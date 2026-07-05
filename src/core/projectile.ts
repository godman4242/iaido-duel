// core/projectile.ts — minimal deterministic kunai sim (M2 blueprint §3.6; port contract
// SimState.projectiles). Pure motion + overlap tests so Stab+Deflect is provable in a core
// test. No RNG, no wall clock, no Phaser; all numbers from config.
import { ARENA_X_MAX } from '../config/combat-sim';

export interface Projectile {
  id: number;
  x: number;
  vx: number; // px/ms — sign is the travel direction
  dmg: number;
  fromOpponent: boolean;
}

/** Advance one projectile by dtMs. Hostile dt (NaN/negative) moves it nowhere. */
export function stepProjectile(p: Projectile, dtMs: number): void {
  const dt = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
  p.x += p.vx * dt;
}

/** True when the projectile is within `radius` px of world-x `x` (1-D overlap — sim is x-authoritative). */
export function projectileOverlaps(p: Projectile, x: number, radius: number): boolean {
  const r = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  return Math.abs(p.x - x) <= r;
}

/** True once the projectile has left the arena and should despawn (bounds are config-derived). */
export function projectileOffArena(p: Projectile): boolean {
  return !Number.isFinite(p.x) || p.x < 0 || p.x > ARENA_X_MAX;
}
