// core/critical.ts — the Critical meter (spec §C "Meters/systems", Tell 7; M2 blueprint §3.1).
// Fills passively; drains per swing scaled by weapon weight (Heavy strictly > Light); at FULL
// the NEXT landed hit resolves at CRIT_MULT (3×) and the bar resets; a stance switch also
// deducts (patch behavior). Pure, deterministic, plain-number state — the Sim stores
// `FighterSimState.critical` as a number and threads it through these functions, so snapshots
// stay trivially serializable and restart-safe. All rates/weights live in config/combat.ts.
//
// Sim ordering note: check consumeCrit()/isCritReady() for a swing BEFORE applying that
// swing's drain, so the full-bar swing itself pays out the 3× hit.
import {
  CRITICAL_MAX,
  CRITICAL_FILL_PER_MS,
  CRITICAL_SWING_DRAIN_BASE,
  CRITICAL_STANCE_SWITCH_DRAIN,
} from '../config/combat';

/** Sanitize any hostile meter value (NaN/±Infinity/out-of-range) into [0, CRITICAL_MAX]. */
function clampMeter(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(CRITICAL_MAX, v));
}

/**
 * Passive fill: the meter value after `dtMs` more milliseconds of charging.
 * Hostile dt (NaN/negative — out-of-order time) adds nothing; +Infinity clamps to full.
 */
export function criticalFill(value: number, dtMs: number): number {
  const dt = Number.isNaN(dtMs) ? 0 : Math.max(0, dtMs);
  return clampMeter(clampMeter(value) + dt * CRITICAL_FILL_PER_MS);
}

/**
 * Drain for ONE swing, scaled by weapon weight (heavier drains strictly more — Tell 7).
 * Hostile weight (NaN/negative/±Infinity) drains 0 — it can never become a gain.
 */
export function criticalDrainPerSwing(weaponWeight: number): number {
  const w = Number.isFinite(weaponWeight) ? Math.max(0, weaponWeight) : 0;
  return CRITICAL_SWING_DRAIN_BASE * w;
}

/** Meter value after one swing with the given weapon weight (clamped at 0). */
export function criticalAfterSwing(value: number, weaponWeight: number): number {
  return clampMeter(clampMeter(value) - criticalDrainPerSwing(weaponWeight));
}

/** Patch behavior: changing stance also deducts from the Critical bar (clamped at 0). */
export function criticalAfterStanceSwitch(value: number): number {
  return clampMeter(clampMeter(value) - CRITICAL_STANCE_SWITCH_DRAIN);
}

/** Full bar ⇒ crit-ready (spec §C: "full → next hit is the 3× crit"). */
export function isCritReady(value: number): boolean {
  return clampMeter(value) >= CRITICAL_MAX;
}

/**
 * Consume readiness for a landed hit: when full, the hit is the CRIT_MULT crit and the meter
 * resets to 0 (one-shot payout); otherwise the (sanitized) value passes through unchanged.
 */
export function consumeCrit(value: number): { crit: boolean; value: number } {
  const v = clampMeter(value);
  return v >= CRITICAL_MAX ? { crit: true, value: 0 } : { crit: false, value: v };
}
