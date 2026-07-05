import Phaser from 'phaser';
import { GAME_H } from '../../config';
import { RAD_TO_DEG } from '../../config/combat';
import { STRIKE_TORSO_OFFSET } from '../../config/combat-sim';
import { FX_DEPTH, FX_GROUND_OFFSET, MS_PER_S, PROJECTILE_VIEW } from '../../config/fx-extra';

/** The slice of SimState.projectiles the view needs (frozen port contract shape). */
export interface SimProjectileLike {
  id: number;
  x: number;
  vx: number;
}

/**
 * Kunai render (M2 blueprint §3.6, Tell 10): mirrors `sim.projectiles` every frame — the
 * sim is the position authority, this view NEVER simulates. Call `sync(sim.projectiles,
 * sim.tFixed)` after each advance(); views are keyed by projectile id, created on first
 * sight, destroyed when the id vanishes (hit / deflected / off-arena — the sim decides).
 */
export class ProjectileView {
  private views = new Map<number, Phaser.GameObjects.Graphics>();
  private flightY: number;

  constructor(
    private scene: Phaser.Scene,
    groundY?: number,
  ) {
    // kunai fly the sim's horizontal strike line: torso height above the ground line
    this.flightY = (groundY ?? GAME_H - FX_GROUND_OFFSET) - STRIKE_TORSO_OFFSET;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Mirror the sim list: move known kunai, birth new ones, destroy vanished ones. */
  sync(projectiles: readonly SimProjectileLike[], tFixedMs = 0): void {
    const seen = new Set<number>();
    const wobble = Number.isFinite(tFixedMs)
      ? Math.sin((tFixedMs / MS_PER_S) * PROJECTILE_VIEW.wobbleHz * 2 * Math.PI) *
        (PROJECTILE_VIEW.wobbleDeg / RAD_TO_DEG)
      : 0;
    for (const p of projectiles) {
      if (!Number.isFinite(p.x)) continue; // hostile x — leave unrendered; the sim despawns it
      seen.add(p.id);
      let g = this.views.get(p.id);
      if (!g) {
        g = this.drawKunai();
        this.views.set(p.id, g);
      }
      g.setPosition(p.x, this.flightY);
      g.scaleX = p.vx < 0 ? -1 : 1; // nose points along the travel direction
      g.rotation = wobble * g.scaleX;
    }
    for (const [id, g] of this.views) {
      if (!seen.has(id)) {
        g.destroy();
        this.views.delete(id);
      }
    }
  }

  /** Live view count (render-side; the sim's projectile list is the authority). */
  count(): number {
    return this.views.size;
  }

  destroy(): void {
    for (const g of this.views.values()) g.destroy();
    this.views.clear();
  }

  /** One kunai, nose toward +x: inked outline pass under a steel pass (house style). */
  private drawKunai(): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.setDepth(FX_DEPTH.projectile);
    const half = PROJECTILE_VIEW.shaftLen / 2;
    const nose = half + PROJECTILE_VIEW.tipLen;
    // ink outline pass (slightly fatter strokes underneath)
    g.lineStyle(PROJECTILE_VIEW.shaftW + PROJECTILE_VIEW.outlinePad, PROJECTILE_VIEW.outline, 1);
    g.beginPath();
    g.moveTo(-half, 0);
    g.lineTo(half, 0);
    g.strokePath();
    g.fillStyle(PROJECTILE_VIEW.outline, 1);
    g.fillTriangle(
      half,
      -PROJECTILE_VIEW.tipHalfW - PROJECTILE_VIEW.outlinePad / 2,
      half,
      PROJECTILE_VIEW.tipHalfW + PROJECTILE_VIEW.outlinePad / 2,
      nose + PROJECTILE_VIEW.outlinePad / 2,
      0,
    );
    // steel pass
    g.lineStyle(PROJECTILE_VIEW.shaftW, PROJECTILE_VIEW.blade, 1);
    g.beginPath();
    g.moveTo(-half, 0);
    g.lineTo(half, 0);
    g.strokePath();
    g.fillStyle(PROJECTILE_VIEW.blade, 1);
    g.fillTriangle(half, -PROJECTILE_VIEW.tipHalfW, half, PROJECTILE_VIEW.tipHalfW, nose, 0);
    // tail pommel ring
    g.lineStyle(PROJECTILE_VIEW.shaftW - 1, PROJECTILE_VIEW.outline, 1);
    g.strokeCircle(-half - PROJECTILE_VIEW.ringR, 0, PROJECTILE_VIEW.ringR);
    return g;
  }
}
