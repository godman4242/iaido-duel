import Phaser from 'phaser';
import { Pt } from '../../core/vec';
import { bloodConeDeg } from '../../core/trajectory';
import { COL } from '../../palette';
import { BLOOD_SPREAD_DEG, BLOOD_LIFESPAN_MS, BLOOD_SCALE_START } from '../../config/combat';
import { BLOOD_FX } from '../../config/fx';
import { GAME_H } from '../../config';
import {
  BLOOD_DOT,
  FX_DEPTH,
  FX_GROUND_OFFSET,
  GROUND_SPATTER,
  LIMB_FX,
  MS_PER_S,
  POOL_FX,
  SEVER_DECAL,
} from '../../config/fx-extra';

/**
 * Blood FX (ART_DIRECTION §4 + tell #8): a BRIGHT red directional burst gouting along the
 * cut vector with gravity droplets; persistent GROUND SPATTER that sticks for the whole
 * fight; and dark POOLS that spread under downed bodies and never fade.
 */
/** The angle EmitterOp's reloadable range — the public type doesn't surface `ops`, so we narrow it. */
type RangeOp = { loadConfig: (config: object) => void };

export class Gore {
  static reduced = false;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private angleOp: RangeOp;
  private decals: Phaser.GameObjects.Graphics;
  private groundLayer: Phaser.GameObjects.Graphics;
  private groundY: number;

