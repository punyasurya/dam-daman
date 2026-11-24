import { randomBytes, randomInt } from 'node:crypto';
import {
  Action,
  applyAction,
  Color,
  createGame,
  DEFAULT_SETTINGS,
  endGame,
  GameState,
  IllegalActionError,
  legalMoves,
  other,
  Settings,
} from '../shared/engine/rules';
import { AvatarKind, isAvatar, PlayerInfo, RoomSettings, RoomSnapshot, sanitizeName } from '../shared/protocol';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const MAX_STRIKES = 3;
export const DISCONNECT_GRACE_MS = 120_000;
export const IDLE_ROOM_MS = 30 * 60_000;
export const MAX_ROOMS = 5000;

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

interface Seat {
  info: PlayerInfo;
  token: string;
  sockets: Set<string>;
}

export class RoomError extends Error {}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  rules: DEFAULT_SETTINGS,
  turnSeconds: 60,
  firstMove: 'undi',
};

export function sanitizeSettings(raw: unknown): RoomSettings {
  const r = (raw ?? {}) as Partial<RoomSettings>;
  const rules = (r.rules ?? {}) as Partial<Settings>;
  const mode = rules.mode === 'wajib' ? 'wajib' : 'tradisional';
  const damPenalty = rules.damPenalty === 1 || rules.damPenalty === 2 ? rules.damPenalty : 3;
  const raja = rules.raja === 'ganjil' || rules.raja === 'tanpa' ? rules.raja : 'terbang';
  const turnSeconds = r.turnSeconds === 0 || r.turnSeconds === 30 || r.turnSeconds === 120 ? r.turnSeconds : 60;
  const firstMove = r.firstMove === 'merah' || r.firstMove === 'biru' ? r.firstMove : 'undi';
  return { rules: { mode, damPenalty, raja, drawPlies: DEFAULT_SETTINGS.drawPlies }, turnSeconds, firstMove };
}

export class Room {
  readonly code: string;
  readonly host: Color = 'red';
  seats: Record<Color, Seat | null> = { red: null, blue: null };
  settings: RoomSettings;
  phase: RoomSnapshot['phase'] = 'menunggu';
  game: GameState | null = null;
  turnDeadline: number | null = null;
  strikes: Record<Color, number> = { red: 0, blue: 0 };
  drawOffer: Color | null = null;
  rematch: Record<Color, boolean> = { red: false, blue: false };
  score: Record<Color, number> = { red: 0, blue: 0 };
  lastFirst: Color | null = null;
  lastActivity: number;
  private turnTimer: unknown = null;
  private dcTimers: Record<Color, unknown> = { red: null, blue: null };

  constructor(code: string, settings: RoomSettings, private clock: Clock, private onChange: (room: Room) => void) {
    this.code = code;
    this.settings = settings;
    this.lastActivity = clock.now();
  }

  snapshotFor(you: Color): RoomSnapshot {
    const info = (c: Color) => (this.seats[c] ? { ...this.seats[c]!.info } : null);
    return {
      code: this.code,
      you,
      host: this.host,
      players: { red: info('red'), blue: info('blue') },
      settings: this.settings,
      phase: this.phase,
      game: this.game,
      turnDeadline: this.turnDeadline,
      serverNow: this.clock.now(),
      strikes: { ...this.strikes },
      drawOffer: this.drawOffer,
      rematch: { ...this.rematch },
      score: { ...this.score },
    };
  }

  seatOfToken(token: string | undefined): Color | null {
    if (!token) return null;
    for (const c of ['red', 'blue'] as const) if (this.seats[c]?.token === token) return c;
    return null;
  }

  isEmpty(): boolean {
    return !this.seats.red?.sockets.size && !this.seats.blue?.sockets.size;
  }

