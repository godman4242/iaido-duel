import { Pt } from '../../core/vec';
import { Capsule } from '../../core/geometry';
import { Limb } from '../../core/slash';

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
