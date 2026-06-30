import { describe, it, expect } from 'vitest';
import { bloodConeDeg, jumpArcPoint } from '../trajectory';

describe('bloodConeDeg — spray along the cut vector (Tell 19)', () => {
  it('centers the cone on the cut direction (Phaser degrees, +y down)', () => {
    expect(bloodConeDeg({ x: 1, y: 0 }, 30)).toEqual({ min: -30, max: 30 }); // rightward
    const up = bloodConeDeg({ x: 0, y: -1 }, 10);
    expect((up.min + up.max) / 2).toBeCloseTo(-90, 6); // up = 270° ≡ -90°
    const down = bloodConeDeg({ x: 0, y: 1 }, 10);
    expect((down.min + down.max) / 2).toBeCloseTo(90, 6);
    const left = bloodConeDeg({ x: -1, y: 0 }, 10);
    expect(Math.abs((left.min + left.max) / 2)).toBeCloseTo(180, 6);
  });

  it('cone width is exactly 2×spread', () => {
    const c = bloodConeDeg({ x: 1, y: 1 }, 42);
    expect(c.max - c.min).toBeCloseTo(84, 6);
  });

  it('chaos: zero / NaN direction falls back to a rightward cone, never NaN', () => {
    for (const d of [{ x: 0, y: 0 }, { x: NaN, y: 1 }, { x: 1, y: Infinity }]) {
      const c = bloodConeDeg(d, 20);
      expect(Number.isNaN(c.min) || Number.isNaN(c.max)).toBe(false);
      expect((c.min + c.max) / 2).toBe(0);
    }
  });
});

describe('jumpArcPoint — begins at start, ends at endpoint (Tell 4)', () => {
  const start = { x: 100, y: 400 };
  const end = { x: 260, y: 400 };

  it('t=0 is the start point, t=1 is the endpoint', () => {
    expect(jumpArcPoint(start, end, 95, 0)).toEqual({ x: 100, y: 400 });
    expect(jumpArcPoint(start, end, 95, 1)).toEqual({ x: 260, y: 400 });
  });

  it('peaks `apex` above the baseline at the midpoint', () => {
    const mid = jumpArcPoint(start, end, 95, 0.5);
    expect(mid.x).toBeCloseTo(180, 6);
    expect(mid.y).toBeCloseTo(400 - 95, 6); // lifted by apex (y decreases upward)
  });

  it('never dips below the baseline during the arc (apex ≥ 0)', () => {
    for (let t = 0; t <= 1.001; t += 0.1) {
      expect(jumpArcPoint(start, end, 95, t).y).toBeLessThanOrEqual(400 + 1e-9);
    }
  });

  it('chaos: out-of-range and non-finite t are clamped (no NaN escape)', () => {
    expect(jumpArcPoint(start, end, 95, -5)).toEqual(jumpArcPoint(start, end, 95, 0));
    expect(jumpArcPoint(start, end, 95, 9)).toEqual(jumpArcPoint(start, end, 95, 1));
    const nan = jumpArcPoint(start, end, 95, NaN);
    expect(Number.isNaN(nan.x) || Number.isNaN(nan.y)).toBe(false);
    expect(nan).toEqual({ x: 100, y: 400 }); // NaN → treated as t=0
  });
});
