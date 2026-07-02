// src/game/chrome/Letterbox.ts — §9 / tell #9 travel-pan letterbox: scene
// transitions collapse to a thin strip between huge black bars while the camera
// pans, then the bars release. Bar height comes from layout.LETTERBOX_BAR_FRAC.
//
// Usage:
//   const lb = new Letterbox(scene);
//   lb.slideIn(() => { /* pan the camera */ lb.slideOut(); });
import Phaser from 'phaser';
import { GAME_W, GAME_H, LETTERBOX_BAR_FRAC } from '../../config/layout';
import { COL } from '../../config/palette';
import { CHROME_DEPTH, LETTERBOX } from '../../config/chrome-extra';

export class Letterbox {
  private top: Phaser.GameObjects.Rectangle;
  private bottom: Phaser.GameObjects.Rectangle;
  private scene: Phaser.Scene;
  private barH = GAME_H * LETTERBOX_BAR_FRAC;
  private covering = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Bars start parked just off the top/bottom edges; scroll factor 0 keeps them
    // screen-fixed if a camera ever pans during the transition.
    this.top = scene.add
      .rectangle(0, -this.barH, GAME_W, this.barH, COL.vignetteBlack, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(CHROME_DEPTH.letterbox);
    this.bottom = scene.add
      .rectangle(0, GAME_H, GAME_W, this.barH, COL.vignetteBlack, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(CHROME_DEPTH.letterbox);
  }

  /** True while the bars are on screen (in, or animating in). */
  get engaged(): boolean {
    return this.covering;
  }

  /** Park the bars ON screen instantly — for a scene that OPENS mid-travel and then slideOut()s. */
  snapIn(): void {
    this.scene.tweens.killTweensOf([this.top, this.bottom]);
    this.top.y = 0;
    this.bottom.y = GAME_H - this.barH;
    this.covering = true;
  }

  /** Slide both bars in, leaving the thin strip between them. */
  slideIn(onDone?: () => void): void {
    this.covering = true;
    this.scene.tweens.killTweensOf([this.top, this.bottom]);
    this.scene.tweens.add({ targets: this.top, y: 0, duration: LETTERBOX.inMs, ease: LETTERBOX.ease });
    this.scene.tweens.add({
      targets: this.bottom,
      y: GAME_H - this.barH,
      duration: LETTERBOX.inMs,
      ease: LETTERBOX.ease,
      onComplete: () => onDone?.(),
    });
  }

  /** Release the bars back off screen. */
  slideOut(onDone?: () => void): void {
    this.scene.tweens.killTweensOf([this.top, this.bottom]);
    this.scene.tweens.add({ targets: this.top, y: -this.barH, duration: LETTERBOX.outMs, ease: LETTERBOX.ease });
    this.scene.tweens.add({
      targets: this.bottom,
      y: GAME_H,
      duration: LETTERBOX.outMs,
      ease: LETTERBOX.ease,
      onComplete: () => {
        this.covering = false;
        onDone?.();
      },
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf([this.top, this.bottom]);
    this.top.destroy();
    this.bottom.destroy();
  }
}
