// core/Sim.ts — owns the fixed-60Hz deterministic tick and applies both sides' intents.
// It consumes OpponentIntent through the controller seam and NEVER branches on the
// controller's concrete type (spec §C). No RNG and no wall-clock here — determinism is
// proven by opponent-seam.test.ts.
import { FIXED_DT_MS, MAX_FRAME_MS } from '../config/timing';
import { STANCE_TABLE, type StanceId } from '../config/stances';
import { classifyGesture } from './gesture';
import type { CombatView, OpponentController, OpponentIntent } from './OpponentController';

export interface FighterSimState {
  x: number;
  hp: number;
  stance: StanceId;
}

export interface SimConfig {
  player: FighterSimState;
  opponent: FighterSimState;
  /** (Attack + WeaponDamage): the flat base for a landed slash (spec §A.1 damage formula). */
  atkPlusWeapon: number;
}

/** The player's intent for a tick — identical shape to OpponentIntent (the seam's symmetry). */
export type PlayerIntent = OpponentIntent;

export class Sim {
  tFixed = 0;
  readonly player: FighterSimState;
  readonly opponent: FighterSimState;
  private acc = 0;

  constructor(
    private readonly cfg: SimConfig,
    private readonly controller: OpponentController,
  ) {
    this.player = { ...cfg.player };
    this.opponent = { ...cfg.opponent };
  }

  /** Advance by elapsed real ms; steps the fixed sim in whole FIXED_DT_MS increments. */
  advance(elapsedMs: number, playerIntent: PlayerIntent = {}): void {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return; // ignore NaN/Infinity/non-positive frames
    this.acc += Math.min(elapsedMs, MAX_FRAME_MS); // spiral-of-death clamp (spec §3 accumulator)
    let intent = playerIntent;
    while (this.acc >= FIXED_DT_MS) {
      this.step(intent);
      this.acc -= FIXED_DT_MS;
      intent = {}; // a discrete player intent applies once, on the first sub-step
    }
  }

  private view(): CombatView {
    return {
      self: { ...this.opponent },
      opponent: { ...this.player },
      distance: Math.abs(this.opponent.x - this.player.x),
      selfStance: this.opponent.stance,
      opponentStance: this.player.stance,
      tFixed: this.tFixed,
    };
  }

  private step(playerIntent: PlayerIntent): void {
    const oppIntent = this.controller.decide(this.view(), FIXED_DT_MS);
    // Fixed, deterministic resolution order: opponent resolves, then the player.
    this.apply(this.opponent, this.player, oppIntent);
    this.apply(this.player, this.opponent, playerIntent);
    this.tFixed += FIXED_DT_MS;
  }

  /** Apply one actor's intent against its target. Pure-deterministic; no RNG, no wall clock. */
  private apply(actor: FighterSimState, target: FighterSimState, intent: OpponentIntent): void {
    if (intent.switchStance) actor.stance = intent.switchStance;
    if (intent.stroke && classifyGesture(intent.stroke.path) === 'slash') {
      const stance = STANCE_TABLE[actor.stance];
      if (Math.abs(actor.x - target.x) <= stance.reach) {
        const dmg = Math.round(this.cfg.atkPlusWeapon * stance.dmgMult);
        target.hp = Math.max(0, target.hp - dmg);
      }
    }
  }
}
