import { POINTS, POINT_COUNT, RAYS } from './board';

export type Color = 'red' | 'blue';

export interface Piece {
  /** Id unik selama satu game, dipakai untuk animasi. */
  readonly id: number;
  readonly color: Color;
  readonly raja: boolean;
}

export type Cell = Piece | null;

export type RuleMode = 'tradisional' | 'wajib';
export type RajaMode = 'terbang' | 'ganjil' | 'tanpa';

export interface Settings {
  /** tradisional: makan tidak dipaksa, lalai bisa kena DAM. wajib: harus makan bila bisa. */
  mode: RuleMode;
  /** Jumlah bidak yang diambil saat DAM (mode tradisional). */
  damPenalty: 1 | 2 | 3;
  raja: RajaMode;
  /** Seri bila sekian langkah (total kedua pemain) berlalu tanpa ada yang makan. */
  drawPlies: number;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'tradisional',
  damPenalty: 3,
  raja: 'terbang',
  drawPlies: 100,
};

export interface Move {
  from: number;
  /** Titik pendaratan berurutan. Jalan biasa: satu titik. */
  path: number[];
  /** Titik bidak lawan yang dimakan, sejajar dengan path. */
  captures: number[];
  /** true bila tidak ada lagi yang bisa dimakan di akhir langkah ini. */
  complete: boolean;
}

export interface DamClaim {
  claimant: Color;
  count: number;
}

export type ResultReason =
  | 'habis' // bidak lawan habis
  | 'buntu' // lawan tidak bisa jalan
  | 'menyerah'
  | 'waktu' // kehabisan waktu berkali-kali
  | 'terputus' // keluar dari room terlalu lama
  | 'seri-langkah'
  | 'seri-ulang'
  | 'seri-sepakat';

export interface GameResult {
  winner: Color | null;
  reason: ResultReason;
}

export type LastAction =
  | { kind: 'move'; by: Color; move: Move; promoted: boolean; lalai: boolean }
  | { kind: 'dam'; by: Color; targets: number[] };

export interface GameState {
  board: Cell[];
  turn: Color;
  settings: Settings;
  damClaim: DamClaim | null;
  pliesSinceCapture: number;
  plies: number;
  positions: Record<string, number>;
  result: GameResult | null;
  last: LastAction | null;
  nextPieceId: number;
  stats: Record<Color, { captured: number; longestChain: number; dams: number; lalai: number }>;
}

export type Action =
  | { type: 'move'; from: number; path: number[] }
  | { type: 'dam'; targets: number[] };

export const other = (c: Color): Color => (c === 'red' ? 'blue' : 'red');

/** Baris terluar milik lawan; bidak yang berhenti di sini naik jadi raja. */
export const rajaRow = (c: Color): number => (c === 'red' ? 0 : 8);

export function initialBoard(): Cell[] {
  const board: Cell[] = new Array(POINT_COUNT).fill(null);
  let id = 1;
  for (const p of POINTS) {
    if (p.r <= 3) board[p.id] = { id: id++, color: 'blue', raja: false };
    else if (p.r >= 5) board[p.id] = { id: id++, color: 'red', raja: false };
  }
  return board;
}

export function createGame(settings: Partial<Settings> = {}, first: Color = 'red'): GameState {
  const s: Settings = { ...DEFAULT_SETTINGS, ...settings };
  const state: GameState = {
    board: initialBoard(),
    turn: first,
    settings: s,
    damClaim: null,
    pliesSinceCapture: 0,
    plies: 0,
    positions: {},
    result: null,
    last: null,
    nextPieceId: 100,
    stats: {
      red: { captured: 0, longestChain: 0, dams: 0, lalai: 0 },
      blue: { captured: 0, longestChain: 0, dams: 0, lalai: 0 },
    },
  };
  state.positions[positionKey(state)] = 1;
  return state;
}

export function positionKey(s: Pick<GameState, 'board' | 'turn' | 'damClaim'>): string {
  let k = '';
  for (const cell of s.board) k += cell ? (cell.color === 'red' ? (cell.raja ? 'R' : 'r') : cell.raja ? 'B' : 'b') : '.';
  k += s.turn === 'red' ? 'r' : 'b';
  if (s.damClaim) k += s.damClaim.claimant[0] + s.damClaim.count;
  return k;
}

