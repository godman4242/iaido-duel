// core/gesture.ts — classify a drawn stroke into a verb. Threshold lives in config/combat.ts.
import { Pt } from './vec';
import { LAUNCH_DY } from '../config/combat';

export { LAUNCH_DY };

export type Gesture = 'slash' | 'jump' | 'launch' | 'stab';

export function classifyGesture(path: Pt[]): Gesture {
  if (path.length < 2) return 'slash';
  const a = path[0];
  const b = path[path.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y; // +y is down on screen
  if (Math.abs(dx) >= Math.abs(dy)) return 'slash';
  if (dy < 0) return Math.abs(dy) >= LAUNCH_DY ? 'launch' : 'jump';
  return 'stab';
}
