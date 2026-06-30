// core/OpponentController.ts — the mandated network seam (spec §C). The sim hands each
// controller a read-only CombatView and consumes an OpponentIntent of the SAME shape the
// player's input produces. The combat core never branches on the controller's concrete type —
// today it is local AI; tomorrow it could be a remote peer.
import type { Pt } from './vec';
import type { StanceId } from './stance';

/** Read-only snapshot of one fighter the sim exposes to a controller. */
export interface FighterView {
  x: number;
  hp: number;
  stance: StanceId;
}

/** Read-only snapshot the sim hands each controller every fixed tick. */
export interface CombatView {
  self: FighterView;
  opponent: FighterView;
  distance: number;
  selfStance: StanceId;
  opponentStance: StanceId;
  tFixed: number;
}

/** A controller's decision for one tick — identical shape to what the player's input produces. */
export interface OpponentIntent {
  stroke?: { path: Pt[] }; // a slash/jump/launch/stab gesture (classified by core/gesture)
  switchStance?: StanceId; // costs Focus
  useSkill?: 1 | 2 | 3;
  smokeBomb?: boolean;
}

export interface OpponentController {
  /** Decide an intent for this fixed tick given the current view. Must be deterministic-friendly. */
  decide(view: CombatView, dtFixedMs: number): OpponentIntent;
}
