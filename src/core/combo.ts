// core/combo.ts — consecutive-hit counter. Window lives in config/timing.ts.
import { COMBO_WINDOW_MS } from '../config/timing';

export { COMBO_WINDOW_MS };

/** Consecutive-hit counter: increments within COMBO_WINDOW_MS, otherwise restarts. */
export class Combo {
  private count = 0;
  private lastHitAt = -Infinity;

  hit(nowMs: number): number {
    this.count = nowMs - this.lastHitAt > COMBO_WINDOW_MS ? 1 : this.count + 1;
    this.lastHitAt = nowMs;
    return this.count;
  }

  value(nowMs: number): number {
    return nowMs - this.lastHitAt > COMBO_WINDOW_MS ? 0 : this.count;
  }

  reset(): void {
    this.count = 0;
    this.lastHitAt = -Infinity;
  }
}
