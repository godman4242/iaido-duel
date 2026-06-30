// core/focus.ts — the Focus meter. Thresholds live in config/combat.ts.
import { FOCUS_MAX, FOCUS_SWITCH_COST, FOCUS_CRIT_THRESHOLD } from '../config/combat';

// Back-compat names used across the build and tests.
export const SWITCH_COST = FOCUS_SWITCH_COST;
export const CRIT_THRESHOLD = FOCUS_CRIT_THRESHOLD;
export { FOCUS_MAX };

export class Focus {
  value = 0;

  gain(n: number): void {
    this.value = Math.max(0, Math.min(FOCUS_MAX, this.value + n));
  }

  canSwitch(): boolean {
    return this.value >= SWITCH_COST;
  }

  spendSwitch(): void {
    if (this.canSwitch()) this.value -= SWITCH_COST;
  }

  isCrit(): boolean {
    return this.value >= CRIT_THRESHOLD;
  }
}
