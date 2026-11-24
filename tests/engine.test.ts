import { describe, expect, it } from 'vitest';
import { EDGES, NEIGHBORS, POINTS, POINT_COUNT, pointAt } from '../src/shared/engine/board';
import {
  applyAction,
  countPieces,
  createGame,
  damTargetCount,
  GameState,
  IllegalActionError,
  legalMoves,
  movesFrom,
  Piece,
  positionKey,
  Settings,
} from '../src/shared/engine/rules';

const P = pointAt;
let pid = 1000;
const red = (raja = false): Piece => ({ id: pid++, color: 'red', raja });
const blue = (raja = false): Piece => ({ id: pid++, color: 'blue', raja });

/** Buat posisi kosong lalu taruh bidak. */
function setup(pieces: Array<[number, number, Piece]>, turn: 'red' | 'blue' = 'red', settings: Partial<Settings> = {}): GameState {
  const g = createGame(settings, turn);
  g.board = g.board.map(() => null);
  for (const [c, r, piece] of pieces) g.board[P(c, r)] = piece;
  g.positions = { [positionKey(g)]: 1 };
  return g;
}

const move = (from: [number, number], ...path: Array<[number, number]>) => ({
  type: 'move' as const,
  from: P(...from),
  path: path.map(([c, r]) => P(c, r)),
});

describe('papan', () => {
  it('punya 37 titik', () => {
    expect(POINT_COUNT).toBe(37);
  });

  it('titik tengah persegi terhubung ke 8 arah', () => {
    expect(NEIGHBORS[P(2, 4)]).toHaveLength(8);
  });

  it('titik tanpa diagonal hanya terhubung 4 arah', () => {
    expect(NEIGHBORS[P(1, 4)]).toHaveLength(4);
  });

  it('puncak gunungan terhubung ke 3 garis gunungan', () => {
    const n = NEIGHBORS[P(2, 2)].map((id) => `${POINTS[id].c},${POINTS[id].r}`).sort();
    expect(n).toEqual(['1,1', '1,2', '1,3', '2,1', '2,3', '3,1', '3,2', '3,3'].sort());
  });

  it('titik sisi gunungan tidak terhubung ke kolom persegi di bawahnya', () => {
    expect(NEIGHBORS[P(1, 1)]).not.toContain(P(1, 2));
  });

  it('jumlah ruas garis sesuai gambar papan', () => {
    // 2x3 mendatar gunungan(4 ruas) + 5x4 persegi + 4x4 tegak + 8 tegak tengah + 2x4 diagonal + 4x4 sisi
    expect(EDGES.length).toBe(4 + 20 + 16 + 8 + 8 + 16 + 4);
  });
});

describe('posisi awal', () => {
  it('16 bidak per pemain dan baris tengah kosong', () => {
    const g = createGame();
    expect(countPieces(g.board, 'red')).toBe(16);
    expect(countPieces(g.board, 'blue')).toBe(16);
    for (let c = 0; c < 5; c++) expect(g.board[P(c, 4)]).toBeNull();
  });

  it('langkah pertama Merah hanya ke baris tengah', () => {
    const g = createGame();
    const moves = legalMoves(g);
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(POINTS[m.path[0]].r).toBe(4);
      expect(m.captures).toHaveLength(0);
    }
  });
});

describe('jalan biasa', () => {
  it('bidak biasa tidak boleh mundur, tapi boleh ke samping', () => {
    const g = setup([[2, 4, red()], [0, 0, blue()]]);
    const dest = movesFrom(g, P(2, 4)).map((m) => `${POINTS[m.path[0]].c},${POINTS[m.path[0]].r}`).sort();
    expect(dest).toEqual(['1,3', '1,4', '2,3', '3,3', '3,4'].sort());
  });

  it('Biru maju ke arah baris besar', () => {
    const g = setup([[2, 4, blue()], [0, 8, red()]], 'blue');
    const rows = movesFrom(g, P(2, 4)).map((m) => POINTS[m.path[0]].r);
    expect(Math.min(...rows)).toBe(4);
  });

  it('langkah tidak sah ditolak', () => {
    const g = setup([[2, 4, red()], [0, 0, blue()]]);
    expect(() => applyAction(g, move([2, 4], [2, 5]))).toThrow(IllegalActionError);
  });
});

