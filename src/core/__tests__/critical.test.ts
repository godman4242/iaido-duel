import { describe, it, expect } from 'vitest';
import {
  criticalFill,
  criticalDrainPerSwing,
  criticalAfterSwing,
  criticalAfterStanceSwitch,
  isCritReady,
  consumeCrit,
} from '../critical';
import {
  CRIT_MULT,
  CRITICAL_MAX,
  CRITICAL_FILL_PER_S,
  CRITICAL_SWING_DRAIN_BASE,
  CRITICAL_STANCE_SWITCH_DRAIN,
  WEAPON_WEIGHT,
} from '../../config/combat';
import { FIXED_DT_MS } from '../../config/timing';
import { resolveSlash, type Limb } from '../slash';

// ── Tell 7 measures (M2 blueprint §3 item 1) ────────────────────────────────────────────────

describe('critical meter — passive fill', () => {
  it('~1 s of fixed 60 Hz ticks adds CRITICAL_FILL_PER_S to the bar', () => {
    let v = 0;
    for (let i = 0; i < 60; i++) v = criticalFill(v, FIXED_DT_MS);
    expect(v).toBeCloseTo(CRITICAL_FILL_PER_S, 6);
  });

  it('fill clamps at CRITICAL_MAX, never above', () => {
    expect(criticalFill(CRITICAL_MAX, 100000)).toBe(CRITICAL_MAX);
    expect(criticalFill(CRITICAL_MAX - 0.001, 1e9)).toBe(CRITICAL_MAX);
  });
});

describe('critical meter — drain per swing scaled by weapon weight (MEASURE)', () => {
  it('N swings reduce the bar by exactly weaponDrain·N (each stance weight)', () => {
    const N = 3;
    for (const stance of ['light', 'balanced', 'heavy'] as const) {
      const w = WEAPON_WEIGHT[stance];
      let v = CRITICAL_MAX;
      for (let i = 0; i < N; i++) v = criticalAfterSwing(v, w);
      expect(v).toBe(CRITICAL_MAX - N * criticalDrainPerSwing(w));
      expect(v).toBe(CRITICAL_MAX - N * CRITICAL_SWING_DRAIN_BASE * w);
    }
  });

  it('a Heavy weapon drains strictly more than a Light weapon per swing', () => {
    expect(criticalDrainPerSwing(WEAPON_WEIGHT.heavy)).toBeGreaterThan(
      criticalDrainPerSwing(WEAPON_WEIGHT.light),
    );
    expect(WEAPON_WEIGHT.heavy).toBeGreaterThan(WEAPON_WEIGHT.light);
  });
});

describe('critical meter — full bar ⇒ next landed hit is exactly 3× (MEASURE)', () => {
  const arm: Limb = {
    id: 'arm',
    capsule: { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, r: 10 },
    severThreshold: 18,
  };
  const severingStroke = {
    path: [
      { x: 50, y: -40 },
      { x: 50, y: 40 },
    ],
    origin: { x: 50, y: 0 },
    reach: 300,
    dmgMult: 1.0,
    counter: 1,
  };

  it('at full, consumeCrit fires and the next resolveSlash returns exactly 3× base, then resets', () => {
    const ready = consumeCrit(CRITICAL_MAX);
    expect(ready.crit).toBe(true);
    expect(ready.value).toBe(0); // resets after paying out

    const base = resolveSlash({ ...severingStroke, crit: false }, [arm], 10, 1.0);
    const crit = resolveSlash({ ...severingStroke, crit: ready.crit }, [arm], 10, 1.0);
    expect(base.totalDamage).toBe(15);
    expect(crit.totalDamage).toBe(CRIT_MULT * base.totalDamage); // exactly 3× (CONTRACT)
    expect(crit.totalDamage).toBe(45);

    // the payout is one-shot: the reset meter does not crit again
    const again = consumeCrit(ready.value);
    expect(again.crit).toBe(false);
  });

  it('below full the bar is not crit-ready and consumeCrit is a no-op', () => {
    expect(isCritReady(CRITICAL_MAX - 0.001)).toBe(false);
    expect(isCritReady(CRITICAL_MAX)).toBe(true);
    const r = consumeCrit(CRITICAL_MAX - 1);
    expect(r.crit).toBe(false);
    expect(r.value).toBe(CRITICAL_MAX - 1);
  });
});

