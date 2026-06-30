// config/stances.ts — the three stances + the counter triangle (spec §A.1).
// StanceId is canonically defined HERE; core/stance.ts re-exports it for back-compat.

export type StanceId = 'light' | 'balanced' | 'heavy';

export interface StanceStats {
  id: StanceId;
  reach: number; // px — INFERRED (from existing build)
  speed: number; // animation-playback multiplier (1.0 = Balanced baseline) — see below
  dmgMult: number; // mastery-scaled damage multiplier (current seed within mastery range)
  damageTakenMult: number; // >1 means takes more damage (Heavy −20% def => 1.25)
}

// reach: INFERRED. speed: Light 1.4 is CONTRACT (the only published timing constant);
// Balanced 1.0 / Heavy 0.7 are INFERRED. dmgMult: current seeds inside the CONTRACT mastery
// ranges below. damageTakenMult: Heavy 1.25 derives from the CONTRACT Heavy −20% defense.
export const STANCE_TABLE: Record<StanceId, StanceStats> = {
  light: { id: 'light', reach: 300, speed: 1.4, dmgMult: 0.9, damageTakenMult: 1.0 },
  balanced: { id: 'balanced', reach: 200, speed: 1.0, dmgMult: 1.2, damageTakenMult: 1.0 },
  heavy: { id: 'heavy', reach: 120, speed: 0.7, dmgMult: 1.4, damageTakenMult: 1.25 },
};

// Stance damage multiplier mastery ranges L1→L9 — CONTRACT (spec §A.1).
// dmgMult in STANCE_TABLE is the current seed; these bound it.
export const STANCE_MASTERY = {
  light: { dmgMultMin: 0.5, dmgMultMax: 0.9 }, // CONTRACT ×0.5 → ×0.9
  balanced: { dmgMultMin: 1.0, dmgMultMax: 1.2 }, // CONTRACT ×1.0 → ×1.2
  heavy: { dmgMultMin: 1.4, dmgMultMax: 1.4 }, // CONTRACT ×1.4 (no mastery gain)
} as const;

// Counter triangle membership — CONTRACT (spec §A.1): Light > Heavy > Balanced > Light.
// The winner deals more AND takes less. (Magnitude lives in config/combat.ts COUNTER_BONUS.)
export const STANCE_BEATS: Record<StanceId, StanceId> = {
  light: 'heavy',
  heavy: 'balanced',
  balanced: 'light',
};

// Launch unlock by stance level — CONTRACT (spec §A.1): Light at 3, others at 5.
export const LAUNCH_UNLOCK_LEVEL = { light: 3, balanced: 5, heavy: 5 } as const;
