import { Pt } from '../../core/vec';
import { Capsule } from '../../core/geometry';
import { Limb } from '../../core/slash';
import { Offsets } from '../../core/anim';

export type Joint =
  | 'hat'
  | 'head'
  | 'neck'
  | 'chest'
  | 'pelvis'
  | 'shoulderF'
  | 'elbowF'
  | 'handF'
  | 'sword'
  | 'hipF'
  | 'kneeF'
  | 'footF'
  | 'hipB'
  | 'kneeB'
  | 'footB';

export type Pose = Record<Joint, Pt>;

// Local coords: +x faces forward, +y is down, origin at pelvis. ~7-head slim build.
export const IDLE_POSE: Pose = {
  pelvis: { x: 0, y: 0 },
  chest: { x: 2, y: -46 },
  neck: { x: 2, y: -70 },
  head: { x: 4, y: -86 },
  hat: { x: 6, y: -104 },
  shoulderF: { x: 8, y: -58 },
  elbowF: { x: 24, y: -40 },
  handF: { x: 30, y: -18 },
  sword: { x: 78, y: -24 },
  hipF: { x: 6, y: 0 },
  kneeF: { x: 10, y: 34 },
  footF: { x: 24, y: 64 },
  hipB: { x: -6, y: 0 },
  kneeB: { x: -8, y: 34 },
  footB: { x: -22, y: 64 },
};

// Arms raised and extended across for a horizontal cut. Tuned further at the fidelity gate.
export const SLASH_POSE: Pose = {
  ...IDLE_POSE,
  shoulderF: { x: 6, y: -60 },
  elbowF: { x: 34, y: -66 },
  handF: { x: 56, y: -46 },
  sword: { x: 96, y: 6 },
};

export const lerpPose = (a: Pose, b: Pose, t: number): Pose => {
  const out = {} as Pose;
  (Object.keys(a) as Joint[]).forEach((k) => {
    out[k] = { x: a[k].x + (b[k].x - a[k].x) * t, y: a[k].y + (b[k].y - a[k].y) * t };
  });
  return out;
};

// Sword-arm joints whose displacement from idle defines the slash arc's reach/amplitude.
const ARM_JOINTS: Joint[] = ['shoulderF', 'elbowF', 'handF', 'sword'];

/**
 * Scale a slash keyframe's ARM sweep by `k` (its deviation from IDLE), leaving the rest of the body
 * untouched. Drives per-stance arc geometry (Tell 6): Light reach > balanced ⇒ k>1 ⇒ longer sweeping
 * arc; Heavy reach < balanced ⇒ k<1 ⇒ short heavy arc.
 */
export const scaleArc = (pose: Pose, k: number): Pose => {
  const out = { ...pose };
  for (const j of ARM_JOINTS) {
    out[j] = {
      x: IDLE_POSE[j].x + (pose[j].x - IDLE_POSE[j].x) * k,
      y: IDLE_POSE[j].y + (pose[j].y - IDLE_POSE[j].y) * k,
    };
  }
  return out;
};

const cap = (p: Pt, q: Pt, r: number, root: Pt, f: 1 | -1): Capsule => ({
  a: { x: root.x + f * p.x, y: root.y + p.y },
  b: { x: root.x + f * q.x, y: root.y + q.y },
  r,
});

// Convert a posed skeleton into world-space limb capsules for slice detection.
export function worldLimbs(pose: Pose, root: Pt, facing: 1 | -1, radius = 9): Limb[] {
  const f = facing;
  return [
    { id: 'torso', capsule: cap(pose.chest, pose.pelvis, 16, root, f), severThreshold: 40 },
    { id: 'head', capsule: cap(pose.neck, pose.head, 12, root, f), severThreshold: 22 },
    { id: 'hat', capsule: cap(pose.head, pose.hat, 14, root, f), severThreshold: 9999 },
    { id: 'armF', capsule: cap(pose.shoulderF, pose.elbowF, radius, root, f), severThreshold: 16 },
    { id: 'forearmF', capsule: cap(pose.elbowF, pose.handF, radius, root, f), severThreshold: 16 },
    { id: 'legF', capsule: cap(pose.hipF, pose.footF, radius + 1, root, f), severThreshold: 18 },
    { id: 'legB', capsule: cap(pose.hipB, pose.footB, radius + 1, root, f), severThreshold: 18 },
  ];
}

// Blade drawn up-and-back over the shoulder — the slash wind-up / enemy "tell".
export const SLASH_WINDUP: Pose = {
  ...IDLE_POSE,
  shoulderF: { x: 4, y: -62 },
  elbowF: { x: 2, y: -80 },
  handF: { x: -14, y: -70 },
  sword: { x: -48, y: -94 },
};

// Blade swept down across the front — the follow-through.
export const SLASH_FOLLOW: Pose = {
  ...IDLE_POSE,
  shoulderF: { x: 8, y: -54 },
  elbowF: { x: 34, y: -42 },
  handF: { x: 60, y: -6 },
  sword: { x: 106, y: 42 },
};

// Sword raised horizontal in front — a defensive guard (block).
export const GUARD_POSE: Pose = {
  ...IDLE_POSE,
  shoulderF: { x: 6, y: -60 },
  elbowF: { x: 24, y: -58 },
  handF: { x: 38, y: -52 },
  sword: { x: 92, y: -58 },
};

// Torso/head knocked back away from the strike.
export const HIT_RECOIL: Pose = {
  ...IDLE_POSE,
  chest: { x: -4, y: -44 },
  neck: { x: -6, y: -68 },
  head: { x: -7, y: -83 },
  hat: { x: -5, y: -101 },
  shoulderF: { x: 2, y: -56 },
  elbowF: { x: 16, y: -36 },
  handF: { x: 18, y: -14 },
  sword: { x: 60, y: -30 },
};

// Collapsed on the ground (the loser falls). Body laid back along the ground, low.
export const DEAD: Pose = {
  pelvis: { x: 0, y: 0 },
  chest: { x: -28, y: -10 },
  neck: { x: -48, y: -12 },
  head: { x: -62, y: -10 },
  hat: { x: -80, y: -6 },
  shoulderF: { x: -26, y: -16 },
  elbowF: { x: -40, y: -6 },
  handF: { x: -52, y: 2 },
  sword: { x: -90, y: 6 },
  hipF: { x: 8, y: 2 },
  kneeF: { x: 32, y: 6 },
  footF: { x: 56, y: 8 },
  hipB: { x: -6, y: 2 },
  kneeB: { x: -20, y: 8 },
  footB: { x: -42, y: 10 },
};

/** Add per-joint offsets to a pose (joints absent from `offs` are copied unchanged). */
export const addOffsets = (pose: Pose, offs: Offsets): Pose => {
  const out = {} as Pose;
  (Object.keys(pose) as Joint[]).forEach((k) => {
    const o = offs[k];
    out[k] = o ? { x: pose[k].x + o.x, y: pose[k].y + o.y } : { x: pose[k].x, y: pose[k].y };
  });
  return out;
};
