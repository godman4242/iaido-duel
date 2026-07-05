// Chaos + contract tests for the pure DuelScene↔Sim glue (M2 integration).
// duel-wiring is Phaser-free, so these run without mocks.
import { describe, it, expect } from 'vitest';
import {
  STANCE_CYCLE,
  nextStance,
  clampFoeCount,
  parseTier,
  parseSeed,
  IntentBuffer,
  BlinkPlan,
  duelViewOf,
  type DuelViewSource,
} from '../duel-wiring';
import { MULTI_FOE_MAX, FOCUS_SWITCH_COST, CRITICAL_MAX } from '../../../config/combat';
import { SMOKE_BOMB_COOLDOWN_MS, SKILL_VERB } from '../../../config/combat-sim';
import { SKILL_SLOTS } from '../../../config/hud-extra';
import type { StanceId } from '../../../core/stance';

const baseView = (over: Partial<DuelViewSource> = {}): DuelViewSource => ({
  hp: 80,
  hpMax: 100,
  focus: 50,
  critical: 10,
  shunpo: 100,
  shunpoActive: false,
  stance: 'balanced',
  smokeCooldownMs: 0,
  combo: 3,
  ...over,
});

describe('duel-wiring: stance cycle (Tell 8 — SPACE/portrait rotates)', () => {
  it('cycles light → balanced → heavy → light (pre-port DuelScene order preserved)', () => {
    expect(nextStance('light')).toBe('balanced');
    expect(nextStance('balanced')).toBe('heavy');
    expect(nextStance('heavy')).toBe('light');
  });

  it('an unknown stance id resets to the cycle start instead of indexing out of bounds', () => {
    expect(nextStance('__hostile__' as StanceId)).toBe(STANCE_CYCLE[0]);
  });
});

describe('duel-wiring: URL param parsing (chaos)', () => {
  it('?foes=N clamps to [1, MULTI_FOE_MAX] and floors fractions', () => {
    expect(clampFoeCount(null)).toBe(1);
    expect(clampFoeCount('3')).toBe(Math.min(3, MULTI_FOE_MAX));
    expect(clampFoeCount('2.9')).toBe(2);
    expect(clampFoeCount('999999')).toBe(MULTI_FOE_MAX);
  });

  it('hostile foes values (NaN/±Infinity/negative/garbage) all collapse to 1', () => {
    for (const raw of ['abc', 'NaN', 'Infinity', '-Infinity', '-4', '0', '']) {
      expect(clampFoeCount(raw)).toBe(1);
    }
  });

  it('?tier= accepts only real tiers; garbage and prototype keys fall back to normal', () => {
    expect(parseTier('easy')).toBe('easy');
    expect(parseTier('hard')).toBe('hard');
    expect(parseTier(null)).toBe('normal');
    for (const raw of ['brutal', '__proto__', 'constructor', 'toString', '']) {
      expect(parseTier(raw)).toBe('normal');
    }
  });

  it('?seed= takes positive integers; everything hostile falls back finite and positive', () => {
    expect(parseSeed('42', 7)).toBe(42);
    expect(parseSeed('42.9', 7)).toBe(42);
    for (const raw of [null, '0', '-3', 'abc', 'NaN']) {
      expect(parseSeed(raw, 7)).toBe(7);
    }
    // even a hostile fallback can never produce 0/NaN (makeRng seed safety)
    for (const fb of [Number.NaN, Number.POSITIVE_INFINITY, -0, 0.4]) {
      const s = parseSeed(null, fb);
      expect(Number.isFinite(s)).toBe(true);
      expect(s).toBeGreaterThan(0);
    }
  });
});

