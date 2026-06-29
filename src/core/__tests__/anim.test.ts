import { describe, it, expect } from 'vitest';
import { clamp01, easeOutCubic, easeInOutSine, easeInQuad, phaseAt, Segment, walkOffsets, idleOffsets } from '../anim';

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

describe('anim locomotion offsets', () => {
  it('walk: legs swing in antiphase and the cycle is periodic', () => {
    for (const p of [0, 0.13, 0.37, 0.62, 0.88]) {
      const o = walkOffsets(p);
      expect(o.footF.x).toBeCloseTo(-o.footB.x, 6); // antiphase
    }
    const a = walkOffsets(0);
    const b = walkOffsets(1); // 1 ≡ 0
    expect(a.footF.x).toBeCloseTo(b.footF.x, 6);
  });
  it('walk: vertical bob runs at 2x stride frequency', () => {
    // pelvis bob equal at phase 0 and 0.5 (two bobs per stride), differs at 0.25
    expect(walkOffsets(0).pelvis.y).toBeCloseTo(walkOffsets(0.5).pelvis.y, 6);
    expect(Math.abs(walkOffsets(0).pelvis.y - walkOffsets(0.25).pelvis.y)).toBeGreaterThan(1);
  });
  it('walk: amplitude scales offsets linearly', () => {
    expect(walkOffsets(0.25, 2).footF.x).toBeCloseTo(2 * walkOffsets(0.25, 1).footF.x, 6);
  });
  it('idle: bounded breathing, periodic, near-zero at phase 0', () => {
    expect(idleOffsets(0).chest.y).toBeCloseTo(0, 6);
    expect(Math.abs(idleOffsets(0.25).chest.y)).toBeLessThanOrEqual(2);
    expect(idleOffsets(0).head.y).toBeCloseTo(idleOffsets(1).head.y, 6);
  });
});
