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

// ── M1 slash vertical slice (spec §D.1, §4.2) ────────────────────────────────────────────────
// All INFERRED feel tunables (calibration-overwritable; no test asserts a specific value).

// DrawnStroke: raw pointer path → resampled to even spacing → smoothed (Chaikin). The smoothed
// curve IS both the blade trajectory and the hit polyline (spec §D.1 — never the raw jitter path).
export const RESAMPLE_SPACING = 8; // px between resampled stroke points
export const SMOOTH_ITERATIONS = 2; // Chaikin corner-cut passes
export const CHAIKIN_RATIO = 0.25; // corner-cut fraction: Q = lerp(p_i, p_{i+1}, RATIO)
export const MAX_STROKE_POINTS = 256; // hard cap on resampled points (bounds hostile input — chaos guard)

// Two-layer tapered blade ribbon (spec §D.1, Tells 1/2). Width tapers to zero at both tips,
// widest mid-stroke; bright core + colored edge. Fade is the afterimage decay.
export const BLADE_CORE_WIDTH = 7; // px — max half-width of the white/near-white core, mid-stroke
export const BLADE_EDGE_WIDTH = 13; // px — max half-width of the colored edge (drawn under the core)
export const BLADE_FADE_MS = 200; // ms for the released streak to fade out
export const BLADE_MIN_TAPER = 0.12; // floor on the taper so the very tip is visible, not a point

// Jump (up-stroke) arc — begins at the line's start point, ends at its endpoint (spec §D.1, Tell 4).
export const JUMP_APEX = 95; // px peak height above the launch line
export const JUMP_MS = 460; // ms total jump duration

// Special-move multipliers routed by verb: launch (up-flick) and stab (down). INFERRED seeds.
export const LAUNCH_DMG_MULT = 0.9;
export const LAUNCH_KNOCKUP = 130; // px airborne pop applied to a launched foe
export const STAB_DMG_MULT = 1.45;
export const SPECIAL_MS = 320; // ms recovery lock after a launch/stab

// Radians→degrees (Phaser particle `angle` is in degrees). Housed in config so the blood-cone
// math in core/ stays literal-free.
export const RAD_TO_DEG = 180 / Math.PI;

// Directional blood (spec §4.2 "Blood FX", Tell 19) — gout ALONG the cut vector, bright red.
export const BLOOD_COUNT = 9; // droplets per normal hit
export const BLOOD_COUNT_SEVERED = 16; // droplets on a sever
export const BLOOD_SPREAD_DEG = 42; // half-angle of the gout cone around the cut vector
export const BLOOD_SPEED_MIN = 60; // px/s droplet speed (min)
export const BLOOD_SPEED_MAX = 240; // px/s droplet speed (max)
export const BLOOD_LIFESPAN_MS = 520; // droplet lifetime
export const BLOOD_GRAVITY_Y = 760; // px/s² so the gout arcs and falls
export const BLOOD_SCALE_START = 1.15; // droplet start scale (fades to 0)

// Multi-foe demonstration (spec §D.1, Tell 5 — one line damages multiple foes, instakills none).
// `?foes=N` adds static sparring dummies beside the AI ronin; one horizontal stroke crosses them all.
export const MULTI_FOE_SPACING = 64; // px between stacked practice foes (kept within balanced reach)
export const MULTI_FOE_MAX = 4; // clamp on the ?foes dev flag
