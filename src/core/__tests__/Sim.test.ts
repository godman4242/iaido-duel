import { describe, it, expect } from 'vitest';
import { Sim, type SimConfig, type SimEvent, type FighterSeed } from '../Sim';
import { ScriptedController } from '../ScriptedController';
import { AISeamController } from '../AISeamController';
import type { OpponentIntent } from '../OpponentController';
import type { Limb } from '../slash';
import { criticalDrainPerSwing } from '../critical';
import { stepProjectile, projectileOverlaps, projectileOffArena } from '../projectile';
import {
  makeRng,
  SIM_GROUND_Y,
  STRIKE_TORSO_OFFSET,
  PLAYER_WINDUP_MS,
  PLAYER_MOVE_SPEED,
  SMOKE_BOMB_DISTANCE,
  SMOKE_BOMB_MS,
  SMOKE_BOMB_IFRAMES_MS,
  SMOKE_BOMB_COOLDOWN_MS,
  DEFLECT_WINDOW_MS,
  PROJECTILE_DMG,
  SHUNPO_MAX,
  SHUNPO_DRAIN_PER_MS,
  SHUNPO_TIMESCALE,
  SPAWN_INVULN_MS,
} from '../../config/combat-sim';
import {
  CHI_PUNCH_DMG_L1,
  CRIT_MULT,
  CRITICAL_MAX,
  CRITICAL_FILL_PER_MS,
  FOCUS_START,
  FOCUS_SWITCH_COST,
  FOCUS_GAIN_HIT,
  WEAPON_WEIGHT,
  JUMP_MS,
  LAUNCH_KNOCKUP,
  SPECIAL_MS,
} from '../../config/combat';
import { FIXED_DT_MS, SLASH_FRAMES } from '../../config/timing';
import { AI_TIERS, ENEMY_SPEED } from '../../config/ai';
import { ARENA_MARGIN } from '../../config/layout';
import type { StanceId } from '../../config/stances';

// ── shared fixtures ──────────────────────────────────────────────────────────────────────────
const DT = FIXED_DT_MS;
const TORSO_Y = SIM_GROUND_Y - STRIKE_TORSO_OFFSET;
/** Ticks a countdown of `ms` needs to reach zero (tickDown ceil semantics; never −0). */
const ticksFor = (ms: number) => Math.max(0, Math.ceil(ms / DT - 1e-9));
const WINDUP_TICKS = ticksFor(PLAYER_WINDUP_MS); // 0 — the drawn slash resolves the tick it lands
const BUSY_TICKS_BAL =
  SLASH_FRAMES.balanced.windup + SLASH_FRAMES.balanced.active + SLASH_FRAMES.balanced.recovery; // 21

const seed = (over: Partial<FighterSeed> = {}): FighterSeed => ({
  x: 300,
  hp: 100,
  atkPlusWeapon: 10,
  defense: 0,
  stance: 'balanced',
  deflectLearned: true,
  ...over,
});

const cfg = (over: Partial<SimConfig> = {}): SimConfig => ({
  player: seed(),
  foes: [seed({ x: 450, atkPlusWeapon: 10, deflectLearned: false })],
  rng: makeRng(1),
  ...over,
});

// Horizontal torso-height stroke crossing the foe's default body capsule (x=450).
const slash: OpponentIntent = {
  stroke: {
    path: [
      { x: 260, y: TORSO_Y },
      { x: 520, y: TORSO_Y },
    ],
  },
};
// Wide stroke also crossing dummies out to x≈560.
const wideSlash: OpponentIntent = {
  stroke: {
    path: [
      { x: 260, y: TORSO_Y },
      { x: 580, y: TORSO_Y },
    ],
  },
};
// A slash far from every fighter: clears own spawn invuln (first-slash half), always whiffs.
const whiff: OpponentIntent = {
  stroke: {
    path: [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ],
    verb: 'slash',
  },
};
const stab: OpponentIntent = {
  stroke: {
    path: [
      { x: 300, y: TORSO_Y - 30 },
      { x: 300, y: TORSO_Y + 30 },
    ],
  },
};

type Tagged = { tick: number; ev: SimEvent };

/** Advance n fixed ticks; feeds intents[i] on tick i; per-tick `always` merged into every feed. */
function run(
  sim: Sim,
  n: number,
  intents: Record<number, OpponentIntent> = {},
  always: OpponentIntent = {},
): Tagged[] {
  const out: Tagged[] = [];
  for (let i = 0; i < n; i++) {
    for (const ev of sim.advance(DT, { ...always, ...(intents[i] ?? {}) })) out.push({ tick: i, ev });
  }
  return out;
}

const ofType = <T extends SimEvent['type']>(evs: Tagged[], type: T) =>
  evs.filter((e) => e.ev.type === type) as Array<{ tick: number; ev: Extract<SimEvent, { type: T }> }>;

/** Serializable full-state snapshot — the byte-identical determinism measure reads this. */
const snap = (sim: Sim) =>
  JSON.parse(
    JSON.stringify({
      t: sim.tFixed,
      p: sim.player,
      f: sim.foes,
      pr: sim.projectiles,
      ts: sim.timeScale,
      over: sim.over,
      winner: sim.winner,
    }),
  );

// ── §3.2 determinism + known-script kill ─────────────────────────────────────────────────────
describe('Sim combat port — determinism (blueprint §3.2 measure)', () => {
  const killRun = () => {
    const sim = new Sim(cfg(), new ScriptedController([whiff])); // foe clears own invuln, then idles
    const trace: unknown[] = [];
    const events: Tagged[] = [];
    for (let i = 0; i < 400; i++) {
      for (const ev of sim.advance(DT, slash)) events.push({ tick: i, ev }); // slash spam every tick
      if (i % 10 === 0) trace.push(snap(sim));
    }
    trace.push(snap(sim));
    return { sim, events, json: JSON.stringify(trace) };
  };

  it('a ScriptedController full duel produces a byte-identical state trace across two runs', () => {
    const a = killRun();
    const b = killRun();
    expect(a.json).toBe(b.json); // byte-identical JSON.stringify state trace
    expect(a.sim.over).toBe(true);
    expect(a.sim.winner).toBe(b.sim.winner);
  });

  it('a known script kills the opponent at the exact expected tick', () => {
    const { sim, events } = killRun();
    // dmg/hit = round(10 atk × 1.2 balanced) = 12 → hits to kill 100 HP:
    const hits = Math.ceil(100 / 12); // 9
    // cadence: queue → WINDUP_TICKS → land → BUSY_TICKS_BAL busy → re-queue same tick busy ends
    const expectedTick = (WINDUP_TICKS + BUSY_TICKS_BAL) * (hits - 1) + WINDUP_TICKS; // 366
    const kills = ofType(events, 'killBeat');
    expect(kills).toHaveLength(1);
    expect(kills[0].tick).toBe(expectedTick);
    expect(kills[0].ev.winner).toBe('player');
    expect(sim.winner).toBe('player');
    expect(sim.foes[0].hp).toBe(0);
    // busy lock drops spammed strikes deterministically: exactly one slashStarted per cycle
    expect(ofType(events, 'slashStarted').filter((e) => e.ev.actor === 'player')).toHaveLength(hits);
    // focus economy: first landed hit pays FOCUS_GAIN_HIT on top of FOCUS_START
    const firstHit = ofType(events, 'hitLanded')[0];
    expect(firstHit.tick).toBe(WINDUP_TICKS);
    expect(firstHit.ev.dmg).toBe(12);
    expect(sim.player.combo).toBe(hits); // combo window (1200ms) spans the 43-tick cadence
  });

  it('an AISeamController duel with a shared seeded rng is byte-identical across runs and ends', () => {
    const duel = () => {
      const rng = makeRng(1234);
      const sim = new Sim(
        cfg({ foes: [seed({ x: 450, atkPlusWeapon: 7, deflectLearned: false })], rng }),
        new AISeamController({ rng, tier: 'normal' }),
      );
      const trace: unknown[] = [];
      let ticks = 0;
      for (; ticks < 7200 && !sim.over; ticks++) {
        sim.advance(DT, slash);
        if (ticks % 20 === 0) trace.push(snap(sim));
      }
      trace.push(snap(sim));
      return { json: JSON.stringify(trace), winner: sim.winner, ticks, over: sim.over };
    };
    const a = duel();
    const b = duel();
    expect(a.over).toBe(true); // the duel ENDS (no stalemate) within 2 min of sim time
    expect(a.json).toBe(b.json);
    expect(a.winner).toBe(b.winner);
    expect(a.ticks).toBe(b.ticks);
  });
});

