import { NEIGHBORS, POINTS } from '../engine/board';
import {
  Action,
  Cell,
  Color,
  countPieces,
  damTargetCount,
  GameState,
  legalMoves,
  legalMovesFor,
  Move,
  other,
  rajaRow,
  Settings,
} from '../engine/rules';

export type Level = 'mudah' | 'sedang' | 'sulit';

interface LevelConfig {
  timeMs: number;
  maxDepth: number;
  /** Peluang mengklaim DAM bila tersedia. */
  claimDam: number;
  /** Peluang "lupa" makan dan jalan biasa (mode tradisional). */
  forgetCapture: number;
  /** Peluang memilih langkah kedua/ketiga terbaik. */
  blunder: number;
}

export const LEVELS: Record<Level, LevelConfig> = {
  mudah: { timeMs: 150, maxDepth: 2, claimDam: 0.5, forgetCapture: 0.3, blunder: 0.35 },
  sedang: { timeMs: 700, maxDepth: 6, claimDam: 0.9, forgetCapture: 0.04, blunder: 0.08 },
  sulit: { timeMs: 1800, maxDepth: 16, claimDam: 1, forgetCapture: 0, blunder: 0 },
};

const WIN = 100000;
const CENTER = POINTS.map((p) => (NEIGHBORS[p.id].length === 8 ? 5 : 0));

function rajaValue(settings: Settings): number {
  return settings.raja === 'terbang' ? 300 : settings.raja === 'ganjil' ? 210 : 100;
}

export function evaluate(board: readonly Cell[], color: Color, settings: Settings): number {
  const rv = rajaValue(settings);
  let score = 0;
  for (let p = 0; p < board.length; p++) {
    const cell = board[p];
    if (!cell) continue;
    let v: number;
    if (cell.raja) {
      v = rv + CENTER[p];
    } else {
      const adv = cell.color === 'red' ? 8 - POINTS[p].r : POINTS[p].r;
      v = 100 + adv * 3 + (adv >= 6 ? 12 : 0) + CENTER[p];
    }
    score += cell.color === color ? v : -v;
  }
  return score;
}

/** Bidak lawan yang paling berharga untuk diambil saat DAM. */
export function chooseDamTargets(board: readonly Cell[], claimant: Color, count: number, settings: Settings): number[] {
  const opp = other(claimant);
  const rv = rajaValue(settings);
  const cands: Array<{ p: number; v: number }> = [];
  for (let p = 0; p < board.length; p++) {
    const cell = board[p];
    if (!cell || cell.color !== opp) continue;
    const adv = opp === 'red' ? 8 - POINTS[p].r : POINTS[p].r;
    cands.push({ p, v: (cell.raja ? rv : 100 + adv * 6) + CENTER[p] });
  }
  cands.sort((a, b) => b.v - a.v || a.p - b.p);
  return cands.slice(0, count).map((c) => c.p);
}

function makeMove(board: readonly Cell[], move: Move, settings: Settings): Cell[] {
  const b = board.slice();
  const piece = b[move.from]!;
  b[move.from] = null;
  for (const c of move.captures) b[c] = null;
  const dest = move.path[move.path.length - 1];
  b[dest] = !piece.raja && settings.raja !== 'tanpa' && POINTS[dest].r === rajaRow(piece.color) ? { ...piece, raja: true } : piece;
  return b;
}

function boardKey(board: readonly Cell[], turn: Color, claim: number): string {
  let k = turn === 'red' ? 'r' : 'b';
  k += claim;
  for (const cell of board) k += cell ? (cell.color === 'red' ? (cell.raja ? 'R' : 'r') : cell.raja ? 'B' : 'b') : '.';
  return k;
}

class Timeout extends Error {}

interface TTEntry {
  depth: number;
  score: number;
  flag: 0 | 1 | 2; // 0 exact, 1 lower, 2 upper
  best: string | null;
}

const moveId = (m: Move) => `${m.from}:${m.path.join(',')}`;

/** Langkah yang dipertimbangkan dalam pencarian: kalau ada makan, hanya makan penuh. */
function searchMoves(board: Cell[], turn: Color, settings: Settings): Move[] {
  const all = legalMovesFor(board, turn, settings);
  const caps = all.filter((m) => m.captures.length > 0 && m.complete);
  return caps.length > 0 ? caps : all.filter((m) => m.captures.length === 0);
}

export interface SearchResult {
  move: Move | null;
  score: number;
  depth: number;
  nodes: number;
  ranked: Array<{ move: Move; score: number }>;
}

