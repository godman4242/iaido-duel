// config/timing.ts — frame/second timings (spec §3, §4.2). All times in ms or frames @60fps.

// CONTRACT (spec §3) — the simulation runs on a fixed 60 Hz timestep, decoupled from render.
export const FIXED_HZ = 60;
export const FIXED_DT_MS = 1000 / FIXED_HZ; // derived — one fixed tick in ms

// INFERRED — consecutive-hit combo window (existing build).
export const COMBO_WINDOW_MS = 1200;

// INFERRED — spiral-of-death clamp: the most real elapsed time the sim catches up in a single
// advance() call. Bounds catch-up work in the render-decoupled accumulator (spec §3).
export const MAX_FRAME_MS = 250;

// INFERRED seeds — per-stance slash phase frame counts (windup → active → recovery) @60fps.
// CALIBRATE to CONFIRMED footage (spec §4.2, target ±1 frame). Anchor: Light SPEED = 1.4 (CONTRACT).
export const SLASH_FRAMES = {
  light: { windup: 4, active: 3, recovery: 8 },
  balanced: { windup: 6, active: 3, recovery: 12 },
  heavy: { windup: 10, active: 4, recovery: 16 },
} as const;
