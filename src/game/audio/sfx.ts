// Synthesized combat SFX via the Web Audio API — no sampled assets, ever (all audio is our
// own synthesis; nothing is ripped from the original). Every synth number lives in
// config/audio.ts (SFX_SYNTH / HEAVY_LIGHT_TONE / SFX_ENV_FLOOR) — this module is
// literal-free (M2 config-purity paydown: the pre-M2 39 baseline literals moved to config).
//
// M2 four-way slash matrix (blueprint §3.14, Tell 28) — the integrator calls each on the
// measured sim event (fire frames in config SFX_FIRE_FRAMES):
//   playDraw(stance)   ← slashStarted   (stroke start — the unsheathe)
//   playWhiff(stance)  ← whiffed        (stroke resolved, zero limb hits)
//   playFlesh(stance)  ← hitLanded      (body hit)
//   playArmor(stance)  ← blocked        (blocked/parried — the armor "tink")
// Heavy vs light tonal weight (HEAVY_LIGHT_TONE): heavy = lower pitch, louder, longer.
import {
  SFX_SYNTH,
  SFX_ENV_FLOOR,
  HEAVY_LIGHT_TONE,
  NEUTRAL_TONE,
  type SfxCue,
  type SlashSfx,
  type ToneWeight,
} from '../../config/audio';
import type { StanceId } from '../../config/stances';

let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

/** Call on the first user gesture to satisfy the browser autoplay policy. */
export function resumeAudio(): void {
  try {
    ac().resume?.();
  } catch {
    /* audio unavailable — stay silent */
  }
}

export function toggleMuted(): boolean {
  muted = !muted;
  return muted;
}

/** Stance → tonal weight; unknown/absent stances play neutral (hostile-input guard). */
function toneOf(stance?: StanceId): ToneWeight {
  return (stance && HEAVY_LIGHT_TONE[stance]) || NEUTRAL_TONE;
}

function noise(c: AudioContext, dur: number): AudioBufferSourceNode {
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

function env(c: AudioContext, peak: number, attack: number, decay: number): GainNode {
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(SFX_ENV_FLOOR, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(SFX_ENV_FLOOR, t + attack + decay);
  return g;
}

/**
 * Play one config cue through the three layer primitives (noise sweeps / tone sweeps /
 * partial stacks), weighted by a ToneWeight: frequencies × freqScale, envelope peaks ×
 * gainScale, decay/sweep/stop times × durScale (attack untouched — no click).
 */
function playCue(cue: SfxCue, w: ToneWeight = NEUTRAL_TONE): void {
  if (muted) return;
  try {
    const c = ac();
    const t = c.currentTime;
    for (const L of cue.noise ?? []) {
      const src = noise(c, L.durS * w.durScale);
      const f = c.createBiquadFilter();
      f.type = L.filter;
      if (L.q !== undefined) f.Q.value = L.q;
      f.frequency.setValueAtTime(L.freqFrom * w.freqScale, t);
      if (L.freqTo !== undefined && L.sweepS !== undefined) {
        f.frequency.exponentialRampToValueAtTime(L.freqTo * w.freqScale, t + L.sweepS * w.durScale);
      }
      const g = env(c, L.peak * w.gainScale, L.attackS, L.decayS * w.durScale);
      src.connect(f).connect(g).connect(c.destination);
      src.start(t);
      src.stop(t + L.stopS * w.durScale);
    }
    for (const L of cue.tones ?? []) {
      const o = c.createOscillator();
      o.type = L.wave;
      o.frequency.setValueAtTime(L.freqFrom * w.freqScale, t);
      if (L.freqTo !== undefined && L.sweepS !== undefined) {
        o.frequency.exponentialRampToValueAtTime(L.freqTo * w.freqScale, t + L.sweepS * w.durScale);
      }
      const g = env(c, L.peak * w.gainScale, L.attackS, L.decayS * w.durScale);
      let head: AudioNode = o;
      if (L.lowpassHz !== undefined) {
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = L.lowpassHz * w.freqScale;
        head = o.connect(lp);
      }
      head.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + L.stopS * w.durScale);
    }
    for (const L of cue.partials ?? []) {
      L.freqs.forEach((f0, i) => {
        const o = c.createOscillator();
        o.type = L.wave;
        o.frequency.value = f0 * w.freqScale;
        const g = env(c, L.peak * w.gainScale, L.attackS, L.decayS * w.durScale);
        o.connect(g).connect(c.destination);
        o.start(t + i * L.stepDelayS * w.durScale);
        o.stop(t + L.stopS * w.durScale);
      });
    }
  } catch {
    /* audio unavailable — stay silent */
  }
}

// ── four-way slash matrix (Tell 28) ────────────────────────────────────────────────────────

/** Unsheathe "shing" — fire on `slashStarted` (SFX_FIRE_FRAMES.draw = strokeStart). */
export function playDraw(stance?: StanceId): void {
  playCue(SFX_SYNTH.draw, toneOf(stance));
}

/** Air-only miss whoosh — fire on `whiffed`. */
export function playWhiff(stance?: StanceId): void {
  playCue(SFX_SYNTH.whiff, toneOf(stance));
}

/** Flesh hit: low thud + high crack — fire on `hitLanded`. */
export function playFlesh(stance?: StanceId): void {
  playCue(SFX_SYNTH.flesh, toneOf(stance));
}

/** Armor-parry "tink" — fire on `blocked`. */
export function playArmor(stance?: StanceId): void {
  playCue(SFX_SYNTH.armor, toneOf(stance));
}

/** Matrix dispatcher for SFX_FIRE_FRAMES-driven wiring. */
export function playSlashSfx(kind: SlashSfx, stance?: StanceId): void {
  playCue(SFX_SYNTH[kind], toneOf(stance));
}

// ── legacy cues (M1 call sites in DuelScene keep working; sounds unchanged) ────────────────

/** A blade whoosh: band-passed noise sweeping upward (the M1 swing sound). */
export function playSlash(stance?: StanceId): void {
  playCue(SFX_SYNTH.slash, toneOf(stance));
}

/** A flesh/blade impact — the M1 name for the flesh hit (same cue as playFlesh). */
export function playImpact(stance?: StanceId): void {
  playFlesh(stance);
}

/** A two-tone stance chime. */
export function playStanceSwitch(): void {
  playCue(SFX_SYNTH.stanceSwap);
}

/** A short pained grunt. */
export function playGrunt(): void {
  playCue(SFX_SYNTH.grunt);
}
