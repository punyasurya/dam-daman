import { describe, expect, it } from 'vitest';
import { pointAt } from '../src/shared/engine/board';
import { applyAction, countPieces, createGame, legalMoves, positionKey, sameMove } from '../src/shared/engine/rules';
import { chooseAction, chooseDamTargets, searchBest } from '../src/shared/ai/search';

const P = pointAt;

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('AI', () => {
  it('selalu memilih langkah sah dari posisi awal', () => {
    const g = createGame();
    for (const level of ['mudah', 'sedang', 'sulit'] as const) {
      const a = chooseAction(g, level, seeded(1));
      expect(a.type).toBe('move');
      if (a.type === 'move') expect(legalMoves(g).some((m) => sameMove(m, a))).toBe(true);
    }
  });

  it('mengambil makan beruntun yang tersedia', () => {
    const g = createGame({}, 'red');
    g.board = g.board.map(() => null);
    g.board[P(0, 6)] = { id: 1, color: 'red', raja: false };
    g.board[P(0, 5)] = { id: 2, color: 'blue', raja: false };
    g.board[P(0, 3)] = { id: 3, color: 'blue', raja: false };
    g.board[P(4, 0)] = { id: 4, color: 'blue', raja: false };
    g.positions = { [positionKey(g)]: 1 };
    const res = searchBest(g, 500, 4);
    expect(res.move?.captures).toHaveLength(2);
  });

  it('level sulit selalu klaim DAM dan memilih bidak paling berharga', () => {
    let g = createGame({}, 'red');
    g.board = g.board.map(() => null);
    g.board[P(2, 5)] = { id: 1, color: 'red', raja: false };
    g.board[P(2, 4)] = { id: 2, color: 'blue', raja: false };
    g.board[P(0, 6)] = { id: 3, color: 'red', raja: false };
    g.board[P(4, 6)] = { id: 4, color: 'red', raja: true };
    g.board[P(1, 6)] = { id: 5, color: 'red', raja: false };
    g.board[P(4, 0)] = { id: 6, color: 'blue', raja: false };
    g.positions = { [positionKey(g)]: 1 };
    g = applyAction(g, { type: 'move', from: P(0, 6), path: [P(0, 5)] });
    const a = chooseAction(g, 'sulit', seeded(2));
    expect(a.type).toBe('dam');
    if (a.type === 'dam') {
      expect(a.targets).toHaveLength(3);
      expect(a.targets).toContain(P(4, 6));
    }
    expect(chooseDamTargets(g.board, 'blue', 1, g.settings)).toEqual([P(4, 6)]);
  });

  it('AI melawan AI menyelesaikan permainan tanpa langkah ilegal', () => {
    let g = createGame({ drawPlies: 60 });
    const rng = seeded(7);
    let guard = 0;
    while (!g.result && guard++ < 400) {
      const level = g.turn === 'red' ? 'sedang' : 'mudah';
      const fake = (() => {
        let t = 0;
        return () => (t += 5);
      })();
      g = applyAction(g, chooseAction(g, level, rng, fake));
    }
    expect(g.result).not.toBeNull();
    expect(countPieces(g.board, 'red') + countPieces(g.board, 'blue')).toBeLessThanOrEqual(32);
  });
});
