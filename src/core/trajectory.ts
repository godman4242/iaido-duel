// core/trajectory.ts — pure motion math shared by the presentation layer. No Phaser, no literals.
// Kept in core/ (and unit-tested) so the directional-blood and jump-arc behaviours are provable,
// not just asserted by eye.
import { Pt } from './vec';
import { RAD_TO_DEG } from '../config/combat';

/**
 * Spray cone (Phaser `angle` degrees: 0=right, 90=down, 270=up) centered on the cut vector `dir`,
 * widened by ±`spreadDeg`. Blood gouts ALONG the cut, not omnidirectionally (spec §4.2, Tell 19).
 * A degenerate/non-finite direction falls back to a rightward cone.
 */
export function bloodConeDeg(dir: Pt, spreadDeg: number): { min: number; max: number } {
  const usable = Number.isFinite(dir.x) && Number.isFinite(dir.y) && (dir.x !== 0 || dir.y !== 0);
  const center = usable ? Math.atan2(dir.y, dir.x) * RAD_TO_DEG : 0;
  return { min: center - spreadDeg, max: center + spreadDeg };
}

/**
 * Parabolic jump position at parameter `t`∈[0,1]: x/baseline interpolate `start`→`end`, and the
 * body arcs up by `apex` at the midpoint (Tell 4 — a jump BEGINS at the line's start point and
 * ENDS at its endpoint). `t` is clamped; non-finite `t` is treated as 0.
 */
export function jumpArcPoint(start: Pt, end: Pt, apex: number, t: number): Pt {
  const u = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const k = 2 * u - 1; // peak at u=0.5
  const lift = apex * (1 - k * k); // apex at midpoint, 0 at both ends; ≥0 for apex≥0
  return {
    x: start.x + (end.x - start.x) * u,
    y: start.y + (end.y - start.y) * u - lift,
  };
}
