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