// ── §3.4 spawn invuln (Tell 9) ───────────────────────────────────────────────────────────────
describe('spawn invuln — SPAWN_INVULN_MS or until own first slash', () => {
  it('damage applied before 5s with no prior slash = 0 (blocked beat fires instead)', () => {
    const sim = new Sim(cfg(), new ScriptedController([slash])); // foe strikes immediately
    const evs = run(sim, ticksFor(AI_TIERS.normal.telegraphMs) + 4);
    expect(sim.player.hp).toBe(100); // player never slashed → still invulnerable
    expect(ofType(evs, 'blocked').length).toBeGreaterThan(0);
    expect(ofType(evs, 'hitLanded')).toHaveLength(0);
  });

  it('own first slash clears invuln (invulnEnded firstSlash) and damage then applies', () => {
    const sim = new Sim(cfg(), new ScriptedController([slash]));
    const evs = run(sim, ticksFor(AI_TIERS.normal.telegraphMs) + 4, { 0: whiff });
    const ended = ofType(evs, 'invulnEnded').filter((e) => e.ev.actor === 'player');
    expect(ended).toHaveLength(1);
    expect(ended[0].ev.reason).toBe('firstSlash');
    expect(ended[0].tick).toBe(0);
    expect(sim.player.invulnMs).toBe(0);
    expect(sim.player.hp).toBe(88); // foe's telegraphed slash now lands: 100 − round(10×1.2)
  });

  it('invuln times out at exactly SPAWN_INVULN_MS and exposes remaining ms for the blink', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    expect(sim.player.invulnMs).toBe(SPAWN_INVULN_MS);
    const before = ticksFor(SPAWN_INVULN_MS) - 1;
    const evs1 = run(sim, before);
    expect(sim.player.invulnMs).toBeGreaterThan(0); // still blinking
    expect(ofType(evs1, 'invulnEnded')).toHaveLength(0);
    const evs2 = run(sim, 1);
    expect(sim.player.invulnMs).toBe(0);
    const ended = ofType(evs2, 'invulnEnded');
    expect(ended.map((e) => e.ev.reason)).toEqual(['timeout', 'timeout']); // player + foe
  });

  it('CHAOS: invuln + would-be-fatal blow on the same frame → no death, no killBeat', () => {
    const sim = new Sim(
      cfg({ player: seed({ hp: 1 }) }),
      new ScriptedController([slash]), // fatal-sized blow lands ~550ms < 5s invuln
    );
    const evs = run(sim, ticksFor(AI_TIERS.normal.telegraphMs) + 4);
    expect(sim.player.hp).toBe(1);
    expect(sim.over).toBe(false);
    expect(ofType(evs, 'killBeat')).toHaveLength(0);
  });
});

// ── §3.2 Focus + stance switch, §3.3 triangle (Tell 8) ───────────────────────────────────────
describe('Focus + stance switch + triangle live in the sim', () => {
  it('switchStance costs FOCUS_SWITCH_COST, updates weaponWeight, emits stanceSwitched', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    const evs = run(sim, 2, { 0: { switchStance: 'light' } });
    const sw = ofType(evs, 'stanceSwitched');
    expect(sw).toHaveLength(1);
    expect(sw[0].ev).toMatchObject({ actor: 'player', from: 'balanced', to: 'light' });
    expect(sim.player.focus).toBe(FOCUS_START - FOCUS_SWITCH_COST);
    expect(sim.player.stance).toBe('light');
    expect(sim.player.weaponWeight).toBe(WEAPON_WEIGHT.light);
  });

  it('a second switch is denied on focus (16 < 34) with a stanceSwitchDenied beat', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    const evs = run(sim, 4, { 0: { switchStance: 'light' }, 2: { switchStance: 'heavy' } });
    const denied = ofType(evs, 'stanceSwitchDenied');
    expect(denied).toHaveLength(1);
    expect(denied[0].ev.reason).toBe('focus');
    expect(sim.player.stance).toBe('light'); // unchanged
  });

  it('CHAOS: an invalid stance id is denied (invalidId), costs nothing, does not throw', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    const evs = run(sim, 2, { 0: { switchStance: 'bogus' as StanceId } });
    const denied = ofType(evs, 'stanceSwitchDenied');
    expect(denied).toHaveLength(1);
    expect(denied[0].ev.reason).toBe('invalidId');
    expect(sim.player.focus).toBe(FOCUS_START);
    expect(sim.player.stance).toBe('balanced');
  });

  it('switching to the SAME stance is a free no-op (no cost, no event)', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    const evs = run(sim, 2, { 0: { switchStance: 'balanced' } });
    expect(ofType(evs, 'stanceSwitched')).toHaveLength(0);
    expect(ofType(evs, 'stanceSwitchDenied')).toHaveLength(0);
    expect(sim.player.focus).toBe(FOCUS_START);
  });

  it('a landed hit pays FOCUS_GAIN_HIT through the sim', () => {
    const sim = new Sim(cfg(), new ScriptedController([whiff])); // foe vulnerable from tick 0
    run(sim, WINDUP_TICKS + 2, { 0: slash });
    expect(sim.player.focus).toBe(FOCUS_START + FOCUS_GAIN_HIT);
  });

  it('counter triangle: light-vs-heavy lands ×1.25 counter; heavy defender penalizes balanced ÷1.25', () => {
    const landOne = (pStance: StanceId, fStance: StanceId): number => {
      const sim = new Sim(
        cfg({ player: seed({ stance: pStance }), foes: [seed({ x: 450, stance: fStance })] }),
        new ScriptedController([whiff]),
      );
      const evs = run(sim, WINDUP_TICKS + 2, { 0: slash });
      const hit = ofType(evs, 'hitLanded');
      expect(hit).toHaveLength(1);
      return hit[0].ev.dmg;
    };
    // light attacker: neutral (vs light) = round(10×0.9) = 9
    expect(landOne('light', 'light')).toBe(9);
    // light beats heavy: round(10 × 0.9 × 1.25 counter × 1.25 heavyTaken) = round(14.06) = 14
    expect(landOne('light', 'heavy')).toBe(14);
    // heavy DEFENDER beats balanced attacker: round(10 × 1.2 × 1.25 taken ÷ 1.25 penalty) = 12
    expect(landOne('balanced', 'heavy')).toBe(12);
    const counterHit = landOne('light', 'heavy');
    const counteredOut = landOne('balanced', 'heavy');
    expect(counterHit).toBeGreaterThan(counteredOut);
  });

  it('stance reach gates the strike (light reaches 250px where balanced whiffs)', () => {
    const at = (stance: StanceId) => {
      const sim = new Sim(
        cfg({ player: seed({ stance }), foes: [seed({ x: 550 })] }), // 250px away
        new ScriptedController([whiff]),
      );
      const evs = run(sim, WINDUP_TICKS + 2, {
        0: { stroke: { path: [{ x: 260, y: TORSO_Y }, { x: 620, y: TORSO_Y }] } },
      });
      return { hit: ofType(evs, 'hitLanded').length, whiffs: ofType(evs, 'whiffed').length };
    };
    expect(at('light').hit).toBe(1); // reach 300 ≥ 250
    expect(at('balanced').hit).toBe(0); // reach 200 < 250 → reach gate
    expect(at('balanced').whiffs).toBeGreaterThan(0);
  });

  it('stance speed gates recovery: light busy lock is shorter than heavy (SLASH_FRAMES)', () => {
    // sampled on the resolution tick itself, before any decrement → the full per-stance lock
    const busyAfter = (stance: StanceId): number => {
      const sim = new Sim(cfg({ player: seed({ stance }) }), new ScriptedController([]));
      run(sim, WINDUP_TICKS + 1, { 0: whiff });
      return sim.player.busyMs;
    };
    const frames = (s: StanceId) =>
      (SLASH_FRAMES[s].windup + SLASH_FRAMES[s].active + SLASH_FRAMES[s].recovery) * DT;
    expect(busyAfter('light')).toBeCloseTo(frames('light'), 6);
    expect(busyAfter('heavy')).toBeCloseTo(frames('heavy'), 6);
    expect(busyAfter('light')).toBeLessThan(busyAfter('heavy'));
  });
});

