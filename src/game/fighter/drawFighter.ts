import Phaser from 'phaser';
import { COL } from '../../palette';
import { Pose } from './Skeleton';

type G = Phaser.GameObjects.Graphics;

/** Draw an outlined, round-capped capsule (a limb) from a→b with radius r. */
function capsule(g: G, ax: number, ay: number, bx: number, by: number, r: number, fill: number, ow = 3): void {
  // outline pass (slightly larger)
  g.lineStyle(2 * r + ow, COL.outline, 1);
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(bx, by);
  g.strokePath();
  g.fillStyle(COL.outline, 1);
  g.fillCircle(ax, ay, r + ow / 2);
  g.fillCircle(bx, by, r + ow / 2);
  // fill pass
  g.lineStyle(2 * r, fill, 1);
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(bx, by);
  g.strokePath();
  g.fillStyle(fill, 1);
  g.fillCircle(ax, ay, r);
  g.fillCircle(bx, by, r);
}

/** A capsule with a darker shadow band along its lower edge — flat two-tone cel shading. */
function shaded(g: G, ax: number, ay: number, bx: number, by: number, r: number, base: number, shade: number, ow = 3): void {
  capsule(g, ax, ay, bx, by, r, base, ow);
  g.lineStyle(r * 0.8, shade, 1);
  g.beginPath();
  g.moveTo(ax, ay + r * 0.55);
  g.lineTo(bx, by + r * 0.55);
  g.strokePath();
  g.fillStyle(shade, 1);
  g.fillCircle(ax, ay + r * 0.55, r * 0.4);
  g.fillCircle(bx, by + r * 0.55, r * 0.4);
}

function outlinedPoly(g: G, pts: number[][], fill: number, ow = 3): void {
  const flat = pts.map((p) => new Phaser.Math.Vector2(p[0], p[1]));
  g.lineStyle(ow, COL.outline, 1);
  g.fillStyle(fill, 1);
  g.beginPath();
  g.moveTo(flat[0].x, flat[0].y);
  for (let i = 1; i < flat.length; i++) g.lineTo(flat[i].x, flat[i].y);
  g.closePath();
  g.fillPath();
  g.strokePath();
}

export type DrawOpts = { severed: Set<string>; silhouette?: boolean };

/**
 * Draw the samurai in LOCAL coords (origin at pelvis, +x forward, +y down).
 * The owning Container handles world position and facing (scaleX = ±1).
 * Limb IDs in `severed` are skipped (cut off).
 */
