// Pure animation math: easing + a segment phase-clock + procedural locomotion offsets.
// No Phaser, no side effects. All feel constants come from config/anim.ts so this module is
// literal-free (spec §3 central-config rule — core/ is held to ZERO bare gameplay literals).
import { WALK, IDLE_BREATH, EASE } from '../config/anim';

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

export const easeOutCubic = (t: number): number => {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, EASE.cubicExp);
};
export const easeInOutSine = (t: number): number => EASE.half - EASE.half * Math.cos(Math.PI * clamp01(t));
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
    footF: { x: WALK.footSwing * swing * amp, y: -WALK.footLift * Math.max(0, swing) * amp },
    kneeF: { x: WALK.kneeSwing * swing * amp, y: -WALK.kneeLift * Math.max(0, swing) * amp },
    footB: { x: -WALK.footSwing * swing * amp, y: -WALK.footLift * Math.max(0, -swing) * amp },
    kneeB: { x: -WALK.kneeSwing * swing * amp, y: -WALK.kneeLift * Math.max(0, -swing) * amp },
    pelvis: { x: 0, y: -WALK.bob * bob * amp },
    chest: { x: 0, y: -WALK.bob * bob * amp },
    handF: { x: -WALK.armSwing * swing * amp, y: 0 }, // arm counter-swings the front leg
  };
}

/** Gentle idle breathing/sway. `phase` in [0,1). */
export function idleOffsets(phase: number, amp = 1): Offsets {
  const breathe = Math.sin(phase * TAU);
  return {
    chest: { x: 0, y: -IDLE_BREATH.chest * breathe * amp },
    neck: { x: 0, y: -IDLE_BREATH.neck * breathe * amp },
    head: { x: 0, y: -IDLE_BREATH.head * breathe * amp },
    hat: { x: 0, y: -IDLE_BREATH.hat * breathe * amp },
    handF: { x: 0, y: IDLE_BREATH.hand * breathe * amp },
  };
}
