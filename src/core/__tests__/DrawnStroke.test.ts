import { describe, it, expect } from 'vitest';
import {
  buildDrawnStroke,
  resample,
  chaikin,
  sanitize,
  polylineLength,
  type DrawnStroke,
} from '../DrawnStroke';
import { MAX_STROKE_POINTS } from '../../config/combat';
import type { Pt } from '../vec';

const P = (a: [number, number][]): Pt[] => a.map(([x, y]) => ({ x, y }));
const allFinite = (pts: Pt[]): boolean => pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

describe('DrawnStroke — resample', () => {
  it('keeps the first and last point and spaces interior points ~evenly', () => {
    const r = resample(P([[0, 0], [100, 0]]), 10);
    expect(r[0]).toEqual({ x: 0, y: 0 });
    expect(r[r.length - 1]).toEqual({ x: 100, y: 0 });
    // ~10px spacing across a 100px line => ~11 points
    expect(r.length).toBeGreaterThanOrEqual(9);
    for (let i = 1; i < r.length - 1; i++) {
      const d = Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y);
      expect(d).toBeCloseTo(10, 4);
    }
  });

  it('caps output at MAX_STROKE_POINTS even for a hugely dense path (chaos: thousands of points)', () => {
    const many = P(Array.from({ length: 5000 }, (_, i) => [i, Math.sin(i) * 5] as [number, number]));
    const r = resample(many);
    expect(r.length).toBeLessThanOrEqual(MAX_STROKE_POINTS);
    expect(allFinite(r)).toBe(true);
  });

  it('a zero-length path (all coincident points) collapses to a single point — no NaN, no hang', () => {
    const r = resample(P([[5, 5], [5, 5], [5, 5]]));
    expect(r).toEqual([{ x: 5, y: 5 }]);
  });
});

describe('DrawnStroke — chaikin smoothing', () => {
  it('preserves endpoints (a jump must start at start and end at endpoint)', () => {
    const pts = P([[0, 0], [50, 100], [100, 0]]);
    const s = chaikin(pts, 2);
    expect(s[0]).toEqual({ x: 0, y: 0 });
    expect(s[s.length - 1]).toEqual({ x: 100, y: 0 });
  });

  it('cuts corners: a jagged zigzag gets shorter and smoother', () => {
    const zig = P([[0, 0], [10, 40], [20, -40], [30, 40], [40, 0]]);
    const raw = polylineLength(zig);
    const smooth = polylineLength(chaikin(zig, 3));
    expect(smooth).toBeLessThan(raw); // corner-cutting shortens the path
    expect(smooth).toBeGreaterThan(0);
  });

  it('is a no-op below 3 points or with 0 iterations', () => {
    expect(chaikin(P([[0, 0], [1, 1]]), 2)).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(chaikin(P([[0, 0], [1, 1], [2, 2]]), 0)).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]);
  });
});

describe('DrawnStroke — build + verb', () => {
  it('a horizontal stroke yields a smooth curve, finite cut vector, slash verb', () => {
    const s = buildDrawnStroke(P([[100, 200], [180, 205], [260, 198], [340, 202]]));
    expect(s.verb).toBe('slash');
    expect(s.points.length).toBeGreaterThan(2);
    expect(allFinite(s.points)).toBe(true);
    expect(s.length).toBeGreaterThan(0);
    // cut vector points rightward, unit length
    expect(Math.hypot(s.dir.x, s.dir.y)).toBeCloseTo(1, 6);
    expect(s.dir.x).toBeGreaterThan(0.9);
  });

  it('classifies verbs from the smoothed stroke (up=jump, big-up=launch, down=stab)', () => {
    expect(buildDrawnStroke(P([[0, 0], [4, -80]])).verb).toBe('jump');
    expect(buildDrawnStroke(P([[0, 0], [4, -240]])).verb).toBe('launch');
    expect(buildDrawnStroke(P([[0, 0], [4, 200]])).verb).toBe('stab');
  });
});

