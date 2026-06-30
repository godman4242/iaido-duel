// core/stance.ts — stance types + counter-triangle logic. Numeric values live in config.
import { COUNTER_BONUS } from '../config/combat';
import { STANCE_TABLE, STANCE_BEATS, type StanceId, type StanceStats } from '../config/stances';

export type { StanceId } from '../config/stances';
export type Stance = StanceStats;

export const STANCES: Record<StanceId, Stance> = STANCE_TABLE;

/** Counter triangle: light beats heavy, heavy beats balanced, balanced beats light. */
export function counterBonus(attacker: StanceId, defender: StanceId): number {
  return STANCE_BEATS[attacker] === defender ? COUNTER_BONUS : 1;
}
