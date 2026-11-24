import type { Level } from '../shared/ai/search';
import { POINT_COUNT } from '../shared/engine/board';
import type { Color, GameState } from '../shared/engine/rules';

/** Permainan lawan komputer atau berdua yang disimpan supaya bisa lanjut setelah halaman dimuat ulang. */
export type SavedGame =
  | { kind: 'ai'; level: Level; game: GameState; first: Color; score: Record<Color, number>; savedAt: number }
  | { kind: 'local'; game: GameState; first: Color; score: Record<Color, number>; savedAt: number };

const KEY = 'damdaman:game:v1';
/** Permainan yang ditinggal lebih dari seminggu tidak dilanjutkan. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LEVELS: Level[] = ['mudah', 'sedang', 'sulit'];

function valid(s: unknown): s is SavedGame {
  if (!s || typeof s !== 'object') return false;
  const v = s as Partial<SavedGame> & { level?: unknown };
  if (v.kind !== 'ai' && v.kind !== 'local') return false;
  if (v.kind === 'ai' && !LEVELS.includes(v.level as Level)) return false;
  const g = v.game as GameState | undefined;
  if (!g || !Array.isArray(g.board) || g.board.length !== POINT_COUNT) return false;
  if (g.turn !== 'red' && g.turn !== 'blue') return false;
  if (!g.settings || !g.stats || !g.positions) return false;
  if (v.first !== 'red' && v.first !== 'blue') return false;
  if (!v.score || typeof v.score.red !== 'number' || typeof v.score.blue !== 'number') return false;
  return typeof v.savedAt === 'number' && Date.now() - v.savedAt < MAX_AGE_MS;
}

export function loadSavedGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s: unknown = JSON.parse(raw);
    if (valid(s)) return s;
    localStorage.removeItem(KEY);
  } catch {
    /* penyimpanan tidak tersedia */
  }
  return null;
}

type SaveInput = SavedGame extends infer T ? (T extends SavedGame ? Omit<T, 'savedAt'> : never) : never;

export function saveGame(s: SaveInput) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, savedAt: Date.now() }));
  } catch {
    /* penyimpanan penuh atau diblokir: permainan tetap jalan */
  }
}

export function clearSavedGame() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* abaikan */
  }
}