describe('makan', () => {
  it('makan dengan melompat, juga ke belakang', () => {
    const g = setup([[2, 3, red()], [2, 4, blue()], [0, 0, blue()]]);
    const next = applyAction(g, move([2, 3], [2, 5]));
    expect(next.board[P(2, 4)]).toBeNull();
    expect(next.board[P(2, 5)]?.color).toBe('red');
    expect(countPieces(next.board, 'blue')).toBe(1);
  });

  it('ngeracik: makan beruntun dalam satu giliran', () => {
    const g = setup([[0, 6, red()], [0, 5, blue()], [0, 3, blue()], [4, 0, blue()]]);
    const chain = movesFrom(g, P(0, 6)).find((m) => m.captures.length === 2);
    expect(chain).toBeDefined();
    const next = applyAction(g, { type: 'move', from: chain!.from, path: chain!.path });
    expect(countPieces(next.board, 'blue')).toBe(1);
    expect(next.stats.red.longestChain).toBe(2);
  });

  it('mode wajib makan: hanya langkah makan penuh yang sah', () => {
    const g = setup([[0, 6, red()], [0, 5, blue()], [0, 3, blue()], [4, 6, red()], [4, 0, blue()]], 'red', { mode: 'wajib' });
    const moves = legalMoves(g);
    expect(moves.every((m) => m.captures.length === 2 && m.complete)).toBe(true);
  });

  it('tidak bisa melompati bidak sendiri', () => {
    const g = setup([[2, 6, red()], [2, 5, red()], [0, 0, blue()]]);
    expect(movesFrom(g, P(2, 6)).some((m) => m.captures.length > 0)).toBe(false);
  });
});

describe('hukuman DAM', () => {
  it('lalai makan memberi lawan hak DAM', () => {
    const g = setup([[2, 5, red()], [2, 4, blue()], [0, 6, red()], [4, 6, red()], [4, 0, blue()]]);
    const next = applyAction(g, move([0, 6], [0, 5]));
    expect(next.last).toMatchObject({ kind: 'move', lalai: true });
    expect(next.damClaim).toEqual({ claimant: 'blue', count: 3 });
    expect(damTargetCount(next)).toBe(3);
    const after = applyAction(next, { type: 'dam', targets: [P(2, 5), P(0, 5), P(4, 6)] });
    expect(countPieces(after.board, 'red')).toBe(0);
    expect(after.result).toEqual({ winner: 'blue', reason: 'habis' });
  });

  it('DAM hangus kalau lawan langsung jalan', () => {
    const g = setup([[2, 5, red()], [2, 6, red()], [2, 4, blue()], [0, 6, red()], [4, 0, blue()]]);
    const next = applyAction(g, move([0, 6], [0, 5]));
    const after = applyAction(next, move([4, 0], [3, 1]));
    expect(after.damClaim).toBeNull();
    expect(() => applyAction(after, { type: 'dam', targets: [P(4, 0)] })).toThrow();
  });

  it('berhenti ngeracik terlalu cepat juga lalai', () => {
    const g = setup([[0, 6, red()], [0, 5, blue()], [0, 3, blue()], [4, 0, blue()]]);
    const next = applyAction(g, move([0, 6], [0, 4]));
    expect(next.damClaim?.claimant).toBe('blue');
  });

  it('jumlah target DAM harus tepat', () => {
    const g = setup([[2, 5, red()], [2, 4, blue()], [0, 6, red()], [4, 6, red()], [4, 0, blue()]]);
    const next = applyAction(g, move([0, 6], [0, 5]));
    expect(() => applyAction(next, { type: 'dam', targets: [P(2, 5)] })).toThrow(IllegalActionError);
    expect(() => applyAction(next, { type: 'dam', targets: [P(2, 5), P(2, 5), P(0, 5)] })).toThrow(IllegalActionError);
  });

  it('mode wajib tidak memakai DAM', () => {
    const g = setup([[2, 5, red()], [2, 4, blue()], [0, 6, red()], [4, 0, blue()]], 'red', { mode: 'wajib' });
    expect(() => applyAction(g, move([0, 6], [0, 5]))).toThrow(IllegalActionError);
  });
});

