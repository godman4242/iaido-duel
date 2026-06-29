import { describe, it, expect } from 'vitest';
import { saveGame, loadGame, hasSave, clearSave, SAVE_KEY, StorageLike } from '../Save';
import { createNewGame } from '../../../core/gamestate';

function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('Save adapter', () => {
  it('has no save on a fresh storage', () => {
    expect(hasSave(fakeStorage())).toBe(false);
  });

  it('round-trips a saved game', () => {
    const store = fakeStorage();
    const s = createNewGame();
    s.player.coins = 7;
    saveGame(s, store);
    expect(hasSave(store)).toBe(true);
    expect(loadGame(store)).toEqual(s);
  });

  it('returns null when the stored value is corrupt', () => {
    const store = fakeStorage();
    store.setItem(SAVE_KEY, 'corrupt {');
    expect(loadGame(store)).toBeNull();
    expect(hasSave(store)).toBe(false);
  });

  it('clearSave removes the save', () => {
    const store = fakeStorage();
    saveGame(createNewGame(), store);
    clearSave(store);
    expect(hasSave(store)).toBe(false);
  });

  it('no-ops gracefully when storage is null (headless)', () => {
    expect(loadGame(null)).toBeNull();
    expect(() => saveGame(createNewGame(), null)).not.toThrow();
  });
});