describe('DrawnStroke — mouse/touch parity (spec §3)', () => {
  it('output depends only on the Pt[] — identical input path => byte-identical DrawnStroke', () => {
    const path = P([[10, 10], [60, 14], [120, 9], [180, 12]]);
    const fromMouse = buildDrawnStroke(path);
    const fromTouch = buildDrawnStroke(path.map((p) => ({ ...p }))); // a different array, same coords
    expect(fromTouch).toEqual(fromMouse); // device-independent
  });

  it('two samplings of the SAME gesture agree on verb and endpoints, points stay on the line', () => {
    const sparse = buildDrawnStroke(P([[0, 100], [200, 100]])); // touch: 2 samples
    const dense = buildDrawnStroke(
      P(Array.from({ length: 25 }, (_, i) => [i * (200 / 24), 100 + ((i % 2) - 0.5) * 1.5] as [number, number])),
    ); // mouse: 25 jittery samples of the same line
    expect(dense.verb).toBe(sparse.verb);
    expect(dense.start.x).toBeCloseTo(sparse.start.x, 1);
    expect(dense.end.x).toBeCloseTo(sparse.end.x, 1);
    for (const p of dense.points) expect(Math.abs(p.y - 100)).toBeLessThan(3); // smoothed back onto the line
  });
});

// ── CHAOS: prove the guards by feeding hostile/degenerate input (memory: chaos-test-everything) ──
describe('DrawnStroke — chaos (no throw, no hang, no NaN, no instakill)', () => {
  const ok = (s: DrawnStroke): void => {
    expect(allFinite(s.points)).toBe(true);
    expect(Number.isFinite(s.dir.x) && Number.isFinite(s.dir.y)).toBe(true);
    expect(Number.isFinite(s.length)).toBe(true); // not just non-NaN — Infinity is also forbidden
    expect(['slash', 'jump', 'launch', 'stab']).toContain(s.verb);
  };

  it('empty path → empty safe stroke', () => {
    const s = buildDrawnStroke([]);
    expect(s.points).toEqual([]);
    expect(s.length).toBe(0);
    expect(s.dir).toEqual({ x: 0, y: 0 });
    ok(s);
  });

  it('single point → single-point stroke, zero length, zero dir', () => {
    const s = buildDrawnStroke(P([[42, 42]]));
    expect(s.points).toEqual([{ x: 42, y: 42 }]);
    expect(s.length).toBe(0);
    expect(s.dir).toEqual({ x: 0, y: 0 });
    ok(s);
  });

  it('two identical points (zero-length) → no divide-by-zero', () => {
    ok(buildDrawnStroke(P([[7, 7], [7, 7]])));
  });

  it('NaN / Infinity coords are dropped; an all-garbage path becomes empty', () => {
    const mixed = buildDrawnStroke([
      { x: 0, y: 0 },
      { x: NaN, y: 10 },
      { x: 50, y: Infinity },
      { x: 100, y: 5 },
    ]);
    expect(mixed.raw.length).toBe(2); // only the two finite points survived
    ok(mixed);
    const garbage = buildDrawnStroke([
      { x: NaN, y: NaN },
      { x: Infinity, y: -Infinity },
    ]);
    expect(garbage.points).toEqual([]);
    ok(garbage);
  });

  it('huge but finite coords stay finite', () => {
    ok(buildDrawnStroke(P([[-1e9, 1e9], [1e9, -1e9]])));
  });

  it('overflow-scale coords (±1e308) never produce NaN/Infinity points, length, or direction', () => {
    const s = buildDrawnStroke(P([[-1e308, 0], [1e308, 0]]));
    ok(s); // full invariant: finite points, finite length (not Infinity), finite dir, valid verb
    expect(s.points.length).toBeGreaterThan(0);
  });

  it('thousands of hostile points terminate quickly and stay bounded', () => {
    const many = Array.from({ length: 8000 }, (_, i) => ({ x: (i * 977) % 1000, y: (i * 613) % 500 }));
    const s = buildDrawnStroke(many);
    expect(s.points.length).toBeLessThanOrEqual(MAX_STROKE_POINTS * 4 + 4); // resample cap × chaikin growth
    ok(s);
  });

  it('sanitize is total and never throws on junk', () => {
    expect(sanitize([{ x: 1, y: 2 }, { x: NaN, y: 0 }]).length).toBe(1);
    expect(() => sanitize([])).not.toThrow();
  });
});
