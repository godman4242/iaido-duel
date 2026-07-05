// config/ai.ts — AI duel opponent tiers (spec §A.3). The AI is the entire single-player
// replacement for PvP; specified as numbers, driven through the OpponentController seam (§C).

export type AITier = 'easy' | 'normal' | 'hard';

export interface AITierParams {
  telegraphMs: number; // readable wind-up shown before a committing action lands
  attackMs: number; // active strike window
  recoverMs: number; // post-attack recovery
  reactMs: number; // reaction window to the player's wind-up
  reactBlockChance: number; // 0..1
  reactDodgeChance: number; // 0..1 (Smoke Bomb teleport-dodge)
  counterStancePickChance: number; // 0..1 — switch toward the stance that counters the player
  aggression: number; // 0..1 — approach bias
  /** 0..1 per reaction window: throw a kunai while the player holds AI_KUNAI_RANGE distance.
   *  Makes Tell 10's Stab+Deflect performable in the running build (back off → kunai flies →
   *  stab to swat it). 0 disables the behavior for a tier. */
  kunaiChance: number;
}

// All INFERRED (spec §A.3 — tunable). Telegraph durations are also a feel tell (§F.13).
export const AI_TIERS: Record<AITier, AITierParams> = {
  easy: {
    telegraphMs: 700, attackMs: 180, recoverMs: 760, reactMs: 420,
    reactBlockChance: 0.15, reactDodgeChance: 0.05, counterStancePickChance: 0.2, aggression: 0.3,
    kunaiChance: 0,
  },
  normal: {
    telegraphMs: 520, attackMs: 180, recoverMs: 620, reactMs: 320,
    reactBlockChance: 0.3, reactDodgeChance: 0.15, counterStancePickChance: 0.5, aggression: 0.55,
    kunaiChance: 0.25,
  },
  hard: {
    telegraphMs: 380, attackMs: 160, recoverMs: 480, reactMs: 220,
    reactBlockChance: 0.45, reactDodgeChance: 0.25, counterStancePickChance: 0.8, aggression: 0.8,
    kunaiChance: 0.4,
  },
};

// Kunai-throw distance band (px) — INFERRED. min sits well beyond AI_STRIKE_RANGE so the
// throw only happens when the player deliberately keeps range (the Stab+Deflect setup);
// max keeps the AI from plinking across the whole arena.
export const AI_KUNAI_RANGE = { min: 240, max: 720 } as const;

// Seeded per-cycle recovery jitter: on each entry to `recover`, the FSM dwell becomes
// recoverMs × (1 ± this fraction) using one draw from the injected seeded rng. This makes
// different ?seed= duels genuinely diverge in pacing (Tell 14 harness integrity) without
// touching the sim-owned telegraph guarantee (windup is held for telegraphMs regardless).
export const AI_RECOVER_JITTER_FRAC = 0.35; // INFERRED

// Spatial / movement seeds (from existing build) — INFERRED.
export const AI_APPROACH_RANGE = 620; // px — within this, the AI approaches
export const AI_STRIKE_RANGE = 132; // px — within this, the AI telegraphs then strikes
export const ENEMY_SPEED = 0.17; // px/ms — PvE foes move slowly on purpose (spec §D.1, §F.11)

// Target Normal-tier duel length — genuinely winnable and losable (spec §A.3, §F.14).
export const DUEL_TARGET_SECONDS = { min: 20, max: 60 } as const; // INFERRED
