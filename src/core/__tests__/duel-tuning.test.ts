// core/__tests__/duel-tuning.test.ts — blueprint §3.10 (Tell 14): a Normal-tier duel is
// winnable, losable, and paced inside DUEL_TARGET_SECONDS. Owner: s-tune.
//
// Harness: seeded full duels on core/Sim vs the real AISeamController (Normal tier), player
// driven by deterministic policies fed through advance() — the same intent surface DuelScene
// uses. Deliberately NO `block` intent: the player's real input map has no block key, so
// "good play" must win with gestures/movement/stance swaps only.
//  • good-play: counter-stances (light beats the heavy ronin), retreats out of the frozen
//    strike line during the AI's telegraph (jump-over escape when cornered), and punishes
//    only while the AI is committed/recovering — "times slashes outside telegraphs".
//  • no-play: never acts. The AI must always kill it (the losable half of Tell 14).
// Measures (blueprint §3.10 — do NOT widen): over ≥20 seeded sims, good-play win-rate ≥ 0.8,
// no-play win-rate = 0, median good-play duration ∈ [DUEL_TARGET_SECONDS.min, max].
//
// Re-targeting note (standing open decision): the source longplays show much faster kills
// (~5–6 s) than the spec's 20–60 s target — the spec is the authority today. Everything here
// reads DUEL_TARGET_SECONDS / AI_TIERS / seeds from config, so a feel re-target is a config
// edit (AI_TIERS.normal pacing + DUEL_TARGET_SECONDS); these tests re-measure automatically.
import { describe, it, expect } from 'vitest';
import { Sim, type PlayerIntent } from '../Sim';
import { AISeamController } from '../AISeamController';
import {
  makeRng,
  SIM_GROUND_Y,
  STRIKE_TORSO_OFFSET,
  SPAWN_X_FRAC,
  PLAYER_BASE,
  ENEMY_BASE,
  PROJECTILE_MAX_ACTIVE,
} from '../../config/combat-sim';
import { FOCUS_SWITCH_COST } from '../../config/combat';
import { DUEL_TARGET_SECONDS } from '../../config/ai';
import { STANCE_TABLE, STANCE_BEATS, type StanceId } from '../../config/stances';
import { FIXED_DT_MS } from '../../config/timing';
import { GAME_W, ARENA_MARGIN } from '../../config/layout';

const DT = FIXED_DT_MS;
const TORSO_Y = SIM_GROUND_Y - STRIKE_TORSO_OFFSET;
/** Harness cap well above DUEL_TARGET_SECONDS.max — a duel hitting it is a stalemate bug. */
const MAX_DUEL_S = 120;
const MAX_TICKS = Math.ceil((MAX_DUEL_S * 1000) / DT);
/** ≥20 seeded sims per the blueprint measure; consecutive seeds — no cherry-picking. */
const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);

/** Inverse of the counter triangle: the stance that BEATS `x`. */
const BEATEN_BY = (() => {
  const out = {} as Record<StanceId, StanceId>;
  for (const w of Object.keys(STANCE_BEATS) as StanceId[]) out[STANCE_BEATS[w]] = w;
  return out;
})();

type Policy = (sim: Sim) => PlayerIntent;

interface DuelOutcome {
  winner: 'player' | 'opponent' | null;
  seconds: number;
  over: boolean;
  playerHits: number; // hitLanded events by the player (policy-liveness guard)
  playerSwitches: number; // stanceSwitched events by the player (counter-stance guard)
  sim: Sim; // end-state inspection (chaos battery)
}

