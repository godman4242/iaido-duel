import { describe, it, expect } from 'vitest';
import { Sim, type SimConfig } from '../Sim';
import { ScriptedController } from '../ScriptedController';
import type { OpponentIntent } from '../OpponentController';
import {
  makeRng,
  SIM_GROUND_Y,
  STRIKE_TORSO_OFFSET,
  PLAYER_WINDUP_MS,
} from '../../config/combat-sim';
import { AI_TIERS } from '../../config/ai';
import { FIXED_DT_MS, MAX_FRAME_MS } from '../../config/timing';

// M2 port note: this file was updated with the Sim combat port (blueprint §1.C.5). The old
// assertions encoded pre-port behavior — instant strike resolution (now: strikes windup for
// PLAYER_WINDUP_MS / AI_TIERS[tier].telegraphMs before landing), a single shared atkPlusWeapon
// (now per-fighter seeds), and no spawn invuln (now SPAWN_INVULN_MS or until first slash).

const DT = FIXED_DT_MS;
const TORSO_Y = SIM_GROUND_Y - STRIKE_TORSO_OFFSET;

const baseCfg = (): SimConfig => ({
  player: { x: 300, hp: 100, atkPlusWeapon: 10, defense: 0, stance: 'balanced' },
  foes: [{ x: 450, hp: 100, atkPlusWeapon: 10, defense: 0, stance: 'balanced' }],
  rng: makeRng(1),
});

// Horizontal torso-height stroke spanning both fighters — classifies as a slash and crosses
// the default body capsule of whichever side is the target.
const slash: OpponentIntent = {
  stroke: {
    path: [
      { x: 260, y: TORSO_Y },
      { x: 520, y: TORSO_Y },
    ],
  },
};
// A slash whose path is far from every fighter: clears own spawn invuln (first slash), whiffs.
const whiff: OpponentIntent = {
  stroke: {
    path: [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ],
    verb: 'slash',
  },
};

/** Steps the sim n fixed ticks; feeds `intents[i]` (if any) on tick i (0-based). */
function run(sim: Sim, n: number, intents: Record<number, OpponentIntent> = {}) {
  const events: Array<{ tick: number; ev: ReturnType<Sim['advance']>[number] }> = [];
  for (let i = 0; i < n; i++) {
    for (const ev of sim.advance(DT, intents[i] ?? {})) events.push({ tick: i, ev });
  }
  return events;
}

describe('OpponentController seam (spec §C, §G.a)', () => {
  it('Sim runs with a ScriptedController and produces deterministic output', () => {
    const go = () => {
      const sim = new Sim(baseCfg(), new ScriptedController([{}, slash, {}, slash]));
      run(sim, 90, { 0: slash });
      return { pHp: sim.player.hp, oHp: sim.opponent.hp, t: sim.tFixed };
    };
    const a = go();
    const b = go();
    expect(a).toEqual(b); // identical across runs => deterministic
    expect(a.t).toBeCloseTo(90 * DT, 6);
  });

  it('a balanced slash within reach deals exactly round(atk*dmgMult) after its windup', () => {
    // The scripted foe slashes on its first decide(); the strike QUEUES behind the tier
    // telegraph (Tell 13) and lands only after ≥ telegraphMs. The player whiff-slashes on
    // tick 0, which clears the player's own spawn invuln (first-slash half of Tell 9) —
    // so the foe's blow can actually land.
    const sim = new Sim(baseCfg(), new ScriptedController([slash]));
    const telegraphTicks = Math.ceil(AI_TIERS.normal.telegraphMs / DT) + 2;
    run(sim, telegraphTicks, { 0: whiff });
    expect(sim.player.hp).toBe(88); // 100 - round(10 * 1.2) = 88
    expect(sim.opponent.hp).toBe(100);
  });

  it('the player strike lands only after PLAYER_WINDUP_MS (windup port)', () => {
    const sim = new Sim(baseCfg(), new ScriptedController([whiff])); // foe clears its invuln
    const windupTicks = Math.ceil(PLAYER_WINDUP_MS / DT);
    run(sim, windupTicks, { 0: slash }); // queued on tick 0, still winding up
    expect(sim.opponent.hp).toBe(100);
    run(sim, 2);
    expect(sim.opponent.hp).toBe(88);
  });

  it('the sim never needs the controller type — an empty controller drops in unchanged', () => {
    const sim = new Sim(baseCfg(), new ScriptedController([]));
    expect(() => sim.advance(DT)).not.toThrow();
    expect(sim.player.hp).toBe(100);
  });

  it('the accumulator is robust to NaN/Infinity/non-positive frames (no hang, no silent freeze)', () => {
    const sim = new Sim(baseCfg(), new ScriptedController([]));
    expect(() => sim.advance(Number.NaN)).not.toThrow();
    expect(() => sim.advance(Number.POSITIVE_INFINITY)).not.toThrow(); // must not infinite-loop
    expect(() => sim.advance(-100)).not.toThrow();
    expect(sim.tFixed).toBe(0); // none of those advanced the sim
  });

  it('a huge catch-up frame is clamped (spiral-of-death guard), not run unbounded', () => {
    const sim = new Sim(baseCfg(), new ScriptedController([]));
    sim.advance(60_000); // 60s in one call: must clamp to MAX_FRAME_MS of catch-up
    expect(sim.tFixed).toBeLessThanOrEqual(MAX_FRAME_MS);
    expect(sim.tFixed).toBeGreaterThan(0);
  });

  it('discrete intents QUEUE across sub-FIXED_DT advances (120Hz intent-drop fix)', () => {
    const sim = new Sim(baseCfg(), new ScriptedController([]));
    const half = DT / 2; // ~8.3ms deltas — the first advance completes no fixed step
    const first = sim.advance(half, slash);
    expect(first).toEqual([]); // no step ran, intent must NOT be lost
    const second = sim.advance(half); // accumulates to one full step
    expect(second.some((e) => e.type === 'slashStarted')).toBe(true);
    expect(sim.player.pendingStrike?.verb).toBe('slash');
  });
});
