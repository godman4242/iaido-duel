// src/game/chrome/DialogueBox.ts — the §7 bottom dialogue strip (p1 f05/f21/f24):
// full-width near-black box with a thin gold frame, a name-plate banner overlapping
// the top-left edge, cream all-caps typewriter text, stacked choice rows whose
// hovered/selected row fills blood-red, a blinking advance arrow, and an optional
// player-bust frame at the bottom-right.
//
// Usage:
//   const box = new DialogueBox(scene, { showBust: true });
//   box.say('KAEDE', 'A storm is coming in from the pass.', () => box.ask(...));
//   box.ask('KAEDE', 'Will you shelter here tonight?', [
//     { label: 'I will stay.', onSelect: ... },
//     { label: 'The road cannot wait.', onSelect: ... },
//   ]);
// All prose passed through here is OURS — never the original game's lines.
import Phaser from 'phaser';
import { GAME_W, GAME_H, DIALOGUE_STRIP } from '../../config/layout';
import { COL } from '../../config/palette';
import { FONT_BODY, FONT_SIZE, TEXT_OUTLINE } from '../../config/typography';
import { CHROME_DEPTH, DIALOGUE_CHROME as DC, BUST_GLYPH, cssHex } from '../../config/chrome-extra';
import { goldFrame } from './mottle';

export interface DialogueChoice {
  label: string;
  onSelect: () => void;
}

type G = Phaser.GameObjects.Graphics;
type Destroyable = { destroy: () => void };

const HALF = 1 / 2;