// ── §3.1 Critical meter in play (Tell 7) ─────────────────────────────────────────────────────
describe('Critical meter through the sim', () => {
  it('fills passively per tick and fires critReady exactly once at full', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    const fillTicks = Math.ceil(CRITICAL_MAX / (CRITICAL_FILL_PER_MS * DT)) + 5;
    const evs = run(sim, fillTicks);
    expect(sim.player.critical).toBe(CRITICAL_MAX);
    expect(ofType(evs, 'critReady').filter((e) => e.ev.actor === 'player')).toHaveLength(1);
  });

  it('at full, the next landed hit is exactly CRIT_MULT× and the bar resets (one-shot)', () => {
    const sim = new Sim(cfg(), new ScriptedController([whiff]));
    const fillTicks = Math.ceil(CRITICAL_MAX / (CRITICAL_FILL_PER_MS * DT)) + 2;
    run(sim, fillTicks);
    const evs = run(sim, WINDUP_TICKS + 2, { 0: slash });
    const hit = ofType(evs, 'hitLanded');
    expect(hit).toHaveLength(1);
    expect(hit[0].ev.crit).toBe(true);
    expect(hit[0].ev.dmg).toBe(Math.round(10 * 1.2 * CRIT_MULT)); // 36 — visible 3× crit
    expect(ofType(evs, 'critLanded')).toHaveLength(1);
    expect(sim.player.critical).toBeLessThan(CRITICAL_MAX / 2); // reset + only trickle refill
  });

  it('a swing drains by weapon weight: heavy drains strictly more than light in-sim', () => {
    const critAfterWhiff = (stance: StanceId): number => {
      const sim = new Sim(cfg({ player: seed({ stance }) }), new ScriptedController([]));
      run(sim, 300); // let the meter fill clear of the zero clamp
      run(sim, WINDUP_TICKS + 1, { 0: whiff }); // a whiffed swing still drains
      return sim.player.critical;
    };
    const light = critAfterWhiff('light');
    const heavy = critAfterWhiff('heavy');
    expect(light - heavy).toBeCloseTo(
      criticalDrainPerSwing(WEAPON_WEIGHT.heavy) - criticalDrainPerSwing(WEAPON_WEIGHT.light),
      9,
    );
    expect(heavy).toBeLessThan(light);
  });

  it('a stance switch deducts from the Critical bar (patch behavior)', () => {
    const simA = new Sim(cfg(), new ScriptedController([]));
    const simB = new Sim(cfg(), new ScriptedController([]));
    run(simA, 300);
    run(simB, 300);
    run(simA, 1);
    run(simB, 1, { 0: { switchStance: 'light' } });
    expect(simA.player.critical - simB.player.critical).toBeCloseTo(
      simA.player.critical - Math.max(0, simA.player.critical - 20),
      6,
    );
    expect(simB.player.critical).toBeLessThan(simA.player.critical);
  });

  it('CHAOS: hostile critical values (NaN/±Infinity) are sanitized by the next tick', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    sim.player.critical = Number.NaN;
    run(sim, 1);
    expect(Number.isFinite(sim.player.critical)).toBe(true);
    sim.player.critical = Number.POSITIVE_INFINITY;
    run(sim, 1);
    expect(sim.player.critical).toBeLessThanOrEqual(CRITICAL_MAX);
    sim.player.critical = -1e9;
    run(sim, 1);
    expect(sim.player.critical).toBeGreaterThanOrEqual(0);
  });
});

// ── §3.7 Chi Punch + skill slots (Tell 12) ───────────────────────────────────────────────────
describe('Chi Punch + useSkill routing', () => {
  it('useSkill 1 = Chi Punch: reduces target HP by exactly CHI_PUNCH_DMG_L1 (CONTRACT 10)', () => {
    const sim = new Sim(cfg(), new ScriptedController([whiff]));
    const evs = run(sim, WINDUP_TICKS + 2, { 0: { useSkill: 1 } });
    expect(sim.foes[0].hp).toBe(100 - CHI_PUNCH_DMG_L1);
    const landed = ofType(evs, 'chiPunchLanded');
    expect(landed).toHaveLength(1);
    expect(landed[0].ev.dmg).toBe(CHI_PUNCH_DMG_L1);
  });

  it('useSkill 2 = Smoke Bomb alias; useSkill 3 = stab special', () => {
    const simB = new Sim(cfg(), new ScriptedController([]));
    const evsB = run(simB, 2, { 0: { useSkill: 2 } });
    expect(ofType(evsB, 'smokeBombUsed')).toHaveLength(1);

    const simC = new Sim(cfg(), new ScriptedController([whiff]));
    const evsC = run(simC, 1, { 0: { useSkill: 3 } });
    // zero windup: the stab is queued AND resolved on the same tick (slashStarted carries the verb)
    const started = ofType(evsC, 'slashStarted').filter((e) => e.ev.actor === 'player');
    expect(started).toHaveLength(1);
    expect(started[0].ev.verb).toBe('stab');
    expect(simC.foes[0].hp).toBe(100 - Math.round(10 * 1.2 * 1.45)); // stab mult
    expect(simC.player.busyMs).toBeGreaterThan(0);
    expect(simC.player.busyMs).toBeLessThanOrEqual(SPECIAL_MS);
  });

  it('CHAOS: an out-of-range skill slot is ignored without throwing', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    expect(() => run(sim, 2, { 0: { useSkill: 7 as 1 } })).not.toThrow();
    expect(sim.player.pendingStrike).toBeNull();
  });
});

// ── §3.5 Smoke Bomb (Tell 10) ────────────────────────────────────────────────────────────────
describe('Smoke Bomb — teleport, i-frames, cooldown', () => {
  it('teleports by SMOKE_BOMB_DISTANCE away from the opponent over SMOKE_BOMB_MS', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    const evs = run(sim, 1, { 0: { smokeBomb: true } });
    const used = ofType(evs, 'smokeBombUsed');
    expect(used).toHaveLength(1);
    expect(used[0].ev.fromX).toBe(300);
    expect(used[0].ev.toX).toBe(300 - SMOKE_BOMB_DISTANCE); // facing +1 → away is −x
    expect(sim.player.iFramesMs).toBe(SMOKE_BOMB_IFRAMES_MS);
    run(sim, ticksFor(SMOKE_BOMB_MS) + 1);
    expect(sim.player.x).toBe(300 - SMOKE_BOMB_DISTANCE); // slide completed, sim-owned motion
  });

  it('i-frames null damage: a kunai arriving during them is blocked; without smoke it hits', () => {
    // foe throws on tick 0 (kunai reaches x≈300 at tick 9 / chases to x=120 by tick 28);
    // smoking on tick 5 grants 420ms of i-frames (ticks 5..30) covering the interception.
    const script = [{ throwProjectile: true }];
    const withSmoke = new Sim(cfg(), new ScriptedController(script));
    const evsA = run(withSmoke, 60, { 0: whiff, 5: { smokeBomb: true } });
    expect(withSmoke.player.hp).toBe(100); // i-frames blocked the kunai
    expect(ofType(evsA, 'projectileHit')).toHaveLength(0);
    expect(ofType(evsA, 'blocked').length).toBeGreaterThan(0);

    const noSmoke = new Sim(cfg(), new ScriptedController(script));
    const evsB = run(noSmoke, 60, { 0: whiff });
    expect(noSmoke.player.hp).toBe(100 - PROJECTILE_DMG);
    expect(ofType(evsB, 'projectileHit')).toHaveLength(1);
  });

  it('CHAOS: smokeBomb spam every tick respects the cooldown exactly', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    const evs = run(sim, 600, {}, { smokeBomb: true });
    const uses = ofType(evs, 'smokeBombUsed');
    // uses at tick 0 then every ceil(COOLDOWN/DT) ticks: 0, 150, 300, 450 → exactly 4 in 600
    const expected = Math.floor((600 - 1) / ticksFor(SMOKE_BOMB_COOLDOWN_MS)) + 1;
    expect(uses).toHaveLength(expected);
    expect(uses[0].tick).toBe(0);
    expect(uses[1].tick).toBe(ticksFor(SMOKE_BOMB_COOLDOWN_MS));
  });

  it('the AI smoke bomb telegraphs for ≥ tier telegraphMs before executing', () => {
    const sim = new Sim(cfg(), new ScriptedController([{ smokeBomb: true }]));
    const evs = run(sim, ticksFor(AI_TIERS.normal.telegraphMs) + 4);
    const tel = ofType(evs, 'telegraphStarted').filter((e) => e.ev.kind === 'smokeBomb');
    const used = ofType(evs, 'smokeBombUsed').filter((e) => e.ev.actor === 'opponent');
    expect(tel).toHaveLength(1);
    expect(used).toHaveLength(1);
    expect((used[0].tick - tel[0].tick) * DT).toBeGreaterThanOrEqual(AI_TIERS.normal.telegraphMs);
  });
});

