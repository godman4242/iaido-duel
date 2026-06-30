// core/DrawnStroke.ts — the heart of the slash engine (spec §D.1).
// Raw pointer path → sanitized → resampled to even arc-length spacing → smoothed (Chaikin).
// The SMOOTHED curve IS both the blade trajectory and the hit polyline. A literal jagged
// hand-path is itself a tell ("MS-Paint") — never render or hit-test the raw path.
//
// Pure + deterministic + Phaser-free. Output depends ONLY on the Pt[] (not on mouse vs touch) —
// that is the mouse/touch parity guarantee (spec §3): identical input path → identical DrawnStroke.
import { Pt } from './vec';
import { classifyGesture, type Gesture } from './gesture';
import { RESAMPLE_SPACING, SMOOTH_ITERATIONS, CHAIKIN_RATIO, MAX_STROKE_POINTS } from '../config/combat';

export interface DrawnStroke {
  raw: Pt[]; // input with non-finite points dropped (sanitized)
  points: Pt[]; // resampled + smoothed — the blade trajectory AND the hit polyline
  start: Pt; // points[0] (origin of a jump / lead of the cut), {0,0} when empty
  end: Pt; // points[last] (endpoint of a jump), {0,0} when empty
  length: number; // arc length of `points` (≥ 0)
  dir: Pt; // unit cut vector start→end; {0,0} when degenerate (used to aim blood, §F.19)
  verb: Gesture; // classified from the smoothed stroke (slash/jump/launch/stab)
}

const ZERO = (): Pt => ({ x: 0, y: 0 });
const finitePt = (p: Pt): boolean => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/** Drop null/NaN/Infinity points so no hostile coordinate propagates downstream. */
export function sanitize(path: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of path) if (finitePt(p)) out.push({ x: p.x, y: p.y });
  return out;
}

/** Total polyline arc length. */
export function polylineLength(pts: readonly Pt[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return total;
}

/**
 * Resample a polyline to ~even arc-length spacing. Always preserves the first & last point.
 * Output is hard-capped at `maxPoints` (the effective step grows for very long/dense strokes) —
 * this bounds work on hostile multi-thousand-point input and cannot hang.
 */
export function resample(pts: readonly Pt[], spacing = RESAMPLE_SPACING, maxPoints = MAX_STROKE_POINTS): Pt[] {
  if (pts.length === 0) return [];
  if (pts.length === 1) return [{ ...pts[0] }];
  const cap = Math.max(2, Math.floor(maxPoints));
  const total = polylineLength(pts);
  if (total === 0) return [{ ...pts[0] }]; // all-coincident points collapse to one
  // Grow the step so we never emit more than `cap` points (chaos guard for huge strokes).
  const step = Math.max(spacing, total / (cap - 1));
  // Bail to the two endpoints if step is non-positive OR non-finite — an overflow-scale stroke
  // (e.g. ±1e308) makes total/step Infinity, and interpolating with it would emit NaN points.
  if (!(step > 0) || !Number.isFinite(step)) return [{ ...pts[0] }, { ...pts[pts.length - 1] }];

  const out: Pt[] = [{ ...pts[0] }];
  let prev = pts[0];
  let acc = 0; // arc length walked since the last emitted point
  for (let i = 1; i < pts.length; i++) {
    let segStart = prev;
    const segEnd = pts[i];
    let segLen = Math.hypot(segEnd.x - segStart.x, segEnd.y - segStart.y);
    while (acc + segLen >= step && out.length < cap - 1) {
      const t = (step - acc) / segLen;
      const np = { x: segStart.x + (segEnd.x - segStart.x) * t, y: segStart.y + (segEnd.y - segStart.y) * t };
      out.push(np);
      segStart = np;
      segLen = Math.hypot(segEnd.x - segStart.x, segEnd.y - segStart.y);
      acc = 0;
    }
    acc += segLen;
    prev = segEnd;
  }
  const last = pts[pts.length - 1];
  const tail = out[out.length - 1];
  if (tail.x !== last.x || tail.y !== last.y) out.push({ ...last });
  return out;
}

/**
 * Endpoint-preserving Chaikin corner-cutting. Each pass replaces every interior corner with two
 * points at `ratio` / `1-ratio` along its edges, keeping the first & last point fixed (so a jump
 * still begins at the start and ends at the endpoint). Smooths the jagged hand-path into a curve.
 */
export function chaikin(pts: readonly Pt[], iterations = SMOOTH_ITERATIONS, ratio = CHAIKIN_RATIO): Pt[] {
  if (pts.length <= 2 || iterations <= 0) return pts.map((p) => ({ ...p }));
  let cur: Pt[] = pts.map((p) => ({ ...p }));
  for (let it = 0; it < iterations; it++) {
    const next: Pt[] = [{ ...cur[0] }];
    for (let i = 0; i + 1 < cur.length; i++) {
      const p = cur[i];
      const q = cur[i + 1];
      next.push({ x: p.x + (q.x - p.x) * ratio, y: p.y + (q.y - p.y) * ratio });
      next.push({ x: p.x + (q.x - p.x) * (1 - ratio), y: p.y + (q.y - p.y) * (1 - ratio) });
    }
    next.push({ ...cur[cur.length - 1] });
    cur = next;
  }
  return cur;
}

/** Build the canonical DrawnStroke from a raw pointer path. Never throws; never returns NaN. */
export function buildDrawnStroke(rawPath: readonly Pt[]): DrawnStroke {
  const raw = sanitize(rawPath);
  if (raw.length === 0) {
    return { raw, points: [], start: ZERO(), end: ZERO(), length: 0, dir: ZERO(), verb: 'slash' };
  }
  const points = chaikin(resample(raw));
  const start = { ...points[0] };
  const end = { ...points[points.length - 1] };
  const rawLength = polylineLength(points);
  const length = Number.isFinite(rawLength) ? rawLength : 0; // overflow-scale strokes → safe 0
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const d = Math.hypot(dx, dy);
  const dir = d > 0 && Number.isFinite(d) ? { x: dx / d, y: dy / d } : ZERO();
  return { raw, points, start, end, length, dir, verb: classifyGesture(points) };
}