export function searchBest(state: GameState, timeMs: number, maxDepth: number, now: () => number = Date.now): SearchResult {
  const settings = state.settings;
  const root = state.board.slice();
  const rootTurn = state.turn;
  const deadline = now() + timeMs;
  const tt = new Map<string, TTEntry>();
  let nodes = 0;

  const negamax = (board: Cell[], turn: Color, claim: number, depth: number, alpha: number, beta: number, ply: number): number => {
    nodes++;
    if ((nodes & 255) === 0 && now() > deadline) throw new Timeout();

    if (claim > 0) {
      const n = Math.min(claim, countPieces(board, other(turn)));
      if (n > 0) {
        board = board.slice();
        for (const t of chooseDamTargets(board, turn, n, settings)) board[t] = null;
      }
      if (countPieces(board, other(turn)) === 0) return WIN - ply;
    }

    const moves = searchMoves(board, turn, settings);
    if (moves.length === 0) return -WIN + ply;

    const capturing = moves[0].captures.length > 0;
    if (depth <= 0 && !capturing) return evaluate(board, turn, settings);
    if (depth <= -6) return evaluate(board, turn, settings);

    const key = boardKey(board, turn, 0);
    const entry = tt.get(key);
    if (entry && entry.depth >= depth) {
      if (entry.flag === 0) return entry.score;
      if (entry.flag === 1 && entry.score >= beta) return entry.score;
      if (entry.flag === 2 && entry.score <= alpha) return entry.score;
    }

    const anyCapture = capturing;
    const ordered = moves
      .map((m) => ({ m, k: (entry?.best === moveId(m) ? 1000 : 0) + m.captures.length * 50 }))
      .sort((a, b) => b.k - a.k);

    const alpha0 = alpha;
    let best = -Infinity;
    let bestId: string | null = null;
    for (const { m } of ordered) {
      const next = makeMove(board, m, settings);
      const lalai = settings.mode === 'tradisional' && m.captures.length === 0 && anyCapture;
      const score = -negamax(next, other(turn), lalai ? settings.damPenalty : 0, depth - 1, -beta, -alpha, ply + 1);
      if (score > best) {
        best = score;
        bestId = moveId(m);
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    tt.set(key, { depth, score: best, flag: best <= alpha0 ? 2 : best >= beta ? 1 : 0, best: bestId });
    return best;
  };

  let rootMoves = searchMoves(root, rootTurn, settings);
  let result: SearchResult = { move: rootMoves[0] ?? null, score: 0, depth: 0, nodes: 0, ranked: [] };
  if (rootMoves.length <= 1) return { ...result, ranked: rootMoves.map((m) => ({ move: m, score: 0 })) };

  for (let depth = 1; depth <= maxDepth; depth++) {
    try {
      const anyCapture = rootMoves[0].captures.length > 0;
      const scored: Array<{ move: Move; score: number }> = [];
      let alpha = -Infinity;
      for (const m of rootMoves) {
        const next = makeMove(root, m, settings);
        const lalai = settings.mode === 'tradisional' && m.captures.length === 0 && anyCapture;
        // Jendela penuh untuk urutan yang akurat (dipakai level mudah/sedang untuk variasi).
        const score = -negamax(next, other(rootTurn), lalai ? settings.damPenalty : 0, depth - 1, -Infinity, Infinity, 1);
        scored.push({ move: m, score });
        if (score > alpha) alpha = score;
      }
      scored.sort((a, b) => b.score - a.score);
      result = { move: scored[0].move, score: scored[0].score, depth, nodes, ranked: scored };
      rootMoves = scored.map((s) => s.move);
      if (Math.abs(scored[0].score) > WIN - 1000) break;
    } catch (e) {
      if (e instanceof Timeout) break;
      throw e;
    }
  }
  return result;
}

/** Pilih aksi AI untuk posisi sekarang. */
export function chooseAction(state: GameState, level: Level, rng: () => number = Math.random, now: () => number = Date.now): Action {
  const cfg = LEVELS[level];
  const need = damTargetCount(state);
  if (need > 0 && rng() < cfg.claimDam) {
    return { type: 'dam', targets: chooseDamTargets(state.board, state.turn, need, state.settings) };
  }

  const legal = legalMoves(state);
  if (legal.length === 0) throw new Error('Tidak ada langkah');

  if (state.settings.mode === 'tradisional' && cfg.forgetCapture > 0) {
    const hasCapture = legal.some((m) => m.captures.length > 0);
    const quiet = legal.filter((m) => m.captures.length === 0);
    if (hasCapture && quiet.length > 0 && rng() < cfg.forgetCapture) {
      const m = quiet[Math.floor(rng() * quiet.length)];
      return { type: 'move', from: m.from, path: m.path };
    }
  }

  const res = searchBest(state, cfg.timeMs, cfg.maxDepth, now);
  let pick = res.move!;
  if (cfg.blunder > 0 && res.ranked.length > 1 && rng() < cfg.blunder) {
    const pool = res.ranked.slice(1, 3).filter((r) => r.score > -WIN + 1000);
    if (pool.length > 0) pick = pool[Math.floor(rng() * pool.length)].move;
  }
  return { type: 'move', from: pick.from, path: pick.path };
}