// ── §3.6 Stab + Deflect + projectiles (Tell 10) ──────────────────────────────────────────────
describe('Stab + Deflect — deterministic projectile entities', () => {
  it('a projectile overlapping the stab arc during the deflect window is destroyed, deals 0', () => {
    const sim = new Sim(cfg(), new ScriptedController([{ throwProjectile: true }]));
    const evs = run(sim, 40, { 0: stab }); // stab opens deflect (window spans windup + DEFLECT_WINDOW_MS)
    expect(ofType(evs, 'deflectSuccess')).toHaveLength(1);
    expect(ofType(evs, 'projectileHit')).toHaveLength(0);
    expect(sim.player.hp).toBe(100);
    expect(sim.projectiles).toHaveLength(0); // swatted kunai despawned
  });

  it('without a stab pose the same kunai lands for PROJECTILE_DMG', () => {
    const sim = new Sim(cfg(), new ScriptedController([{ throwProjectile: true }]));
    const evs = run(sim, 40, { 0: whiff }); // clears invuln but opens no deflect window
    expect(ofType(evs, 'deflectSuccess')).toHaveLength(0);
    expect(ofType(evs, 'projectileHit')).toHaveLength(1);
    expect(sim.player.hp).toBe(100 - PROJECTILE_DMG);
  });

  it('without Deflect LEARNED the stab pose does not deflect (spec §D.1 learned flag)', () => {
    const sim = new Sim(
      cfg({ player: seed({ deflectLearned: false }) }),
      new ScriptedController([{ throwProjectile: true }]),
    );
    const evs = run(sim, 40, { 0: stab });
    expect(ofType(evs, 'deflectSuccess')).toHaveLength(0);
    expect(sim.player.hp).toBe(100 - PROJECTILE_DMG);
  });

  it('the stab itself is a committed strike: resolves after windup for STAB_DMG_MULT damage', () => {
    const sim = new Sim(cfg(), new ScriptedController([whiff]));
    run(sim, WINDUP_TICKS + 2, { 0: stab });
    expect(sim.foes[0].hp).toBe(100 - Math.round(10 * 1.2 * 1.45)); // 83
    expect(sim.player.deflectMs).toBeGreaterThan(0); // window = windup + DEFLECT_WINDOW_MS
    expect(sim.player.deflectMs).toBeLessThanOrEqual(DEFLECT_WINDOW_MS);
  });

  it('CHAOS: a deflect with no projectile in flight is harmless', () => {
    const sim = new Sim(cfg(), new ScriptedController([whiff]));
    const evs = run(sim, 60, { 0: stab });
    expect(ofType(evs, 'deflectSuccess')).toHaveLength(0);
    expect(sim.projectiles).toHaveLength(0);
  });

  it('CHAOS: throwProjectile spam is bounded by PROJECTILE_MAX_ACTIVE and never throws', () => {
    // park the fighters far apart so kunai stay in flight and the cap is actually exercised
    const sim = new Sim(
      cfg({ player: seed({ x: ARENA_MARGIN }), foes: [seed({ x: 1024 - ARENA_MARGIN })] }),
      new ScriptedController([]),
    );
    expect(() => run(sim, 120, {}, { throwProjectile: true })).not.toThrow();
    expect(sim.projectiles.length).toBeLessThanOrEqual(8);
  });
});

// ── §3.12 Shunpo (Tell 16) ───────────────────────────────────────────────────────────────────
describe('Shunpo — held slow-mo draining the power meter', () => {
  it('drains at SHUNPO_DRAIN_PER_MS while held and exposes SHUNPO_TIMESCALE', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    const evs = run(sim, 61, {}, { shunpoHold: true });
    expect(ofType(evs, 'shunpoStarted')).toHaveLength(1);
    expect(sim.timeScale).toBe(SHUNPO_TIMESCALE);
    // started on tick 0 (no drain that tick); 60 draining ticks follow
    expect(sim.player.shunpo).toBeCloseTo(SHUNPO_MAX - 60 * SHUNPO_DRAIN_PER_MS * DT, 6);
  });

  it('ends with reason "empty" when the meter empties; timeScale returns to 1', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    const drainTicks = Math.ceil(SHUNPO_MAX / (SHUNPO_DRAIN_PER_MS * DT)) + 2;
    const evs = run(sim, drainTicks + 1, {}, { shunpoHold: true });
    const ended = ofType(evs, 'shunpoEnded');
    expect(ended).toHaveLength(1);
    expect(ended[0].ev.reason).toBe('empty');
    expect(sim.player.shunpo).toBe(0);
    expect(sim.player.shunpoActive).toBe(false);
    expect(sim.timeScale).toBe(1);
  });

  it('ends with reason "released" on hold release', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    run(sim, 10, {}, { shunpoHold: true });
    const evs = run(sim, 2); // release
    const ended = ofType(evs, 'shunpoEnded');
    expect(ended).toHaveLength(1);
    expect(ended[0].ev.reason).toBe('released');
    expect(sim.timeScale).toBe(1);
  });

  it('CHAOS: holding with an empty meter cannot restart it (no event spam)', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    const drainTicks = Math.ceil(SHUNPO_MAX / (SHUNPO_DRAIN_PER_MS * DT)) + 2;
    run(sim, drainTicks, {}, { shunpoHold: true }); // drained empty while held
    run(sim, 5); // release
    const evs = run(sim, 120, {}, { shunpoHold: true }); // re-hold on empty meter
    expect(ofType(evs, 'shunpoStarted')).toHaveLength(0);
    expect(ofType(evs, 'shunpoEnded')).toHaveLength(0);
    expect(sim.timeScale).toBe(1);
  });
});

