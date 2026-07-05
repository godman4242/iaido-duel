import type Phaser from 'phaser';
import type { Pt } from '../../core/vec';
import { DEFLECT_SWAT, FX_DEPTH } from '../../config/fx-extra';

/**
 * Deflect swat spark (M2 blueprint §3.6, Tell 10): a white core pop, an expanding steel
 * ring, and radial tick sparks where a kunai was swatted out of the air. Presentation only —
 * the integrator fires `swat(point)` off the `deflectSuccess { point }` sim event. Each swat
 * is a self-contained graphics + tween that destroys itself; scene shutdown sweeps any
 * survivors with the display list.
 */
export class DeflectSpark {
  constructor(private scene: Phaser.Scene) {}

  swat(at: Pt): void {
    if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return; // hostile point — skip
    const g = this.scene.add.graphics();
    g.setDepth(FX_DEPTH.deflectSpark);
    g.setPosition(at.x, at.y);

    // fixed per-swat spark geometry (chosen once so the tween only animates radius/alpha)
    const phase = Math.random() * Math.PI * 2;
    const lens: number[] = [];
    for (let i = 0; i < DEFLECT_SWAT.sparkCount; i++) {
      lens.push(
        DEFLECT_SWAT.sparkLenMin + Math.random() * (DEFLECT_SWAT.sparkLenMax - DEFLECT_SWAT.sparkLenMin),
      );
    }

    const draw = (t: number): void => {
      const fade = 1 - t;
      const ringR = DEFLECT_SWAT.ringStartR + (DEFLECT_SWAT.ringR - DEFLECT_SWAT.ringStartR) * t;
      g.clear();
      // white core pop — brightest at birth, gone fastest (quadratic fade)
      g.fillStyle(DEFLECT_SWAT.core, DEFLECT_SWAT.coreAlpha * fade * fade);
      g.fillCircle(0, 0, DEFLECT_SWAT.coreR);
      // expanding steel ring
      g.lineStyle(DEFLECT_SWAT.ringW, DEFLECT_SWAT.color, fade);
      g.strokeCircle(0, 0, ringR);
      // radial tick sparks sliding outward
      g.lineStyle(DEFLECT_SWAT.sparkW, DEFLECT_SWAT.color, fade);
      for (let i = 0; i < DEFLECT_SWAT.sparkCount; i++) {
        const a = phase + (i / DEFLECT_SWAT.sparkCount) * Math.PI * 2;
        const base = DEFLECT_SWAT.ringStartR + DEFLECT_SWAT.sparkTravel * t;
        g.beginPath();
        g.moveTo(Math.cos(a) * base, Math.sin(a) * base);
        g.lineTo(Math.cos(a) * (base + lens[i]), Math.sin(a) * (base + lens[i]));
        g.strokePath();
      }
    };
    draw(0);

    const state = { t: 0 };
    this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: DEFLECT_SWAT.flashMs,
      onUpdate: () => draw(state.t),
      onComplete: () => g.destroy(),
    });
  }
}
