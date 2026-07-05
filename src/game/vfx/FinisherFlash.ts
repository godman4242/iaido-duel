import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { COL } from '../../palette';
import { FINISHER_FLASH } from '../../config/fx';
import { FINISHER_LAYERS, FX_DEPTH } from '../../config/fx-extra';
import { drawSkeleton } from '../fighter/drawFighter';
import { IDLE_POSE, Pose } from '../fighter/Skeleton';

/**
 * Finisher flash (ART_DIRECTION §4 + tell #5a, p1 f56 / p2 f35): for a beat mid-kill the
 * WHOLE scene renders as black silhouettes over flat red — distinct from the YOU WIN
 * screen (KillBeat). Implemented as an overlay: a full-screen flat-red rect + a black
 * ground band + duplicate black-silhouette renders of the fighters, snapping in over
 * `snapInMs`, holding `durationMs`, releasing over `fadeOutMs`.
 *
 * Optional slow-mo (§9): scales the scene clock + tween manager by `slowMoScale` for the
 * beat; the flash's own lifecycle runs on raw frame deltas so it is immune to the scaling.
 *
 * Integrator hook: on the killing blow, before KillBeat —
 *   `new FinisherFlash(scene).play([{ x: f.x, y: f.y, facing: f.facing, pose }], { onDone })`.
 */
export type FinisherSil = {
  x: number;
  y: number; // pelvis root (same convention as Fighter containers)
  facing: 1 | -1;
  pose?: Pose; // defaults to IDLE_POSE
  scale?: number; // defaults to FINISHER_LAYERS.silScale (world scale)
};

export class FinisherFlash {
  private active = false;

  constructor(private scene: Phaser.Scene) {}

  get isActive(): boolean {
    return this.active;
  }

  play(sils: FinisherSil[], opts?: { groundY?: number; slowMo?: boolean; onDone?: () => void }): void {
    if (this.active) return;
    this.active = true;
    const s = this.scene;

    const layer = s.add.container(0, 0).setDepth(FX_DEPTH.finisher).setAlpha(0);

    // flat red field (§4: everything over flat red)
    const field = s.make.graphics({ x: 0, y: 0 }, false);
    field.fillStyle(COL.finisherRed, 1).fillRect(0, 0, GAME_W, GAME_H);
    layer.add(field);

    // black ground band — the world floor reads as a solid silhouette strip
    const bandTop = opts?.groundY ?? GAME_H * (1 - FINISHER_LAYERS.groundBandFrac);
    const band = s.make.graphics({ x: 0, y: 0 }, false);
    band.fillStyle(COL.vignetteBlack, 1).fillRect(0, bandTop, GAME_W, GAME_H - bandTop);
    layer.add(band);

    // duplicate silhouette renders of the fighters (black, current poses)
    for (const sil of sils) {
      const g = s.make.graphics({ x: sil.x, y: sil.y }, false);
      const k = sil.scale ?? FINISHER_LAYERS.silScale;
      g.setScale(k * sil.facing, k);
      drawSkeleton(g, sil.pose ?? IDLE_POSE, { severed: new Set(), silhouette: true });
      layer.add(g);
    }

    // slow-mo beat (§9 / blueprint §3.11): the clock RAMPS to slowMoScale over slowMoRampMs
    // (not an instant set), holds, and restores on release. The ramp runs on the same raw
    // update deltas as the flash lifecycle, so it is immune to the scaling it applies.
    const applySlowMo = opts?.slowMo ?? true;
    const prevTimeScale = s.time.timeScale;
    const prevTweenScale = s.tweens.timeScale;
    const rampMs = FINISHER_FLASH.slowMoRampMs;
    const setScales = (v: number): void => {
      s.time.timeScale = v;
      s.tweens.timeScale = v;
    };

    // lifecycle on RAW update deltas — unaffected by the slow-mo it applies
    const snap = FINISHER_FLASH.snapInMs;
    const hold = FINISHER_FLASH.durationMs;
    const release = FINISHER_LAYERS.fadeOutMs;
    let t = 0;
    let done = false;
    const onUpdate = (_time: number, deltaMs: number): void => {
      t += deltaMs;
      if (applySlowMo) {
        // §3.11 measure: an intermediate timeScale exists mid-ramp, then the factor holds
        const k = rampMs > 0 ? Math.min(1, t / rampMs) : 1;
        setScales(prevTimeScale + (FINISHER_FLASH.slowMoScale - prevTimeScale) * k);
      }
      if (t < snap) {
        layer.setAlpha(t / snap); // snaps in near-instantly (§4)
      } else if (t < snap + hold) {
        layer.setAlpha(1);
      } else if (t < snap + hold + release) {
        layer.setAlpha(1 - (t - snap - hold) / release);
      } else {
        finish();
      }
    };
    // cleanup vs finish: SHUTDOWN (e.g. R-restart mid-flash) must ONLY clean up — running
    // onDone there would spawn the KillBeat into a scene whose plugins (clock/tweens/display
    // list) have already purged, leaking its graphics/timers into the restarted duel.
    const cleanup = (): void => {
      if (done) return;
      done = true;
      s.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
      s.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
      if (applySlowMo) {
        s.time.timeScale = prevTimeScale;
        s.tweens.timeScale = prevTweenScale;
      }
      layer.destroy(true);
      this.active = false;
    };
    const finish = (): void => {
      if (done) return;
      cleanup();
      opts?.onDone?.();
    };
    s.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    s.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  }
}
