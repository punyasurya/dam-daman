import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { EDGES, POINTS } from '../../shared/engine/board';
import type { Cell, GameState, Piece } from '../../shared/engine/rules';
import { Crown } from './Icons';

export const BOARD_W = 348;
export const BOARD_H = 484;
const px = (c: number) => 34 + 70 * c;
const py = (r: number) => 34 + 52 * r;

export function pointXY(p: number, flip: boolean): [number, number] {
  const { c, r } = POINTS[p];
  const x = px(c);
  const y = py(r);
  return flip ? [BOARD_W - x, BOARD_H - y] : [x, y];
}

export interface BoardProps {
  game: GameState;
  flip?: boolean;
  /** Titik bidak yang boleh dipilih. */
  selectable?: ReadonlySet<number>;
  /** Titik bidak yang wajib makan (ditandai). */
  mustCapture?: ReadonlySet<number>;
  selected?: number | null;
  partialPath?: readonly number[];
  targets?: ReadonlySet<number>;
  captureTargets?: ReadonlySet<number>;
  marked?: ReadonlySet<number>;
  damCandidates?: ReadonlySet<number>;
  damChosen?: ReadonlySet<number>;
  onPoint?: (p: number) => void;
  onStep?: (kind: 'move' | 'capture', index: number) => void;
  onAnimDone?: () => void;
  label?: string;
}

interface Anim {
  pieceId: number;
  points: number[];
  step: number;
  wasRaja: boolean;
  caps: Array<{ piece: Piece; at: number; step: number }>;
}

/** Lama satu langkah biasa (ms). */
const MOVE_MS = 280;
/** Lompatan makan lebih pelan supaya terlihat bidak lawan dilompati. */
const CAPTURE_BASE_MS = 380;
const CAPTURE_PER_PX = 1.2;
const CAPTURE_MAX_MS = 950;
/** Jeda singkat di antara lompatan beruntun (ngeracik). */
const CHAIN_PAUSE_MS = 140;
/** Lama bidak hilang saat kena DAM. */
const DAM_REMOVE_MS = 650;

function stepInfo(anim: Anim, step: number): { capture: boolean; ms: number } {
  const capture = anim.caps.some((c) => c.step === step);
  if (!capture) return { capture, ms: MOVE_MS };
  const [x1, y1] = pointXY(anim.points[step - 1], false);
  const [x2, y2] = pointXY(anim.points[step], false);
  const dist = Math.hypot(x2 - x1, y2 - y1);
  return { capture, ms: Math.min(CAPTURE_MAX_MS, Math.round(CAPTURE_BASE_MS + dist * CAPTURE_PER_PX)) };
}

