// core/AISeamController.ts — the AI's decisions behind the OpponentController seam (M2 port).
// Wraps the pure FSM (core/ai.nextAIState) and emits OpponentIntent — the IDENTICAL type the
// player's input produces; the sim never branches on which side made an intent (spec §C).
// game/ai/AIController.ts shrinks to a telegraph-caret/pose painter reading sim state/events.
//
// Determinism: ALL randomness comes from the injected seeded rng (config/combat-sim makeRng);
// Math.random is banned in core. One rng draw feeds the FSM every tick; the counter-stance
// pick draws once per reaction window (bounded consumption, reproducible across runs).
import { AI_TIERS, AI_APPROACH_RANGE, AI_STRIKE_RANGE, type AITier } from '../config/ai';
import { STANCE_TABLE, STANCE_BEATS, type StanceId } from '../config/stances';
import { SIM_GROUND_Y, STRIKE_TORSO_OFFSET, PROJECTILE_SPAWN_OFFSET } from '../config/combat-sim';
import { nextAIState, type AIState, type AIParams } from './ai';
import type { Pt } from './vec';
import type { CombatView, OpponentController, OpponentIntent } from './OpponentController';

/** Inverse of the counter triangle: the stance that BEATS `x` (what the AI switches toward). */
const BEATEN_BY: Record<StanceId, StanceId> = (() => {
  const out = {} as Record<StanceId, StanceId>;
  for (const winner of Object.keys(STANCE_BEATS) as StanceId[]) out[STANCE_BEATS[winner]] = winner;
  return out;
})();

export interface AISeamOpts {
  /** Seeded rng — REQUIRED (determinism); share or fork the SimConfig rng. */
  rng: () => number;
  tier?: AITier;
  /** World ground line for the synthetic slash path (must match SimConfig.groundY). */
  groundY?: number;
}

export class AISeamController implements OpponentController {
  private state: AIState = 'idle';
  private tInState = 0;
  private stanceEvalMs = 0;
  private readonly rng: () => number;
  private readonly tier: AITier;
  private readonly groundY: number;

  constructor(opts: AISeamOpts) {
    this.rng = opts.rng;
    this.tier = opts.tier && AI_TIERS[opts.tier] ? opts.tier : 'normal';
    this.groundY = Number.isFinite(opts.groundY ?? SIM_GROUND_Y)
      ? (opts.groundY ?? SIM_GROUND_Y)
      : SIM_GROUND_Y;
  }

  /** For the render half (pose painter) and dev hooks. */
  stateName(): AIState {
    return this.state;
  }

  decide(view: CombatView, dtFixedMs: number): OpponentIntent {
    const tier = AI_TIERS[this.tier];
    const intent: OpponentIntent = {};
    this.tInState += dtFixedMs;

    const params: AIParams = {
      approachRange: AI_APPROACH_RANGE,
      // never telegraph from beyond own blade reach — the unified sim reach gate would whiff
      strikeRange: Math.min(AI_STRIKE_RANGE, STANCE_TABLE[view.selfStance].reach),
      reactBlockChance: tier.reactBlockChance,
      reactDodgeChance: tier.reactDodgeChance,
      telegraphMs: tier.telegraphMs,
      attackMs: tier.attackMs,
      recoverMs: tier.recoverMs,
      reactMs: tier.reactMs,
    };
    const next = nextAIState(
      this.state,
      this.tInState,
      {
        distance: view.distance,
        playerAttacking: view.opponent.windupMs > 0,
        playerWindup: view.opponent.windupMs > 0,
        selfRecovering: this.state === 'recover',
        playerStabIncoming: view.opponent.pendingStrike?.verb === 'stab',
        rng: this.rng(),
      },
      params,
    );
    if (next !== this.state) {
      this.state = next;
      this.tInState = 0;
      // committing actions fire ON ENTRY; the sim holds them for tier.telegraphMs (windup /
      // pendingSmokeMs), so telegraph-enter → land ≥ telegraphMs is a sim-provable measure.
      if (next === 'telegraph') intent.stroke = { path: this.slashPath(view), verb: 'slash' };
      if (next === 'dodge') intent.smokeBomb = true; // the react-dodge IS the smoke bomb intent
    }
    intent.block = this.state === 'block';
    if (this.state === 'approach') {
      intent.move = Math.sign(view.opponent.x - view.self.x) as -1 | 0 | 1;
    }

    // counter-stance pick (spec §A.3): each reaction window, with tier probability, switch
    // toward the stance that counters the player's current stance (the sim charges Focus).
    this.stanceEvalMs += dtFixedMs;
    if (this.stanceEvalMs >= tier.reactMs) {
      this.stanceEvalMs = 0;
      const counterStance = BEATEN_BY[view.opponentStance];
      if (counterStance !== view.selfStance && this.rng() < tier.counterStancePickChance) {
        intent.switchStance = counterStance;
      }
    }
    return intent;
  }

  /** Synthetic horizontal slash path at torso height, from own blade toward (and past) the
   *  player — classified 'slash' by core/gesture and hit-tested by the sim like any stroke. */
  private slashPath(view: CombatView): Pt[] {
    const y = this.groundY - STRIKE_TORSO_OFFSET;
    const dir = Math.sign(view.opponent.x - view.self.x) || 1;
    return [
      { x: view.self.x, y },
      { x: view.opponent.x + dir * PROJECTILE_SPAWN_OFFSET, y },
    ];
  }
}
