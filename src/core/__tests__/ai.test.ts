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
});
