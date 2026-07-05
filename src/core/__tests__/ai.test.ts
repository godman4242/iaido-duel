import { describe, it, expect } from 'vitest';
import { nextAIState } from '../ai';

const P = { approachRange: 500, strikeRange: 140, reactBlockChance: 0.5, reactDodgeChance: 0.3 };
const sense = (over: Partial<Parameters<typeof nextAIState>[2]> = {}) => ({
  distance: 300,
  playerAttacking: false,
  playerWindup: false,
  selfRecovering: false,
  rng: 0.9,
  ...over,
});

describe('ai', () => {
  it('approaches then telegraphs at strike range', () => {
    expect(nextAIState('idle', 0, sense({ distance: 300 }), P)).toBe('approach');
    expect(nextAIState('approach', 0, sense({ distance: 130 }), P)).toBe('telegraph');
  });
  it('reacts to player windup with block (low rng)', () => {
    expect(nextAIState('approach', 0, sense({ distance: 130, playerWindup: true, rng: 0.1 }), P)).toBe('block');
  });
  it('telegraph commits to attack after the wind-up time, then recovers', () => {
    expect(nextAIState('telegraph', 1000, sense({ distance: 120 }), P)).toBe('attack');
    expect(nextAIState('attack', 1000, sense({ distance: 120 }), P)).toBe('recover');
    expect(nextAIState('recover', 1000, sense({ distance: 120 }), P)).toBe('idle');
  });

  // ── M2 additions (spec §D.1, §A.3) ──────────────────────────────────────────────────────
  it('prefers the Smoke-Bomb dodge over a block against a telegraphed STAB', () => {
    // rng 0.1 < reactBlockChance 0.5 would normally block — the incoming stab flips it to dodge
    const s = sense({ distance: 130, playerWindup: true, playerStabIncoming: true, rng: 0.1 });
    expect(nextAIState('approach', 0, s, P)).toBe('dodge');
    // same rng without the stab still blocks (the preference is stab-specific)
    expect(
      nextAIState('approach', 0, sense({ distance: 130, playerWindup: true, rng: 0.1 }), P),
    ).toBe('block');
  });

  it('honors per-tier duration overrides (telegraphMs/attackMs/recoverMs/reactMs params)', () => {
    const tier = { ...P, telegraphMs: 100, attackMs: 50, recoverMs: 80, reactMs: 40 };
    expect(nextAIState('telegraph', 99, sense({ distance: 120 }), tier)).toBe('telegraph');
    expect(nextAIState('telegraph', 100, sense({ distance: 120 }), tier)).toBe('attack');
    expect(nextAIState('attack', 50, sense({ distance: 120 }), tier)).toBe('recover');
    expect(nextAIState('recover', 80, sense({ distance: 120 }), tier)).toBe('idle');
    expect(nextAIState('block', 40, sense(), tier)).toBe('approach');
    expect(nextAIState('dodge', 39, sense(), tier)).toBe('dodge');
  });

  it('CHAOS: hostile senses (NaN distance/rng, negative t) resolve without throwing', () => {
    expect(() =>
      nextAIState('idle', Number.NaN, sense({ distance: Number.NaN, rng: Number.NaN }), P),
    ).not.toThrow();
    expect(nextAIState('telegraph', -50, sense(), P)).toBe('telegraph'); // negative t never commits early
    expect(nextAIState('idle', 0, sense({ distance: Number.POSITIVE_INFINITY }), P)).toBe('idle');
  });
});
