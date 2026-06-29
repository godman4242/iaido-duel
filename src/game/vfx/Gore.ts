import Phaser from 'phaser';
import { Pt } from '../../core/vec';
import { COL } from '../../palette';

/** Blood spray + sever decals. Crimson against the green, in the series' style. */
export class Gore {
  static reduced = false;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private decals: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {
    if (!scene.textures.exists('blood-dot')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 4);
      g.generateTexture('blood-dot', 8, 8);
      g.destroy();
    }
    this.decals = scene.add.graphics();
    this.decals.setDepth(5);
    this.emitter = scene.add.particles(0, 0, 'blood-dot', {
      lifespan: 520,
      speed: { min: 60, max: 240 },
      angle: { min: 205, max: 335 }, // up-and-outward fan (0=right, 270=up); gravity arcs it down
      scale: { start: 1.15, end: 0 },
      gravityY: 760,
      quantity: 0,
      emitting: false,
      tint: [COL.blood, COL.bloodDark],
    });
    this.emitter.setDepth(40);
  }

  /** Burst of blood at `at`. */
  spray(at: Pt, amount: number): void {
    const count = Gore.reduced ? Math.ceil(amount / 2) : amount;
    this.emitter.emitParticleAt(at.x, at.y, count);
  }

  /** Dark splat + droplets where a limb came off. */
  severDecal(at: Pt): void {
    if (Gore.reduced) return;
    this.decals.fillStyle(COL.bloodDark, 0.85);
    this.decals.fillCircle(at.x, at.y, Phaser.Math.Between(5, 9));
    for (let i = 0; i < 6; i++) {
      this.decals.fillStyle(COL.blood, 0.8);
      this.decals.fillCircle(
        at.x + Phaser.Math.Between(-16, 16),
        at.y + Phaser.Math.Between(-8, 16),
        Phaser.Math.Between(2, 4),
      );
    }
  }

  /** A severed limb piece flung outward — arcs, spins, falls, fades. */
  flyLimb(at: Pt, dir: 1 | -1, color: number): void {
    if (Gore.reduced) return;
    const piece = this.scene.add.graphics().setDepth(45).setPosition(at.x, at.y);
    const len = Phaser.Math.Between(20, 30);
    const r = 7;
    piece.lineStyle(2 * r + 3, COL.outline, 1);
    piece.beginPath();
    piece.moveTo(-len / 2, 0);
    piece.lineTo(len / 2, 0);
    piece.strokePath();
    piece.lineStyle(2 * r, color, 1);
    piece.beginPath();
    piece.moveTo(-len / 2, 0);
    piece.lineTo(len / 2, 0);
    piece.strokePath();
    piece.fillStyle(COL.blood, 1).fillCircle(-len / 2, 0, r); // bloody stump end

    const vx = dir * Phaser.Math.Between(120, 220);
    const vy = -Phaser.Math.Between(180, 300);
    const spin = Phaser.Math.Between(-360, 360);
    const state = { t: 0 };
    this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: 900,
      onUpdate: () => {
        const dt = state.t * 0.9; // seconds-ish
        piece.x = at.x + vx * dt;
        piece.y = at.y + vy * dt + 0.5 * 900 * dt * dt; // gravity arc
        piece.angle = spin * state.t;
        piece.alpha = 1 - Math.max(0, (state.t - 0.6) / 0.4);
      },
      onComplete: () => piece.destroy(),
    });
  }
}
