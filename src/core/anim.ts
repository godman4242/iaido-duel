// Pure animation math: easing + a segment phase-clock. No Phaser, no side effects.

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

export const easeOutCubic = (t: number): number => {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
};
export const easeInOutSine = (t: number): number => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
export const easeInQuad = (t: number): number => {
  const x = clamp01(t);
  return x * x;
};

export type Segment = { name: string; ms: number };
export type PhaseResult = { name: string; t: number; done: boolean };

/** Locate `elapsedMs` within a sequence of timed segments. `t` is progress [0,1] in the active segment. */
export function phaseAt(segments: Segment[], elapsedMs: number): PhaseResult {
  let acc = 0;
  for (const seg of segments) {
    if (elapsedMs < acc + seg.ms) {
      return { name: seg.name, t: clamp01((elapsedMs - acc) / seg.ms), done: false };
    }
    acc += seg.ms;
  }
  const last = segments[segments.length - 1];
  return { name: last.name, t: 1, done: true };
}

export type JointOffset = { x: number; y: number };
export type Offsets = { [joint: string]: JointOffset };

const TAU = Math.PI * 2;

/** Procedural side-view walk cycle. `phase` in [0,1). */
export function walkOffsets(phase: number, amp = 1): Offsets {
  const a = phase * TAU;
  const swing = Math.sin(a);
  const bob = Math.cos(2 * a); // two bobs per stride
  return {
    footF: { x: 18 * swing * amp, y: -9 * Math.max(0, swing) * amp },
    kneeF: { x: 9 * swing * amp, y: -2 * Math.max(0, swing) * amp },
    footB: { x: -18 * swing * amp, y: -9 * Math.max(0, -swing) * amp },
    kneeB: { x: -9 * swing * amp, y: -2 * Math.max(0, -swing) * amp },
    pelvis: { x: 0, y: -3 * bob * amp },
    chest: { x: 0, y: -3 * bob * amp },
    handF: { x: -7 * swing * amp, y: 0 }, // arm counter-swings the front leg
  };
}

/** Gentle idle breathing/sway. `phase` in [0,1). */
export function idleOffsets(phase: number, amp = 1): Offsets {
  const breathe = Math.sin(phase * TAU);
  return {
    chest: { x: 0, y: -1.5 * breathe * amp },
    neck: { x: 0, y: -1.3 * breathe * amp },
    head: { x: 0, y: -1.1 * breathe * amp },
    hat: { x: 0, y: -1.1 * breathe * amp },
    handF: { x: 0, y: 1.0 * breathe * amp },
  };
}
