// src/game/chrome/Modal.ts — the §7 modal panel (p1 f20 "YOU RECEIVED", p2 f07):
// scene dims, then a centered mottled-maroon panel (base + smoke swirls + black
// kasa-silhouette accent) pops in with a thin gold frame, ornate gold corner
// flourishes, centered cream caps text and red gold-bordered buttons (OK / YES–NO).
//
// Usage:
//   Modal.message(scene, 'The gate is barred until dawn.');
//   Modal.confirm(scene, 'Abandon this quest?', onYes, onNo);
//   new Modal(scene, { title: 'You received', body: '30 coins.', buttons: [...] });
// All prose passed through here is OURS — never the original game's lines.
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config/layout';
import { COL } from '../../config/palette';
import { FONT_BODY, FONT_SIZE, TEXT_OUTLINE } from '../../config/typography';
import { CHROME_DEPTH, CHROME_COL, MODAL, PANEL, cssHex } from '../../config/chrome-extra';
import { paintMottled, goldFrame, cornerFlourishes, paintSilhouette } from './mottle';

export interface ModalButton {
  label: string;
  onClick?: () => void;
}

export interface ModalOpts {
  title?: string;
  body?: string;
  /** Defaults to a single OK button that closes the modal. */
  buttons?: ModalButton[];
  w?: number;
  h?: number;
}

const HALF = 1 / 2;

export class Modal {
  private scene: Phaser.Scene;
  private dim: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Container;
  private destroyed = false;

  /** Plain message box with a red OK button. */
  static message(scene: Phaser.Scene, body: string, onOk?: () => void): Modal {
    return new Modal(scene, { body, buttons: [{ label: 'OK', onClick: onOk }] });
  }

  /** YES / NO confirmation box. */
  static confirm(scene: Phaser.Scene, body: string, onYes?: () => void, onNo?: () => void): Modal {
    return new Modal(scene, {
      body,
      buttons: [
        { label: 'YES', onClick: onYes },
        { label: 'NO', onClick: onNo },
      ],
    });
  }

  constructor(scene: Phaser.Scene, opts: ModalOpts) {
    this.scene = scene;
    const w = opts.w ?? MODAL.w;
    const h = opts.h ?? MODAL.h;
    const buttons = opts.buttons ?? [{ label: 'OK' }];

    // Full-screen dim that also swallows clicks behind the panel.
    this.dim = scene.add
      .rectangle(GAME_W * HALF, GAME_H * HALF, GAME_W, GAME_H, COL.vignetteBlack, MODAL.dimAlpha)
      .setDepth(CHROME_DEPTH.modal)
      .setInteractive();

    // Panel container centered on screen; children use panel-local coords.
    this.panel = scene.add.container(GAME_W * HALF, GAME_H * HALF).setDepth(CHROME_DEPTH.modal + 1);
    const left = -w * HALF;
    const top = -h * HALF;

    const g = scene.add.graphics();
    paintMottled(g, left, top, w, h);
    // Black kasa-figure accent on the right side of the backdrop.
    paintSilhouette(
      g,
      left + MODAL.silhouetteXFrac * w,
      top + (1 - MODAL.silhouetteHFrac) * h,
      MODAL.silhouetteWFrac * w,
      MODAL.silhouetteHFrac * h,
      MODAL.silhouetteAlpha,
    );
    goldFrame(g, left, top, w, h);
    cornerFlourishes(g, left, top, w, h);
    this.panel.add(g);

    if (opts.title) {
      this.panel.add(
        scene.add
          .text(0, top + MODAL.titleOffsetY, opts.title.toUpperCase(), {
            fontFamily: FONT_BODY,
            fontSize: `${FONT_SIZE.body}px`,
            color: cssHex(COL.chromeCream),
            stroke: cssHex(COL.vignetteBlack),
            strokeThickness: TEXT_OUTLINE.body,
          })
          .setOrigin(HALF),
      );
    }

    if (opts.body) {
      this.panel.add(
        scene.add
          .text(0, opts.title ? top + MODAL.bodyOffsetY : -h * HALF * HALF, opts.body.toUpperCase(), {
            fontFamily: FONT_BODY,
            fontSize: `${FONT_SIZE.body}px`,
            color: cssHex(COL.chromeCream),
            stroke: cssHex(COL.vignetteBlack),
            strokeThickness: TEXT_OUTLINE.body,
            align: 'center',
            wordWrap: { width: w - MODAL.bodyWrapPad * 2 },
          })
          .setOrigin(HALF, opts.title ? 0 : HALF),
      );
    }

    // Red buttons row, centered along the bottom of the panel.
    const rowW = buttons.length * MODAL.btnW + (buttons.length - 1) * MODAL.btnGap;
    const btnY = h * HALF - MODAL.btnMarginBottom - MODAL.btnH * HALF;
    buttons.forEach((btn, i) => {
      const cx = -rowW * HALF + MODAL.btnW * HALF + i * (MODAL.btnW + MODAL.btnGap);
      this.addButton(cx, btnY, btn);
    });

    // §7 pop-in beat.
    this.panel.setScale(MODAL.popFromScale).setAlpha(0);
    scene.tweens.add({
      targets: this.panel,
      scale: 1,
      alpha: 1,
      duration: MODAL.popMs,
      ease: 'Back.easeOut',
    });
  }

  /** Red rounded button with a thin gold border; clicking runs the callback then closes. */
  private addButton(cx: number, cy: number, btn: ModalButton): void {
    const g = this.scene.add.graphics();
    const draw = (hover: boolean): void => {
      g.clear();
      g.fillStyle(hover ? CHROME_COL.buttonRedHover : COL.buttonRed, 1);
      g.fillRoundedRect(cx - MODAL.btnW * HALF, cy - MODAL.btnH * HALF, MODAL.btnW, MODAL.btnH, MODAL.btnRadius);
      g.lineStyle(PANEL.btnBorderW, COL.goldTrim, 1);
      g.strokeRoundedRect(cx - MODAL.btnW * HALF, cy - MODAL.btnH * HALF, MODAL.btnW, MODAL.btnH, MODAL.btnRadius);
    };
    draw(false);
    this.panel.add(g);

    this.panel.add(
      this.scene.add
        .text(cx, cy, btn.label.toUpperCase(), {
          fontFamily: FONT_BODY,
          fontSize: `${FONT_SIZE.body}px`,
          color: cssHex(COL.chromeCream),
          stroke: cssHex(COL.vignetteBlack),
          strokeThickness: TEXT_OUTLINE.body,
        })
        .setOrigin(HALF),
    );

    const hit = this.scene.add
      .rectangle(cx, cy, MODAL.btnW, MODAL.btnH)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => draw(true))
      .on('pointerout', () => draw(false))
      .on('pointerdown', () => {
        btn.onClick?.();
        this.close();
      });
    this.panel.add(hit);
  }

  close(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.dim.destroy();
    this.panel.destroy(); // destroys children, including hit rects
  }

  destroy(): void {
    this.close();
  }
}
