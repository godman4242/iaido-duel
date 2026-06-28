import { describe, it, expect } from 'vitest';
import { resolveSlash, Limb } from '../slash';

const arm: Limb = {
  id: 'arm',
  capsule: { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, r: 10 },
  severThreshold: 18,
};
const farLeg: Limb = {
  id: 'leg',
  capsule: { a: { x: 500, y: 0 }, b: { x: 600, y: 0 }, r: 10 },
  severThreshold: 18,
};
const origin = { x: 50, y: 0 };

describe('resolveSlash', () => {
  it('a stroke through the arm hits and (long stroke) severs', () => {
    const path = [
      { x: 50, y: -40 },
      { x: 50, y: 40 },
    ];
    const r = resolveSlash(
      { path, origin, reach: 300, dmgMult: 1.0, crit: false, counter: 1 },
      [arm],
      10,
      1.0,
    );
    expect(r.hits.map((h) => h.limbId)).toEqual(['arm']);
    // overlap ~2r=20 >= severThreshold 18
    expect(r.hits[0].severed).toBe(true);
    expect(r.totalDamage).toBe(Math.round(10 * 1.0 * 1.0 * 1.0 * (1 + 0.5))); // 15
  });
  it('reach gate: far limb out of reach is not hit', () => {
    const path = [
      { x: 550, y: -40 },
      { x: 550, y: 40 },
    ];
    const r = resolveSlash(
      { path, origin, reach: 120, dmgMult: 1.0, crit: false, counter: 1 },
      [farLeg],
      10,
      1.0,
    );
    expect(r.hits).toEqual([]);
    expect(r.totalDamage).toBe(0);
  });
  it('crit + counter + defenseTaken multiply into damage', () => {
    const path = [
      { x: 50, y: -5 },
      { x: 50, y: 5 },
    ]; // short nick: hits, no sever
    const r = resolveSlash(
      { path, origin, reach: 300, dmgMult: 1.4, crit: true, counter: 1.25 },
      [arm],
      10,
      1.25,
    );
    expect(r.hits[0].severed).toBe(false);
    // base = 10*1.4*1.3*1.25 = 22.75 ; *1.25 def ; *(1+0) = 28.4375 -> 28
    expect(r.totalDamage).toBe(28);
  });
});
