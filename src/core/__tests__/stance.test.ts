import { describe, it, expect } from 'vitest';
import { STANCES, counterBonus, counterPenalty, type StanceId } from '../stance';

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
  it('counterPenalty: the out-countered ATTACKER is divided (defender wins the triangle)', () => {
    // defender's stance beats the attacker's ⇒ ÷1.25 divisor (spec §A.1 defenderCounterPenalty)
    expect(counterPenalty('heavy', 'light')).toBe(1.25); // light (def) beats heavy (atk)
    expect(counterPenalty('balanced', 'heavy')).toBe(1.25);
    expect(counterPenalty('light', 'balanced')).toBe(1.25);
    // attacker wins or neutral ⇒ no penalty
    expect(counterPenalty('light', 'heavy')).toBe(1.0);
    expect(counterPenalty('light', 'light')).toBe(1.0);
  });
  it('winner deals more AND takes less (CONTRACT, both helpers agree on every pair)', () => {
    const ids: StanceId[] = ['light', 'balanced', 'heavy'];
    for (const a of ids)
      for (const d of ids) {
        // exactly one direction of the pair can be a counter, never both
        expect(counterBonus(a, d) > 1 && counterPenalty(a, d) > 1).toBe(false);
        // symmetry: if a beats d, then with roles flipped the attacker d is penalized
        expect(counterBonus(a, d) > 1).toBe(counterPenalty(d, a) > 1);
      }
  });
  it('chaos: unknown stance ids (hostile JS input) resolve to neutral 1, never throw/NaN', () => {
    const bogus = 'bogus' as unknown as StanceId;
    expect(counterBonus(bogus, 'light')).toBe(1);
    expect(counterBonus('light', bogus)).toBe(1);
    expect(counterPenalty(bogus, 'light')).toBe(1);
    expect(counterPenalty('light', bogus)).toBe(1);
    expect(counterPenalty(bogus, bogus)).toBe(1);
  });
});