describe('critical meter — stance switch also deducts (patch behavior)', () => {
  it('a stance switch deducts CRITICAL_STANCE_SWITCH_DRAIN', () => {
    expect(criticalAfterStanceSwitch(CRITICAL_MAX)).toBe(
      CRITICAL_MAX - CRITICAL_STANCE_SWITCH_DRAIN,
    );
  });

  it('deduct clamps at 0, never negative', () => {
    expect(criticalAfterStanceSwitch(0)).toBe(0);
    expect(criticalAfterStanceSwitch(CRITICAL_STANCE_SWITCH_DRAIN / 2)).toBe(0);
  });
});

// ── Chaos suite (memory: chaos-test-everything) ─────────────────────────────────────────────

describe('critical meter — chaos / hostile input', () => {
  it('NaN and ±Infinity meter values sanitize into [0, CRITICAL_MAX]', () => {
    expect(criticalFill(NaN, FIXED_DT_MS)).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(criticalFill(NaN, FIXED_DT_MS))).toBe(true);
    expect(criticalAfterSwing(NaN, WEAPON_WEIGHT.light)).toBe(0);
    expect(criticalAfterStanceSwitch(NaN)).toBe(0);
    expect(criticalFill(Infinity, 0)).toBe(CRITICAL_MAX);
    expect(criticalFill(-Infinity, 0)).toBe(0);
    expect(isCritReady(NaN)).toBe(false);
    expect(isCritReady(Infinity)).toBe(true); // clamps to full first — still deterministic
    expect(consumeCrit(NaN)).toEqual({ crit: false, value: 0 });
    expect(consumeCrit(Infinity)).toEqual({ crit: true, value: 0 });
  });

  it('NaN / negative dt adds nothing; +Infinity dt clamps to full (no NaN escapes)', () => {
    expect(criticalFill(40, NaN)).toBe(40);
    expect(criticalFill(40, -1000)).toBe(40); // out-of-order/negative time never drains
    expect(criticalFill(40, Infinity)).toBe(CRITICAL_MAX);
  });

  it('hostile weapon weight (NaN/negative/Infinity) never INCREASES the bar', () => {
    for (const w of [NaN, -5, -Infinity, Infinity]) {
      const after = criticalAfterSwing(50, w);
      expect(after).toBeLessThanOrEqual(50);
      expect(after).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(after)).toBe(true);
    }
    expect(criticalDrainPerSwing(-5)).toBe(0); // a negative weight cannot become a gain
  });

  it('spam: 10 000 swings + switches never leave [0, CRITICAL_MAX] and never NaN', () => {
    let v = CRITICAL_MAX;
    for (let i = 0; i < 10000; i++) {
      v = criticalAfterSwing(v, WEAPON_WEIGHT.heavy);
      if (i % 3 === 0) v = criticalAfterStanceSwitch(v);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(CRITICAL_MAX);
    }
    expect(v).toBe(0); // fully drained, floored — not negative
  });

  it('interleaved fill/drain/consume (out-of-order shapes) stays finite and in range', () => {
    let v = 0;
    const dts = [FIXED_DT_MS, -50, NaN, 1e6, 0, FIXED_DT_MS];
    for (let i = 0; i < 600; i++) {
      v = criticalFill(v, dts[i % dts.length]);
      if (i % 5 === 0) v = criticalAfterSwing(v, WEAPON_WEIGHT.balanced);
      if (i % 7 === 0) v = consumeCrit(v).value;
      if (i % 11 === 0) v = criticalAfterStanceSwitch(v);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(CRITICAL_MAX);
    }
  });
});