// ── §3.11 kill-beat trigger (Tell 15) ────────────────────────────────────────────────────────
describe('killBeat — latched exactly once, deterministic tie rule', () => {
  it('CHAOS: simultaneous fatal blows on one tick → ONE killBeat; opponent-first rule wins', () => {
    // foe strike queued t4 lands t4+32=36; the player's ZERO-windup strike queued t36 would
    // land the same tick 36 (step 5b) — the opponent's resolves first (step 3) and wins.
    // A tick-0 whiff clears the player's spawn invuln so the foe's blow can actually land.
    const oppTicks = ticksFor(AI_TIERS.normal.telegraphMs); // 32
    const playerQueueTick = 4 + oppTicks - WINDUP_TICKS; // = 36 → both would land tick 36
    const script: OpponentIntent[] = [];
    script[4] = slash;
    const sim = new Sim(
      cfg({ player: seed({ hp: 5 }), foes: [seed({ x: 450, hp: 5 })] }),
      new ScriptedController(script),
    );
    const evs = run(sim, 60, { 0: whiff, [playerQueueTick]: slash });
    const kills = ofType(evs, 'killBeat');
    expect(kills).toHaveLength(1); // never double-fires
    // documented deterministic resolution order: opponent resolves first, player dies
    expect(kills[0].ev.winner).toBe('opponent');
    expect(sim.player.hp).toBe(0);
    expect(sim.foes[0].hp).toBe(5); // the player's simultaneous blow never resolves
    expect(ofType(evs, 'hitLanded').filter((e) => e.ev.actor === 'player')).toHaveLength(0);
  });

  it('CHAOS: post-kill re-entry — further intents and ticks change nothing, no second killBeat', () => {
    const sim = new Sim(cfg({ foes: [seed({ x: 450, hp: 5 })] }), new ScriptedController([whiff]));
    const evs1 = run(sim, WINDUP_TICKS + 2, { 0: slash });
    expect(ofType(evs1, 'killBeat')).toHaveLength(1);
    const hpAfter = { p: sim.player.hp, f: sim.foes[0].hp };
    const evs2 = run(sim, 200, {}, { ...slash, smokeBomb: true, useSkill: 1 });
    expect(ofType(evs2, 'killBeat')).toHaveLength(0);
    expect(evs2).toHaveLength(0); // a finished duel emits nothing at all
    expect({ p: sim.player.hp, f: sim.foes[0].hp }).toEqual(hpAfter);
  });

  it('kill during Shunpo force-ends the slow-mo (distinct systems, timeScale restored)', () => {
    const sim = new Sim(cfg({ foes: [seed({ x: 450, hp: 5 })] }), new ScriptedController([whiff]));
    const evs = run(sim, WINDUP_TICKS + 2, { 0: { ...slash, shunpoHold: true } }, { shunpoHold: true });
    const killTick = ofType(evs, 'killBeat')[0].tick;
    const shunpoEnd = ofType(evs, 'shunpoEnded');
    expect(shunpoEnd).toHaveLength(1);
    expect(shunpoEnd[0].tick).toBe(killTick);
    expect(sim.timeScale).toBe(1); // the kill-beat ramp is presentation, sim time is neutral
  });

  it('multi-foe: one stroke damages several foes; a dummy death never fires killBeat (Tell 5)', () => {
    const sim = new Sim(
      cfg({
        player: seed({ stance: 'light' }), // reach 300 covers all three
        foes: [seed({ x: 450 }), seed({ x: 480, hp: 5 }), seed({ x: 510, hp: 5 })],
      }),
      new ScriptedController([]),
    );
    run(sim, ticksFor(SPAWN_INVULN_MS) + 1); // dummies never act — wait out their invuln
    const evs = run(sim, WINDUP_TICKS + 2, { 0: wideSlash });
    const hits = ofType(evs, 'hitLanded');
    expect(hits.map((h) => h.ev.targetIndex).sort()).toEqual([0, 1, 2]); // ONE stroke, three foes
    expect(sim.foes[1].hp).toBe(0);
    expect(sim.foes[2].hp).toBe(0);
    expect(ofType(evs, 'killBeat')).toHaveLength(0); // dummies died, duel continues
    expect(sim.over).toBe(false);
    // now kill the ronin — killBeat fires exactly once
    let kills = 0;
    for (let i = 0; i < 2000 && !sim.over; i++) {
      kills += sim.advance(DT, wideSlash).filter((e) => e.type === 'killBeat').length;
    }
    expect(kills).toBe(1);
    expect(sim.winner).toBe('player');
  });
});

// ── §3.9 AI telegraphs through the seam (Tell 13) ────────────────────────────────────────────
describe('AI telegraph ≥ AI_TIERS[tier].telegraphMs before landing', () => {
  const landOf = (evs: Tagged[]) =>
    evs.find(
      (e) =>
        (e.ev.type === 'hitLanded' || e.ev.type === 'whiffed' || e.ev.type === 'blocked') &&
        e.ev.actor === 'opponent',
    );

  it('slash: telegraphStarted → land ≥ telegraphMs (scripted through the seam)', () => {
    const sim = new Sim(cfg(), new ScriptedController([slash]));
    const evs = run(sim, ticksFor(AI_TIERS.normal.telegraphMs) + 6, { 0: whiff });
    const tel = ofType(evs, 'telegraphStarted').find((e) => e.ev.kind === 'slash');
    const land = landOf(evs);
    expect(tel).toBeDefined();
    expect(land).toBeDefined();
    expect((land!.tick - tel!.tick) * DT).toBeGreaterThanOrEqual(AI_TIERS.normal.telegraphMs);
  });

  it('lunge (stab special): telegraphStarted → land ≥ telegraphMs', () => {
    const foeStab: OpponentIntent = {
      stroke: { path: [{ x: 450, y: TORSO_Y - 20 }, { x: 450, y: TORSO_Y + 20 }] },
    };
    const sim = new Sim(cfg(), new ScriptedController([foeStab]));
    const evs = run(sim, ticksFor(AI_TIERS.normal.telegraphMs) + 6, { 0: whiff });
    const tel = ofType(evs, 'telegraphStarted').find((e) => e.ev.kind === 'lunge');
    const land = landOf(evs);
    expect(tel).toBeDefined();
    expect((land!.tick - tel!.tick) * DT).toBeGreaterThanOrEqual(AI_TIERS.normal.telegraphMs);
  });

  it('per-tier: a hard-tier strike telegraphs ≥ the hard telegraphMs (shorter, still honored)', () => {
    const sim = new Sim(cfg({ tier: 'hard' }), new ScriptedController([slash]));
    const evs = run(sim, ticksFor(AI_TIERS.hard.telegraphMs) + 6, { 0: whiff });
    const tel = ofType(evs, 'telegraphStarted').find((e) => e.ev.kind === 'slash');
    const land = landOf(evs);
    expect(tel!.ev.durationMs).toBe(AI_TIERS.hard.telegraphMs);
    expect((land!.tick - tel!.tick) * DT).toBeGreaterThanOrEqual(AI_TIERS.hard.telegraphMs);
  });

  it('AISeamController: every committing slash in a real duel telegraphs ≥ telegraphMs', () => {
    const rng = makeRng(77);
    const sim = new Sim(
      cfg({ foes: [seed({ x: 450, atkPlusWeapon: 7 })], rng }),
      new AISeamController({ rng, tier: 'normal' }),
    );
    const evs = run(sim, 1800, { 0: whiff }); // 30s of the AI fighting a passive player
    const tels = ofType(evs, 'telegraphStarted').filter((e) => e.ev.kind === 'slash');
    expect(tels.length).toBeGreaterThan(0); // the AI actually commits to strikes
    for (const tel of tels) {
      const land = evs.find(
        (e) =>
          e.tick > tel.tick &&
          (e.ev.type === 'hitLanded' || e.ev.type === 'whiffed' || e.ev.type === 'blocked') &&
          e.ev.actor === 'opponent',
      );
      if (!land) continue; // duel may end mid-windup on the last one
      expect((land.tick - tel.tick) * DT).toBeGreaterThanOrEqual(AI_TIERS.normal.telegraphMs);
    }
  });

  it('AISeamController emits the Smoke-Bomb dodge intent against a telegraphed stab', () => {
    const ai = new AISeamController({ rng: () => 0.01, tier: 'normal' }); // rng < reactDodgeChance
    const fv = (over: Record<string, unknown>) => ({
      x: 450, y: SIM_GROUND_Y, facing: -1 as const, hp: 100, hpMax: 100,
      stance: 'balanced' as StanceId, focus: 50, critical: 0, weaponWeight: 1.5,
      atkPlusWeapon: 10, defense: 0, deflectLearned: false, invulnMs: 0, hasSlashed: true,
      busyMs: 0, windupMs: 0, pendingStrike: null, smokeCooldownMs: 0, iFramesMs: 0,
      deflectMs: 0, shunpo: 100, shunpoActive: false, prevShunpoHold: false, blocking: false,
      airborneMs: 0, airborneTotalMs: 0, airFromX: 450, airToX: 450, airApex: 0,
      smokeMs: 0, smokeFromX: 450, smokeToX: 450, pendingSmokeMs: 0,
      combo: 0, comboLastHitTick: 0, critReadyLatch: false,
      ...over,
    });
    const view = (playerOver: Record<string, unknown>) => ({
      self: fv({}) as never,
      opponent: fv({ x: 300, facing: 1, ...playerOver }) as never,
      distance: 150,
      selfStance: 'balanced' as StanceId,
      opponentStance: 'balanced' as StanceId,
      tFixed: 0,
    });
    ai.decide(view({}), DT); // idle → approach (distance ≤ approachRange)
    // any positive windup reads as a telegraphed strike (PLAYER_WINDUP_MS is 0 by config,
    // so the fixture uses the tier telegraph duration as a representative held windup)
    const react = ai.decide(
      view({ windupMs: AI_TIERS.normal.telegraphMs, pendingStrike: { verb: 'stab' } }),
      DT,
    );
    expect(react.smokeBomb).toBe(true); // the react-dodge IS the smoke-bomb intent
    expect(ai.stateName()).toBe('dodge');
  });

  it('AISeamController picks the counter stance through the seam (seeded rng)', () => {
    const ai = new AISeamController({ rng: () => 0, tier: 'normal' }); // always below pick chance
    const mkView = () => ({
      self: {
        x: 800, y: SIM_GROUND_Y, facing: -1, hp: 100, hpMax: 100, stance: 'balanced',
        focus: 50, critical: 0, weaponWeight: 1.5, atkPlusWeapon: 10, defense: 0,
        deflectLearned: false, invulnMs: 0, hasSlashed: true, busyMs: 0, windupMs: 0,
        pendingStrike: null, smokeCooldownMs: 0, iFramesMs: 0, deflectMs: 0, shunpo: 100,
        shunpoActive: false, prevShunpoHold: false, blocking: false, airborneMs: 0,
        airborneTotalMs: 0, airFromX: 800, airToX: 800, airApex: 0, smokeMs: 0,
        smokeFromX: 800, smokeToX: 800, pendingSmokeMs: 0, combo: 0, comboLastHitTick: 0,
        critReadyLatch: false,
      } as never,
      opponent: {
        x: 300, y: SIM_GROUND_Y, facing: 1, hp: 100, hpMax: 100, stance: 'balanced',
        focus: 50, critical: 0, weaponWeight: 1.5, atkPlusWeapon: 10, defense: 0,
        deflectLearned: true, invulnMs: 0, hasSlashed: true, busyMs: 0, windupMs: 0,
        pendingStrike: null, smokeCooldownMs: 0, iFramesMs: 0, deflectMs: 0, shunpo: 100,
        shunpoActive: false, prevShunpoHold: false, blocking: false, airborneMs: 0,
        airborneTotalMs: 0, airFromX: 300, airToX: 300, airApex: 0, smokeMs: 0,
        smokeFromX: 300, smokeToX: 300, pendingSmokeMs: 0, combo: 0, comboLastHitTick: 0,
        critReadyLatch: false,
      } as never,
      distance: 500,
      selfStance: 'balanced' as StanceId,
      opponentStance: 'balanced' as StanceId,
      tFixed: 0,
    });
    let switched: StanceId | undefined;
    for (let i = 0; i < ticksFor(AI_TIERS.normal.reactMs) + 2 && !switched; i++) {
      switched = ai.decide(mkView(), DT).switchStance;
    }
    expect(switched).toBe('heavy'); // heavy beats the player's balanced (STANCE_BEATS)
  });
});

