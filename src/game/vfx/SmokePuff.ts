import Phaser from 'phaser';
import { GAME_H } from '../../config';
import { FX_DEPTH, FX_GROUND_OFFSET, SMOKE_PUFF } from '../../config/fx-extra';
import { SMOKE_BOMB_MS } from '../../config/combat-sim';

/**
 * Smoke-Bomb puff (M2 blueprint §3.5, Tell 10): a grey burst cloud at the vanish point and
 * a smaller reappear poof at the destination, timed to the sim's SMOKE_BOMB_MS slide.
 * Presentation only — the integrator fires `teleport(fromX, toX)` off the `smokeBombUsed`
 * sim event; position/i-frames stay sim-owned.
 *
 * Phaser 3.90 note (DIVERGENCES, M1): EmitterOp property setters (e.g. `particleAngle =
 * {min,max}`) silently no-op after construction. This emitter needs NO dynamic ranges —
 * every range is final at construction, so the trap is side-stepped entirely; per-burst
 * variation comes from jittered `emitParticleAt` points and counts.
 */
export class SmokePuff {
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private groundY: number;
  private pending = new Set<Phaser.Time.TimerEvent>();
  private destroyed = false;

  constructor(
    private scene: Phaser.Scene,
    groundY?: number,
  ) {
    this.groundY = groundY ?? GAME_H - FX_GROUND_OFFSET;
    if (!scene.textures.exists(SMOKE_PUFF.key)) {
      // soft dot: concentric rings fake a radial gradient (BLOOD_DOT precedent, but fluffy)
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      const c = SMOKE_PUFF.texSize / 2;
      for (let i = 0; i < SMOKE_PUFF.rings; i++) {
        g.fillStyle(SMOKE_PUFF.white, SMOKE_PUFF.ringAlpha);
        g.fillCircle(c, c, c * (1 - i / SMOKE_PUFF.rings));
      }
      g.generateTexture(SMOKE_PUFF.key, SMOKE_PUFF.texSize, SMOKE_PUFF.texSize);
      g.destroy();
    }
    this.emitter = scene.add.particles(0, 0, SMOKE_PUFF.key, {
      lifespan: SMOKE_PUFF.riseMs,
      speed: { min: SMOKE_PUFF.speedMin, max: SMOKE_PUFF.speedMax },
      angle: { min: SMOKE_PUFF.angleMin, max: SMOKE_PUFF.angleMax }, // upward fan, static
      gravityY: SMOKE_PUFF.gravityY, // negative — the cloud rises
      scale: { start: SMOKE_PUFF.scaleStart, end: SMOKE_PUFF.scaleEnd }, // swells as it thins
      alpha: { start: SMOKE_PUFF.alphaStart, end: 0 },
      tint: [SMOKE_PUFF.tintLight, SMOKE_PUFF.tintDark],
      quantity: 0,
      emitting: false,
    });
    this.emitter.setDepth(FX_DEPTH.smoke);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** One puff cloud at (x, y). y defaults to body-center height above the ground line. */
  burst(x: number, y?: number, count: number = SMOKE_PUFF.particleCount): void {
    const cy = y ?? this.groundY - SMOKE_PUFF.centerYOffset;
    if (this.destroyed || !Number.isFinite(x) || !Number.isFinite(cy)) return;
    const n = Number.isFinite(count)
      ? Math.min(SMOKE_PUFF.maxPerBurst, Math.max(0, Math.floor(count)))
      : SMOKE_PUFF.particleCount; // hostile count — fall back to the default
    for (let i = 0; i < n; i++) {
      const jx = (Math.random() * 2 - 1) * SMOKE_PUFF.radius;
      const jy = (Math.random() * 2 - 1) * SMOKE_PUFF.radius;
      this.emitter.emitParticleAt(x + jx, cy + jy, 1);
    }
  }

  /**
   * The full smoke-bomb beat: burst at the vanish point NOW, then a smaller reappear poof
   * at the destination when the sim's SMOKE_BOMB_MS slide completes. Wire to the
   * `smokeBombUsed { fromX, toX }` sim event.
   */
  teleport(fromX: number, toX: number, y?: number): void {
    if (this.destroyed) return;
    this.burst(fromX, y);
    if (!Number.isFinite(toX)) return;
    const ev = this.scene.time.delayedCall(SMOKE_BOMB_MS, () => {
      this.pending.delete(ev);
      this.burst(toX, y, SMOKE_PUFF.reappearCount);
    });
    this.pending.add(ev);
  }

  /** Cancel pending reappear poofs and free the emitter (idempotent; auto-run on SHUTDOWN). */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const ev of this.pending) ev.remove(false);
    this.pending.clear();
    this.emitter.destroy();
  }
}