function BoardImpl(props: BoardProps) {
  const { game, flip = false, onPoint } = props;
  const prevBoard = useRef<Cell[]>(game.board);
  const prevLast = useRef(game.last);
  const [anim, setAnim] = useState<Anim | null>(null);
  const cb = useRef({ onStep: props.onStep, onAnimDone: props.onAnimDone });
  cb.current = { onStep: props.onStep, onAnimDone: props.onAnimDone };

  useLayoutEffect(() => {
    const last = game.last;
    if (last === prevLast.current) {
      prevBoard.current = game.board;
      return;
    }
    prevLast.current = last;
    const before = prevBoard.current;
    prevBoard.current = game.board;
    if (!last) {
      setAnim(null);
      return;
    }
    if (last.kind === 'move') {
      const moving = before[last.move.from];
      if (!moving) return;
      const caps = last.move.captures
        .map((at, i) => ({ piece: before[at]!, at, step: i + 1 }))
        .filter((c) => c.piece);
      setAnim({ pieceId: moving.id, points: [last.move.from, ...last.move.path], step: 0, wasRaja: moving.raja, caps });
    } else {
      const caps = last.targets.map((at) => ({ piece: before[at]!, at, step: 1 })).filter((c) => c.piece);
      setAnim({ pieceId: -1, points: [], step: 0, wasRaja: false, caps });
    }
  }, [game]);

  useEffect(() => {
    if (!anim) return;
    const total = Math.max(anim.points.length - 1, 1);
    if (anim.step > total) {
      const t = setTimeout(() => {
        setAnim(null);
        cb.current.onAnimDone?.();
      }, 160);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => {
        const next = anim.step + 1;
        if (anim.pieceId !== -1 && next <= total) {
          const captured = anim.caps.some((c) => c.step === next);
          cb.current.onStep?.(captured ? 'capture' : 'move', next - 1);
        }
        setAnim({ ...anim, step: next });
      },
      anim.step === 0
        ? 30
        : anim.pieceId === -1
          ? DAM_REMOVE_MS
          : (() => {
              const cur = stepInfo(anim, anim.step);
              const nextIsCapture = anim.step < total && anim.caps.some((c) => c.step === anim.step + 1);
              return cur.ms + (cur.capture && nextIsCapture ? CHAIN_PAUSE_MS : 0);
            })(),
    );
    return () => clearTimeout(t);
  }, [anim]);

  // Posisi bidak yang ditampilkan
  const pieces: Array<{ piece: Piece; at: number; cls: string; style?: CSSProperties }> = [];
  game.board.forEach((cell, at) => {
    if (!cell) return;
    if (anim && cell.id === anim.pieceId) {
      const idx = Math.min(Math.max(anim.step, 0), anim.points.length - 1);
      const showPiece = anim.step < anim.points.length - 1 ? { ...cell, raja: anim.wasRaja } : cell;
      const info = anim.step >= 1 && anim.step < anim.points.length ? stepInfo(anim, anim.step) : null;
      pieces.push({
        piece: showPiece,
        at: anim.points[idx],
        // Nama kelas bergantian supaya animasi angkat diulang di setiap lompatan beruntun.
        cls: `moving ${info?.capture ? (anim.step % 2 ? 'hop-a' : 'hop-b') : ''}`,
        style: info ? ({ transitionDuration: `${info.ms}ms`, '--hop-ms': `${info.ms}ms` } as CSSProperties) : undefined,
      });
    } else pieces.push({ piece: cell, at, cls: '' });
  });
  if (anim)
    for (const c of anim.caps) {
      // Bidak yang dimakan hilang saat bidak penyerang melintas di atasnya.
      const delay = anim.pieceId === -1 ? 0 : Math.round(stepInfo(anim, c.step).ms * 0.45);
      pieces.push({
        piece: c.piece,
        at: c.at,
        cls: anim.step >= c.step ? 'vanish' : '',
        style: anim.step === c.step ? { transitionDelay: `${delay}ms` } : undefined,
      });
    }
  pieces.sort((a, b) => a.piece.id - b.piece.id);

  const last = game.last;
  const lastPts = last?.kind === 'move' ? [last.move.from, ...last.move.path] : [];

  return (
    <svg
      className="board"
      viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
      role="group"
      aria-label={props.label ?? 'Papan dam-daman'}
    >
      <defs>
        <radialGradient id="stone-red" cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#E9845C" />
          <stop offset="60%" stopColor="#C8512A" />
          <stop offset="100%" stopColor="#9C3A1B" />
        </radialGradient>
        <radialGradient id="stone-blue" cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#5E83C2" />
          <stop offset="60%" stopColor="#2D4F86" />
          <stop offset="100%" stopColor="#1C3561" />
        </radialGradient>
      </defs>
      <rect className="board-bg" x={1} y={1} width={BOARD_W - 2} height={BOARD_H - 2} rx={22} />
      <g className="lines">
        {EDGES.map(([a, b], i) => {
          const [x1, y1] = pointXY(a, flip);
          const [x2, y2] = pointXY(b, flip);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>
      {lastPts.length > 1 && (
        <polyline className="last-path" points={lastPts.map((p) => pointXY(p, flip).join(',')).join(' ')} />
      )}
      {POINTS.map((p) => {
        const [x, y] = pointXY(p.id, flip);
        return <circle key={p.id} className="dot" cx={x} cy={y} r={5} />;
      })}
      {lastPts.length > 0 && (() => {
        const [x, y] = pointXY(lastPts[0], flip);
        return <circle className="last-from" cx={x} cy={y} r={12} />;
      })()}
      {props.partialPath && props.partialPath.length > 0 && props.selected != null && (
        <polyline
          className="partial-path"
          points={[props.selected, ...props.partialPath].map((p) => pointXY(p, flip).join(',')).join(' ')}
        />
      )}

      <g className="pieces">
        {pieces.map(({ piece, at, cls, style }) => {
          const [x, y] = pointXY(at, flip);
          const sel = props.selected === at && !anim;
          const isMarked = props.marked?.has(at);
          const must = props.mustCapture?.has(at);
          const damC = props.damCandidates?.has(at);
          const damSel = props.damChosen?.has(at);
          return (
            <g
              key={piece.id}
              className={`piece ${piece.color} ${cls} ${sel ? 'selected' : ''} ${isMarked ? 'marked' : ''} ${must ? 'must' : ''} ${damC ? 'dam-candidate' : ''} ${damSel ? 'dam-chosen' : ''}`}
              style={{ ...style, transform: `translate(${x}px, ${y}px)` }}
            >
              <circle className="halo" r={20} />
              <ellipse className="shadow" cx={1.2} cy={3.2} rx={15} ry={13.5} />
              <circle className="stone" r={15} fill={`url(#stone-${piece.color})`} />
              <circle className="rim" r={10} />
              {piece.raja && <Crown x={0} y={0} s={0.82} />}
              {damSel && <path className="x-mark" d="M-6.5 -6.5L6.5 6.5M6.5 -6.5L-6.5 6.5" />}
            </g>
          );
        })}
      </g>

      {props.targets &&
        [...props.targets].map((p) => {
          const [x, y] = pointXY(p, flip);
          const cap = props.captureTargets?.has(p);
          return <circle key={`t${p}`} className={`target ${cap ? 'capture' : ''}`} cx={x} cy={y} r={cap ? 12 : 9} />;
        })}

      <g className="hit">
        {POINTS.map((p) => {
          const [x, y] = pointXY(p.id, flip);
          const active =
            props.selectable?.has(p.id) || props.targets?.has(p.id) || props.damCandidates?.has(p.id) || props.selected === p.id;
          return (
            <circle
              key={p.id}
              cx={x}
              cy={y}
              r={30}
              className={active ? 'active' : ''}
              role={active ? 'button' : undefined}
              tabIndex={active ? 0 : -1}
              aria-label={active ? `Titik kolom ${p.c + 1} baris ${p.r + 1}` : undefined}
              onClick={() => onPoint?.(p.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPoint?.(p.id);
                }
              }}
            />
          );
        })}
      </g>
    </svg>
  );
}

export const Board = memo(BoardImpl);
