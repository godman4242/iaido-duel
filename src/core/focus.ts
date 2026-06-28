export const FOCUS_MAX = 100;
export const SWITCH_COST = 34;
export const CRIT_THRESHOLD = 80;

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
