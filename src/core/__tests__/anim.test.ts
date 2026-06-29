import { describe, it, expect } from 'vitest';
import { clamp01, easeOutCubic, easeInOutSine, easeInQuad, phaseAt, Segment } from '../anim';

describe('anim easing', () => {
  it('clamps and anchors endpoints', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    for (const e of [easeOutCubic, easeInOutSine, easeInQuad]) {
      expect(e(0)).toBeCloseTo(0, 6);
      expect(e(1)).toBeCloseTo(1, 6);
      expect(e(-5)).toBeCloseTo(0, 6); // clamps
      expect(e(5)).toBeCloseTo(1, 6);
    }
  });
  it('is monotonic non-decreasing', () => {
    for (const e of [easeOutCubic, easeInOutSine, easeInQuad]) {
      let prev = -1;
      for (let i = 0; i <= 10; i++) {
        const v = e(i / 10);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = v;
      }
    }
  });
});

describe('anim phaseAt', () => {
  const segs: Segment[] = [
    { name: 'windup', ms: 90 },
    { name: 'strike', ms: 100 },
    { name: 'recover', ms: 150 },
  ];
  it('reports the active segment and local eased progress', () => {
    expect(phaseAt(segs, 0)).toEqual({ name: 'windup', t: 0, done: false });
    expect(phaseAt(segs, 45)).toMatchObject({ name: 'windup', done: false });
    expect(phaseAt(segs, 45).t).toBeCloseTo(0.5, 6);
    expect(phaseAt(segs, 90)).toMatchObject({ name: 'strike', done: false }); // boundary advances
    expect(phaseAt(segs, 190).t).toBeCloseTo(0, 6); // start of recover
  });
  it('marks done past the total', () => {
    const r = phaseAt(segs, 999);
    expect(r.done).toBe(true);
    expect(r.name).toBe('recover');
    expect(r.t).toBe(1);
  });
});