/** One seeded Normal-tier duel with the real spawn/HP/atk seeds DuelScene will use. */
function runDuel(seedNum: number, policy: Policy): DuelOutcome {
  const rng = makeRng(seedNum);
  const sim = new Sim(
    {
      player: { x: GAME_W * SPAWN_X_FRAC.player, ...PLAYER_BASE },
      foes: [{ x: GAME_W * SPAWN_X_FRAC.opponent, ...ENEMY_BASE }],
      rng,
      tier: 'normal',
    },
    new AISeamController({ rng, tier: 'normal' }),
  );
  let playerHits = 0;
  let playerSwitches = 0;
  for (let i = 0; i < MAX_TICKS && !sim.over; i++) {
    for (const ev of sim.advance(DT, policy(sim))) {
      if (ev.type === 'hitLanded' && ev.actor === 'player') playerHits++;
      if (ev.type === 'stanceSwitched' && ev.actor === 'player') playerSwitches++;
    }
  }
  return { winner: sim.winner, seconds: sim.tFixed / 1000, over: sim.over, playerHits, playerSwitches, sim };
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ── policies ─────────────────────────────────────────────────────────────────────────────────

/** The losable half: never acts (spawn invuln runs its 5 s timeout, then the AI kills it). */
const noPlay: Policy = () => ({});

/** Torso-height horizontal cut from `fromX` through the foe (the standard sim slash). */
const slashThrough = (fromX: number, foeX: number): PlayerIntent => ({
  stroke: {
    path: [
      { x: fromX, y: TORSO_Y },
      { x: foeX + (foeX >= fromX ? 1 : -1) * 60, y: TORSO_Y },
    ],
    verb: 'slash',
  },
});

/**
 * Good play (deterministic hit-and-run duelist — pure function of sim state):
 *  1. counter-stance toward what beats the foe — but only into a stance whose reach still
 *     out-ranges the foe's blade after a full-telegraph retreat (light is the only one;
 *     shorter-reach counters would have to trade instead of hit-and-run).
 *  2. while the foe telegraphs, its strike line/reach are FROZEN — walk out of them; when
 *     cornered against the arena wall, jump clean over the foe instead.
 *  3. punish only while the foe is committed (windup spent / recovery lock) — the AI can
 *     only block or smoke-dodge from its approach state, never mid-commit.
 */
function makeGoodPlay(): Policy {
  return (sim) => {
    const me = sim.player;
    const foe = sim.foes[0];
    const dist = Math.abs(foe.x - me.x);
    const myReach = STANCE_TABLE[me.stance].reach;
    const canAct =
      me.busyMs === 0 && !me.pendingStrike && me.airborneMs === 0 && me.smokeMs === 0;
    const foeTelegraphing = (foe.windupMs > 0 && !!foe.pendingStrike) || foe.pendingSmokeMs > 0;
    const foeCommitted = foe.busyMs > 0 && foe.iFramesMs === 0 && foe.invulnMs === 0;

    // 1. counter-stance (Tell 8 in play) while the foe cannot punish the swap
    const counter = BEATEN_BY[foe.stance];
    if (
      canAct &&
      me.stance !== counter &&
      me.focus >= FOCUS_SWITCH_COST &&
      STANCE_TABLE[counter].reach >= 280 &&
      (foeTelegraphing || foe.busyMs > 0)
    ) {
      return { switchStance: counter };
    }

    // 2. dodge the committed strike: its path/reach were frozen when it queued
    if (foeTelegraphing && !me.pendingStrike) {
      const away: -1 | 1 = me.x <= foe.x ? -1 : 1;
      const room = away === -1 ? me.x - ARENA_MARGIN : GAME_W - ARENA_MARGIN - me.x;
      if (room >= 170) return { move: away };
      if (canAct) {
        // cornered — jump over the foe to the open side (out of the frozen line's span)
        const overX = foe.x + (foe.x >= me.x ? 1 : -1) * 150;
        return {
          stroke: {
            path: [
              { x: me.x, y: TORSO_Y },
              { x: overX, y: TORSO_Y },
            ],
            verb: 'jump',
          },
        };
      }
      return { move: away };
    }

    // 3. punish the recovery
    if (foeCommitted && canAct && foe.hp > 0) {
      if (dist <= myReach) return slashThrough(me.x, foe.x);
      return { move: me.x < foe.x ? 1 : -1 }; // close in while it recovers
    }

    return {}; // foe idle/approaching: hold ground and bait the telegraph
  };
}

/** Chaos policy: mashes every discrete intent every tick plus all held fields. */
const kitchenSink: Policy = (sim) => ({
  ...slashThrough(sim.player.x, sim.foes[0].x),
  switchStance: 'heavy',
  useSkill: ((sim.tFixed / DT) % 3 === 0 ? 1 : 3) as 1 | 3,
  smokeBomb: true,
  throwProjectile: true,
  move: sim.player.x < sim.foes[0].x ? 1 : -1,
  shunpoHold: true,
});

// ── measured outcomes (computed once — every test below reads these) ────────────────────────
const goodOutcomes = SEEDS.map((s) => runDuel(s, makeGoodPlay()));
const noPlayOutcomes = SEEDS.map((s) => runDuel(s, noPlay));

// ── blueprint §3.10 measures (Tell 14) ───────────────────────────────────────────────────────
describe('duel tuning — Normal tier is winnable, losable, and paced (blueprint §3.10, Tell 14)', () => {
  it(`good-play win-rate ≥ 0.8 over ${SEEDS.length} seeded sims (winnable)`, () => {
    const wins = goodOutcomes.filter((o) => o.winner === 'player').length;
    expect(wins / goodOutcomes.length).toBeGreaterThanOrEqual(0.8);
  });

  it('no-play win-rate is 0 — the Normal AI always kills a passive player (losable)', () => {
    for (const o of noPlayOutcomes) {
      expect(o.over).toBe(true); // the AI closes it out — no stalemate/timeout
      expect(o.winner).toBe('opponent');
    }
  });

  it('median good-play duel duration is inside DUEL_TARGET_SECONDS', () => {
    const med = median(goodOutcomes.map((o) => o.seconds));
    expect(med).toBeGreaterThanOrEqual(DUEL_TARGET_SECONDS.min);
    expect(med).toBeLessThanOrEqual(DUEL_TARGET_SECONDS.max);
  });

  it('every measured duel terminates before the harness cap (no stalemate path)', () => {
    for (const o of [...goodOutcomes, ...noPlayOutcomes]) {
      expect(o.over).toBe(true);
      expect(o.seconds).toBeGreaterThan(0);
      expect(o.seconds).toBeLessThan(MAX_DUEL_S);
      expect(Number.isFinite(o.seconds)).toBe(true);
    }
  });
});

// ── harness integrity (a broken policy or rng leak must fail loudly, not pass vacuously) ────
describe('duel tuning — harness integrity', () => {
  it('same seed ⇒ byte-identical outcome (seeded-sim determinism)', () => {
    const a = runDuel(5, makeGoodPlay());
    const b = runDuel(5, makeGoodPlay());
    expect(a.winner).toBe(b.winner);
    expect(a.seconds).toBe(b.seconds);
    expect(a.playerHits).toBe(b.playerHits);
    expect(a.playerSwitches).toBe(b.playerSwitches);
  });

  it('good-play actually plays: lands hits AND uses the counter-stance in every duel', () => {
    for (const o of goodOutcomes) {
      expect(o.playerHits).toBeGreaterThan(0); // offense is live
      expect(o.playerSwitches).toBeGreaterThanOrEqual(1); // counter-stance is live (Tell 8)
    }
  });

  it('no-play never lands a hit (the policy is genuinely passive)', () => {
    for (const o of noPlayOutcomes) expect(o.playerHits).toBe(0);
  });
});

// ── chaos battery (memory: chaos-test-everything) ────────────────────────────────────────────
describe('duel tuning — chaos: intent-mashing duels stay finite and sane', () => {
  it('kitchen-sink mashing terminates with a valid winner and finite, bounded state', () => {
    for (const s of SEEDS.slice(0, 5)) {
      const o = runDuel(s, kitchenSink);
      expect(o.over).toBe(true); // no hang, no stalemate
      expect(o.winner === 'player' || o.winner === 'opponent').toBe(true);
      expect(Number.isFinite(o.seconds)).toBe(true);
      // end-state sanity: HP within [0, hpMax], meters finite, projectile cap respected
      const { player, foes, projectiles } = o.sim;
      for (const f of [player, ...foes]) {
        expect(f.hp).toBeGreaterThanOrEqual(0);
        expect(f.hp).toBeLessThanOrEqual(f.hpMax);
        expect(Number.isFinite(f.x)).toBe(true);
        expect(Number.isFinite(f.focus)).toBe(true);
        expect(Number.isFinite(f.critical)).toBe(true);
      }
      expect(projectiles.length).toBeLessThanOrEqual(PROJECTILE_MAX_ACTIVE);
    }
  });

  it('a policy that returns hostile intents every tick cannot hang or corrupt the duel', () => {
    const hostile: Policy = (sim) => ({
      stroke: {
        path: [
          { x: Number.NaN, y: Number.POSITIVE_INFINITY },
          { x: -1e9, y: 1e9 },
        ],
        verb: 'slash',
      },
      switchStance: 'nonsense' as StanceId,
      move: 2 as unknown as 1, // out-of-domain move
      useSkill: 99 as unknown as 1,
      smokeBomb: true,
      shunpoHold: sim.tFixed % 2 === 0,
    });
    const o = runDuel(3, hostile);
    expect(o.over).toBe(true); // hostile player still dies to the AI (or duel otherwise ends)
    expect(Number.isFinite(o.seconds)).toBe(true);
    expect(Number.isFinite(o.sim.player.hp)).toBe(true);
    expect(o.sim.player.hp).toBeGreaterThanOrEqual(0);
  });
});
