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
}

// All INFERRED (spec §A.3 — tunable). Telegraph durations are also a feel tell (§F.13).
export const AI_TIERS: Record<AITier, AITierParams> = {
  easy: {
    telegraphMs: 700, attackMs: 180, recoverMs: 760, reactMs: 420,
    reactBlockChance: 0.15, reactDodgeChance: 0.05, counterStancePickChance: 0.2, aggression: 0.3,
  },
  normal: {
    telegraphMs: 520, attackMs: 180, recoverMs: 620, reactMs: 320,
    reactBlockChance: 0.3, reactDodgeChance: 0.15, counterStancePickChance: 0.5, aggression: 0.55,
  },
  hard: {
    telegraphMs: 380, attackMs: 160, recoverMs: 480, reactMs: 220,
    reactBlockChance: 0.45, reactDodgeChance: 0.25, counterStancePickChance: 0.8, aggression: 0.8,
  },
};

// Spatial / movement seeds (from existing build) — INFERRED.
export const AI_APPROACH_RANGE = 620; // px — within this, the AI approaches
export const AI_STRIKE_RANGE = 132; // px — within this, the AI telegraphs then strikes
export const ENEMY_SPEED = 0.17; // px/ms — PvE foes move slowly on purpose (spec §D.1, §F.11)

// Target Normal-tier duel length — genuinely winnable and losable (spec §A.3, §F.14).
export const DUEL_TARGET_SECONDS = { min: 20, max: 60 } as const; // INFERRED
