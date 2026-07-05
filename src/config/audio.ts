// config/audio.ts — per-cue audio briefs (spec §D.5). We compose our OWN music/SFX that hit
// the same cue timing and tonal role; no original audio bytes are shipped. All INFERRED —
// mood/instrumentation/tempo/loop and the exact fire-frame refine from footage (§4.2, ±1 frame).

import type { StanceId } from './stances';

export interface MusicCue {
  mood: string;
  instrumentation: string;
  loop: boolean;
}

export const MUSIC_CUES: Record<string, MusicCue> = {
  title: { mood: 'calm, expectant', instrumentation: 'shakuhachi + soft taiko', loop: true },
  menu: { mood: 'melancholic wander', instrumentation: 'koto + shakuhachi', loop: true },
  combat: { mood: 'tense drive', instrumentation: 'taiko + shamisen', loop: true },
  victory: { mood: 'triumphant', instrumentation: 'taiko hit + koto flourish', loop: false },
  defeat: { mood: 'somber', instrumentation: 'low shakuhachi', loop: false },
  levelUp: { mood: 'bright reward', instrumentation: 'koto pluck', loop: false },
  stanceSwap: { mood: 'snap', instrumentation: 'cloth/steel whoosh', loop: false },
};

// Four-way slash SFX matrix (spec §D.5) — each fires on a calibrated animation frame,
// heavy vs light have distinct tonal weight.
export const SLASH_SFX = ['draw', 'whiff', 'flesh', 'armor'] as const;
export type SlashSfx = (typeof SLASH_SFX)[number];

// ── M2 §3.14 fire frames (frozen port contract, configKeys.toAdd) ───────────────────────
// WHICH sim beat each matrix cue fires on. 'strokeStart' = the slashStarted event (the
// draw/unsheathe of the 4-way matrix); 'resolve' = the strike resolution beat (whiffed /
// hitLanded / blocked). The per-cue ms offsets below are the CALIBRATION knobs (§4.2 ±1
// frame): all INFERRED 0 until a Ruffle frame-step confirms an offset.
export const SFX_FIRE_FRAMES: Record<SlashSfx, 'strokeStart' | 'resolve'> = {
  draw: 'strokeStart', // fires the moment the gesture commits (slashStarted)
  whiff: 'resolve', // stroke resolved with zero limb hits (whiffed event)
  flesh: 'resolve', // body hit (hitLanded event)
  armor: 'resolve', // blocked/parried hit (blocked event)
};
export const SFX_FIRE_OFFSET_MS: Record<SlashSfx, number> = {
  draw: 0, // INFERRED — calibrate vs CALIBRATION.md row 10 (±1 frame)
  whiff: 0, // INFERRED
  flesh: 0, // INFERRED
  armor: 0, // INFERRED
};

// ── M2 §3.14 heavy-vs-light tonal weight (frozen port contract HEAVY_LIGHT_TONE) ────────
// Applied by game/audio/sfx.ts to the matrix cues: heavy = lower pitch, louder, LONGER;
// light = brighter, softer, shorter (spec §D.5 "distinct tonal weight"). durScale extends
// the contract pair {freqScale,gainScale} because "longer for heavy" needs a time axis.
export interface ToneWeight {
  freqScale: number; // multiplies every filter/oscillator frequency
  gainScale: number; // multiplies every envelope peak
  durScale: number; // multiplies decay/sweep/stop times (attack stays — no click)
}
export const NEUTRAL_TONE: ToneWeight = { freqScale: 1, gainScale: 1, durScale: 1 };
export const HEAVY_LIGHT_TONE: Record<StanceId, ToneWeight> = {
  light: { freqScale: 1.22, gainScale: 0.92, durScale: 0.85 }, // INFERRED — bright + quick
  balanced: NEUTRAL_TONE,
  heavy: { freqScale: 0.74, gainScale: 1.12, durScale: 1.3 }, // INFERRED — low + long
};

