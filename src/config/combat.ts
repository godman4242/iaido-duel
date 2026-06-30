// config/combat.ts — combat-core tunables (spec §A.1 + damage formula §A.1).

// CONTRACT — critical multiplier is 3× (spec §A.1). The previous build used 1.3× in
// core/slash.ts; that is the documented divergence now fixed (see DIVERGENCES.md).
export const CRIT_MULT = 3;

// INFERRED — counter-triangle magnitude (membership is CONTRACT; lives in config/stances.ts).
export const COUNTER_BONUS = 1.25; // attacker deals ×1.25 when its stance beats the defender's

// INFERRED — extra damage fraction per severed limb (existing build behaviour).
export const SEVERED_DAMAGE_BONUS = 0.5;

// CONTRACT — Light & Heavy stance damage cap noted at ×1.4 (spec §A.1).
export const STANCE_DAMAGE_CAP = 1.4;

// CONTRACT — Heavy stance defense penalty −20% (spec §A.1). Applied to the defender's
// effective Defense before the (1 - Defense*DEF_K) term; surfaces as STANCE_TABLE.heavy.damageTakenMult.
export const HEAVY_DEF_PENALTY = 0.2;

// INFERRED — defense coefficient in the (1 - Defense*DEF_K) damage term (spec §A.1), clamp final ≥ 1.
export const DEF_K = 0.01;

// CONTRACT — spawn invulnerability: 5s or until first slash; character blinks (spec §A.1).
export const SPAWN_INVULN_S = 5;

// CONTRACT — Chi Punch flat damage at level 1 (spec §A.1).
export const CHI_PUNCH_DMG_L1 = 10;

// Focus meter — INFERRED (from existing build; spec §A.1 tunable by calibration).
export const FOCUS_MAX = 100;
export const FOCUS_SWITCH_COST = 34; // Focus spent to change stance
export const FOCUS_CRIT_THRESHOLD = 80; // Focus at/above which the next hit is a crit

// INFERRED — an up-stroke with |dy| ≥ this is a launch flick, not a plain jump (spec §D.1).
export const LAUNCH_DY = 160;

// CONTRACT — documented skill damage references (spec §A.2): "max 300+" / "maxed 100+".
// Frozen as reference values; the runtime skill tables (M3) build up to these.
export const ELEMENTAL_SKILL_DMG_MAX = 300; // elemental skills, via Rebirth only
export const CHI_SKILL_DMG_MAX = 100; // Chi skills maxed

// INFERRED — overlap-sampling resolution for slash hit-detection (algorithm precision knob,
// moved out of core/geometry.ts to keep that module literal-free).
export const HIT_SAMPLE_STEPS = 64;
