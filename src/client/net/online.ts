import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Action } from '../../shared/engine/rules';
import type { AvatarKind, ClientToServer, RoomSettings, RoomSnapshot, ServerToClient } from '../../shared/protocol';
import { loadToken, saveToken } from '../prefs';

export type ConnStatus = 'idle' | 'connecting' | 'online' | 'reconnecting';

export interface EmoteEvent {
  from: 'red' | 'blue';
  index: number;
  at: number;
}

interface OnlineState {
  status: ConnStatus;
  snapshot: RoomSnapshot | null;
  clockOffset: number;
  emote: EmoteEvent | null;
}

type Listener = () => void;

class OnlineClient {
  private socket: Socket<ServerToClient, ClientToServer> | null = null;
  private listeners = new Set<Listener>();
  private me: { name: string; avatar: AvatarKind } = { name: 'Pemain', avatar: 'kucing' };
  state: OnlineState = { status: 'idle', snapshot: null, clockOffset: 0, emote: null };

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }

  private set(patch: Partial<OnlineState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  private ensure(): Socket<ServerToClient, ClientToServer> {
    if (this.socket) return this.socket;
    const s: Socket<ServerToClient, ClientToServer> = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
    });
    this.socket = s;
    this.set({ status: 'connecting' });
    s.on('connect', () => {
      this.set({ status: 'online' });
      // Sambung ulang ke room yang sedang dibuka
      const code = this.state.snapshot?.code;
      if (code) {
        s.emit('join', { code, name: this.me.name, avatar: this.me.avatar, token: loadToken(code) }, (res) => {
          if (!res.ok) this.set({ snapshot: null });
        });
      }
    });
    s.on('disconnect', () => this.set({ status: 'reconnecting' }));
    s.io.on('reconnect_attempt', () => this.set({ status: 'reconnecting' }));
    s.on('state', (snap) => this.set({ snapshot: snap, clockOffset: snap.serverNow - Date.now() }));
    s.on('emote', (e) => this.set({ emote: { ...e, at: Date.now() } }));
    return s;
  }

  private waitConnected(): Promise<Socket<ServerToClient, ClientToServer>> {
    const s = this.ensure();
    if (s.connected) return Promise.resolve(s);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        s.off('connect', ok);
        reject(new Error('Tidak bisa terhubung ke server. Cek koneksi internet.'));
      }, 8000);
      const ok = () => {
        clearTimeout(timer);
        resolve(s);
      };
      s.once('connect', ok);
    });
  }

  async create(name: string, avatar: AvatarKind, settings: RoomSettings): Promise<string> {
    this.me = { name, avatar };
    const s = await this.waitConnected();
    return new Promise((resolve, reject) => {
      s.emit('create', { name, avatar, settings }, (res) => {
        if (!res.ok) return reject(new Error(res.error));
        saveToken(res.code, res.token);
        resolve(res.code);
      });
    });
  }

  async join(code: string, name: string, avatar: AvatarKind): Promise<string> {
    this.me = { name, avatar };
    const s = await this.waitConnected();
    const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return new Promise((resolve, reject) => {
      s.emit('join', { code: clean, name, avatar, token: loadToken(clean) }, (res) => {
        if (!res.ok) return reject(new Error(res.error));
        saveToken(res.code, res.token);
        resolve(res.code);
      });
    });
  }

  private call(ev: 'start' | 'resign' | 'offerDraw' | 'rematch'): Promise<void> {
    const s = this.ensure();
    return new Promise((resolve, reject) => s.emit(ev, (res) => (res.ok ? resolve() : reject(new Error(res.error)))));
  }

  start = () => this.call('start');
  resign = () => this.call('resign');
  offerDraw = () => this.call('offerDraw');
  rematch = () => this.call('rematch');

  answerDraw(accept: boolean): Promise<void> {
    const s = this.ensure();
    return new Promise((resolve, reject) => s.emit('answerDraw', accept, (res) => (res.ok ? resolve() : reject(new Error(res.error)))));
  }

  updateSettings(settings: RoomSettings): Promise<void> {
    const s = this.ensure();
    return new Promise((resolve, reject) => s.emit('updateSettings', settings, (res) => (res.ok ? resolve() : reject(new Error(res.error)))));
  }

  act(action: Action): Promise<void> {
    const s = this.ensure();
    return new Promise((resolve, reject) => s.emit('action', action, (res) => (res.ok ? resolve() : reject(new Error(res.error)))));
  }

  emote(index: number) {
    this.socket?.emit('emote', index);
  }

  leave() {
    this.socket?.emit('leave');
    this.set({ snapshot: null, emote: null });
  }
}

export const online = new OnlineClient();

export function useOnline(): OnlineState {
  const [state, setState] = useState(online.state);
  useEffect(() => online.subscribe(() => setState(online.state)), []);
  return state;
}