export function countPieces(board: readonly Cell[], color: Color): number {
  let n = 0;
  for (const cell of board) if (cell && cell.color === color) n++;
  return n;
}

function isForwardOrSideways(color: Color, from: number, to: number): boolean {
  const rf = POINTS[from].r;
  const rt = POINTS[to].r;
  return color === 'red' ? rt <= rf : rt >= rf;
}

/** Semua langkah makan beruntun untuk satu bidak (termasuk berhenti di tengah). */
function captureSequences(board: Cell[], from: number, piece: Piece, settings: Settings): Move[] {
  const out: Move[] = [];
  const flying = piece.raja && settings.raja === 'terbang';
  const work = board.slice();
  work[from] = null;

  const jumpsFrom = (pos: number): Array<{ cap: number; land: number }> => {
    const res: Array<{ cap: number; land: number }> = [];
    for (const ray of RAYS[pos]) {
      if (flying) {
        let i = 0;
        while (i < ray.length && work[ray[i]] === null) i++;
        if (i >= ray.length) continue;
        const target = work[ray[i]];
        if (!target || target.color === piece.color) continue;
        for (let j = i + 1; j < ray.length && work[ray[j]] === null; j++) res.push({ cap: ray[i], land: ray[j] });
      } else if (ray.length >= 2) {
        const target = work[ray[0]];
        if (target && target.color !== piece.color && work[ray[1]] === null) res.push({ cap: ray[0], land: ray[1] });
      }
    }
    return res;
  };

  const dfs = (pos: number, path: number[], caps: number[]) => {
    const jumps = jumpsFrom(pos);
    if (caps.length > 0) out.push({ from, path: path.slice(), captures: caps.slice(), complete: jumps.length === 0 });
    for (const { cap, land } of jumps) {
      const captured = work[cap];
      work[cap] = null;
      path.push(land);
      caps.push(cap);
      dfs(land, path, caps);
      caps.pop();
      path.pop();
      work[cap] = captured;
    }
  };

  dfs(from, [], []);
  return out;
}

function simpleMoves(board: readonly Cell[], from: number, piece: Piece, settings: Settings): Move[] {
  const out: Move[] = [];
  if (!piece.raja) {
    for (const ray of RAYS[from]) {
      const to = ray[0];
      if (board[to] === null && isForwardOrSideways(piece.color, from, to)) {
        out.push({ from, path: [to], captures: [], complete: true });
      }
    }
    return out;
  }
  for (const ray of RAYS[from]) {
    for (let i = 0; i < ray.length && board[ray[i]] === null; i++) {
      const steps = i + 1;
      if (settings.raja === 'ganjil' && steps % 2 === 0) continue;
      out.push({ from, path: [ray[i]], captures: [], complete: true });
    }
  }
  return out;
}

export function hasAnyCapture(board: Cell[], color: Color, settings: Settings): boolean {
  for (let p = 0; p < board.length; p++) {
    const piece = board[p];
    if (piece && piece.color === color && captureSequences(board, p, piece, settings).length > 0) return true;
  }
  return false;
}

export function legalMovesFor(board: Cell[], color: Color, settings: Settings): Move[] {
  const captures: Move[] = [];
  const simple: Move[] = [];
  for (let p = 0; p < board.length; p++) {
    const piece = board[p];
    if (!piece || piece.color !== color) continue;
    captures.push(...captureSequences(board, p, piece, settings));
    simple.push(...simpleMoves(board, p, piece, settings));
  }
  if (settings.mode === 'wajib') {
    const full = captures.filter((m) => m.complete);
    return full.length > 0 ? full : simple;
  }
  return [...captures, ...simple];
}

export function legalMoves(state: GameState): Move[] {
  if (state.result) return [];
  return legalMovesFor(state.board, state.turn, state.settings);
}

/** Langkah yang dianggap lalai: bisa makan tapi tidak makan, atau berhenti ngeracik terlalu cepat. */
export function moveIsLalai(move: Move, anyCaptureAvailable: boolean): boolean {
  if (move.captures.length === 0) return anyCaptureAvailable;
  return !move.complete;
}

export function sameMove(a: { from: number; path: readonly number[] }, b: { from: number; path: readonly number[] }): boolean {
  return a.from === b.from && a.path.length === b.path.length && a.path.every((p, i) => p === b.path[i]);
}

export class IllegalActionError extends Error {}

