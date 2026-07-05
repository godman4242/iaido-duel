// core/__tests__/chaos-m2.test.ts — §4 chaos-suite reviewer probes (M2 blueprint §4).
// These close the gaps the plant-prove pass found in the existing chaos coverage:
//  1. hostile dt must not POISON the accumulator — the sim must still advance afterwards
//     (the existing no-throw/tFixed===0 probe stays green even when the finite-dt guard is
//     removed, because NaN in the accumulator freezes the sim in a way that satisfies it);
//  2. the 120Hz intent-drop contract under a sustained sub-16.67ms feed — a full second of
//     ~8.3ms frames must consume every queued discrete intent exactly once (no loss, no dupe).
import { describe, it, expect } from 'vitest';
import { Sim, type SimConfig } from '../Sim';
import { ScriptedController } from '../ScriptedController';
import type { OpponentIntent } from '../OpponentController';
import { makeRng, SIM_GROUND_Y, STRIKE_TORSO_OFFSET, PLAYER_WINDUP_MS } from '../../config/combat-sim';
import { FIXED_DT_MS, SLASH_FRAMES } from '../../config/timing';

const DT = FIXED_DT_MS;
const TORSO_Y = SIM_GROUND_Y - STRIKE_TORSO_OFFSET;

const baseCfg = (): SimConfig => ({
  player: { x: 300, hp: 100, atkPlusWeapon: 10, defense: 0, stance: 'balanced' },
  foes: [{ x: 450, hp: 100, atkPlusWeapon: 10, defense: 0, stance: 'balanced' }],
  rng: makeRng(1),
});

const slash: OpponentIntent = {
  stroke: {
    path: [
      { x: 260, y: TORSO_Y },
      { x: 520, y: TORSO_Y },
    ],
  },
};

describe('§4 chaos — hostile dt cannot poison the accumulator (silent-freeze guard)', () => {
  it('after NaN/Infinity/negative dt frames the sim STILL advances on the next real frame', () => {
    const sim = new Sim(baseCfg(), new ScriptedController([]));
    // hostile frames first — the NaN one is the accumulator-poison vector
    expect(() => sim.advance(Number.NaN)).not.toThrow();
    expect(() => sim.advance(Number.POSITIVE_INFINITY)).not.toThrow();
    expect(() => sim.advance(Number.NEGATIVE_INFINITY)).not.toThrow();
    expect(() => sim.advance(-100)).not.toThrow();
    expect(sim.tFixed).toBe(0); // hostile frames advanced nothing
    // the recovery half the original probe lacks: a real frame must still step
    sim.advance(DT);
    expect(sim.tFixed).toBeCloseTo(DT, 9); // NOT frozen — accumulator was never poisoned
    // and time keeps flowing normally afterwards — single-tick advances, because a multi-tick
    // advance may hold one tick back on ~1e-14 accumulator dust (fixed-timestep latency, not a freeze)
    sim.advance(DT);
    sim.advance(DT);
    sim.advance(DT);
    expect(sim.tFixed).toBeCloseTo(DT * 4, 9);
  });

  it('interleaving hostile dt INSIDE a running duel neither freezes time nor corrupts combat state', () => {
    const sim = new Sim(baseCfg(), new ScriptedController([]));
    sim.advance(DT, slash); // queue + consume a strike normally
    const tAfterOne = sim.tFixed;
    expect(tAfterOne).toBeCloseTo(DT, 9);
    // PLAYER_WINDUP_MS = 0: the strike resolved on its queue tick — the busy lock is the
    // live combat state a hostile burst must not corrupt (was pendingStrike pre-restore)
    const busyAfterOne = sim.player.busyMs;
    expect(busyAfterOne).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) sim.advance(Number.NaN); // mid-duel hostile burst
    expect(sim.player.busyMs).toBe(busyAfterOne); // hostile frames advanced nothing
    sim.advance(DT);
    expect(sim.tFixed).toBeCloseTo(DT * 2, 9); // still ticking
    expect(sim.player.busyMs).toBeCloseTo(busyAfterOne - DT, 9); // and time flows normally
  });
});

describe('§4 chaos — sustained 120Hz feed never loses queued intents (intent-drop contract)', () => {
  it('a full second of ~8.3ms frames consumes every discrete intent exactly once', () => {
    const sim = new Sim(baseCfg(), new ScriptedController([]));
    const half = DT / 2; // ~8.33ms — every other advance() completes no fixed step
    // Distinct, order-verifiable discrete intents fed on non-step-completing frames only:
    // stance switch (emits stanceSwitched) then smoke bomb (emits smokeBombUsed).
    const evTypes: string[] = [];
    let fed = 0;
    for (let i = 0; i < 240; i++) {
      // feed each intent ONCE, on an EVEN frame — those complete no fixed step (acc reaches
      // exactly DT only on odd calls, since DT/2 + DT/2 === DT in binary FP), so the intent
      // MUST survive the no-step advance() to be consumed by the next call's step. Feeding on
      // odd frames would let same-call ingest→step consumption mask a drop-on-no-step bug.
      let intent: OpponentIntent = {};
      if (i === 0) (intent = { switchStance: 'light' }), fed++;
      if (i === 2) (intent = { smokeBomb: true }), fed++;
      for (const ev of sim.advance(half, intent)) evTypes.push(ev.type);
    }
    expect(fed).toBe(2);
    expect(sim.tFixed).toBeCloseTo(120 * DT, 6); // 240 half-frames = 120 fixed steps ran
    expect(evTypes.filter((t) => t === 'stanceSwitched')).toHaveLength(1); // not lost, not duped
    expect(evTypes.filter((t) => t === 'smokeBombUsed')).toHaveLength(1);
    expect(sim.player.stance).toBe('light');
  });

  it('sub-frame spam of the SAME discrete intent stays bounded (no queue blowup, one strike)', () => {
    const sim = new Sim(baseCfg(), new ScriptedController([]));
    const third = DT / 3; // ~5.6ms — a 180Hz-style feed, stroke attached to EVERY call
    let slashStartedCount = 0;
    for (let i = 0; i < 360; i++) {
      for (const ev of sim.advance(third, slash)) {
        if (ev.type === 'slashStarted' && ev.actor === 'player') slashStartedCount++;
      }
    }
    // 360 third-frames = 120 steps = 2s of sim time; the busy-lock cadence admits a strike
    // only every windup+busy cycle — spam must not multi-fire within a cycle
    expect(sim.tFixed).toBeCloseTo(120 * DT, 6);
    const f = SLASH_FRAMES.balanced;
    const cycleTicks = Math.max(
      1,
      Math.ceil(PLAYER_WINDUP_MS / DT) + f.windup + f.active + f.recovery,
    );
    expect(slashStartedCount).toBeGreaterThanOrEqual(1);
    expect(slashStartedCount).toBeLessThanOrEqual(Math.ceil(120 / cycleTicks)); // one per cycle
  });
});
