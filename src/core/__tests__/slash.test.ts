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
  it('one stroke crosses TWO foes: damages BOTH, instakills NEITHER at full HP (Tell 5)', () => {
    // each foe = a vertical torso capsule; one long horizontal sweep crosses both
    const torsoAt = (x: number): Limb => ({
      id: 'torso',
      capsule: { a: { x, y: -20 }, b: { x, y: 20 }, r: 14 },
      severThreshold: 40, // wider than the ~2r crossing, so a clean sweep does NOT sever
    });
    const path = [
      { x: -50, y: 0 },
      { x: 350, y: 0 },
    ];
    const slashOrigin = { x: -50, y: 0 };
    const FULL_HP = 60;
    const a = resolveSlash({ path, origin: slashOrigin, reach: 500, dmgMult: 1, crit: false, counter: 1 }, [torsoAt(60)], 10, 1);
    const b = resolveSlash({ path, origin: slashOrigin, reach: 500, dmgMult: 1, crit: false, counter: 1 }, [torsoAt(260)], 10, 1);
    expect(a.hits.length).toBeGreaterThan(0);
    expect(b.hits.length).toBeGreaterThan(0);
    expect(a.totalDamage).toBeGreaterThan(0);
    expect(b.totalDamage).toBeGreaterThan(0);
    expect(a.totalDamage).toBeLessThan(FULL_HP); // HP-based, not one-hit-kill
    expect(b.totalDamage).toBeLessThan(FULL_HP);
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
    // base = 10*1.4*3(CONTRACT crit)*1.25 = 52.5 ; *1.25 def ; *(1+0) = 65.625 -> 66
    expect(r.totalDamage).toBe(66);
  });
});
