// core/OpponentController.ts — the mandated network seam (spec §C). The sim hands each
// controller a read-only CombatView and consumes an OpponentIntent of the SAME shape the
// player's input produces. The combat core never branches on the controller's concrete type —
// today it is local AI; tomorrow it could be a remote peer.
//
// M2 port: the view now exposes the FULL fighter sim state (windup/busy/meters/pending verb)
// so the AI can react to a telegraphed player strike through the seam alone, and the intent
// gains the M2 verbs (move / skills / smoke bomb / shunpo hold / projectile / block-hold).
import type { Pt } from './vec';
import type { StanceId } from './stance';
import type { Gesture } from './gesture';
import type { FighterSimState } from './Sim';

/** Read-only snapshot of one fighter the sim exposes to a controller (full M2 sim state;
 *  `pendingStrike.path` is omitted from snapshots — controllers only need the verb). */
export type FighterView = Readonly<Omit<FighterSimState, 'pendingStrike'>> & {
  readonly pendingStrike: Readonly<{ verb: string }> | null;
};

/** Read-only snapshot the sim hands each controller every fixed tick. */
export interface CombatView {
  self: FighterView;
  opponent: FighterView;
  distance: number;
  selfStance: StanceId;
  opponentStance: StanceId;
  tFixed: number;
}

/**
 * A controller's decision for one tick — identical shape to what the player's input produces
 * (PlayerIntent = OpponentIntent; Sim.apply never branches on which side produced it).
 * Discrete fields (stroke/switchStance/useSkill/smokeBomb/throwProjectile) act once;
 * held fields (move/shunpoHold/block) are per-tick state, latest value wins.
 */
export interface OpponentIntent {
  /** Drawn gesture; `verb` carried from DrawnStroke when present (player), else classified
   *  by core/gesture — ONE classifier decision (port contract "two classifiers" risk). */
  stroke?: { path: Pt[]; verb?: Gesture };
  switchStance?: StanceId; // costs Focus + deducts Critical (patch behavior)
  useSkill?: 1 | 2 | 3; // slot mapping in config/combat-sim SKILL_VERB (1 chiPunch / 2 smokeBomb / 3 stab)
  smokeBomb?: boolean; // teleport-dodge (the AI's react-dodge plays this same intent)
  move?: -1 | 0 | 1; // continuous walk direction, applied every tick at the side's move speed
  shunpoHold?: boolean; // held-state each tick; sim edge-detects start/end (player slow-mo)
  throwProjectile?: boolean; // spawns a kunai toward the opponent (AI Normal+ tiers throw in range — config/ai)
  /** Held while the player is mid-draw (stroke started, not yet released). The AI's
   *  react-block/dodge senses THIS (M1 parity: reactions armed at stroke START), because a
   *  zero-windup strike resolves the tick it is queued — there is no windup left to read. */
  strokeArmed?: boolean;
  /** Held block pose (AI react-block). Contract extension: `blocking` is sim-owned state but the
   *  DECISION is the controller's, and block has no other channel through the seam. */
  block?: boolean;
}

export interface OpponentController {
  /** Decide an intent for this fixed tick given the current view. Must be deterministic-friendly
   *  (any randomness comes from an injected seeded rng — Math.random is banned in core). */
  decide(view: CombatView, dtFixedMs: number): OpponentIntent;
}
