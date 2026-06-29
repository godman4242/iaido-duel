/** The id of the area a new game starts in (Kasuta tutorial town). */
export const STARTING_AREA = 'kasuta';

export interface PlayerState {
  name: string;
  level: number;
  xp: number;
  coins: number;
}

/** The persisted campaign state — the single source of truth for a save. Extended by later systems. */
export interface GameState {
  player: PlayerState;
  flags: Record<string, boolean>; // story / quest / dialogue flags
  area: string; // current area id
}

/** A fresh save: a level-1 ronin with no progress, standing in the starting area. */
export function createNewGame(): GameState {
  return {
    player: { name: 'Ronin', level: 1, xp: 0, coins: 0 },
    flags: {},
    area: STARTING_AREA,
  };
}
