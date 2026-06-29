import { describe, it, expect } from 'vitest';
import { FighterAnimator } from '../../game/fighter/FighterAnimator';
import { IDLE_POSE } from '../../game/fighter/Skeleton';

const run = (a: FighterAnimator, ms: number, step = 16) => {
  let pose = IDLE_POSE;
  for (let t = 0; t < ms; t += step) pose = a.update(step);
  return pose;
};

describe('FighterAnimator', () => {
  it('idle breathing makes the head bob over time', () => {
    const a = new FighterAnimator();
    const p1 = a.update(16);
    const p2 = run(a, 800);
    expect(p1.head.y).not.toBeCloseTo(p2.head.y, 3);
    expect(a.actionName()).toBe('none');
  });
  it('walking moves the feet apart from the idle stance', () => {
    const a = new FighterAnimator();
    a.setMoving(true);
    const p = run(a, 200);
    expect(Math.abs(p.footF.x - IDLE_POSE.footF.x)).toBeGreaterThan(2);
    // antiphase: front and back foot must swing in opposite x directions
    expect(Math.sign(p.footF.x - IDLE_POSE.footF.x)).toBe(-Math.sign(p.footB.x - IDLE_POSE.footB.x));
  });
  it('slash drives the sword hand forward during the strike then returns', () => {
    const a = new FighterAnimator();
    a.startSlash();
    let forward = 0;
    for (let t = 0; t < 200; t += 16) {
      const p = a.update(16);
      forward = Math.max(forward, p.handF.x);
    }
    expect(forward).toBeGreaterThan(IDLE_POSE.handF.x + 10);
    run(a, 400); // let it finish
    expect(a.actionName()).toBe('none');
  });
  it('guard=telegraph blends toward the wind-up and holds', () => {
    const a = new FighterAnimator();
    a.setGuard('telegraph');
    const p = run(a, 300);
    expect(p.sword.x).toBeLessThan(0); // wind-up sword is behind (negative x)
    expect(a.guardLevel()).toBe('telegraph');
  });
  it('startDeath re-entry guard: second call must not reset the death animation', () => {
    const a = new FighterAnimator();
    a.startDeath();
    const collapsedPose = run(a, 500); // > DEATH_MS(320) — fully collapsed
    const collapsedY = collapsedPose.head.y;
    // collapsedY should be well below IDLE (closer to DEAD.head.y ≈ -10 vs IDLE.head.y = -86)
    expect(collapsedY).toBeGreaterThan(IDLE_POSE.head.y);
    a.startDeath(); // second call — must be a no-op
    const p = a.update(16);
    // still fully collapsed, NOT rewound back toward IDLE
    expect(p.head.y).toBeCloseTo(collapsedY, 1);
  });
  it('death collapses to the DEAD pose and is terminal', () => {
    const a = new FighterAnimator();
    a.startDeath();
    const p = run(a, 500);
    expect(p.head.y).toBeGreaterThan(IDLE_POSE.head.y); // dropped toward ground
    expect(a.isDead).toBe(true);
    a.setMoving(true); // ignored once dead
    const p2 = a.update(16);
    expect(p2.head.y).toBeGreaterThan(IDLE_POSE.head.y);
  });
});
