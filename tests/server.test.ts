import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AddressInfo } from 'node:net';
import { io as connect, Socket } from 'socket.io-client';
import { startServer } from '../src/server/main';
import { Clock, DISCONNECT_GRACE_MS, RoomManager } from '../src/server/rooms';
import { legalMoves } from '../src/shared/engine/rules';
import type { RoomSnapshot } from '../src/shared/protocol';

class FakeClock implements Clock {
  t = 1_000_000;
  timers: Array<{ at: number; fn: () => void; id: number }> = [];
  private seq = 0;
  now() {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number) {
    const id = ++this.seq;
    this.timers.push({ at: this.t + ms, fn, id });
    return id;
  }
  clearTimeout(h: unknown) {
    this.timers = this.timers.filter((t) => t.id !== h);
  }
  advance(ms: number) {
    this.t += ms;
    for (;;) {
      const due = this.timers.filter((t) => t.at <= this.t).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.timers = this.timers.filter((t) => t !== due);
      due.fn();
    }
  }
}

const settings = { rules: { mode: 'tradisional', damPenalty: 3, raja: 'terbang', drawPlies: 100 }, turnSeconds: 30, firstMove: 'merah' };

describe('RoomManager', () => {
  it('kehabisan waktu 3 kali berturut-turut berarti kalah', () => {
    const clock = new FakeClock();
    const mgr = new RoomManager(clock);
    const { room } = mgr.create('a', 'Ana', 'kucing', settings);
    mgr.join('b', room.code, 'Budi', 'komodo');
    room.start('red');
    expect(room.game?.turn).toBe('red');
    clock.advance(30_000); // merah timeout, langkah otomatis
    expect(room.strikes.red).toBe(1);
    expect(room.game?.turn).toBe('blue');
    const m = legalMoves(room.game!)[0];
    room.act('blue', { type: 'move', from: m.from, path: m.path });
    clock.advance(30_000);
    const m2 = legalMoves(room.game!)[0];
    room.act('blue', { type: 'move', from: m2.from, path: m2.path });
    clock.advance(30_000);
    expect(room.phase).toBe('selesai');
    expect(room.game?.result).toEqual({ winner: 'blue', reason: 'waktu' });
    expect(room.score.blue).toBe(1);
  });

  it('pemain yang terputus terlalu lama kalah, yang kembali tepat waktu tidak', () => {
    const clock = new FakeClock();
    const mgr = new RoomManager(clock);
    const { room, token } = mgr.create('a', 'Ana', 'kucing', { ...settings, turnSeconds: 0 });
    mgr.join('b', room.code, 'Budi', 'komodo');
    room.start('red');
    room.detach('red', 'a');
    clock.advance(DISCONNECT_GRACE_MS - 1000);
    const again = mgr.join('a2', room.code, 'Ana', 'kucing', token);
    expect(again.seat).toBe('red');
    clock.advance(10_000);
    expect(room.phase).toBe('main');
    room.detach('blue', 'b');
    clock.advance(DISCONNECT_GRACE_MS + 1);
    expect(room.game?.result).toEqual({ winner: 'red', reason: 'terputus' });
  });

  it('rematch bergantian siapa yang jalan duluan', () => {
    const clock = new FakeClock();
    const mgr = new RoomManager(clock);
    const { room } = mgr.create('a', 'Ana', 'kucing', settings);
    mgr.join('b', room.code, 'Budi', 'komodo');
    room.start('red');
    room.resign('blue');
    expect(room.score.red).toBe(1);
    room.requestRematch('red');
    expect(room.phase).toBe('selesai');
    room.requestRematch('blue');
    expect(room.phase).toBe('main');
    expect(room.game?.turn).toBe('blue');
  });

  it('room penuh menolak pemain ketiga', () => {
    const mgr = new RoomManager(new FakeClock());
    const { room } = mgr.create('a', 'Ana', 'kucing', settings);
    mgr.join('b', room.code, 'Budi', 'komodo');
    expect(() => mgr.join('c', room.code, 'Cici', 'gajah')).toThrow('Room sudah penuh');
  });
});

describe('server socket', () => {
  let srv: ReturnType<typeof startServer>;
  let url = '';
  const sockets: Socket[] = [];

  beforeAll(async () => {
    srv = startServer(0);
    await new Promise<void>((r) => srv.http.once('listening', () => r()));
    url = `http://127.0.0.1:${(srv.http.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await srv.close();
  });

  const client = () => {
    const s = connect(url, { transports: ['websocket'], forceNew: true });
    sockets.push(s);
    return s;
  };
  const call = <T>(s: Socket, ev: string, ...args: unknown[]) =>
    new Promise<T>((resolve) => s.emit(ev, ...args, (r: T) => resolve(r)));
  const nextState = (s: Socket, pred: (st: RoomSnapshot) => boolean) =>
    new Promise<RoomSnapshot>((resolve) => {
      const h = (st: RoomSnapshot) => {
        if (pred(st)) {
          s.off('state', h);
          resolve(st);
        }
      };
      s.on('state', h);
    });

  it('alur lengkap: buat room, gabung, main, langkah ilegal ditolak', async () => {
    const a = client();
    const b = client();
    const created = await call<{ ok: boolean; code: string; token: string }>(a, 'create', { name: 'Ana', avatar: 'kucing', settings });
    expect(created.ok).toBe(true);
    expect(created.code).toMatch(/^[A-Z0-9]{5}$/);

    const joinedState = nextState(a, (st) => !!st.players.blue);
    const joined = await call<{ ok: boolean }>(b, 'join', { code: created.code.toLowerCase(), name: 'Budi', avatar: 'komodo' });
    expect(joined.ok).toBe(true);
    expect((await joinedState).players.blue?.name).toBe('Budi');

    const notHost = await call<{ ok: boolean; error?: string }>(b, 'start');
    expect(notHost.ok).toBe(false);

    const playing = nextState(b, (st) => st.phase === 'main');
    expect((await call<{ ok: boolean }>(a, 'start')).ok).toBe(true);
    const st = await playing;
    expect(st.game?.turn).toBe('red');
    expect(st.you).toBe('blue');

    const wrongTurn = await call<{ ok: boolean; error?: string }>(b, 'action', { type: 'move', from: 10, path: [20] });
    expect(wrongTurn).toEqual({ ok: false, error: 'Bukan giliranmu' });

    const bad = await call<{ ok: boolean; error?: string }>(a, 'action', { type: 'move', from: 30, path: [5] });
    expect(bad.ok).toBe(false);

    const m = legalMoves(st.game!)[0];
    const moved = nextState(b, (s) => s.game?.turn === 'blue');
    expect((await call<{ ok: boolean }>(a, 'action', { type: 'move', from: m.from, path: m.path })).ok).toBe(true);
    await moved;

    const resigned = nextState(a, (s) => s.phase === 'selesai');
    await call(b, 'resign');
    expect((await resigned).game?.result).toEqual({ winner: 'red', reason: 'menyerah' });
  });

  it('kode room salah ditolak', async () => {
    const c = client();
    const r = await call<{ ok: boolean; error?: string }>(c, 'join', { code: 'ZZZZZ', name: 'X', avatar: 'kucing' });
    expect(r.ok).toBe(false);
  });

  it('health check', async () => {
    const res = await fetch(`${url}/api/health`);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});
