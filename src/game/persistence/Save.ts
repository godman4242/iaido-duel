import { GameState, createNewGame } from '../../core/gamestate';
import { serialize, deserialize } from '../../core/save';

export const SAVE_KEY = 'iaido-duel.save.v1';

/** Minimal Web-Storage subset — lets the adapter be unit-tested with an in-memory fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // no DOM (test env) or storage disabled
  }
}

export function saveGame(state: GameState, storage: StorageLike | null = defaultStorage()): void {
  storage?.setItem(SAVE_KEY, serialize(state));
}

export function loadGame(storage: StorageLike | null = defaultStorage()): GameState | null {
  const raw = storage?.getItem(SAVE_KEY) ?? null;
  return raw === null ? null : deserialize(raw);
}

export function hasSave(storage: StorageLike | null = defaultStorage()): boolean {
  return loadGame(storage) !== null;
}

export function clearSave(storage: StorageLike | null = defaultStorage()): void {
  storage?.removeItem(SAVE_KEY);
}

// re-export so callers can start a new game without reaching into core directly
export { createNewGame };