function cloneState(s: GameState): GameState {
  return {
    ...s,
    board: s.board.slice(),
    positions: { ...s.positions },
    stats: { red: { ...s.stats.red }, blue: { ...s.stats.blue } },
  };
}

/** Pilihan bidak lawan yang sah untuk DAM, sesuai jumlah hukuman. */
export function damTargetCount(state: GameState): number {
  if (!state.damClaim || state.damClaim.claimant !== state.turn) return 0;
  return Math.min(state.damClaim.count, countPieces(state.board, other(state.turn)));
}

export function applyAction(state: GameState, action: Action): GameState {
  if (state.result) throw new IllegalActionError('Permainan sudah selesai');
  if (action.type === 'dam') return applyDam(state, action.targets);
  return applyMove(state, action.from, action.path);
}

function applyDam(state: GameState, targets: number[]): GameState {
  const need = damTargetCount(state);
  if (need === 0) throw new IllegalActionError('Tidak ada DAM yang bisa diklaim');
  const unique = new Set(targets);
  if (unique.size !== targets.length || targets.length !== need) {
    throw new IllegalActionError(`Pilih tepat ${need} bidak lawan`);
  }
  const opp = other(state.turn);
  for (const t of targets) {
    const cell = state.board[t];
    if (!cell || cell.color !== opp) throw new IllegalActionError('Target DAM harus bidak lawan');
  }
  const s = cloneState(state);
  for (const t of targets) s.board[t] = null;
  s.damClaim = null;
  s.stats[s.turn].dams += 1;
  s.stats[s.turn].captured += targets.length;
  s.pliesSinceCapture = 0;
  s.last = { kind: 'dam', by: s.turn, targets: targets.slice() };
  if (countPieces(s.board, opp) === 0) s.result = { winner: s.turn, reason: 'habis' };
  return s;
}

function applyMove(state: GameState, from: number, path: number[]): GameState {
  const legal = legalMoves(state);
  const move = legal.find((m) => sameMove(m, { from, path }));
  if (!move) throw new IllegalActionError('Langkah tidak sah');

  const mover = state.turn;
  const anyCapture = state.settings.mode === 'tradisional' ? hasAnyCapture(state.board, mover, state.settings) : false;
  const lalai = state.settings.mode === 'tradisional' && moveIsLalai(move, anyCapture);

  const s = cloneState(state);
  const piece = s.board[move.from]!;
  s.board[move.from] = null;
  for (const cap of move.captures) s.board[cap] = null;
  const dest = move.path[move.path.length - 1];
  let promoted = false;
  let placed: Piece = piece;
  if (!piece.raja && s.settings.raja !== 'tanpa' && POINTS[dest].r === rajaRow(mover)) {
    placed = { ...piece, raja: true };
    promoted = true;
  }
  s.board[dest] = placed;

  s.plies += 1;
  s.pliesSinceCapture = move.captures.length > 0 ? 0 : s.pliesSinceCapture + 1;
  s.stats[mover].captured += move.captures.length;
  s.stats[mover].longestChain = Math.max(s.stats[mover].longestChain, move.captures.length);
  if (lalai) s.stats[mover].lalai += 1;

  s.damClaim = lalai && s.settings.damPenalty > 0 ? { claimant: other(mover), count: s.settings.damPenalty } : null;
  s.turn = other(mover);
  s.last = { kind: 'move', by: mover, move, promoted, lalai };

  const key = positionKey(s);
  s.positions[key] = (s.positions[key] ?? 0) + 1;

  const opp = other(mover);
  if (countPieces(s.board, opp) === 0) {
    s.result = { winner: mover, reason: 'habis' };
  } else if (legalMovesFor(s.board, opp, s.settings).length === 0) {
    s.result = { winner: mover, reason: 'buntu' };
  } else if (s.positions[key] >= 3) {
    s.result = { winner: null, reason: 'seri-ulang' };
  } else if (s.pliesSinceCapture >= s.settings.drawPlies) {
    s.result = { winner: null, reason: 'seri-langkah' };
  }
  return s;
}

export function endGame(state: GameState, result: GameResult): GameState {
  if (state.result) return state;
  return { ...state, result };
}

/** Langkah sah yang dimulai dari titik tertentu. */
export function movesFrom(state: GameState, from: number): Move[] {
  return legalMoves(state).filter((m) => m.from === from);
}