  attach(seat: Color, socketId: string, name: string, avatar: AvatarKind) {
    const s = this.seats[seat]!;
    s.sockets.add(socketId);
    s.info = { name, avatar, connected: true };
    if (this.dcTimers[seat]) {
      this.clock.clearTimeout(this.dcTimers[seat]);
      this.dcTimers[seat] = null;
    }
    this.touch();
  }

  detach(seat: Color, socketId: string) {
    const s = this.seats[seat];
    if (!s) return;
    s.sockets.delete(socketId);
    if (s.sockets.size > 0) return;
    s.info = { ...s.info, connected: false };
    if (this.phase === 'main') {
      this.dcTimers[seat] = this.clock.setTimeout(() => {
        this.dcTimers[seat] = null;
        if (this.phase === 'main' && !this.seats[seat]?.info.connected) this.finish({ winner: other(seat), reason: 'terputus' });
      }, DISCONNECT_GRACE_MS);
    }
    this.touch();
  }

  touch() {
    this.lastActivity = this.clock.now();
    this.onChange(this);
  }

  updateSettings(by: Color, settings: unknown) {
    if (by !== this.host) throw new RoomError('Hanya host yang bisa mengubah aturan');
    if (this.phase === 'main') throw new RoomError('Aturan tidak bisa diubah saat bermain');
    this.settings = sanitizeSettings(settings);
    this.touch();
  }

  start(by: Color) {
    if (by !== this.host) throw new RoomError('Hanya host yang bisa memulai');
    if (this.phase === 'main') throw new RoomError('Permainan sudah berjalan');
    if (!this.seats.red || !this.seats.blue) throw new RoomError('Tunggu lawan bergabung dulu');
    this.begin();
  }

  private begin() {
    let first: Color;
    if (this.lastFirst) first = other(this.lastFirst);
    else if (this.settings.firstMove === 'merah') first = 'red';
    else if (this.settings.firstMove === 'biru') first = 'blue';
    else first = randomInt(2) === 0 ? 'red' : 'blue';
    this.lastFirst = first;
    this.game = createGame(this.settings.rules, first);
    this.phase = 'main';
    this.strikes = { red: 0, blue: 0 };
    this.drawOffer = null;
    this.rematch = { red: false, blue: false };
    this.armTurnTimer();
    this.touch();
  }

  act(by: Color, action: Action, auto = false) {
    if (this.phase !== 'main' || !this.game) throw new RoomError('Permainan belum dimulai');
    if (this.game.turn !== by) throw new RoomError('Bukan giliranmu');
    try {
      this.game = applyAction(this.game, action);
    } catch (e) {
      if (e instanceof IllegalActionError) throw new RoomError(e.message);
      throw e;
    }
    if (!auto) this.strikes[by] = 0;
    if (this.drawOffer && action.type === 'move') this.drawOffer = null;
    if (this.game.result) this.finish(this.game.result);
    else {
      this.armTurnTimer();
      this.touch();
    }
  }

  resign(by: Color) {
    if (this.phase !== 'main') throw new RoomError('Tidak sedang bermain');
    this.finish({ winner: other(by), reason: 'menyerah' });
  }

  offerDraw(by: Color) {
    if (this.phase !== 'main') throw new RoomError('Tidak sedang bermain');
    this.drawOffer = by;
    this.touch();
  }

  answerDraw(by: Color, accept: boolean) {
    if (this.phase !== 'main' || this.drawOffer !== other(by)) throw new RoomError('Tidak ada tawaran seri');
    if (accept) this.finish({ winner: null, reason: 'seri-sepakat' });
    else {
      this.drawOffer = null;
      this.touch();
    }
  }

  requestRematch(by: Color) {
    if (this.phase !== 'selesai') throw new RoomError('Permainan belum selesai');
    this.rematch[by] = true;
    if (this.rematch.red && this.rematch.blue && this.seats.red && this.seats.blue) this.begin();
    else this.touch();
  }

