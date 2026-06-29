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
  // back leg (behind body) — darker kimono
  if (!cut.has('legB')) {
    capsule(g, p.hipB.x, p.hipB.y, p.kneeB.x, p.kneeB.y, 8, COL.kimonoShade);
    capsule(g, p.kneeB.x, p.kneeB.y, p.footB.x, p.footB.y, 7, COL.kimonoShade);
  }
  // hakama skirt — trapezoid pelvis → knees
  outlinedPoly(
    g,
    [
      [p.pelvis.x - 14, p.pelvis.y - 6],
      [p.pelvis.x + 16, p.pelvis.y - 6],
      [p.kneeF.x + 14, p.kneeF.y + 4],
      [p.kneeB.x - 14, p.kneeF.y + 4],
    ],
    COL.kimono,
  );
  // torso / kimono body
  if (!cut.has('torso')) capsule(g, p.chest.x, p.chest.y, p.pelvis.x, p.pelvis.y, 16, COL.kimono);
  // chest wrap / obi accent
  capsule(g, p.chest.x - 2, p.chest.y + 22, p.pelvis.x + 2, p.pelvis.y - 8, 15, COL.kimono2);
  // front leg
  if (!cut.has('legF')) {
    capsule(g, p.hipF.x, p.hipF.y, p.kneeF.x, p.kneeF.y, 9, COL.kimono);
    capsule(g, p.kneeF.x, p.kneeF.y, p.footF.x, p.footF.y, 8, COL.kimono2);
    // sandal
    capsule(g, p.footF.x - 6, p.footF.y + 4, p.footF.x + 10, p.footF.y + 4, 4, COL.wood);
  }
  // neck + head (face partly shadowed under the hat)
  if (!cut.has('head')) {
    capsule(g, p.neck.x, p.neck.y, p.head.x, p.head.y, 10, COL.skin);
    g.fillStyle(COL.skin, 1);
    g.lineStyle(3, COL.outline, 1);
    g.fillCircle(p.head.x, p.head.y, 13);
    g.strokeCircle(p.head.x, p.head.y, 13);
    // shadow of the brim across the eyes
    g.fillStyle(COL.skinShade, 1);
    g.fillRect(p.head.x - 13, p.head.y - 6, 28, 6);
  }
  // sword arm (sleeve)
  if (!cut.has('armF')) capsule(g, p.shoulderF.x, p.shoulderF.y, p.elbowF.x, p.elbowF.y, 9, COL.kimono2);
  if (!cut.has('forearmF')) {
    capsule(g, p.elbowF.x, p.elbowF.y, p.handF.x, p.handF.y, 8, COL.kimono2);
    // hand
    g.fillStyle(COL.skin, 1);
    g.fillCircle(p.handF.x, p.handF.y, 6);
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
  // straw hat (kasa) — the iconic wide cone over the head
  if (!cut.has('hat')) {
    outlinedPoly(
      g,
      [
        [p.head.x - 30, p.head.y - 2],
        [p.head.x + 32, p.head.y - 2],
        [p.hat.x + 4, p.hat.y],
      ],
      COL.wood,
    );
    // brim highlight
    g.lineStyle(3, COL.kimonoShade, 0.6);
    g.beginPath();
    g.moveTo(p.head.x - 26, p.head.y - 3);
    g.lineTo(p.head.x + 28, p.head.y - 3);
    g.strokePath();
  }
}
