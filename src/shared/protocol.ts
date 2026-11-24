import type { Action, Color, GameState, Settings } from './engine/rules';

export const AVATARS = ['kucing', 'orangutan', 'komodo', 'jalak', 'gajah', 'harimau', 'kancil', 'kura'] as const;
export type AvatarKind = (typeof AVATARS)[number];

export const AVATAR_NAMES: Record<AvatarKind, string> = {
  kucing: 'Kucing',
  orangutan: 'Orangutan',
  komodo: 'Komodo',
  jalak: 'Jalak Bali',
  gajah: 'Gajah',
  harimau: 'Harimau',
  kancil: 'Kancil',
  kura: 'Kura-kura',
};

export const EMOTES = ['Halo!', 'Mantap!', 'Waduh!', 'Hehe', 'Ayo cepat', 'Main lagi?'] as const;

export type TurnSeconds = 0 | 30 | 60 | 120;
export type FirstMove = 'undi' | 'merah' | 'biru';

export interface RoomSettings {
  rules: Settings;
  turnSeconds: TurnSeconds;
  firstMove: FirstMove;
}

export interface PlayerInfo {
  name: string;
  avatar: AvatarKind;
  connected: boolean;
}

export type RoomPhase = 'menunggu' | 'main' | 'selesai';

export interface RoomSnapshot {
  code: string;
  you: Color;
  host: Color;
  players: Record<Color, PlayerInfo | null>;
  settings: RoomSettings;
  phase: RoomPhase;
  game: GameState | null;
  /** Batas waktu giliran (epoch ms, jam server). */
  turnDeadline: number | null;
  serverNow: number;
  strikes: Record<Color, number>;
  drawOffer: Color | null;
  rematch: Record<Color, boolean>;
  score: Record<Color, number>;
}

export type Ack<T = object> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void;

export interface ClientToServer {
  create: (p: { name: string; avatar: AvatarKind; settings: RoomSettings }, ack: Ack<{ code: string; token: string }>) => void;
  join: (p: { code: string; name: string; avatar: AvatarKind; token?: string }, ack: Ack<{ code: string; token: string }>) => void;
  updateSettings: (s: RoomSettings, ack: Ack) => void;
  start: (ack: Ack) => void;
  action: (a: Action, ack: Ack) => void;
  resign: (ack: Ack) => void;
  offerDraw: (ack: Ack) => void;
  answerDraw: (accept: boolean, ack: Ack) => void;
  rematch: (ack: Ack) => void;
  emote: (index: number) => void;
  leave: () => void;
}

export interface ServerToClient {
  state: (s: RoomSnapshot) => void;
  emote: (p: { from: Color; index: number }) => void;
}

export const sanitizeName = (raw: unknown): string => {
  const s = typeof raw === 'string' ? raw : '';
  const clean = s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
  return clean || 'Pemain';
};

export const isAvatar = (v: unknown): v is AvatarKind => typeof v === 'string' && (AVATARS as readonly string[]).includes(v);