describe('raja', () => {
  it('bidak yang berhenti di ujung gunungan lawan naik jadi raja', () => {
    const g = setup([[1, 1, red()], [4, 8, blue()]]);
    const next = applyAction(g, move([1, 1], [0, 0]));
    expect(next.board[P(0, 0)]?.raja).toBe(true);
    expect(next.last).toMatchObject({ kind: 'move', promoted: true });
  });

  it('raja terbang bergerak jauh dan makan dari jauh', () => {
    const g = setup([[0, 2, red(true)], [3, 5, blue()], [0, 0, blue()]]);
    const moves = movesFrom(g, P(0, 2));
    const far = moves.find((m) => m.captures.length === 1 && m.path[0] === P(4, 6));
    expect(far).toBeDefined();
    expect(moves.some((m) => m.captures.length === 0 && m.path[0] === P(0, 6))).toBe(true);
  });

  it('raja langkah ganjil tidak bisa berhenti di jarak genap', () => {
    const g = setup([[0, 2, red(true)], [4, 0, blue()]], 'red', { raja: 'ganjil' });
    const dests = movesFrom(g, P(0, 2)).filter((m) => POINTS[m.path[0]].c === 0).map((m) => POINTS[m.path[0]].r);
    expect(dests.sort()).toEqual([3, 5]);
  });

  it('mode tanpa raja tidak menaikkan pangkat', () => {
    const g = setup([[1, 1, red()], [4, 8, blue()]], 'red', { raja: 'tanpa' });
    const next = applyAction(g, move([1, 1], [0, 0]));
    expect(next.board[P(0, 0)]?.raja).toBe(false);
  });
});

describe('akhir permainan', () => {
  it('kalah kalau tidak bisa jalan', () => {
    // Biru di (2,8) terkepung: kiri-kanan terisi, bidak biasa Biru tidak boleh mundur
    const g = setup([[2, 8, blue()], [0, 8, red()], [4, 8, red()], [4, 4, red()]], 'red');
    const next = applyAction(g, move([4, 4], [4, 3]));
    expect(next.result).toEqual({ winner: 'red', reason: 'buntu' });
  });

  it('seri setelah terlalu lama tanpa makan', () => {
    let g = setup([[0, 2, red(true)], [4, 8, blue(true)]], 'red', { drawPlies: 4 });
    const seq = [move([0, 2], [0, 3]), move([4, 8], [3, 7]), move([0, 3], [0, 2]), move([3, 7], [2, 7])];
    for (const a of seq) g = applyAction(g, a);
    expect(g.result).toEqual({ winner: null, reason: 'seri-langkah' });
  });

  it('seri kalau posisi sama terulang 3 kali', () => {
    let g = setup([[0, 2, red(true)], [4, 8, blue(true)]]);
    const loop = [move([0, 2], [0, 3]), move([4, 8], [3, 7]), move([0, 3], [0, 2]), move([3, 7], [4, 8])];
    for (let i = 0; i < 2; i++) for (const a of loop) if (!g.result) g = applyAction(g, a);
    expect(g.result).toEqual({ winner: null, reason: 'seri-ulang' });
  });

  it('tidak ada langkah setelah permainan selesai', () => {
    const g = setup([[2, 3, red()], [2, 4, blue()]]);
    const next = applyAction(g, move([2, 3], [2, 5]));
    expect(next.result?.winner).toBe('red');
    expect(legalMoves(next)).toHaveLength(0);
  });
});
