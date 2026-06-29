import Phaser from 'phaser';
import { Limb, SlashResult } from '../../core/slash';
import { StanceId } from '../../core/stance';
import { IDLE_POSE, Pose, worldLimbs } from './Skeleton';
import { FighterAnimator, GuardLevel } from './FighterAnimator';
import { drawSkeleton, Skin } from './drawFighter';

export type FighterOpts = {
  maxHealth?: number;
  stance?: StanceId;
  atkPlusWeapon?: number;
  skin?: Skin;
};

/** A procedural vector samurai: skeleton of capsule limbs that can be sliced and severed. */
export class Fighter extends Phaser.GameObjects.Container {
  readonly maxHealth: number;
  health: number;
  facing: 1 | -1;
  stanceId: StanceId;
  atkPlusWeapon: number;
  pose: Pose = IDLE_POSE;
  severed = new Set<string>();
  blocking = false;
  private animator = new FighterAnimator();
  private gfx: Phaser.GameObjects.Graphics;
  private skin?: Skin;

  constructor(scene: Phaser.Scene, x: number, y: number, facing: 1 | -1, opts: FighterOpts = {}) {
    super(scene, x, y);
    this.facing = facing;
    this.scaleX = facing; // mirror the local drawing
    this.maxHealth = opts.maxHealth ?? 100;
    this.health = this.maxHealth;
    this.stanceId = opts.stance ?? 'balanced';
    this.atkPlusWeapon = opts.atkPlusWeapon ?? 10;
    this.skin = opts.skin;
    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    scene.add.existing(this);
    this.redraw();
  }

  /** Current limb capsules in WORLD space, for slice detection. */
  worldLimbs(): Limb[] {
    return worldLimbs(this.pose, { x: this.x, y: this.y }, this.facing);
  }

  /** Sword-hand world position (slash origin). */
  swordHand(): { x: number; y: number } {
    return { x: this.x + this.facing * this.pose.handF.x, y: this.y + this.pose.handF.y };
  }

  setPose(pose: Pose): void {
    this.pose = pose;
    this.redraw();
  }

  /** Advance the animation one frame and render. `moving` drives the walk vs idle base layer. */
  update(dtMs: number, moving: boolean): void {
    this.animator.setMoving(moving);
    this.setPose(this.animator.update(dtMs));
  }

  setGuard(g: GuardLevel): void {
    this.animator.setGuard(g);
  }
  slash(): void {
    this.animator.startSlash();
  }
  hitAnim(): void {
    this.animator.startHit();
  }
  die(): void {
    this.animator.startDeath();
  }

  applyHit(result: SlashResult): void {
    this.health = Math.max(0, this.health - result.totalDamage);
    for (const h of result.hits) if (h.severed) this.severed.add(h.limbId);
    this.hitAnim();
    this.redraw();
  }

  redraw(): void {
    this.gfx.clear();
    drawSkeleton(this.gfx, this.pose, { severed: this.severed, skin: this.skin });
  }

  get isDead(): boolean {
    return this.health <= 0;
  }
}
