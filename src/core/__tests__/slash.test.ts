import { describe, it, expect } from 'vitest';
import { resolveSlash, defenseTerm, Limb } from '../slash';
import { counterBonus, counterPenalty } from '../stance';
import { DAMAGE_FLOOR, DEF_K } from '../../config/combat';

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

// ── M2 §3.2 — the (1 − Defense·DEF_K) term (spec §A.1, deferred from M0) ────────────────────

describe('defense term (1 − Defense·DEF_K)', () => {
  const severingStroke = {
    path: [
      { x: 50, y: -40 },
      { x: 50, y: 40 },
    ],
    origin,
    reach: 300,
    dmgMult: 1.0,
    crit: false,
    counter: 1,
  };
  const dmg = (defense: number): number =>
    resolveSlash(severingStroke, [arm], 10, 1.0, defense).totalDamage;

  it('a known Defense value produces the exact expected damage (MEASURE)', () => {
    // 10 * 1.0 * (1 - 20*0.01) * 1.5(sever) = 12
    expect(DEF_K).toBe(0.01);
    expect(dmg(20)).toBe(12);
    // 10 * (1 - 50*0.01) * 1.5 = 7.5 -> 8
    expect(dmg(50)).toBe(8);
  });

  it('Defense 0 (and the omitted argument) leaves damage unchanged', () => {
    expect(dmg(0)).toBe(15); // identical to the pre-M2 result
    expect(resolveSlash(severingStroke, [arm], 10, 1.0).totalDamage).toBe(15); // back-compat call
  });

  it('chaos: NaN/negative Defense never amplifies; huge/Infinity floors at DAMAGE_FLOOR ≥ 1', () => {
    expect(dmg(NaN)).toBe(15); // NaN → treated as 0 defense
    expect(dmg(-50)).toBe(15); // negative defense must NOT boost damage
    expect(dmg(-Infinity)).toBe(15);
    expect(dmg(1e9)).toBe(DAMAGE_FLOOR); // landed hit is floored, never 0/negative
    expect(dmg(Infinity)).toBe(DAMAGE_FLOOR);
    for (const hostile of [NaN, -1, -Infinity, 0.5, 99, 100, 101, 1e9, Infinity]) {
      const d = dmg(hostile);
      expect(Number.isFinite(d)).toBe(true);
      expect(d).toBeGreaterThanOrEqual(DAMAGE_FLOOR);
    }
  });

  it('defenseTerm() clamps: 0→1, 20→0.8, ≥100→0, hostile→sane', () => {
    expect(defenseTerm(0)).toBe(1);
    expect(defenseTerm(20)).toBeCloseTo(0.8, 12);
    expect(defenseTerm(100)).toBe(0);
    expect(defenseTerm(1e9)).toBe(0);
    expect(defenseTerm(NaN)).toBe(1);
    expect(defenseTerm(-1e9)).toBe(1); // negative clamps to 0 defense, never >1
  });
});

// ── M2 §3.3 — stance-triangle resolution in the damage path ─────────────────────────────────

describe('stance triangle in the damage path', () => {
  const nick = {
    path: [
      { x: 50, y: -5 },
      { x: 50, y: 5 },
    ], // hits, no sever
    origin,
    reach: 300,
    dmgMult: 1.0,
    crit: false,
  };

  it('Light-vs-Heavy landed hit deals EXACTLY 1.25× the neutral case (MEASURE)', () => {
    const neutral = resolveSlash(
      { ...nick, counter: counterBonus('light', 'light') },
      [arm],
      16,
      1.0,
    );
    const countered = resolveSlash(
      { ...nick, counter: counterBonus('light', 'heavy') },
      [arm],
      16,
      1.0,
    );
    expect(neutral.totalDamage).toBe(16);
    expect(countered.totalDamage).toBe(20);
    expect(countered.totalDamage).toBe(1.25 * neutral.totalDamage);
  });

  it('out-countered attacker divides by 1.25 (defenderCounterPenalty, spec §A.1)', () => {
    const neutral = resolveSlash({ ...nick, counter: 1 }, [arm], 20, 1.0);
    const penalized = resolveSlash(
      { ...nick, counter: 1, counterPenalty: counterPenalty('heavy', 'light') },
      [arm],
      20,
      1.0,
    );
    expect(neutral.totalDamage).toBe(20);
    expect(penalized.totalDamage).toBe(16); // 20 / 1.25
    expect(penalized.totalDamage * 1.25).toBe(neutral.totalDamage);
  });

  it('chaos: hostile counterPenalty (0/NaN/negative/Infinity) is treated as neutral 1', () => {
    for (const hostile of [0, NaN, -5, Infinity, -Infinity]) {
      const r = resolveSlash({ ...nick, counter: 1, counterPenalty: hostile }, [arm], 10, 1.0);
      expect(r.totalDamage).toBe(10); // divisor sanitized to 1 — never ×∞, never 0-out a landed hit
    }
  });
});