// ── movement, jump, launch (Tell 11 + sim-owned arcs) ────────────────────────────────────────
describe('movement + airborne arcs are sim-owned', () => {
  it('player moves at PLAYER_MOVE_SPEED; the AI side moves at the slower ENEMY_SPEED (Tell 11)', () => {
    expect(ENEMY_SPEED).toBeLessThan(PLAYER_MOVE_SPEED); // PvE foes grant charge time
    const sim = new Sim(cfg(), new ScriptedController([], ));
    run(sim, 10, {}, { move: 1 });
    expect(sim.player.x).toBeCloseTo(300 + 10 * PLAYER_MOVE_SPEED * DT, 6);

    const chase = new Sim(cfg(), new ScriptedController(Array(10).fill({ move: -1 })));
    run(chase, 10);
    expect(chase.foes[0].x).toBeCloseTo(450 - 10 * ENEMY_SPEED * DT, 6);
  });

  it('movement clamps to the arena margins (never walks out of the world)', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    run(sim, 2000, {}, { move: -1 });
    expect(sim.player.x).toBe(ARENA_MARGIN);
  });

  it('a jump stroke flies the drawn line start→end on a deterministic arc, then re-grounds', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    const jump: OpponentIntent = {
      stroke: { path: [{ x: 300, y: TORSO_Y }, { x: 380, y: TORSO_Y - 120 }] }, // dy<LAUNCH_DY → jump
    };
    const evs = run(sim, 2, { 0: jump });
    const started = ofType(evs, 'jumpStarted');
    expect(started).toHaveLength(1);
    expect(started[0].ev).toMatchObject({ fromX: 300, toX: 380, durationMs: JUMP_MS });
    run(sim, Math.ceil(JUMP_MS / DT / 2) - 2);
    expect(sim.player.y).toBeLessThan(SIM_GROUND_Y); // mid-arc, airborne
    run(sim, ticksFor(JUMP_MS));
    expect(sim.player.y).toBe(SIM_GROUND_Y); // re-grounded exactly
    expect(sim.player.x).toBe(380);
  });

  it('a landed launch knocks the target up via a sim arc (no render tween owns position)', () => {
    const sim = new Sim(cfg(), new ScriptedController([whiff]));
    const launch: OpponentIntent = {
      stroke: { path: [{ x: 320, y: TORSO_Y + 40 }, { x: 330, y: TORSO_Y - 200 }] }, // |dy|≥LAUNCH_DY
    };
    const evs = run(sim, WINDUP_TICKS + 3, { 0: launch });
    const landed = ofType(evs, 'launchLanded');
    expect(landed).toHaveLength(1);
    expect(landed[0].ev.knockUp).toBe(LAUNCH_KNOCKUP);
    expect(sim.foes[0].airborneMs).toBeGreaterThan(0);
    run(sim, 8);
    expect(sim.foes[0].y).toBeLessThan(SIM_GROUND_Y); // popped up, sim-computed
  });
});

// ── verb routing parity (port-contract risk: two classifiers drifting) ───────────────────────
describe('one classifier decision — the verb travels in the intent', () => {
  // With PLAYER_WINDUP_MS = 0 the strike is queued AND resolved on the same tick, so the
  // routed verb is observed on the slashStarted event it emits (not on pendingStrike).
  const startedVerb = (evs: Tagged[]): string | undefined =>
    ofType(evs, 'slashStarted').find((e) => e.ev.actor === 'player')?.ev.verb;

  it('an explicit verb is trusted even when the path would classify differently', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    const evs = run(sim, 1, {
      0: { stroke: { path: [{ x: 260, y: TORSO_Y }, { x: 520, y: TORSO_Y }], verb: 'stab' } },
    });
    expect(startedVerb(evs)).toBe('stab'); // horizontal path, verb wins
  });

  it('a path-only stroke is classified; an unknown verb string falls back to classification', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    const evs = run(sim, 1, {
      0: { stroke: { path: stab.stroke!.path, verb: 'teleport' as 'stab' } },
    });
    expect(startedVerb(evs)).toBe('stab'); // down-stroke → stab via classifyGesture
  });
});