export function drawSkeleton(g: G, p: Pose, opts: DrawOpts): void {
  const cut = opts.severed;

  // flat black silhouette (for the win screen)
  if (opts.silhouette) {
    const b = COL.outline;
    capsule(g, p.hipB.x, p.hipB.y, p.kneeB.x, p.kneeB.y, 8, b, 0);
    capsule(g, p.kneeB.x, p.kneeB.y, p.footB.x, p.footB.y, 7, b, 0);
    capsule(g, p.chest.x, p.chest.y, p.pelvis.x, p.pelvis.y, 17, b, 0);
    capsule(g, p.hipF.x, p.hipF.y, p.kneeF.x, p.kneeF.y, 9, b, 0);
    capsule(g, p.kneeF.x, p.kneeF.y, p.footF.x, p.footF.y, 8, b, 0);
    capsule(g, p.neck.x, p.neck.y, p.head.x, p.head.y, 10, b, 0);
    g.fillStyle(b, 1);
    g.fillCircle(p.head.x, p.head.y, 13);
    capsule(g, p.shoulderF.x, p.shoulderF.y, p.elbowF.x, p.elbowF.y, 9, b, 0);
    capsule(g, p.elbowF.x, p.elbowF.y, p.handF.x, p.handF.y, 8, b, 0);
    capsule(g, p.handF.x, p.handF.y, p.sword.x, p.sword.y, 3, b, 0);
    g.fillStyle(b, 1);
    g.beginPath();
    g.moveTo(p.head.x - 32, p.head.y - 2);
    g.lineTo(p.head.x + 34, p.head.y - 2);
    g.lineTo(p.hat.x + 4, p.hat.y);
    g.closePath();
    g.fillPath();
    return;
  }
  // back leg (white hakama, behind)
  if (!cut.has('legB')) {
    shaded(g, p.hipB.x, p.hipB.y, p.kneeB.x, p.kneeB.y, 7, COL.kimonoShade, COL.kimono2);
    shaded(g, p.kneeB.x, p.kneeB.y, p.footB.x, p.footB.y, 6, COL.kimonoShade, COL.kimono2);
  }
  // white hakama (wide trousers) — trapezoid pelvis → knees
  outlinedPoly(
    g,
    [
      [p.pelvis.x - 13, p.pelvis.y - 4],
      [p.pelvis.x + 15, p.pelvis.y - 4],
      [p.kneeF.x + 13, p.kneeF.y + 6],
      [p.kneeB.x - 13, p.kneeF.y + 6],
    ],
    COL.kimono,
  );
  g.lineStyle(2, COL.kimonoShade, 0.9);
  g.beginPath();
  g.moveTo(p.pelvis.x + 2, p.pelvis.y);
  g.lineTo(p.kneeF.x + 2, p.kneeF.y + 4);
  g.strokePath();
  g.beginPath();
  g.moveTo(p.pelvis.x - 5, p.pelvis.y);
  g.lineTo(p.kneeB.x - 2, p.kneeF.y + 4);
  g.strokePath();
  // front leg (white) + tabi sandal
  if (!cut.has('legF')) {
    shaded(g, p.hipF.x, p.hipF.y, p.kneeF.x, p.kneeF.y, 8, COL.kimono, COL.kimonoShade);
    shaded(g, p.kneeF.x, p.kneeF.y, p.footF.x, p.footF.y, 7, COL.kimono, COL.kimonoShade);
    capsule(g, p.footF.x - 6, p.footF.y + 3, p.footF.x + 11, p.footF.y + 3, 4, COL.kimono2);
    capsule(g, p.footF.x - 5, p.footF.y + 6, p.footF.x + 9, p.footF.y + 6, 2.5, COL.wood);
  }
  // white under-kimono torso (slim)
  if (!cut.has('torso')) shaded(g, p.chest.x, p.chest.y, p.pelvis.x, p.pelvis.y, 12, COL.kimono, COL.kimonoShade);
  // navy hooded haori (open jacket) over the torso + upper thighs
  shaded(g, p.neck.x, p.neck.y + 4, p.pelvis.x + 3, p.pelvis.y + 16, 15, COL.haori, COL.haoriShade);
  // open front: white kimono V down the centre
  outlinedPoly(
    g,
    [
      [p.neck.x + 4, p.neck.y + 6],
      [p.chest.x + 12, p.chest.y + 4],
      [p.pelvis.x + 9, p.pelvis.y - 2],
      [p.pelvis.x - 2, p.pelvis.y - 2],
      [p.chest.x - 7, p.chest.y + 2],
    ],
    COL.kimono,
    2,
  );
  // red inner-lining accent
  g.lineStyle(2, COL.haoriTrim, 1);
  g.beginPath();
  g.moveTo(p.neck.x + 5, p.neck.y + 8);
  g.lineTo(p.chest.x + 13, p.chest.y + 4);
  g.lineTo(p.pelvis.x + 10, p.pelvis.y - 2);
  g.strokePath();
  // hood at the back of the neck
  g.lineStyle(3, COL.outline, 1);
  g.fillStyle(COL.haori, 1);
  g.fillCircle(p.neck.x - 10, p.neck.y - 1, 11);
  g.strokeCircle(p.neck.x - 10, p.neck.y - 1, 11);
  g.fillStyle(COL.haoriShade, 1);
  g.fillCircle(p.neck.x - 12, p.neck.y + 2, 7);
  // gold obi (sash) at the waist
  capsule(g, p.pelvis.x - 11, p.pelvis.y - 16, p.pelvis.x + 13, p.pelvis.y - 16, 6, COL.obi);
  g.lineStyle(2, COL.obiShade, 1);
  g.beginPath();
  g.moveTo(p.pelvis.x - 11, p.pelvis.y - 13);
  g.lineTo(p.pelvis.x + 13, p.pelvis.y - 13);
  g.strokePath();
  // neck + head (under the hat)
  if (!cut.has('head')) {
    shaded(g, p.neck.x, p.neck.y, p.head.x, p.head.y, 9, COL.skin, COL.skinShade);
    g.fillStyle(COL.skin, 1);
    g.lineStyle(3, COL.outline, 1);
    g.fillCircle(p.head.x, p.head.y, 12);
    g.strokeCircle(p.head.x, p.head.y, 12);
    g.fillStyle(COL.hair, 1);
    g.fillCircle(p.head.x - 9, p.head.y + 2, 6);
    g.fillStyle(COL.skinShade, 1);
    g.fillRect(p.head.x - 12, p.head.y - 5, 26, 6);
  }
  // sword arm: navy haori sleeve + white cuff + hand
  if (!cut.has('armF')) shaded(g, p.shoulderF.x, p.shoulderF.y, p.elbowF.x, p.elbowF.y, 9, COL.haori, COL.haoriShade);
  if (!cut.has('forearmF')) {
    shaded(g, p.elbowF.x, p.elbowF.y, p.handF.x - 4, p.handF.y - 1, 8, COL.haori, COL.haoriShade);
    capsule(g, p.handF.x - 7, p.handF.y - 2, p.handF.x - 1, p.handF.y, 7, COL.kimono);
    g.fillStyle(COL.skin, 1);
    g.lineStyle(2, COL.outline, 1);
    g.fillCircle(p.handF.x, p.handF.y, 6);
    g.strokeCircle(p.handF.x, p.handF.y, 6);
  }
  // katana — blade from hand to tip + guard
  // blue chi glow under the blade
  g.lineStyle(8, COL.bladeChi, 0.3);
  g.beginPath();
  g.moveTo(p.handF.x, p.handF.y);
  g.lineTo(p.sword.x, p.sword.y);
  g.strokePath();
  capsule(g, p.handF.x, p.handF.y, p.sword.x, p.sword.y, 3, COL.blade, 2);
  // blue chi edge highlight
  g.lineStyle(1.5, COL.bladeChi, 0.9);
  g.beginPath();
  g.moveTo(p.handF.x, p.handF.y);
  g.lineTo(p.sword.x, p.sword.y);
  g.strokePath();
  g.fillStyle(COL.bladeEdge, 1);
  g.fillCircle(p.sword.x, p.sword.y, 2);
  g.fillStyle(COL.wood, 1);
  g.fillCircle(p.handF.x, p.handF.y, 5); // tsuba/guard
  // wide, low straw kasa — the iconic read
  if (!cut.has('hat')) {
    const baseY = p.head.y + 2;
    const apex = { x: p.hat.x + 4, y: p.hat.y + 8 };
    outlinedPoly(
      g,
      [
        [p.head.x - 37, baseY],
        [p.head.x + 40, baseY],
        [apex.x, apex.y],
      ],
      COL.hatStraw,
    );
    // darker underbrim
    g.lineStyle(4, COL.hatShade, 1);
    g.beginPath();
    g.moveTo(p.head.x - 35, baseY - 1);
    g.lineTo(p.head.x + 38, baseY - 1);
    g.strokePath();
    // woven seams
    g.lineStyle(1.5, COL.hatShade, 0.65);
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(apex.x, apex.y);
      g.lineTo(p.head.x + i * 17, baseY - 1);
      g.strokePath();
    }
  }
}
