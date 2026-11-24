import { chooseAction, Level } from '../../shared/ai/search';
import type { Action, GameState } from '../../shared/engine/rules';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (a: Action | null) => void>();

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; action?: Action }>) => {
      const res = pending.get(e.data.id);
      pending.delete(e.data.id);
      res?.(e.data.action ?? null);
    };
    worker.onerror = () => {
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** Minta AI berpikir di Web Worker, dengan jeda minimum supaya terasa alami. */
export async function askAI(state: GameState, level: Level, minDelayMs = 550): Promise<Action> {
  const started = performance.now();
  const w = getWorker();
  let action: Action | null = null;
  if (w) {
    const id = ++seq;
    action = await new Promise<Action | null>((resolve) => {
      pending.set(id, resolve);
      w.postMessage({ id, state, level });
    });
  }
  if (!action) action = chooseAction(state, level);
  const wait = minDelayMs - (performance.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return action;
}
