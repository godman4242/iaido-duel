import { describe, it, expect } from 'vitest';
import { createNewGame, STARTING_AREA } from '../gamestate';

describe('gamestate', () => {
  it('createNewGame starts a level-1 ronin with no progress, in the starting area', () => {
    const s = createNewGame();
    expect(s.player).toEqual({ name: 'Ronin', level: 1, xp: 0, coins: 0 });
    expect(s.area).toBe(STARTING_AREA);
    expect(s.flags).toEqual({});
  });

  it('gives each new game its own flags object (no shared reference)', () => {
    const a = createNewGame();
    const b = createNewGame();
    a.flags.metShihan = true;
    expect(b.flags.metShihan).toBeUndefined();
  });
});
