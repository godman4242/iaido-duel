// src/game/chrome/Panel.ts — §7 menu-screen primitives (p1 f13 PLAYER screen is the
// reference): full mottled-maroon backdrop, gold brush title top-left, red X close
// button top-right, near-black inset boxes, red gold-bordered action buttons and
// stone-grey item tiles with rarity borders. Enough chrome to assemble the future
// PLAYER / SKILLS / QUESTS / BUY / SELL screens.
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config/layout';
import { COL } from '../../config/palette';
import { FONT_DISPLAY, FONT_BODY, FONT_SIZE, TEXT_OUTLINE } from '../../config/typography';
import { CHROME_DEPTH, CHROME_COL, PANEL, cssHex } from '../../config/chrome-extra';
import { paintMottled, goldFrame, cornerFlourishes } from './mottle';

type G = Phaser.GameObjects.Graphics;

const HALF = 1 / 2;

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic';

const RARITY_COL: Record<Rarity, number> = {
  common: COL.rarityGrey,
  uncommon: COL.rarityGreen,
  rare: COL.rarityBlue,
  epic: COL.rarityPurple,
};

/**
 * Full-screen §7 panel backdrop: mottled maroon field + thin gold frame + ornate
 * corner flourishes. Returns the Graphics so callers can destroy the screen.
 */
export function panelBackdrop(scene: Phaser.Scene, depth = CHROME_DEPTH.modal): G {
  const g = scene.add.graphics().setDepth(depth);
  paintMottled(g, 0, 0, GAME_W, GAME_H);
  const inset = PANEL.frameInset;
  goldFrame(g, inset, inset, GAME_W - inset * 2, GAME_H - inset * 2);
  cornerFlourishes(g, inset, inset, GAME_W - inset * 2, GAME_H - inset * 2);
  return g;
}

/** Gold brush-caps screen title, top-left (`PLAYER`, `SKILLS`, `QUESTS`, …). */
export function panelTitle(scene: Phaser.Scene, label: string, depth = CHROME_DEPTH.modal + 1): Phaser.GameObjects.Text {
  return scene.add
    .text(PANEL.titleX, PANEL.titleY, label.toUpperCase(), {
      fontFamily: FONT_DISPLAY,
      fontStyle: 'bold',
      fontSize: `${FONT_SIZE.panelTitle}px`,
      color: cssHex(COL.goldTrim),
      stroke: cssHex(COL.vignetteBlack),
      strokeThickness: TEXT_OUTLINE.display,
    })
    .setDepth(depth);
}

/** Near-black inset content box with a thin tan border (inventory grids, detail panes). */
export function insetBox(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(COL.panelInk, 1);
  g.fillRoundedRect(x, y, w, h, PANEL.insetRadius);
  g.lineStyle(1, COL.goldTrim, PANEL.insetBorderAlpha);
  g.strokeRoundedRect(x, y, w, h, PANEL.insetRadius);
}

export interface ChromeHandle {
  destroy: () => void;
}

/** Red X close button, top-right of the screen (or at an explicit position). */
export function closeButton(
  scene: Phaser.Scene,
  onClose: () => void,
  opts: { x?: number; y?: number; depth?: number } = {},
): ChromeHandle {
  const s = PANEL.closeSize;
  const x = opts.x ?? GAME_W - PANEL.closeMargin - s;
  const y = opts.y ?? PANEL.closeMargin;
  const depth = opts.depth ?? CHROME_DEPTH.modal + 1;
  const g = scene.add.graphics().setDepth(depth);
  const draw = (hover: boolean): void => {
    g.clear();
    g.fillStyle(hover ? CHROME_COL.buttonRedHover : COL.buttonRed, 1);
    g.fillRoundedRect(x, y, s, s, PANEL.closeRadius);
    g.lineStyle(PANEL.btnBorderW, COL.goldTrim, 1);
    g.strokeRoundedRect(x, y, s, s, PANEL.closeRadius);
    // The X glyph, drawn as two thick cream strokes.
    const cx = x + s * HALF;
    const cy = y + s * HALF;
    const r = PANEL.closeXSize * HALF;
    g.lineStyle(PANEL.btnBorderW * 2, COL.chromeCream, 1);
    g.beginPath();
    g.moveTo(cx - r, cy - r);
    g.lineTo(cx + r, cy + r);
    g.moveTo(cx + r, cy - r);
    g.lineTo(cx - r, cy + r);
    g.strokePath();
  };
  draw(false);
  const hit = scene.add
    .rectangle(x + s * HALF, y + s * HALF, s, s)
    .setDepth(depth + 1)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', () => draw(true))
    .on('pointerout', () => draw(false))
    .on('pointerdown', onClose);
  return {
    destroy: () => {
      g.destroy();
      hit.destroy();
    },
  };
}

