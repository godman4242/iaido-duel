import {
  IDLE_POSE,
  SLASH_WINDUP,
  SLASH_FOLLOW,
  GUARD_POSE,
  HIT_RECOIL,
  DEAD,
  lerpPose,
  addOffsets,
  scaleArc,
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
import { SLASH_FRAMES, FIXED_DT_MS } from '../../config/timing';
import { STANCE_TABLE, type StanceId } from '../../config/stances';

export type GuardLevel = 'none' | 'telegraph' | 'block';
type Action = 'none' | 'slash' | 'hit' | 'dead';

/** Per-stance slash phase clock (frames → ms): Light fast, Heavy slow (spec §4.2, Tell 6). */
const slashSegsFor = (stance: StanceId): Segment[] => {
  const f = SLASH_FRAMES[stance];
  return [
    { name: 'windup', ms: f.windup * FIXED_DT_MS },
    { name: 'strike', ms: f.active * FIXED_DT_MS },
    { name: 'recover', ms: f.recovery * FIXED_DT_MS },
  ];
};
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
  // per-stance slash arc + timing (set at startSlash; default = balanced baseline, k=1)
  private slashSegs: Segment[] = slashSegsFor('balanced');
  private slashWindup: Pose = SLASH_WINDUP;
  private slashFollow: Pose = SLASH_FOLLOW;

  setMoving(b: boolean): void {
    if (!this.dead) this.moving = b;
  }
  setGuard(g: GuardLevel): void {
    if (!this.dead) this.guard = g;
  }
  startSlash(stance: StanceId = 'balanced'): void {
    if (!this.dead) {
      this.action = 'slash';
      this.actionElapsed = 0;
      this.slashSegs = slashSegsFor(stance);
      // arc amplitude scales with stance reach (Light long, Heavy short) — Tell 6
      const k = STANCE_TABLE[stance].reach / STANCE_TABLE.balanced.reach;
      this.slashWindup = scaleArc(SLASH_WINDUP, k);
      this.slashFollow = scaleArc(SLASH_FOLLOW, k);
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
      const p = phaseAt(this.slashSegs, this.actionElapsed);
      if (p.done) {
        this.action = 'none';
      } else if (p.name === 'windup') {
        return lerpPose(base, this.slashWindup, easeOutCubic(p.t));
      } else if (p.name === 'strike') {
        return lerpPose(this.slashWindup, this.slashFollow, easeOutCubic(p.t));
      } else {
        return lerpPose(this.slashFollow, base, easeInOutSine(p.t));
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