  constructor(
    private scene: Phaser.Scene,
    groundY?: number,
  ) {
    // default to the arena floor (mirrors DuelScene's GROUND_Y); bindGround() overrides
    this.groundY = groundY ?? GAME_H - FX_GROUND_OFFSET;
    if (!scene.textures.exists(BLOOD_DOT.key)) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(BLOOD_DOT.white, 1);
      g.fillCircle(BLOOD_DOT.r, BLOOD_DOT.r, BLOOD_DOT.r);
      g.generateTexture(BLOOD_DOT.key, BLOOD_DOT.size, BLOOD_DOT.size);
      g.destroy();
    }
    // persistent ground plane: pools + spatter render UNDER the fighters (tell #8)
    this.groundLayer = scene.add.graphics();
    this.groundLayer.setDepth(FX_DEPTH.groundSpatter);
    this.decals = scene.add.graphics();
    this.decals.setDepth(FX_DEPTH.decal);
    this.emitter = scene.add.particles(0, 0, BLOOD_DOT.key, {
      lifespan: BLOOD_LIFESPAN_MS,
      speed: { min: BLOOD_FX.speedMin, max: BLOOD_FX.speedMax },
      angle: { min: -BLOOD_SPREAD_DEG, max: BLOOD_SPREAD_DEG }, // default cone; re-aimed along the cut per spray
      scale: { start: BLOOD_SCALE_START, end: 0 },
      gravityY: BLOOD_FX.gravityY,
      quantity: 0,
      emitting: false,
      tint: [COL.bloodBright, COL.blood], // §4: BRIGHT red burst reads over the muted world
    });
    this.emitter.setDepth(FX_DEPTH.bloodEmitter);
    // Capture the angle op so spray() can re-aim it along the cut (see spray() for the 3.90 caveat).
    this.angleOp = (this.emitter as unknown as { ops: { angle: RangeOp } }).ops.angle;
  }

  /** Late-bind the ground line (enables ground spatter + pool placement at the floor). */
  bindGround(groundY: number): void {
    this.groundY = groundY;
  }

  /** Burst of blood at `at`, gouting ALONG the cut vector `dir` (§4, Tell 19). */
  spray(at: Pt, amount: number, dir: Pt = { x: 0, y: -1 }): void {
    const cone = bloodConeDeg(dir, BLOOD_SPREAD_DEG);
    // Re-aim the angle EmitterOp at the cut. NOTE: `emitter.particleAngle = {min,max}` does NOT
    // work in Phaser 3.90 — its setter calls EmitterOp.onChange, which only mutates `current` and
    // never reassigns start/end, so the cone would stay frozen at the construction default. Reload
    // the op's range so randomRangedValueEmit reads the new [min,max] (verified vs phaser@3.90 source).
    this.angleOp.loadConfig({ angle: { min: cone.min, max: cone.max } });
    const count = Gore.reduced ? Math.ceil(amount / 2) : amount;
    this.emitter.emitParticleAt(at.x, at.y, count);
    this.groundSpatter(at, dir);
  }

  /** Persistent spatter dots on the ground line under a burst — they stay for the whole fight (tell #8). */
  private groundSpatter(at: Pt, dir: Pt): void {
    if (Gore.reduced) return;
    const bias = Math.sign(dir.x) * GROUND_SPATTER.dirBias; // scatter drifts along the cut
    for (let i = 0; i < GROUND_SPATTER.dotCount; i++) {
      this.groundLayer.fillStyle(i % 2 === 0 ? COL.bloodBright : COL.blood, GROUND_SPATTER.alpha);
      this.groundLayer.fillCircle(
        at.x + bias + Phaser.Math.Between(-GROUND_SPATTER.spreadX, GROUND_SPATTER.spreadX),
        this.groundY + Phaser.Math.Between(-GROUND_SPATTER.spreadY, GROUND_SPATTER.spreadY),
        Phaser.Math.FloatBetween(GROUND_SPATTER.rMin, GROUND_SPATTER.rMax),
      );
    }
  }

  /**
   * A dark pool that SPREADS under a downed body and persists for the whole fight (§4, tell #8).
   * Call when a fighter goes down: `pool({ x: corpse.x, y: groundY })`. Never destroyed.
   * Reduced-gore mode keeps the pool (it marks the corpse) but shrinks it.
   */
  pool(at: Pt): void {
    const g = this.scene.add.graphics().setPosition(at.x, this.groundY);
    g.setDepth(FX_DEPTH.pool);
    g.fillStyle(COL.bloodPool, BLOOD_FX.poolAlpha);
    const w = BLOOD_FX.poolSpreadRadius * 2;
    g.fillEllipse(0, 0, w, w * POOL_FX.aspect);
    g.setScale(POOL_FX.startScale);
    this.scene.tweens.add({
      targets: g,
      scaleX: Gore.reduced ? POOL_FX.reducedScale : 1,
      scaleY: Gore.reduced ? POOL_FX.reducedScale : 1,
      duration: BLOOD_FX.poolSpreadMs,
      ease: POOL_FX.ease,
    });
  }

  /** Dark splat + droplets where a limb came off (persists — tell #8). */
  severDecal(at: Pt): void {
    if (Gore.reduced) return;
    this.decals.fillStyle(COL.bloodPool, SEVER_DECAL.coreAlpha);
    this.decals.fillCircle(at.x, at.y, Phaser.Math.Between(SEVER_DECAL.coreRMin, SEVER_DECAL.coreRMax));
    for (let i = 0; i < SEVER_DECAL.dropletCount; i++) {
      this.decals.fillStyle(COL.bloodBright, SEVER_DECAL.dropletAlpha);
      this.decals.fillCircle(
        at.x + Phaser.Math.Between(-SEVER_DECAL.spreadX, SEVER_DECAL.spreadX),
        at.y + Phaser.Math.Between(-SEVER_DECAL.spreadYUp, SEVER_DECAL.spreadYDown),
        Phaser.Math.Between(SEVER_DECAL.dropletRMin, SEVER_DECAL.dropletRMax),
      );
    }
  }

  /** A severed limb piece flung outward — arcs, spins, falls, fades. */
  flyLimb(at: Pt, dir: 1 | -1, color: number): void {
    if (Gore.reduced) return;
    const piece = this.scene.add.graphics().setDepth(FX_DEPTH.limb).setPosition(at.x, at.y);
    const len = Phaser.Math.Between(LIMB_FX.lenMin, LIMB_FX.lenMax);
    const r = LIMB_FX.r;
    piece.lineStyle(2 * r + LIMB_FX.outlinePad, COL.outline, 1);
    piece.beginPath();
    piece.moveTo(-len / 2, 0);
    piece.lineTo(len / 2, 0);
    piece.strokePath();
    piece.lineStyle(2 * r, color, 1);
    piece.beginPath();
    piece.moveTo(-len / 2, 0);
    piece.lineTo(len / 2, 0);
    piece.strokePath();
    piece.fillStyle(COL.bloodBright, 1).fillCircle(-len / 2, 0, r); // bloody stump end

    const vx = dir * Phaser.Math.Between(LIMB_FX.vxMin, LIMB_FX.vxMax);
    const vy = -Phaser.Math.Between(LIMB_FX.vyMin, LIMB_FX.vyMax);
    const spin = Phaser.Math.Between(-LIMB_FX.spinDeg, LIMB_FX.spinDeg);
    const flightS = LIMB_FX.flightMs / MS_PER_S;
    const state = { t: 0 };
    this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: LIMB_FX.flightMs,
      onUpdate: () => {
        const dt = state.t * flightS; // seconds along the flight
        piece.x = at.x + vx * dt;
        piece.y = at.y + vy * dt + (LIMB_FX.gravity * dt * dt) / 2; // gravity arc
        piece.angle = spin * state.t;
        piece.alpha = 1 - Math.max(0, (state.t - LIMB_FX.fadeStartFrac) / (1 - LIMB_FX.fadeStartFrac));
      },
      onComplete: () => piece.destroy(),
    });
  }
}