// ── §4 chaos battery (remaining probes) ──────────────────────────────────────────────────────
describe('chaos battery — none may throw, hang, NaN, or double-fire', () => {
  it('a duel that never lands a hit times out clean: exactly 2 invulnEnded + 2 critReady', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    const evs = run(sim, 36_000); // 10 minutes of sim time, nobody acts
    expect(sim.over).toBe(false);
    expect(sim.player.hp).toBe(100);
    expect(sim.foes[0].hp).toBe(100);
    const types = new Set(evs.map((e) => e.ev.type));
    expect([...types].sort()).toEqual(['critReady', 'invulnEnded']);
    expect(ofType(evs, 'invulnEnded')).toHaveLength(2);
    expect(ofType(evs, 'critReady')).toHaveLength(2); // latched once per fighter, never re-fires
    for (const f of [sim.player, sim.foes[0]]) {
      for (const [k, v] of Object.entries(f)) {
        if (typeof v === 'number') expect(Number.isFinite(v), `${k} finite`).toBe(true);
      }
    }
  });

  it('zero-delta intent spam cannot grow the queue unbounded or multi-fire strikes', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    for (let i = 0; i < 1000; i++) sim.advance(0, slash); // 1000 spam calls, no time passes
    expect(sim.tFixed).toBe(0);
    const evs = run(sim, 300); // then run normally with no further intents
    // the bounded queue (INTENT_QUEUE_MAX) holds ≤8 strokes; busy-lock drops all but the first
    expect(ofType(evs, 'slashStarted').filter((e) => e.ev.actor === 'player')).toHaveLength(1);
  });

  it('every discrete intent at once in a single tick is applied in deterministic order', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    const everything: OpponentIntent = {
      ...slash,
      switchStance: 'light',
      useSkill: 1,
      smokeBomb: true,
      throwProjectile: true,
      move: 1,
      shunpoHold: true,
      block: true,
    };
    let evs: SimEvent[] = [];
    expect(() => {
      evs = sim.advance(DT, everything);
    }).not.toThrow();
    const types = evs.map((e) => e.type);
    expect(types).toContain('stanceSwitched');
    expect(types).toContain('smokeBombUsed');
    expect(types).toContain('projectileSpawned');
    expect(types).toContain('shunpoStarted');
    // deterministic order: the smoke slide begins BEFORE the strike intents are tried, so both
    // useSkill and the stroke are dropped by the smokeMs gate — no strike sneaks into a teleport
    expect(sim.player.pendingStrike).toBeNull();
  });

  it('hostile seeds (NaN/Infinity/negative) are sanitized at construction', () => {
    const sim = new Sim(
      cfg({
        player: seed({ x: Number.NaN, hp: Number.NEGATIVE_INFINITY, atkPlusWeapon: Number.NaN, defense: -5 }),
        foes: [seed({ x: Number.POSITIVE_INFINITY, hp: Number.NaN, stance: 'zzz' as StanceId })],
      }),
      new ScriptedController([]),
    );
    expect(() => run(sim, 60, {}, { move: 1 })).not.toThrow();
    expect(Number.isFinite(sim.player.x)).toBe(true);
    expect(sim.player.hp).toBeGreaterThanOrEqual(1);
    expect(sim.foes[0].stance).toBe('balanced'); // bogus stance seed falls back
  });

  it('an empty foes array never crashes the sim (guarded to a 1v1)', () => {
    const sim = new Sim(cfg({ foes: [] }), new ScriptedController([slash]));
    expect(() => run(sim, 120, { 0: slash })).not.toThrow();
    expect(sim.foes.length).toBe(1);
  });

  it('CHAOS: projectile helpers survive hostile dt/radius/position', () => {
    const p = { id: 1, x: 500, vx: -0.55, dmg: 8, fromOpponent: true };
    stepProjectile(p, Number.NaN);
    expect(p.x).toBe(500); // hostile dt moves it nowhere
    stepProjectile(p, -1000);
    expect(p.x).toBe(500);
    expect(projectileOverlaps(p, 510, Number.NaN)).toBe(false); // hostile radius → sanitized to 0
    expect(projectileOverlaps(p, 500, -5)).toBe(true); // |0| ≤ max(0,-5)=0 — exact center only
    expect(projectileOffArena({ ...p, x: Number.NaN })).toBe(true); // NaN x despawns, never lingers
  });

  it('a missing rng (hostile untyped caller) falls back instead of crashing controllers', () => {
    const bad = cfg();
    delete (bad as Partial<SimConfig>).rng;
    const sim = new Sim(bad, new ScriptedController([]));
    expect(typeof sim.rng).toBe('function');
    expect(Number.isFinite(sim.rng())).toBe(true);
  });
});

// ── M2 verification-pass regressions (adversarial-review findings) ───────────────────────────

describe('REGRESSION (M1 feel): the drawn slash resolves the SAME tick the gesture lands', () => {
  it('intent tick === slashStarted tick === hitLanded tick (PLAYER_WINDUP_MS = 0)', () => {
    expect(PLAYER_WINDUP_MS).toBe(0); // fidelity contract — instant-on-gesture-end
    const sim = new Sim(cfg(), new ScriptedController([whiff])); // foe clears own invuln t0
    const evs = run(sim, 3, { 1: slash }); // queue on tick 1 (not 0 — proves no off-by-one)
    const started = ofType(evs, 'slashStarted').filter((e) => e.ev.actor === 'player');
    const landed = ofType(evs, 'hitLanded').filter((e) => e.ev.actor === 'player');
    expect(started).toHaveLength(1);
    expect(landed).toHaveLength(1);
    expect(started[0].tick).toBe(1);
    expect(landed[0].tick).toBe(1); // zero-tick latency: gesture end → blood
  });

  it('the AI reacts to the DRAW (held strokeArmed), not to a windup that no longer exists', () => {
    // rng pinned below reactBlockChance: once the player is mid-draw, the approach-state AI
    // must enter block (M1 reaction parity: playerWindupUntil armed at stroke START).
    const ai = new AISeamController({ rng: () => 0.01, tier: 'normal' });
    const sim = new Sim(cfg(), ai);
    run(sim, 3); // idle → approach (distance 150 ≤ approachRange)
    expect(ai.stateName()).toBe('approach');
    run(sim, 6, {}, { strokeArmed: true }); // the player starts drawing
    expect(ai.stateName()).toBe('block');
    expect(sim.foes[0].blocking).toBe(true);
  });
});

describe('blocked events carry WHY the damage nulled (Tell 28: parry ≠ invulnerability null)', () => {
  it('striking a spawn-invulnerable foe → reason "invuln" (no armor-parry cue)', () => {
    const sim = new Sim(cfg(), new ScriptedController([])); // foe never acts — invuln holds
    const evs = run(sim, 2, { 0: slash });
    const blocked = ofType(evs, 'blocked');
    expect(blocked).toHaveLength(1);
    expect(blocked[0].ev.reason).toBe('invuln');
  });

  it('a held block pose → reason "block" (the true armor-parry)', () => {
    const script: OpponentIntent[] = [whiff]; // clears the foe's own spawn invuln
    for (let i = 1; i < 40; i++) script[i] = { block: true };
    const sim = new Sim(cfg(), new ScriptedController(script));
    const evs = run(sim, 10, { 5: slash });
    const blocked = ofType(evs, 'blocked');
    expect(blocked).toHaveLength(1);
    expect(blocked[0].ev.reason).toBe('block');
  });

  it('smoke i-frames → reason "iframes"', () => {
    const script: OpponentIntent[] = [whiff];
    script[2] = { smokeBomb: true }; // AI smoke telegraphs, then executes with i-frames
    const sim = new Sim(cfg(), new ScriptedController(script));
    const execTick = 2 + ticksFor(AI_TIERS.normal.telegraphMs);
    // strike INTO the slide one tick after execution (any later and the teleport carries the
    // foe beyond balanced reach — the whiff would mask the i-frame null this test measures)
    const evs = run(sim, execTick + 6, { [execTick + 1]: slash });
    const blocked = ofType(evs, 'blocked');
    expect(blocked).toHaveLength(1);
    expect(blocked[0].ev.reason).toBe('iframes');
    expect(sim.foes[0].hp).toBe(100);
  });
});

describe('§3.9 stance-flash — an AI stance switch telegraphs ≥ telegraphMs before it lands', () => {
  it('telegraphStarted(stanceFlash) → stanceSwitched ≥ AI_TIERS[tier].telegraphMs', () => {
    const sim = new Sim(cfg(), new ScriptedController([{ switchStance: 'light' }]));
    const evs = run(sim, ticksFor(AI_TIERS.normal.telegraphMs) + 4);
    const tel = ofType(evs, 'telegraphStarted').filter((e) => e.ev.kind === 'stanceFlash');
    const sw = ofType(evs, 'stanceSwitched').filter((e) => e.ev.actor === 'opponent');
    expect(tel).toHaveLength(1);
    expect(tel[0].ev.durationMs).toBe(AI_TIERS.normal.telegraphMs);
    expect(sw).toHaveLength(1);
    // the blueprint measure, verbatim: telegraph-enter → land ≥ telegraphMs
    expect((sw[0].tick - tel[0].tick) * DT).toBeGreaterThanOrEqual(AI_TIERS.normal.telegraphMs);
    expect(sim.foes[0].stance).toBe('light');
    expect(sim.foes[0].focus).toBe(FOCUS_START - FOCUS_SWITCH_COST); // charged when it lands
  });

  it('the switch does NOT apply before the telegraph expires (no instant flip)', () => {
    const sim = new Sim(cfg(), new ScriptedController([{ switchStance: 'light' }]));
    run(sim, ticksFor(AI_TIERS.normal.telegraphMs) - 1);
    expect(sim.foes[0].stance).toBe('balanced'); // still holding the stance flash
    expect(sim.foes[0].pendingStanceMs).toBeGreaterThan(0);
  });

  it('CHAOS: switch spam during a pending stance-flash cannot double-queue or double-charge', () => {
    const sim = new Sim(
      cfg(),
      new ScriptedController(Array.from({ length: 80 }, () => ({ switchStance: 'light' as const }))),
    );
    const evs = run(sim, 80);
    expect(ofType(evs, 'telegraphStarted').filter((e) => e.ev.kind === 'stanceFlash')).toHaveLength(1);
    expect(ofType(evs, 'stanceSwitched').filter((e) => e.ev.actor === 'opponent')).toHaveLength(1);
    expect(sim.foes[0].focus).toBe(FOCUS_START - FOCUS_SWITCH_COST); // charged exactly once
  });

  it('the PLAYER stance switch stays instant (Tell 8 responsiveness — no telegraph)', () => {
    const sim = new Sim(cfg(), new ScriptedController([]));
    const evs = run(sim, 1, { 0: { switchStance: 'light' } });
    expect(ofType(evs, 'stanceSwitched')).toHaveLength(1); // lands on the intent tick
    expect(ofType(evs, 'telegraphStarted')).toHaveLength(0);
    expect(sim.player.stance).toBe('light');
  });
});

