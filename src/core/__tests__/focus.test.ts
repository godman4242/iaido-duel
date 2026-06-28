import { describe, it, expect } from 'vitest';
import { Focus, FOCUS_MAX, SWITCH_COST } from '../focus';

describe('focus', () => {
  it('gain clamps to max; crit above threshold', () => {
    const f = new Focus();
    f.gain(200);
    expect(f.value).toBe(FOCUS_MAX);
    expect(f.isCrit()).toBe(true);
  });
  it('switch spends focus and is gated when too low', () => {
    const f = new Focus();
    f.gain(SWITCH_COST);
    expect(f.canSwitch()).toBe(true);
    f.spendSwitch();
    expect(f.value).toBe(0);
    expect(f.canSwitch()).toBe(false);
  });
});
