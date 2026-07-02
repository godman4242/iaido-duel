// src/game/chrome/mottle.ts — shared painters for the §7 panel treatment: mottled
// maroon backdrop (base + lighter smoke swirls + dark edge falloff), thin double
// gold frames, ornate gold corner flourishes, and the black kasa-figure silhouette
// accent. Used by Modal, Panel and StoryCard so every chrome surface shares one look.
// All tunables live in src/config/ (config-purity: this file carries no literals).
import Phaser from 'phaser';
import { COL } from '../../config/palette';
import { MOTTLE, CORNER_FLOURISH, GOLD_FRAME, SILHOUETTE } from '../../config/chrome-extra';

type G = Phaser.GameObjects.Graphics;

const HALF = 1 / 2;

/** Deterministic 0..1 hash (same modular trick as Forest.canopies) — panels never flicker. */
function hash01(i: number, seed: number): number {
  return ((i * seed) % MOTTLE.hashMod) / MOTTLE.hashMod;
}

/**
 * Paint the §7 mottled maroon backdrop into `g`: flat panelMaroon base, wide
 * panelMaroonSwirl smoke ellipses (deterministic placement) and a dark inner-edge
 * falloff so the center reads lighter than the rim.
 */
export function paintMottled(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(COL.panelMaroon, 1);
  g.fillRect(x, y, w, h);

  // Lighter smoke swirls — wide soft ellipses drifting across the field.
  const rRange = MOTTLE.swirlMaxR - MOTTLE.swirlMinR;
  for (let i = 0; i < MOTTLE.swirlCount; i++) {
    const cx = x + hash01(i + 1, MOTTLE.hashA) * w;
    const cy = y + hash01(i + 2, MOTTLE.hashB) * h;
    const r = MOTTLE.swirlMinR + hash01(i + 1, MOTTLE.hashC) * rRange;
    g.fillStyle(COL.panelMaroonSwirl, MOTTLE.swirlAlpha);
    g.fillEllipse(cx, cy, r * MOTTLE.swirlStretch * 2, r * 2);
  }

  // Dark edge falloff — stacked translucent ink bands hugging the rim.
  const bandAlpha = MOTTLE.edgeVignetteAlpha / MOTTLE.edgeVignetteBands;
  for (let b = 0; b < MOTTLE.edgeVignetteBands; b++) {
    const t = (b + 1) * MOTTLE.edgeVignetteBandPx;
    g.lineStyle(MOTTLE.edgeVignetteBandPx, COL.panelInk, bandAlpha);
    g.strokeRect(x + t - MOTTLE.edgeVignetteBandPx * HALF, y + t - MOTTLE.edgeVignetteBandPx * HALF, w - 2 * t + MOTTLE.edgeVignetteBandPx, h - 2 * t + MOTTLE.edgeVignetteBandPx);
  }
}

/** Thin §7 gold frame: bright outer line + dimmer inner echo line. */
export function goldFrame(g: G, x: number, y: number, w: number, h: number): void {
  g.lineStyle(GOLD_FRAME.outerW, COL.goldTrim, 1);
  g.strokeRect(x, y, w, h);
  const gap = GOLD_FRAME.innerGap;
  g.lineStyle(GOLD_FRAME.innerW, COL.goldTrim, GOLD_FRAME.innerAlpha);
  g.strokeRect(x + gap, y + gap, w - 2 * gap, h - 2 * gap);
}

/** One ornate gold corner: filled diamond + two arms along the edges + curl tips. */
function flourish(g: G, cx: number, cy: number, dx: number, dy: number): void {
  const F = CORNER_FLOURISH;
  g.fillStyle(COL.goldTrim, 1);
  // Diamond sitting right in the corner.
  g.beginPath();
  g.moveTo(cx, cy - F.diamondR);
  g.lineTo(cx + F.diamondR, cy);
  g.lineTo(cx, cy + F.diamondR);
  g.lineTo(cx - F.diamondR, cy);
  g.closePath();
  g.fillPath();
  // Arms hugging the two panel edges.
  g.fillRect(Math.min(cx, cx + dx * F.armLen), cy - F.armW * HALF, F.armLen, F.armW);
  g.fillRect(cx - F.armW * HALF, Math.min(cy, cy + dy * F.armLen), F.armW, F.armLen);
  // Small curls at the arm tips.
  g.lineStyle(F.lineW, COL.goldTrim, 1);
  g.strokeCircle(cx + dx * (F.armLen + F.curlR), cy, F.curlR);
  g.strokeCircle(cx, cy + dy * (F.armLen + F.curlR), F.curlR);
}

/** All four §7 ornate gold corner flourishes for the rect (x,y,w,h). */
export function cornerFlourishes(g: G, x: number, y: number, w: number, h: number): void {
  const inset = CORNER_FLOURISH.inset;
  flourish(g, x + inset, y + inset, 1, 1);
  flourish(g, x + w - inset, y + inset, -1, 1);
  flourish(g, x + inset, y + h - inset, 1, -1);
  flourish(g, x + w - inset, y + h - inset, -1, -1);
}

/**
 * Black kasa-figure silhouette accent (§7 story cards / modal backdrops), scaled
 * into the box (x,y,w,h). Polygon + over-shoulder sword line from config.
 */
export function paintSilhouette(g: G, x: number, y: number, w: number, h: number, alpha: number = SILHOUETTE.alpha): void {
  g.fillStyle(COL.vignetteBlack, alpha);
  g.beginPath();
  const pts = SILHOUETTE.body;
  g.moveTo(x + pts[0][0] * w, y + pts[0][1] * h);
  for (let i = 1; i < pts.length; i++) g.lineTo(x + pts[i][0] * w, y + pts[i][1] * h);
  g.closePath();
  g.fillPath();
  const s = SILHOUETTE.sword;
  g.lineStyle(s.w * h, COL.vignetteBlack, alpha);
  g.beginPath();
  g.moveTo(x + s.x1 * w, y + s.y1 * h);
  g.lineTo(x + s.x2 * w, y + s.y2 * h);
  g.strokePath();
}
