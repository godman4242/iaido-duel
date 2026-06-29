import {
  IDLE_POSE,
  SLASH_WINDUP,
  SLASH_FOLLOW,
  GUARD_POSE,
  HIT_RECOIL,
  DEAD,
  lerpPose,
  addOffsets,
  Pose,
} from './Skeleton';
import {
  phaseAt,
  walkOffsets,
  idleOffsets,
  easeOutCubic,
  easeInOutSine,
  easeInQuad,
  Segment,
} from '../../core/anim';

export type GuardLevel = 'none' | 'telegraph' | 'block';
type Action = 'none' | 'slash' | 'hit' | 'dead';

const SLASH_SEGS: Segment[] = [
  { name: 'windup', ms: 90 },
  { name: 'strike', ms: 100 },
  { name: 'recover', ms: 150 },
];
const HIT_SEGS: Segment[] = [
  { name: 'recoil', ms: 90 },
  { name: 'return', ms: 120 },
];
const DEATH_MS = 320;
const WALK_PERIOD = 560; // ms / stride
const IDLE_PERIOD = 2600; // ms / breath
const GUARD_BLEND_MS = 130;

/** Owns one fighter's pose each frame: base locomotion + action overlays + guard hold. */
export class FighterAnimator {
  private moving = false;
  private guard: GuardLevel = 'none';
  private guardT = 0; // smoothed 0..1 toward the guard pose
  private action: Action = 'none';
  private actionElapsed = 0;
  private locoPhase = 0;
  private dead = false;

  setMoving(b: boolean): void {
    if (!this.dead) this.moving = b;
  }
  setGuard(g: GuardLevel): void {
    if (!this.dead) this.guard = g;
  }
  startSlash(): void {
    if (!this.dead) {
      this.action = 'slash';
      this.actionElapsed = 0;
    }
  }
  startHit(): void {
    if (!this.dead && this.action !== 'slash') {
      this.action = 'hit';
      this.actionElapsed = 0;
    }
  }
  startDeath(): void {
    if (this.dead) return;
    this.dead = true;
    this.action = 'dead';
    this.actionElapsed = 0;
  }
  get isDead(): boolean {
    return this.dead;
  }
  actionName(): Action {
    return this.action;
  }
  guardLevel(): GuardLevel {
    return this.guard;
  }

  update(dtMs: number): Pose {
    // base locomotion layer
    const period = this.moving ? WALK_PERIOD : IDLE_PERIOD;
    this.locoPhase = (this.locoPhase + dtMs / period) % 1;
    const base = this.moving
      ? addOffsets(IDLE_POSE, walkOffsets(this.locoPhase))
      : addOffsets(IDLE_POSE, idleOffsets(this.locoPhase));

    // 1) death wins
    if (this.action === 'dead') {
      this.actionElapsed += dtMs;
      return lerpPose(IDLE_POSE, DEAD, easeInQuad(Math.min(1, this.actionElapsed / DEATH_MS)));
    }

    // 2) transient action overlay
    if (this.action === 'slash') {
      this.actionElapsed += dtMs;
      const p = phaseAt(SLASH_SEGS, this.actionElapsed);
      if (p.done) {
        this.action = 'none';
      } else if (p.name === 'windup') {
        return lerpPose(base, SLASH_WINDUP, easeOutCubic(p.t));
      } else if (p.name === 'strike') {
        return lerpPose(SLASH_WINDUP, SLASH_FOLLOW, easeOutCubic(p.t));
      } else {
        return lerpPose(SLASH_FOLLOW, base, easeInOutSine(p.t));
      }
    } else if (this.action === 'hit') {
      this.actionElapsed += dtMs;
      const p = phaseAt(HIT_SEGS, this.actionElapsed);
      if (p.done) {
        this.action = 'none';
      } else if (p.name === 'recoil') {
        return lerpPose(base, HIT_RECOIL, easeOutCubic(p.t));
      } else {
        return lerpPose(HIT_RECOIL, base, easeInOutSine(p.t));
      }
    }

    // 3) guard hold (smoothed)
    const target = this.guard === 'none' ? 0 : 1;
    this.guardT += (Math.sign(target - this.guardT) * dtMs) / GUARD_BLEND_MS;
    this.guardT = Math.max(0, Math.min(1, this.guardT));
    if (this.guardT > 0.001) {
      const held = this.guard === 'block' ? GUARD_POSE : SLASH_WINDUP;
      return lerpPose(base, held, easeInOutSine(this.guardT));
    }

    // 4) plain locomotion
    return base;
  }
}
