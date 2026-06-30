// config/anim.ts — motion-feel + easing constants (spec §4.2 "Locomotion & secondary motion").
// These were grandfathered inside core/anim.ts; M1 moves them here so ALL of core/ is literal-free
// (DIVERGENCES.md: the one CORE_GRANDFATHERED module is retired). All INFERRED — calibration-tunable.

// Procedural walk-cycle amplitudes (px), applied to IDLE_POSE joints each frame (core/anim.ts).
export const WALK = {
  footSwing: 18, // fore/aft foot travel
  footLift: 9, // vertical lift of the leading foot
  kneeSwing: 9, // fore/aft knee travel
  kneeLift: 2, // vertical lift of the leading knee
  bob: 3, // pelvis/chest vertical bob (2× stride frequency)
  armSwing: 7, // sword-hand counter-swing
} as const;

// Idle breathing/sway amplitudes (px) — the body looks alive at rest.
export const IDLE_BREATH = {
  chest: 1.5,
  neck: 1.3,
  head: 1.1,
  hat: 1.1,
  hand: 1.0,
} as const;

// Easing shape constants (pure math housed in config to keep core/ literal-free).
export const EASE = {
  cubicExp: 3, // easeOutCubic exponent: 1 - (1-x)^3
  half: 0.5, // easeInOutSine midpoint: 0.5 - 0.5·cos(πx)
} as const;

// Flowing scarf — the iconic SHS silhouette element (spec §D.2, Tells 18, 20). A trailing
// tapered ribbon hung off the neck; tail lags the body's motion and idle-flutters.
export const SCARF = {
  segments: 5, // tail points beyond the neck anchor
  segLen: 11, // px between scarf points (local space, trailing -x)
  width: 8, // base half-width of the ribbon at the neck
  sway: 7, // idle flutter amplitude (px)
  flutterHz: 1.6, // idle flutter speed (cycles/sec)
  flowGain: 36, // tail displacement per unit local body velocity (px per px/ms)
  flowMax: 30, // clamp on velocity-driven tail displacement (px)
  flowSmoothing: 0.18, // low-pass factor on the body-velocity estimate (0..1, per frame)
  anchorX: -7, // local x offset from the neck where the scarf starts (behind the shoulder)
  anchorY: 4, // local y offset from the neck
  droop: 3, // gravity sag added per segment down the tail (px)
} as const;

// Idle flutter angular frequency (radians per ms) — precomputed so drawFighter stays literal-free.
export const SCARF_FLUTTER_RAD_PER_MS = (SCARF.flutterHz * 2 * Math.PI) / 1000;
