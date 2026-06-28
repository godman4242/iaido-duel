import { Pt } from './vec';

export type Capsule = { a: Pt; b: Pt; r: number };

export function pointSegDist(p: Pt, a: Pt, b: Pt): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : (apx * abx + apy * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * abx;
  const cy = a.y + t * aby;
  return Math.hypot(p.x - cx, p.y - cy);
}

// Sampled length of segment p0->p1 lying within radius r of capsule core a-b.
export function segCapsuleOverlap(p0: Pt, p1: Pt, c: Capsule, steps = 64): number {
  const segLen = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  if (segLen === 0) return 0;
  let inside = 0;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    const x = p0.x + (p1.x - p0.x) * t;
    const y = p0.y + (p1.y - p0.y) * t;
    if (pointSegDist({ x, y }, c.a, c.b) <= c.r) inside++;
  }
  return (inside / steps) * segLen;
}

export function polylineCapsuleOverlap(path: Pt[], c: Capsule): number {
  let total = 0;
  for (let i = 0; i + 1 < path.length; i++) total += segCapsuleOverlap(path[i], path[i + 1], c);
  return total;
}

export function firstPointInCapsule(path: Pt[], c: Capsule): Pt | null {
  for (const p of path) if (pointSegDist(p, c.a, c.b) <= c.r) return p;
  return null;
}
