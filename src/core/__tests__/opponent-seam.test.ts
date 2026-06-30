import { describe, it, expect } from 'vitest';
import { Sim, type SimConfig } from '../Sim';
import { ScriptedController } from '../ScriptedController';
import type { OpponentIntent } from '../OpponentController';

const FIXED_DT = 1000 / 60;
const baseCfg = (): SimConfig => ({
  player: { x: 0, hp: 100, stance: 'balanced' },
  opponent: { x: 150, hp: 100, stance: 'balanced' },
  atkPlusWeapon: 10,
});

// A horizontal stroke classifies as a slash (core/gesture).
const slash: OpponentIntent = { stroke: { path: [{ x: 0, y: 0 }, { x: 100, y: 2 }] } };

describe('OpponentController seam (spec §C, §G.a)', () => {
  it('Sim runs with a ScriptedController and produces deterministic output', () => {
    const run = () => {
      const sim = new Sim(baseCfg(), new ScriptedController([{}, slash, {}, slash]));
      for (let k = 0; k < 6; k++) sim.advance(FIXED_DT, k === 0 ? slash : {});
      return { pHp: sim.player.hp, oHp: sim.opponent.hp, t: sim.tFixed };
    };
    const a = run();
    const b = run();
    expect(a).toEqual(b); // identical across runs => deterministic
    expect(a.t).toBeCloseTo(6 * FIXED_DT, 6);
  });

  it('a balanced slash within reach deals exactly round(atk*dmgMult) damage', () => {
    // opponent (scripted) slashes the player once; balanced reach 200 > distance 150 => lands.
    const sim = new Sim(baseCfg(), new ScriptedController([slash]));
    sim.advance(FIXED_DT);
    expect(sim.player.hp).toBe(88); // 100 - round(10 * 1.2) = 88
    expect(sim.opponent.hp).toBe(100);
  });

  it('the sim never needs the controller type — an empty controller drops in unchanged', () => {
    const sim = new Sim(baseCfg(), new ScriptedController([]));
    expect(() => sim.advance(FIXED_DT)).not.toThrow();
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
    sim.advance(60_000); // 60s in one call: must clamp to MAX_FRAME_MS (250ms) of catch-up
    expect(sim.tFixed).toBeLessThanOrEqual(250);
    expect(sim.tFixed).toBeGreaterThan(0);
  });
});