// ── M2 §3.14 per-cue synth params (frozen port contract SFX_SYNTH) ──────────────────────
// Moves game/audio/sfx.ts's synth literals out of the game/ purity ratchet (paydown 39→0).
// Three layer primitives cover every cue: filtered-noise sweeps, oscillator sweeps, and
// staggered partial stacks. All values INFERRED (authored by ear vs the reference footage
// briefs); calibration may overwrite numbers, never the structure.
export interface SfxEnv {
  peak: number; // envelope peak gain
  attackS: number; // exponential attack, s
  decayS: number; // exponential decay after the attack, s
}
export interface NoiseLayer extends SfxEnv {
  durS: number; // noise buffer length, s
  filter: BiquadFilterType;
  q?: number; // filter Q (left at the node default when absent)
  freqFrom: number; // filter cutoff/center at t0, Hz
  freqTo?: number; // optional exponential sweep target, Hz
  sweepS?: number; // sweep duration, s
  stopS: number; // source stop offset, s
}
export interface ToneLayer extends SfxEnv {
  wave: OscillatorType;
  freqFrom: number; // oscillator frequency at t0, Hz
  freqTo?: number; // optional exponential sweep target, Hz
  sweepS?: number; // sweep duration, s
  lowpassHz?: number; // optional lowpass shaping (the grunt's muffle)
  stopS: number;
}
export interface PartialsLayer extends SfxEnv {
  wave: OscillatorType;
  freqs: readonly number[]; // partial stack, Hz
  stepDelayS: number; // stagger between partial starts, s
  stopS: number;
}
export interface SfxCue {
  noise?: readonly NoiseLayer[];
  tones?: readonly ToneLayer[];
  partials?: readonly PartialsLayer[];
}

/** Exponential envelopes cannot ramp to 0 — this is the silent floor. */
export const SFX_ENV_FLOOR = 0.0001;

export const SFX_SYNTH = {
  // M1 blade whoosh (values carried verbatim from the pre-M2 sfx.ts — behavior-identical)
  slash: {
    noise: [
      { durS: 0.2, filter: 'bandpass', q: 1.3, freqFrom: 700, freqTo: 3600, sweepS: 0.16, peak: 0.22, attackS: 0.02, decayS: 0.16, stopS: 0.22 },
    ],
  },
  // draw — the unsheathe "shing" at stroke start: fast upward steel ring + a thin ping
  draw: {
    noise: [
      { durS: 0.14, filter: 'bandpass', q: 2.2, freqFrom: 1500, freqTo: 5200, sweepS: 0.09, peak: 0.14, attackS: 0.006, decayS: 0.11, stopS: 0.15 },
    ],
    partials: [
      { wave: 'triangle', freqs: [2350], stepDelayS: 0, peak: 0.06, attackS: 0.004, decayS: 0.12, stopS: 0.16 },
    ],
  },
  // whiff — air only, no steel: a softer noise sweep falling AWAY (reads as a miss)
  whiff: {
    noise: [
      { durS: 0.18, filter: 'bandpass', q: 1.1, freqFrom: 2400, freqTo: 850, sweepS: 0.14, peak: 0.13, attackS: 0.018, decayS: 0.13, stopS: 0.18 },
    ],
  },
  // flesh — body hit: low sine thud + high noise crack (the M1 playImpact, carried verbatim)
  flesh: {
    tones: [
      { wave: 'sine', freqFrom: 170, freqTo: 55, sweepS: 0.13, peak: 0.4, attackS: 0.005, decayS: 0.16, stopS: 0.2 },
    ],
    noise: [
      { durS: 0.09, filter: 'highpass', freqFrom: 2200, peak: 0.3, attackS: 0.004, decayS: 0.08, stopS: 0.1 },
    ],
  },
  // armor — blocked/parried "tink": two detuned bright partials + a tiny metallic click
  armor: {
    partials: [
      { wave: 'triangle', freqs: [2950, 3720], stepDelayS: 0.004, peak: 0.16, attackS: 0.002, decayS: 0.1, stopS: 0.14 },
    ],
    noise: [
      { durS: 0.05, filter: 'highpass', freqFrom: 4200, peak: 0.12, attackS: 0.002, decayS: 0.04, stopS: 0.05 },
    ],
  },
  // stance chime (values carried verbatim from the pre-M2 sfx.ts)
  stanceSwap: {
    partials: [
      { wave: 'sine', freqs: [880, 1320], stepDelayS: 0.02, peak: 0.12, attackS: 0.01, decayS: 0.38, stopS: 0.45 },
    ],
  },
  // pained grunt (values carried verbatim from the pre-M2 sfx.ts)
  grunt: {
    tones: [
      { wave: 'sawtooth', freqFrom: 230, freqTo: 105, sweepS: 0.13, lowpassHz: 950, peak: 0.2, attackS: 0.01, decayS: 0.15, stopS: 0.2 },
    ],
  },
} as const satisfies Record<string, SfxCue>;
export type SfxCueName = keyof typeof SFX_SYNTH;
