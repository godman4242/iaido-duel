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

/**
 * Winner takes less (CONTRACT): the divisor applied to the attacker's damage when the
 * DEFENDER's stance beats the attacker's — spec §A.1 `dmg = round(base / defenderCounterPenalty)`.
 * Unknown ids (hostile untyped input) resolve to neutral 1.
 */
export function counterPenalty(attacker: StanceId, defender: StanceId): number {
  return STANCE_BEATS[defender] === attacker ? COUNTER_BONUS : 1;
}
