import { describe, it, expect } from 'vitest';
import { STANCES, counterBonus } from '../stance';

describe('stance', () => {
  it('stat table', () => {
    expect(STANCES.light.dmgMult).toBe(0.9);
    expect(STANCES.balanced.dmgMult).toBe(1.2);
    expect(STANCES.heavy.dmgMult).toBe(1.4);
    expect(STANCES.heavy.damageTakenMult).toBe(1.25); // -20% def => takes 25% more
    expect(STANCES.light.reach).toBeGreaterThan(STANCES.heavy.reach);
  });
  it('counter triangle: light>heavy>balanced>light', () => {
    expect(counterBonus('light', 'heavy')).toBe(1.25);
    expect(counterBonus('heavy', 'balanced')).toBe(1.25);
    expect(counterBonus('balanced', 'light')).toBe(1.25);
    expect(counterBonus('heavy', 'light')).toBe(1.0);
    expect(counterBonus('light', 'light')).toBe(1.0);
  });
});
