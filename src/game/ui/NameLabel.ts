import Phaser from 'phaser';
import { NAME_LABEL } from '../../config/layout';
import { COL } from '../../palette';
import { FONT_BODY, FONT_SIZE, TEXT_OUTLINE } from '../../config/typography';
import { hexCss, HUD_DEPTH, HUD_BARS } from '../../config/hud-extra';

const HALF = 1 / 2;

/** §3/tell #7 label kinds: gold = player, blue = NPC, red = hostile `NAME (LVL)`. */
export type NameLabelKind = 'player' | 'npc' | 'hostile';

export type NameLabelOpts = {
  /** Level shown in parens after the name (hostiles in the source footage). */
  level?: number;
  /** 0..1 health fraction provider; when present a small green bar renders under the name. */
  hp?: () => number;
  /** Height above target.y; defaults to NAME_LABEL.offsetY (scale it for shrunken explorer rigs). */
  offsetY?: number;
};

type LabelTarget = { x: number; y: number };

const KIND_COLOR: Record<NameLabelKind, number> = {
  player: COL.nameGold,
  npc: COL.nameBlue,
  hostile: COL.nameRed,
};

/**
 * Floating name label above a fighter/NPC (ART_DIRECTION §3, tell #7): small outlined
 * caps — gold player / blue NPC / red hostile with `(LVL)` — plus an optional 60×6
 * green HP bar UNDER the name (never a top-of-screen bar). Call update() every frame.
 */
export class NameLabel {
  private text: Phaser.GameObjects.Text;
  private g?: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private target: LabelTarget,
    name: string,
    kind: NameLabelKind,
    private opts: NameLabelOpts = {},
  ) {
    const caption =
      opts.level !== undefined ? `${name.toUpperCase()} (${opts.level})` : name.toUpperCase();
    this.text = scene.add
      .text(target.x, target.y + (opts.offsetY ?? NAME_LABEL.offsetY), caption, {
        fontFamily: FONT_BODY,
        fontSize: `${FONT_SIZE.nameLabel}px`,
        fontStyle: 'bold',
        color: hexCss(KIND_COLOR[kind]),
      })
      .setOrigin(HALF, 1)
      .setDepth(HUD_DEPTH.text)
      .setStroke(hexCss(COL.outline), TEXT_OUTLINE.nameLabel);
    if (opts.hp) this.g = scene.add.graphics().setDepth(HUD_DEPTH.gfx);
  }

  update(): void {
    const x = this.target.x;
    const top = this.target.y + (this.opts.offsetY ?? NAME_LABEL.offsetY);
    this.text.setPosition(x, top);
    if (this.g && this.opts.hp) {
      const frac = Math.max(0, Math.min(1, this.opts.hp()));
      const bx = x - NAME_LABEL.hpBarW * HALF;
      const by = top + NAME_LABEL.hpBarGap;
      this.g.clear();
      this.g
        .fillStyle(COL.outline, HUD_BARS.outlineAlpha)
        .fillRect(
          bx - HUD_BARS.pad,
          by - HUD_BARS.pad,
          NAME_LABEL.hpBarW + HUD_BARS.pad * 2,
          NAME_LABEL.hpBarH + HUD_BARS.pad * 2,
        );
      this.g.fillStyle(COL.outline, 1).fillRect(bx, by, NAME_LABEL.hpBarW, NAME_LABEL.hpBarH);
      this.g
        .fillStyle(COL.healthGreen, 1)
        .fillRect(bx, by, NAME_LABEL.hpBarW * frac, NAME_LABEL.hpBarH);
    }
  }

  destroy(): void {
    this.text.destroy();
    this.g?.destroy();
  }
}
