import { chooseAction, Level } from '../../shared/ai/search';
import type { GameState } from '../../shared/engine/rules';

self.onmessage = (e: MessageEvent<{ id: number; state: GameState; level: Level }>) => {
  const { id, state, level } = e.data;
  try {
    const action = chooseAction(state, level);
    (self as unknown as Worker).postMessage({ id, action });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
