// config/economy.ts — progression, currency, rebirth, equipment, and the War Room
// strategy meta-layer (spec §A.2 + §A.4). Many values here are CONTRACT (documented).

// ── Progression (spec §A.2) ───────────────────────────────────────────────
export const LEVEL_UP_REWARD = { skillPoints: 1, statPoints: 3, fullRefill: true } as const; // CONTRACT
export const BASE_STATS_L1 = { atk: 5, def: 5, spd: 5, chi: 4, ap: 3 } as const; // INFERRED
export const POOLS_L1 = { hp: 60, chi: 20, ap: 20 } as const; // INFERRED
export const PER_POINT = { attack: 1, defense: 1, hp: 8 } as const; // INFERRED
export const xpToNext = (level: number): number => Math.round(50 * Math.pow(level, 1.5)); // INFERRED
export const KILL_REWARD = { xpPerFoeLevel: 10, coinsPerFoeLevel: 8 } as const; // INFERRED

export const FIRST_RUN_SP_CAP = 80; // CONTRACT — first-run Skill-Point cap
export const MAX_DAN_RANK = 5; // CONTRACT — max rank, dan rank 5 ("kyudan")
export const STANCE_MASTERY_CAP = 9; // CONTRACT — stance mastery cap
export const CHI_SKILL_UNLOCK_STEP = 5; // CONTRACT — Chi skills unlock at levels ending in 5
export const NINJA_SKILL_UNLOCK_FROM = 10; // CONTRACT — Ninja skills unlock at levels ending in 0 from 10

// Rebirth payout schedule — CONTRACT (spec §A.2).
export const REBIRTH = {
  earlyGold: 25, // rebirths 1–9: 25 gold each
  earlyElement: 10, // rebirths 1–9: 10 elemental each
  tenthGold: 100, // 10th: 100 gold
  tenthElement: 20, // 10th: 20 elemental
  lateGold: 25, // 11th+: 25 gold, no element
  attackBonusPerRebirth: 10, // +10 Attack to chosen element, stacks
} as const;

// ── Equipment & inventory (spec §A.2) ─────────────────────────────────────
export const EQUIPMENT_SLOTS = ['weapon', 'helmet', 'body', 'pants', 'gloves'] as const; // CONTRACT — 5 slots
export const INVENTORY_MAX_STACK = 99; // CONTRACT
export const MERCHANT_TOP_ITEM_COINS = 8000; // CONTRACT — top merchant item up to 8,000 coins
export const MERCHANT_FLOOR_RARITY = 'green' as const; // CONTRACT — merchant floor rarity
export const NINJA_STAT_TRANSFER_GOLD = 10; // CONTRACT — 10 gold, same item type
export const NINJA_RARE_OUTFIT_GOLD = 15; // CONTRACT — rare outfits, 15 gold each
// CONTRACT — duel tokens: +10 / +25 / +40 duels for 5 / 10 / 15 gold (spec §A.2).
export const DUEL_TOKEN_TIERS = [
  { duels: 10, gold: 5 },
  { duels: 25, gold: 10 },
  { duels: 40, gold: 15 },
] as const;

// ── Currency (single-player scope, spec §2) ───────────────────────────────
// Gold is kept as an EARNABLE/cosmetic currency; real-money purchase is removed entirely.
export const HAS_CASH_PURCHASE = false;

// ── War Room strategy meta-layer (spec §A.4) — DESIGN-FROM-LORE; numbers are CONTRACT ──
export const WAR_ROOM = {
  unlockLevel: 10, // gated at player level 10 (preserve the landmark)
  killCap: 350, // 340 troops + 10 PC samurai per run
  buildDonationCap: 500, // exactly 500 coins/action
  deployMods: { fieldToMountain: 60, mountainToMountain: 100, fieldToForest: 75 },
  controlPointFlagBonus: 1.2, // +120% to troops on a control-point flag
  forwardBase: 10000,
  barricades: 10000,
  tunnels: 5000, // disables Fire Arrows
  hqsPerClan: 3,
  conquestTickHours: 24, // accelerate locally
  movesPerHourBase: 3, // baseline, scales with rank
} as const;