  private finish(result: NonNullable<GameState['result']>) {
    if (this.game) this.game = endGame(this.game, result);
    if (result.winner) this.score[result.winner] += 1;
    this.phase = 'selesai';
    this.turnDeadline = null;
    this.drawOffer = null;
    if (this.turnTimer) this.clock.clearTimeout(this.turnTimer);
    this.turnTimer = null;
    this.touch();
  }

  private armTurnTimer() {
    if (this.turnTimer) this.clock.clearTimeout(this.turnTimer);
    this.turnTimer = null;
    this.turnDeadline = null;
    if (!this.game || this.game.result || this.settings.turnSeconds === 0) return;
    const ms = this.settings.turnSeconds * 1000;
    this.turnDeadline = this.clock.now() + ms;
    this.turnTimer = this.clock.setTimeout(() => this.onTimeout(), ms);
  }

  /** Waktu habis: langkah otomatis, dan kalah setelah 3 kali berturut-turut. */
  onTimeout() {
    this.turnTimer = null;
    if (this.phase !== 'main' || !this.game) return;
    const who = this.game.turn;
    this.strikes[who] += 1;
    if (this.strikes[who] >= MAX_STRIKES) {
      this.finish({ winner: other(who), reason: 'waktu' });
      return;
    }
    const moves = legalMoves(this.game);
    const caps = moves.filter((m) => m.captures.length > 0 && m.complete);
    const pool = caps.length > 0 ? caps : moves;
    const m = pool[randomInt(pool.length)];
    this.act(who, { type: 'move', from: m.from, path: m.path }, true);
  }

  dispose() {
    if (this.turnTimer) this.clock.clearTimeout(this.turnTimer);
    for (const c of ['red', 'blue'] as const) if (this.dcTimers[c]) this.clock.clearTimeout(this.dcTimers[c]);
  }
}

export class RoomManager {
  rooms = new Map<string, Room>();

  constructor(private clock: Clock = realClock, private onChange: (room: Room) => void = () => {}) {}

  private newCode(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      for (let i = 0; i < 5; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
    throw new RoomError('Server penuh, coba lagi');
  }

  create(socketId: string, rawName: unknown, rawAvatar: unknown, rawSettings: unknown) {
    this.sweep();
    if (this.rooms.size >= MAX_ROOMS) throw new RoomError('Server sedang penuh, coba lagi sebentar');
    const code = this.newCode();
    const room = new Room(code, sanitizeSettings(rawSettings), this.clock, this.onChange);
    const token = randomBytes(16).toString('hex');
    const name = sanitizeName(rawName);
    const avatar = isAvatar(rawAvatar) ? rawAvatar : 'kucing';
    room.seats.red = { info: { name, avatar, connected: true }, token, sockets: new Set([socketId]) };
    this.rooms.set(code, room);
    return { room, seat: 'red' as Color, token };
  }

  join(socketId: string, rawCode: unknown, rawName: unknown, rawAvatar: unknown, token?: string) {
    const code = typeof rawCode === 'string' ? rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('Room tidak ditemukan. Cek lagi kodenya.');
    const name = sanitizeName(rawName);
    const avatar = isAvatar(rawAvatar) ? rawAvatar : 'kucing';
    const existing = room.seatOfToken(typeof token === 'string' ? token : undefined);
    if (existing) {
      room.attach(existing, socketId, name, avatar);
      return { room, seat: existing, token: room.seats[existing]!.token };
    }
    if (room.seats.blue) throw new RoomError('Room sudah penuh');
    const newToken = randomBytes(16).toString('hex');
    room.seats.blue = { info: { name, avatar, connected: true }, token: newToken, sockets: new Set([socketId]) };
    room.touch();
    return { room, seat: 'blue' as Color, token: newToken };
  }

  /** Hapus room yang sudah lama kosong. */
  sweep() {
    const now = this.clock.now();
    for (const [code, room] of this.rooms) {
      if (room.isEmpty() && now - room.lastActivity > IDLE_ROOM_MS) {
        room.dispose();
        this.rooms.delete(code);
      }
    }
  }
}
