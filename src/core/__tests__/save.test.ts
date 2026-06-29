import { describe, it, expect } from 'vitest';
import { serialize, deserialize, SAVE_VERSION } from '../save';
import { createNewGame } from '../gamestate';

describe('save', () => {
  it('round-trips a game state through serialize → deserialize', () => {
    const s = createNewGame();
    s.player.coins = 42;
    s.flags.metShihan = true;
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('returns null on malformed JSON', () => {
    expect(deserialize('not json {')).toBeNull();
  });

  it('returns null when the save version does not match', () => {
    const stale = JSON.stringify({ version: SAVE_VERSION + 1, state: createNewGame() });
    expect(deserialize(stale)).toBeNull();
  });

  it('returns null on a non-envelope payload', () => {
    expect(deserialize('null')).toBeNull();
    expect(deserialize('[]')).toBeNull();
  });
});