/** Red rounded action button with a gold border + cream caps (`EQUIP`, `BUY`, `OK` …). */
export function actionButton(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  depth = CHROME_DEPTH.modal + 1,
): ChromeHandle {
  const g = scene.add.graphics().setDepth(depth);
  const draw = (hover: boolean): void => {
    g.clear();
    g.fillStyle(hover ? CHROME_COL.buttonRedHover : COL.buttonRed, 1);
    g.fillRoundedRect(cx - w * HALF, cy - h * HALF, w, h, PANEL.btnRadius);
    g.lineStyle(PANEL.btnBorderW, COL.goldTrim, 1);
    g.strokeRoundedRect(cx - w * HALF, cy - h * HALF, w, h, PANEL.btnRadius);
  };
  draw(false);
  const txt = scene.add
    .text(cx, cy, label.toUpperCase(), {
      fontFamily: FONT_BODY,
      fontSize: `${FONT_SIZE.body}px`,
      color: cssHex(COL.chromeCream),
      stroke: cssHex(COL.vignetteBlack),
      strokeThickness: TEXT_OUTLINE.body,
    })
    .setOrigin(HALF)
    .setDepth(depth + 1);
  const hit = scene.add
    .rectangle(cx, cy, w, h)
    .setDepth(depth + 2)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', () => draw(true))
    .on('pointerout', () => draw(false))
    .on('pointerdown', onClick);
  return {
    destroy: () => {
      g.destroy();
      txt.destroy();
      hit.destroy();
    },
  };
}

export interface ItemTileHandle extends ChromeHandle {
  setSelected: (selected: boolean) => void;
}

/**
 * Rounded stone-grey item tile with a §7 rarity border (grey/green/blue/purple).
 * `setSelected(true)` adds the brighter selection frame.
 */
export function itemTile(
  scene: Phaser.Scene,
  x: number,
  y: number,
  rarity: Rarity,
  opts: { onClick?: () => void; depth?: number } = {},
): ItemTileHandle {
  const s = PANEL.tileSize;
  const depth = opts.depth ?? CHROME_DEPTH.modal + 1;
  const g = scene.add.graphics().setDepth(depth);
  let selected = false;
  const draw = (): void => {
    g.clear();
    g.fillStyle(CHROME_COL.tileStone, 1);
    g.fillRoundedRect(x, y, s, s, PANEL.tileRadius);
    // Bottom cel-shade band.
    g.fillStyle(CHROME_COL.tileStoneShade, 1);
    g.fillRoundedRect(x, y + s * (1 - PANEL.tileShadeFrac), s, s * PANEL.tileShadeFrac, PANEL.tileRadius);
    // Rarity border.
    g.lineStyle(PANEL.tileBorderW, RARITY_COL[rarity], 1);
    g.strokeRoundedRect(x, y, s, s, PANEL.tileRadius);
    if (selected) {
      g.lineStyle(PANEL.selectedGlowW, COL.chromeCream, 1);
      g.strokeRoundedRect(x - PANEL.selectedGlowW, y - PANEL.selectedGlowW, s + PANEL.selectedGlowW * 2, s + PANEL.selectedGlowW * 2, PANEL.tileRadius);
    }
  };
  draw();
  let hit: Phaser.GameObjects.Rectangle | undefined;
  if (opts.onClick) {
    hit = scene.add
      .rectangle(x + s * HALF, y + s * HALF, s, s)
      .setDepth(depth + 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', opts.onClick);
  }
  return {
    setSelected: (v: boolean) => {
      selected = v;
      draw();
    },
    destroy: () => {
      g.destroy();
      hit?.destroy();
    },
  };
}
