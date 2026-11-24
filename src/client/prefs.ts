import { useSyncExternalStore } from 'react';
import type { Level } from '../shared/ai/search';
import { DEFAULT_SETTINGS, Settings } from '../shared/engine/rules';
import { AvatarKind, isAvatar, RoomSettings } from '../shared/protocol';
import { audio } from './audio/audio';

export interface Prefs {
  name: string;
  avatar: AvatarKind;
  level: Level;
  rules: Settings;
  turnSeconds: RoomSettings['turnSeconds'];
  firstMove: RoomSettings['firstMove'];
  musicOn: boolean;
  sfxOn: boolean;
  musicVolume: number;
  sfxVolume: number;
  vibrate: boolean;
  seenTutorial: boolean;
}

const KEY = 'damdaman:prefs:v1';

const defaults: Prefs = {
  name: '',
  avatar: 'kucing',
  level: 'sedang',
  rules: DEFAULT_SETTINGS,
  turnSeconds: 60,
  firstMove: 'undi',
  musicOn: true,
  sfxOn: true,
  musicVolume: 0.35,
  sfxVolume: 0.8,
  vibrate: true,
  seenTutorial: false,
};

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const p = { ...defaults, ...JSON.parse(raw) } as Prefs;
    if (!isAvatar(p.avatar)) p.avatar = 'kucing';
    p.rules = { ...DEFAULT_SETTINGS, ...p.rules };
    return p;
  } catch {
    return defaults;
  }
}

let current = load();
const listeners = new Set<() => void>();
audio.setPrefs(current);

export function setPrefs(patch: Partial<Prefs>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* penyimpanan bisa diblokir, abaikan */
  }
  audio.setPrefs(current);
  listeners.forEach((l) => l());
}

export function getPrefs() {
  return current;
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

export function roomSettingsFromPrefs(p: Prefs): RoomSettings {
  return { rules: p.rules, turnSeconds: p.turnSeconds, firstMove: p.firstMove };
}

const TOKEN_KEY = (code: string) => `damdaman:token:${code}`;
export function saveToken(code: string, token: string) {
  try {
    localStorage.setItem(TOKEN_KEY(code), token);
  } catch {
    /* abaikan */
  }
}
export function loadToken(code: string): string | undefined {
  try {
    return localStorage.getItem(TOKEN_KEY(code)) ?? undefined;
  } catch {
    return undefined;
  }
}