describe('event payloads carry the victim (targetIndex) — the scene never re-derives it', () => {
  it('chiPunchLanded carries targetIndex 0 even when the punch is the killing blow (?foes≥2)', () => {
    const sim = new Sim(
      cfg({ foes: [seed({ x: 450, hp: CHI_PUNCH_DMG_L1 }), seed({ x: 560 })] }),
      new ScriptedController([]),
    );
    run(sim, ticksFor(SPAWN_INVULN_MS) + 1); // wait out spawn invuln (the foes never act)
    const evs = run(sim, 2, { 0: { useSkill: 1 } });
    const landed = ofType(evs, 'chiPunchLanded');
    expect(landed).toHaveLength(1);
    expect(landed[0].ev.targetIndex).toBe(0); // the ronin it killed, NOT the surviving dummy
    expect(sim.foes[0].hp).toBe(0);
    expect(sim.foes[1].hp).toBe(100); // dummy untouched — no wrong-puppet flinch source
    expect(sim.winner).toBe('player');
  });

  it('projectileHit carries the foe index a player kunai actually struck (a dummy ≠ foes[0])', () => {
    const sim = new Sim(
      cfg({ player: seed({ x: 300 }), foes: [seed({ x: 900 }), seed({ x: 450 })] }),
      new ScriptedController([]),
    );
    run(sim, ticksFor(SPAWN_INVULN_MS) + 1); // the dummies keep invuln until timeout
    const evs = run(sim, 40, { 0: { throwProjectile: true } });
    const hit = ofType(evs, 'projectileHit');
    expect(hit).toHaveLength(1);
    expect(hit[0].ev).toMatchObject({ actor: 'player', targetIndex: 1, dmg: PROJECTILE_DMG });
    expect(sim.foes[1].hp).toBe(100 - PROJECTILE_DMG); // the dummy it flew into
    expect(sim.foes[0].hp).toBe(100); // the far ronin untouched
  });

  it('an opponent kunai carries targetIndex −1 (the player)', () => {
    const sim = new Sim(cfg(), new ScriptedController([{ throwProjectile: true }]));
    const evs = run(sim, 40, { 0: whiff });
    const hit = ofType(evs, 'projectileHit');
    expect(hit).toHaveLength(1);
    expect(hit[0].ev.targetIndex).toBe(-1);
  });
});

describe('CHAOS: hostile limbsFor (shape-invalid injected limbs) never crashes the tick', () => {
  it("the finding's exact malformed limb (missing `capsule`) degrades instead of throwing", () => {
    const hostile = [
      { name: 'torso', a: { x: 450, y: TORSO_Y - 40 }, b: { x: 450, y: TORSO_Y + 40 }, r: Number.NaN },
    ];
    const sim = new Sim(
      cfg({ limbsFor: () => hostile as unknown as Limb[] }),
      new ScriptedController([whiff]),
    );
    let evs: Tagged[] = [];
    expect(() => {
      evs = run(sim, 3, { 0: slash });
    }).not.toThrow();
    // all-invalid limbs fall back to the default body capsule — the duel goes on
    expect(ofType(evs, 'hitLanded').length + ofType(evs, 'whiffed').length).toBeGreaterThan(0);
    for (const [k, v] of Object.entries(sim.foes[0])) {
      if (typeof v === 'number') expect(Number.isFinite(v), `${k} finite`).toBe(true);
    }
  });

  it('a mixed bag (null / primitive / capsule-less / valid) hit-tests only the valid limb', () => {
    const good: Limb = {
      id: 'ok',
      capsule: { a: { x: 450, y: TORSO_Y - 40 }, b: { x: 450, y: TORSO_Y + 40 }, r: 22 },
      severThreshold: Number.POSITIVE_INFINITY,
    };
    const garbage = [null, 7, 'limb', { id: 'x' }, { id: 'y', capsule: {} }, good];
    const sim = new Sim(
      cfg({ limbsFor: () => garbage as unknown as Limb[] }),
      new ScriptedController([whiff]),
    );
    const evs = run(sim, 2, { 0: slash });
    const hit = ofType(evs, 'hitLanded');
    expect(hit).toHaveLength(1);
    expect(hit[0].ev.hits.map((h) => h.limbId)).toEqual(['ok']);
  });
});

describe('AI kunai throw through the seam (Tell 10 exercisable in the running build)', () => {
  const fv = (over: Record<string, unknown>) => ({
    x: 640, y: SIM_GROUND_Y, facing: -1 as const, hp: 100, hpMax: 100,
    stance: 'balanced' as StanceId, focus: 50, critical: 0, weaponWeight: 1.5,
    atkPlusWeapon: 10, defense: 0, deflectLearned: false, invulnMs: 0, hasSlashed: true,
    busyMs: 0, windupMs: 0, pendingStrike: null, smokeCooldownMs: 0, iFramesMs: 0,
    deflectMs: 0, shunpo: 100, shunpoActive: false, prevShunpoHold: false, blocking: false,
    airborneMs: 0, airborneTotalMs: 0, airFromX: 640, airToX: 640, airApex: 0,
    smokeMs: 0, smokeFromX: 640, smokeToX: 640, pendingSmokeMs: 0,
    pendingStanceMs: 0, pendingStanceId: null, strokeArmed: false,
    combo: 0, comboLastHitTick: 0, critReadyLatch: false,
    ...over,
  });
  const view = (distance: number) => ({
    self: fv({}) as never,
    opponent: fv({ x: 640 - distance, facing: 1 }) as never,
    distance,
    selfStance: 'balanced' as StanceId,
    opponentStance: 'balanced' as StanceId,
    tFixed: 0,
  });

  it('a Normal-tier AI emits throwProjectile when the player keeps kunai range', () => {
    const ai = new AISeamController({ rng: () => 0.01, tier: 'normal' }); // below kunaiChance
    let threw = false;
    for (let i = 0; i < ticksFor(AI_TIERS.normal.reactMs) + 2 && !threw; i++) {
      threw = ai.decide(view(340), DT).throwProjectile === true;
    }
    expect(threw).toBe(true);
    expect(AI_TIERS.normal.kunaiChance).toBeGreaterThan(0); // Normal+ tiers throw (config-driven)
    expect(AI_TIERS.hard.kunaiChance).toBeGreaterThan(0);
  });

  it('the easy tier (kunaiChance 0) never throws; no tier throws inside blade range', () => {
    const easy = new AISeamController({ rng: () => 0.01, tier: 'easy' });
    const close = new AISeamController({ rng: () => 0.01, tier: 'normal' });
    for (let i = 0; i < ticksFor(AI_TIERS.easy.reactMs) * 3; i++) {
      expect(easy.decide(view(340), DT).throwProjectile).toBeUndefined();
    }
    for (let i = 0; i < ticksFor(AI_TIERS.normal.reactMs) * 3; i++) {
      expect(close.decide(view(100), DT).throwProjectile).toBeUndefined(); // 100px < band min
    }
  });

  it('integration: a retreating player draws an opponent kunai in a real seeded duel', () => {
    const rng = makeRng(5); // deterministic: this seed throws 4 kunai in the 15s window
    const sim = new Sim(
      cfg({ foes: [seed({ x: 640, atkPlusWeapon: 7 })], rng }),
      new AISeamController({ rng, tier: 'normal' }),
    );
    let spawned = 0;
    for (let i = 0; i < 900 && !sim.over; i++) {
      for (const ev of sim.advance(DT, { move: -1 })) {
        if (ev.type === 'projectileSpawned' && ev.actor === 'opponent') spawned++;
      }
    }
    expect(spawned).toBeGreaterThan(0); // the Stab+Deflect setup exists in a live duel
  });
});