describe('duel-wiring: IntentBuffer (one intent per frame into sim.advance)', () => {
  it('drains queued discrete intents WITH the held fields, then clears', () => {
    const b = new IntentBuffer();
    const path = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    b.queueStroke(path, 'slash');
    b.queueStance('heavy');
    b.queueSkill(1);
    expect(b.hasQueued()).toBe(true);
    const intent = b.drain({ move: 1, shunpoHold: true, strokeArmed: true });
    expect(intent.stroke).toEqual({ path, verb: 'slash' });
    expect(intent.switchStance).toBe('heavy');
    expect(intent.useSkill).toBe(1);
    expect(intent.move).toBe(1);
    expect(intent.shunpoHold).toBe(true);
    expect(intent.strokeArmed).toBe(true); // mid-draw signal reaches the sim (AI reaction)
    // second drain: discrete gone, held fields still applied
    const second = b.drain({ move: -1, shunpoHold: false });
    expect(second.stroke).toBeUndefined();
    expect(second.switchStance).toBeUndefined();
    expect(second.useSkill).toBeUndefined();
    expect(second.move).toBe(-1);
    expect(second.shunpoHold).toBe(false);
    expect(second.strokeArmed).toBe(false); // omitted held field reads false, never undefined-truthy
  });

  it('accepts exactly the configured skill slots and drops hostile slot numbers', () => {
    const b = new IntentBuffer();
    for (let slot = 1; slot <= SKILL_SLOTS.length; slot++) {
      b.queueSkill(slot);
      expect(b.drain({ move: 0, shunpoHold: false }).useSkill).toBe(slot);
    }
    for (const bad of [0, -1, SKILL_SLOTS.length + 1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      b.queueSkill(bad);
      expect(b.drain({ move: 0, shunpoHold: false }).useSkill).toBeUndefined();
    }
  });

  it('hostile held fields are neutralized (move outside -1|0|1, truthy junk shunpoHold)', () => {
    const b = new IntentBuffer();
    const intent = b.drain({
      move: 5 as unknown as -1 | 0 | 1,
      shunpoHold: 'yes' as unknown as boolean,
      strokeArmed: 1 as unknown as boolean,
    });
    expect(intent.move).toBe(0);
    expect(intent.shunpoHold).toBe(false);
    expect(intent.strokeArmed).toBe(false); // strict === true gate, truthy junk collapses
  });

  it('clear() empties the queue without draining', () => {
    const b = new IntentBuffer();
    b.queueStance('light');
    b.clear();
    expect(b.hasQueued()).toBe(false);
    expect(b.drain({ move: 0, shunpoHold: false }).switchStance).toBeUndefined();
  });
});

describe('duel-wiring: BlinkPlan (Tell 9 — blink start on FIGHT!, stop on invulnEnded)', () => {
  it('begin(foeCount) starts the player (−1) and every foe exactly once', () => {
    const plan = new BlinkPlan();
    expect(plan.begin(3)).toEqual([-1, 0, 1, 2]);
    expect(plan.begin(3)).toEqual([]); // a second FIGHT! can never double a tween per fighter
  });

  it('onInvulnEnded stops each key once — the exact-sim-frame stop, never a double-stop', () => {
    const plan = new BlinkPlan();
    plan.begin(2);
    expect(plan.onInvulnEnded(-1)).toBe(-1); // player firstSlash/timeout
    expect(plan.onInvulnEnded(-1)).toBeNull(); // already stopped — no second tween kill
    expect(plan.onInvulnEnded(0)).toBe(0);
    expect(plan.onInvulnEnded(1)).toBe(1);
    expect(plan.onInvulnEnded(1)).toBeNull();
  });

  it('CHAOS: hostile keys/counts never corrupt the plan', () => {
    const plan = new BlinkPlan();
    expect(plan.begin(Number.NaN)).toEqual([-1]); // hostile count → only the player blinks
    expect(plan.begin(-5)).toEqual([]); // negative clamps to no foes; player already tracked
    expect(plan.begin(2.9)).toEqual([0, 1]); // fractional floors; player already tracked
    expect(plan.onInvulnEnded(99)).toBeNull(); // unknown foe index — never a stray stop
    expect(plan.onInvulnEnded(Number.NaN)).toBeNull();
  });

  it('reset() forgets everything (fresh duel after R-restart)', () => {
    const plan = new BlinkPlan();
    plan.begin(1);
    plan.reset();
    expect(plan.onInvulnEnded(-1)).toBeNull(); // stale key gone
    expect(plan.begin(1)).toEqual([-1, 0]); // full restart re-blinks everyone
  });
});

describe('duel-wiring: duelViewOf (sim.player → HUD snapshot, polled per frame)', () => {
  it('maps meters/stance/combo straight through and computes critReady at CRITICAL_MAX', () => {
    const v = duelViewOf(baseView({ critical: CRITICAL_MAX }), false);
    expect(v.hp).toBe(80);
    expect(v.hpMax).toBe(100);
    expect(v.focus).toBe(50);
    expect(v.critReady).toBe(true);
    expect(v.stance).toBe('balanced');
    expect(v.combo).toBe(3);
    expect(duelViewOf(baseView({ critical: CRITICAL_MAX - 1 }), false).critReady).toBe(false);
  });

  it('stanceLocked mirrors the sim rule focus < FOCUS_SWITCH_COST (NaN focus fails closed)', () => {
    expect(duelViewOf(baseView({ focus: FOCUS_SWITCH_COST }), false).stanceLocked).toBe(false);
    expect(duelViewOf(baseView({ focus: FOCUS_SWITCH_COST - 1 }), false).stanceLocked).toBe(true);
    expect(duelViewOf(baseView({ focus: Number.NaN }), false).stanceLocked).toBe(true);
  });

  it('skill slots are index-aligned with SKILL_SLOTS/SKILL_VERB and smoke shows its cooldown', () => {
    const half = SMOKE_BOMB_COOLDOWN_MS / 2;
    const v = duelViewOf(baseView({ smokeCooldownMs: half }), false);
    expect(v.skills).toHaveLength(SKILL_SLOTS.length);
    SKILL_SLOTS.forEach((s, i) => {
      // the config mapping the HUD renders IS the verb map the sim consumes (slot i+1)
      expect(s.id).toBe(SKILL_VERB[(i + 1) as 1 | 2 | 3]);
      const slot = v.skills![i];
      if (s.id === 'smokeBomb') {
        expect(slot.enabled).toBe(false);
        expect(slot.cooldownFrac).toBeCloseTo(0.5);
      } else {
        expect(slot.enabled).toBe(true);
        expect(slot.cooldownFrac).toBe(0);
      }
    });
  });

  it('a decided duel disables every slot; hostile meters never leak NaN into fractions', () => {
    const over = duelViewOf(baseView(), true);
    for (const s of over.skills!) expect(s.enabled).toBe(false);
    const hostile = duelViewOf(
      baseView({
        smokeCooldownMs: Number.NaN,
        critical: Number.NaN,
        combo: Number.POSITIVE_INFINITY,
      }),
      false,
    );
    expect(hostile.critReady).toBe(false);
    expect(hostile.combo).toBe(0);
    for (const s of hostile.skills!) expect(Number.isFinite(s.cooldownFrac)).toBe(true);
  });
});