export class DialogueBox {
  private scene: Phaser.Scene;
  private showBust: boolean;
  /** Everything belonging to the current say()/ask() render, destroyed on re-render. */
  private layer: Destroyable[] = [];
  private typeTimer?: Phaser.Time.TimerEvent;
  private arrowTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, opts: { showBust?: boolean } = {}) {
    this.scene = scene;
    this.showBust = opts.showBust ?? false;
  }

  /** One speech line: name plate + cream caps typewriter text + blinking advance arrow. */
  say(name: string, text: string, onAdvance?: () => void): void {
    this.clearLayer();
    const top = GAME_H - DIALOGUE_STRIP.h;
    this.paintStrip(top, DIALOGUE_STRIP.h);
    this.paintNamePlate(name, top);
    if (this.showBust) this.paintBust(top);

    const inset = DIALOGUE_STRIP.frameInset;
    const bustReserve = this.showBust ? DIALOGUE_STRIP.portrait.w + DC.bustMarginX * 2 : 0;
    const body = this.scene.add
      .text(inset + DC.textPadX, top + DC.textPadY, '', {
        fontFamily: FONT_BODY,
        fontSize: `${FONT_SIZE.body}px`,
        color: cssHex(COL.chromeCream),
        stroke: cssHex(COL.vignetteBlack),
        strokeThickness: TEXT_OUTLINE.body,
        wordWrap: { width: GAME_W - (inset + DC.textPadX) * 2 - bustReserve },
        lineSpacing: DC.lineSpacing,
      })
      .setDepth(CHROME_DEPTH.dialogue + 1);
    this.layer.push(body);

    // Typewriter reveal — a click mid-type completes the line, the next click advances.
    const full = text.toUpperCase();
    let shown = 0;
    let done = false;
    const arrow = this.makeArrow();
    const finish = (): void => {
      done = true;
      body.setText(full);
      this.typeTimer?.remove();
      this.typeTimer = undefined;
      arrow.setVisible(true);
    };
    this.typeTimer = this.scene.time.addEvent({
      delay: DC.typeCharMs,
      loop: true,
      callback: () => {
        shown++;
        body.setText(full.slice(0, shown));
        if (shown >= full.length) finish();
      },
    });

    const hit = this.scene.add
      .rectangle(GAME_W * HALF, top + DIALOGUE_STRIP.h * HALF, GAME_W, DIALOGUE_STRIP.h)
      .setDepth(CHROME_DEPTH.dialogue + 2)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (!done) finish();
        else onAdvance?.();
      });
    this.layer.push(hit);
  }

  /** Prompt row + stacked full-width choice rows; hovered/selected row fills blood-red. */
  ask(name: string, prompt: string, choices: DialogueChoice[]): void {
    this.clearLayer();
    const inset = DIALOGUE_STRIP.frameInset;
    const rowH = DIALOGUE_STRIP.choiceRowH;
    const stripH = DC.promptRowH + rowH * choices.length + inset * 2;
    const top = GAME_H - stripH;
    this.paintStrip(top, stripH);
    this.paintNamePlate(name, top);
    if (this.showBust) this.paintBust(top);

    const promptText = this.scene.add
      .text(inset + DC.textPadX, top + inset + DC.promptRowH * HALF, prompt.toUpperCase(), {
        fontFamily: FONT_BODY,
        fontSize: `${FONT_SIZE.body}px`,
        color: cssHex(COL.chromeCream),
        stroke: cssHex(COL.vignetteBlack),
        strokeThickness: TEXT_OUTLINE.body,
      })
      .setOrigin(0, HALF)
      .setDepth(CHROME_DEPTH.dialogue + 1);
    this.layer.push(promptText);

    choices.forEach((choice, i) => {
      const rowTop = top + inset + DC.promptRowH + i * rowH;
      const g = this.scene.add.graphics().setDepth(CHROME_DEPTH.dialogue + 1);
      this.layer.push(g);
      const draw = (hover: boolean): void => {
        g.clear();
        if (hover) {
          g.fillStyle(COL.choiceHoverRed, 1);
          g.fillRect(inset, rowTop, GAME_W - inset * 2, rowH);
        }
        // Thin gold separator along the row's top edge.
        g.lineStyle(1, COL.goldTrim, DC.separatorAlpha);
        g.beginPath();
        g.moveTo(inset, rowTop);
        g.lineTo(GAME_W - inset, rowTop);
        g.strokePath();
      };
      draw(false);

      const label = this.scene.add
        .text(DC.choicePadX, rowTop + rowH * HALF, choice.label.toUpperCase(), {
          fontFamily: FONT_BODY,
          fontSize: `${FONT_SIZE.body}px`,
          color: cssHex(COL.chromeCream),
          stroke: cssHex(COL.vignetteBlack),
          strokeThickness: TEXT_OUTLINE.body,
        })
        .setOrigin(0, HALF)
        .setDepth(CHROME_DEPTH.dialogue + 2);
      this.layer.push(label);

      const hit = this.scene.add
        .rectangle(GAME_W * HALF, rowTop + rowH * HALF, GAME_W - inset * 2, rowH)
        .setDepth(CHROME_DEPTH.dialogue + 2)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => draw(true))
        .on('pointerout', () => draw(false))
        .on('pointerdown', () => {
          draw(true); // stays filled as the selected row
          choice.onSelect();
        });
      this.layer.push(hit);
    });
  }

  /** Remove the current strip (keeps the instance reusable). */
  hide(): void {
    this.clearLayer();
  }

  destroy(): void {
    this.clearLayer();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private paintStrip(top: number, h: number): void {
    const g = this.scene.add.graphics().setDepth(CHROME_DEPTH.dialogue);
    g.fillStyle(COL.panelInk, DC.bgAlpha);
    g.fillRect(0, top, GAME_W, h);
    const inset = DIALOGUE_STRIP.frameInset;
    goldFrame(g, inset, top + inset, GAME_W - inset * 2, h - inset * 2);
    this.layer.push(g);
  }

  private paintNamePlate(name: string, stripTop: number): void {
    const p = DIALOGUE_STRIP.namePlate;
    const x = p.offsetX;
    const y = stripTop + p.offsetY;
    const g = this.scene.add.graphics().setDepth(CHROME_DEPTH.dialogue + 1);
    g.fillStyle(COL.panelInk, 1);
    g.fillRoundedRect(x, y, DC.namePlateW, p.h, DC.namePlateRadius);
    g.lineStyle(2, COL.goldTrim, 1);
    g.strokeRoundedRect(x, y, DC.namePlateW, p.h, DC.namePlateRadius);
    g.lineStyle(1, COL.goldTrim, DC.separatorAlpha);
    g.strokeRoundedRect(x + 2, y + 2, DC.namePlateW - 2 * 2, p.h - 2 * 2, DC.namePlateRadius);
    this.layer.push(g);

    const label = this.scene.add
      .text(x + DC.namePlateW * HALF, y + p.h * HALF, name.toUpperCase(), {
        fontFamily: FONT_BODY,
        fontSize: `${FONT_SIZE.nameLabel}px`,
        color: cssHex(COL.chromeCream),
        stroke: cssHex(COL.vignetteBlack),
        strokeThickness: TEXT_OUTLINE.nameLabel,
      })
      .setOrigin(HALF)
      .setDepth(CHROME_DEPTH.dialogue + 2);
    this.layer.push(label);
  }

  /** Blinking cream ▶ advance arrow, bottom-right of the strip (hidden while typing). */
  private makeArrow(): G {
    const g = this.scene.add.graphics().setDepth(CHROME_DEPTH.dialogue + 1);
    const s = DC.arrowSize;
    const x = GAME_W - DC.arrowMarginX;
    const y = GAME_H - DC.arrowMarginY;
    g.fillStyle(COL.chromeCream, 1);
    g.beginPath();
    g.moveTo(x - s, y - s);
    g.lineTo(x, y);
    g.lineTo(x - s, y + s);
    g.closePath();
    g.fillPath();
    g.setVisible(false);
    this.arrowTween = this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: DC.arrowBlinkMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.layer.push(g);
    return g;
  }

  /** Player-bust slot: gold-framed rounded box with a flat kasa-bust glyph. */
  private paintBust(stripTop: number): void {
    const { w, h } = DIALOGUE_STRIP.portrait;
    const x = GAME_W - w - DC.bustMarginX;
    const y = stripTop - DC.bustOverlap;
    const g = this.scene.add.graphics().setDepth(CHROME_DEPTH.dialogue + 2);
    g.fillStyle(COL.panelInk, 1);
    g.fillRoundedRect(x, y, w, h, DC.bustRadius);
    // Flat cel bust: shoulders → face → kasa → dark under-brim band.
    g.fillStyle(COL.kimono, 1);
    this.fillGlyphPoly(g, BUST_GLYPH.body, x, y, w, h);
    g.fillStyle(COL.skin, 1);
    g.fillCircle(x + BUST_GLYPH.face.x * w, y + BUST_GLYPH.face.y * h, BUST_GLYPH.face.r * w);
    g.fillStyle(COL.hatStraw, 1);
    this.fillGlyphPoly(g, BUST_GLYPH.kasa, x, y, w, h);
    const b = BUST_GLYPH.brim;
    g.lineStyle(b.w * h, COL.hatShade, 1);
    g.beginPath();
    g.moveTo(x + b.x1 * w, y + b.y1 * h);
    g.lineTo(x + b.x2 * w, y + b.y2 * h);
    g.strokePath();
    g.lineStyle(2, COL.goldTrim, 1);
    g.strokeRoundedRect(x, y, w, h, DC.bustRadius);
    this.layer.push(g);
  }

  private fillGlyphPoly(g: G, pts: readonly (readonly number[])[], x: number, y: number, w: number, h: number): void {
    g.beginPath();
    g.moveTo(x + pts[0][0] * w, y + pts[0][1] * h);
    for (let i = 1; i < pts.length; i++) g.lineTo(x + pts[i][0] * w, y + pts[i][1] * h);
    g.closePath();
    g.fillPath();
  }

  private clearLayer(): void {
    this.typeTimer?.remove();
    this.typeTimer = undefined;
    this.arrowTween?.remove();
    this.arrowTween = undefined;
    for (const o of this.layer) o.destroy();
    this.layer = [];
  }
}
