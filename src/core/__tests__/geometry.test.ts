import { describe, it, expect } from 'vitest';
import {
  pointSegDist,
  segCapsuleOverlap,
  polylineCapsuleOverlap,
  firstPointInCapsule,
} from '../geometry';

const cap = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, r: 10 }; // horizontal limb, radius 10

describe('geometry', () => {
  it('pointSegDist: perpendicular and beyond-endpoint', () => {
    expect(pointSegDist({ x: 50, y: 7 }, cap.a, cap.b)).toBeCloseTo(7, 5);
    expect(pointSegDist({ x: 120, y: 0 }, cap.a, cap.b)).toBeCloseTo(20, 5); // clamps to endpoint b
  });
  it('segCapsuleOverlap: vertical stroke clean through has overlap ~= 2r', () => {
    const ov = segCapsuleOverlap({ x: 50, y: -40 }, { x: 50, y: 40 }, cap);
    expect(ov).toBeGreaterThan(16);
    expect(ov).toBeLessThan(24); // ~2*r = 20
  });
  it('segCapsuleOverlap: stroke that misses returns 0', () => {
    expect(segCapsuleOverlap({ x: 50, y: 40 }, { x: 50, y: 25 }, cap)).toBe(0);
  });
  it('polylineCapsuleOverlap sums segments; firstPointInCapsule finds entry', () => {
    const path = [
      { x: 50, y: -40 },
      { x: 50, y: 0 },
      { x: 50, y: 40 },
    ];
    expect(polylineCapsuleOverlap(path, cap)).toBeGreaterThan(16);
    expect(firstPointInCapsule(path, cap)).toEqual({ x: 50, y: 0 });
  });
});
