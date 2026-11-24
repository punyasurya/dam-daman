import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { Server, Socket } from 'socket.io';
import type { Color } from '../shared/engine/rules';
import { ClientToServer, EMOTES, ServerToClient } from '../shared/protocol';
import { realClock, Room, RoomError, RoomManager } from './rooms';

type Sock = Socket<ClientToServer, ServerToClient, Record<string, never>, { code?: string; seat?: Color; lastEmote?: number }>;

export function startServer(port: number, host = '127.0.0.1') {
  const started = Date.now();
  const http = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, rooms: manager.rooms.size, uptime: Math.round((Date.now() - started) / 1000) }));
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  });

  const io = new Server<ClientToServer, ServerToClient, Record<string, never>, { code?: string; seat?: Color; lastEmote?: number }>(http, {
    serveClient: false,
    cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? false },
    pingInterval: 20000,
    pingTimeout: 20000,
    maxHttpBufferSize: 16 * 1024,
  });

  const broadcast = (room: Room) => {
    for (const color of ['red', 'blue'] as const) {
      const seat = room.seats[color];
      if (!seat) continue;
      const snap = room.snapshotFor(color);
      for (const id of seat.sockets) io.to(id).emit('state', snap);
    }
  };

  const manager = new RoomManager(realClock, broadcast);
  const sweep = setInterval(() => manager.sweep(), 60_000);
  sweep.unref();

  const leaveCurrent = (socket: Sock) => {
    const { code, seat } = socket.data;
    if (!code || !seat) return;
    const room = manager.rooms.get(code);
    socket.data.code = undefined;
    socket.data.seat = undefined;
    room?.detach(seat, socket.id);
  };

  const guard = <A extends unknown[]>(socket: Sock, fn: (room: Room, seat: Color, ...args: A) => void) =>
    (...args: [...A, (r: { ok: true } | { ok: false; error: string }) => void]) => {
      const ack = args[args.length - 1] as (r: { ok: true } | { ok: false; error: string }) => void;
      const safeAck = typeof ack === 'function' ? ack : () => {};
      try {
        const { code, seat } = socket.data;
        const room = code ? manager.rooms.get(code) : undefined;
        if (!room || !seat) throw new RoomError('Kamu belum masuk room');
        fn(room, seat, ...(args.slice(0, -1) as A));
        safeAck({ ok: true });
      } catch (e) {
        safeAck({ ok: false, error: e instanceof RoomError ? e.message : 'Terjadi kesalahan di server' });
        if (!(e instanceof RoomError)) console.error(e);
      }
    };

  io.on('connection', (socket: Sock) => {
    socket.on('create', (p, ack) => {
      try {
        leaveCurrent(socket);
        const { room, seat, token } = manager.create(socket.id, p?.name, p?.avatar, p?.settings);
        socket.data.code = room.code;
        socket.data.seat = seat;
        ack({ ok: true, code: room.code, token });
        broadcast(room);
      } catch (e) {
        ack({ ok: false, error: e instanceof RoomError ? e.message : 'Gagal membuat room' });
      }
    });

    socket.on('join', (p, ack) => {
      try {
        leaveCurrent(socket);
        const { room, seat, token } = manager.join(socket.id, p?.code, p?.name, p?.avatar, p?.token);
        socket.data.code = room.code;
        socket.data.seat = seat;
        ack({ ok: true, code: room.code, token });
        broadcast(room);
      } catch (e) {
        ack({ ok: false, error: e instanceof RoomError ? e.message : 'Gagal bergabung' });
      }
    });

    socket.on('updateSettings', guard(socket, (room, seat, s: unknown) => room.updateSettings(seat, s)));
    socket.on('start', guard(socket, (room, seat) => room.start(seat)));
    socket.on('action', guard(socket, (room, seat, a: unknown) => {
      const act = a as { type?: string; from?: unknown; path?: unknown; targets?: unknown };
      const ints = (v: unknown) => Array.isArray(v) && v.length <= 40 && v.every((x) => Number.isInteger(x) && x >= 0 && x < 37);
      if (act?.type === 'move' && Number.isInteger(act.from) && ints(act.path)) {
        room.act(seat, { type: 'move', from: act.from as number, path: act.path as number[] });
      } else if (act?.type === 'dam' && ints(act.targets)) {
        room.act(seat, { type: 'dam', targets: act.targets as number[] });
      } else throw new RoomError('Aksi tidak dikenal');
    }));
    socket.on('resign', guard(socket, (room, seat) => room.resign(seat)));
    socket.on('offerDraw', guard(socket, (room, seat) => room.offerDraw(seat)));
    socket.on('answerDraw', guard(socket, (room, seat, accept: unknown) => room.answerDraw(seat, accept === true)));
    socket.on('rematch', guard(socket, (room, seat) => room.requestRematch(seat)));

    socket.on('emote', (index) => {
      const { code, seat } = socket.data;
      const room = code ? manager.rooms.get(code) : undefined;
      if (!room || !seat || !Number.isInteger(index) || index < 0 || index >= EMOTES.length) return;
      const now = Date.now();
      if (socket.data.lastEmote && now - socket.data.lastEmote < 1500) return;
      socket.data.lastEmote = now;
      for (const c of ['red', 'blue'] as const) for (const id of room.seats[c]?.sockets ?? []) io.to(id).emit('emote', { from: seat, index });
    });

    socket.on('leave', () => {
      const { code, seat } = socket.data;
      const room = code ? manager.rooms.get(code) : undefined;
      leaveCurrent(socket);
      // Tamu yang keluar sebelum mulai mengosongkan kursinya.
      if (room && seat === 'blue' && room.phase === 'menunggu' && !room.seats.blue?.sockets.size) {
        room.seats.blue = null;
        room.touch();
      }
    });

    socket.on('disconnect', () => leaveCurrent(socket));
  });

  http.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} di ${host} sudah dipakai aplikasi lain. Ganti PORT di service dan proxy Apache.`);
    } else {
      console.error('Server gagal berjalan:', err);
    }
    process.exit(1);
  });
  http.listen(port, host);
  return { http, io, manager, close: () => new Promise<void>((r) => io.close(() => r())) };
}

const isMain = process.argv[1] && /main\.(ts|mjs|js)$|server\.mjs$/.test(process.argv[1]);
if (isMain) {
  const port = Number(process.env.PORT ?? 3747);
  const host = process.env.HOST ?? '127.0.0.1';
  startServer(port, host);
  console.log(`Server Dam-Daman berjalan di http://${host}:${port}`);
}
