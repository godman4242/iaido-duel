import { describe, it, expect } from 'vitest';
import { IDLE_POSE, worldLimbs, addOffsets, SLASH_WINDUP, SLASH_FOLLOW, HIT_RECOIL, GUARD_POSE, DEAD } from '../../game/fighter/Skeleton';

describe('skeleton', () => {
  it('produces limb capsules in world space, mirrored by facing', () => {
    const right = worldLimbs(IDLE_POSE, { x: 100, y: 300 }, 1);
    const left = worldLimbs(IDLE_POSE, { x: 100, y: 300 }, -1);
    expect(right.length).toBeGreaterThanOrEqual(6);
    const armR = right.find((l) => l.id === 'armF')!;
    const armL = left.find((l) => l.id === 'armF')!;
    // mirrored about root x = 100
    expect(armR.capsule.b.x - 100).toBeCloseTo(-(armL.capsule.b.x - 100), 3);
    expect(right.every((l) => l.severThreshold > 0)).toBe(true);
  });
});

describe('skeleton keyframes + offsets', () => {
  it('every keyframe defines all joints', () => {
    const joints = Object.keys(IDLE_POSE);
    for (const pose of [SLASH_WINDUP, SLASH_FOLLOW, HIT_RECOIL, GUARD_POSE, DEAD]) {
      expect(Object.keys(pose).sort()).toEqual([...joints].sort());
    }
  });
  it('addOffsets adds deltas and leaves unlisted joints untouched', () => {
    const out = addOffsets(IDLE_POSE, { chest: { x: 0, y: -5 } });
    expect(out.chest.y).toBeCloseTo(IDLE_POSE.chest.y - 5, 6);
    expect(out.pelvis.x).toBeCloseTo(IDLE_POSE.pelvis.x, 6); // untouched
    expect(out).not.toBe(IDLE_POSE); // new object
  });
  it('DEAD collapses the body low and forward (head near ground, behind pelvis)', () => {
    expect(DEAD.head.y).toBeGreaterThan(IDLE_POSE.head.y); // head dropped toward ground (y increases downward)
    expect(DEAD.head.x).toBeLessThan(0); // head fell back behind the pelvis
  });
});
