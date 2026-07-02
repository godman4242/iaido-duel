import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { COL } from '../../palette';
import { PARALLAX } from '../../config/biomes';
import { BAMBOO, BGK, GROUND_BAND } from '../../config/biomes-extra';
import { BiomeKit, Rnd, between, makeRand } from './biomeKit';

type G = Phaser.GameObjects.Graphics;
type CulmCfg = (typeof BAMBOO)['far'] | (typeof BAMBOO)['near'];

/** One rank of node-ringed bamboo culms across the overscan span. */
function culmRank(g: G, kit: BiomeKit, rnd: Rnd, cfg: CulmCfg, color: number, outlined: boolean): void {
  const top = -BGK.skyPadTop;
  const bottom = kit.groundY + BGK.skyPadBelowGround;
  const nodeStop = kit.groundY + GROUND_BAND.topOffset;
  for (let i = 0; i < cfg.count; i++) {
    const cx = kit.x0 + (kit.spanW / cfg.count) * (i + 1 / 2) + between(rnd, -cfg.jitterX, cfg.jitterX);
    const cw = between(rnd, cfg.wMin, cfg.wMax);
    if (outlined) {
      // §1: near layers keep their chunky black outline; far layers lose it
      g.fillStyle(COL.outline, BGK.outlineAlpha).fillRect(cx - cw / 2 - BGK.outlinePx, top, cw + 2 * BGK.outlinePx, bottom - top);
    }
    g.fillStyle(color, 1).fillRect(cx - cw / 2, top, cw, bottom - top);
    if (cfg.sheenAlpha > 0) {
      g.fillStyle(COL.canopyBright, cfg.sheenAlpha).fillRect(cx - cw / 2, top, cw * cfg.sheenFrac, bottom - top);
    }
    g.fillStyle(COL.bambooNode, cfg.nodeAlpha);
    let y = top + between(rnd, 0, cfg.nodeGap);
    while (y < nodeStop) {
      g.fillRect(cx - cw / 2 - 1, y, cw + 2, cfg.nodeH);
      y += cfg.nodeGap * (1 + (rnd() - 1 / 2) * cfg.nodeGapJitter);
    }
  }
}

/**
 * §2.2 bamboo forest (p1 f02/f06/f15/f17/f18): flat mid-green wash darkening toward the
 * leaf mass up top, node-ringed culms at two depths, dark leaf-cluster top vignette,
 * moss mounds + stone lantern + pale rocks on the floor, drifting leaves.
 */
export function paintBamboo(kit: BiomeKit): void {
  const rnd = makeRand(BAMBOO.seed);
  const x0 = kit.x0;
  const w = kit.spanW;
  const bottom = kit.groundY + BGK.skyPadBelowGround;

  // 1) backdrop wash
  const wash = kit.layer(BGK.depth.backdrop, PARALLAX.sky);
  wash.fillStyle(COL.bambooBackdrop, 1).fillRect(x0, -BGK.skyPadTop, w, bottom + BGK.skyPadTop);
  wash.fillGradientStyle(
    COL.bambooLeafTop, COL.bambooLeafTop, COL.bambooBackdrop, COL.bambooBackdrop,
    BAMBOO.washTopAlpha, BAMBOO.washTopAlpha, 0, 0,
  );
  wash.fillRect(x0, -BGK.skyPadTop, w, GAME_H * BAMBOO.washTopFrac);

  // 2) far desaturated culm rank / 3) near brighter, outlined culm rank
  culmRank(kit.layer(BGK.depth.far, PARALLAX.far), kit, rnd, BAMBOO.far, COL.bambooCulmFar, false);
  culmRank(kit.layer(BGK.depth.mid, PARALLAX.mid), kit, rnd, BAMBOO.near, COL.bambooCulmNear, true);

  // 4) leaf-cluster top vignette: blob row + drooping clusters + scattered leaf blades
  const K = BAMBOO.canopy;
  const canopy = kit.layer(BGK.depth.near, BAMBOO.canopyParallax);
  canopy.fillStyle(COL.bambooLeafTop, 1);
  for (let x = x0; x < x0 + w; x += K.stepX) {
    canopy.fillCircle(x, K.rowY + (rnd() - 1 / 2) * 2 * K.rowJitterY, between(rnd, K.rMin, K.rMax));
  }
  for (let i = 0; i < K.droopCount; i++) {
    const dx = x0 + rnd() * w;
    let r = between(rnd, K.rMin, K.rMax);
    let y = K.rowY;
    for (let s = 0; s < K.droopSteps; s++) {
      canopy.fillCircle(dx + (rnd() - 1 / 2) * r, y, r);
      y += r * K.droopStepFrac;
      r *= K.droopShrink;
    }
  }
  canopy.fillStyle(COL.bambooLeafTop, K.leafAlpha);
  for (let i = 0; i < K.leafCount; i++) {
    canopy.save();
    canopy.translateCanvas(x0 + rnd() * w, K.leafBandY + rnd() * K.leafBandH);
    canopy.rotateCanvas((rnd() - 1 / 2) * Math.PI);
    canopy.fillEllipse(0, 0, K.leafLen, K.leafW);
    canopy.restore();
  }

  // 5) floor: dark band with a bright grass edge (p1 f15) + moss mounds + lantern/rocks + grass
  kit.groundBand(COL.fieldGround, COL.canopy, COL.bambooLeafTop);
  const M = BAMBOO.moss;
  const gd = kit.layer(BGK.depth.ground, PARALLAX.ground);
  const mossBase = kit.groundY + GROUND_BAND.topOffset + M.sink;
  for (let i = 0; i < M.count; i++) {
    const mx = x0 + (w / M.count) * (i + 1 / 2) + between(rnd, -M.jitterX, M.jitterX);
    const mw = between(rnd, M.wMin, M.wMax);
    const mh = mw * M.hFrac;
    gd.fillStyle(COL.outline, BGK.outlineAlpha).fillEllipse(mx, mossBase, mw + 2 * BGK.outlinePx, mh + 2 * BGK.outlinePx);
    gd.fillStyle(COL.bambooMoss, 1).fillEllipse(mx, mossBase, mw, mh);
    gd.fillStyle(COL.bambooLeafTop, M.shadeAlpha).fillEllipse(mx + mw * M.shadeDxFrac, mossBase + mh * M.shadeDyFrac, mw * M.shadeWFrac, mh * M.shadeHFrac);
  }
  const detail = kit.layer(BGK.depth.detail, PARALLAX.ground);
  kit.stoneLantern(detail, GAME_W * BAMBOO.lanternXFrac, kit.propBaseY);
  for (const f of BAMBOO.rockXFracs) kit.rock(detail, GAME_W * f, kit.propBaseY, BAMBOO.rockW, COL.paleRock);
  for (let i = 0; i < BAMBOO.grass.clumps; i++) {
    kit.grassFan(detail, x0 + (w / BAMBOO.grass.clumps) * (i + rnd()), kit.propBaseY, COL.bambooLeafTop, BAMBOO.grass, rnd);
  }

  kit.leaves([COL.canopyBright, COL.sage2, COL.bambooCulmNear]);
}
