import { describe, it, expect } from 'vitest';
import { IDLE_POSE, worldLimbs } from '../../game/fighter/Skeleton';

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
