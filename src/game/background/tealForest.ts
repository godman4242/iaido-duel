import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { COL } from '../../palette';
import { PARALLAX } from '../../config/biomes';
import { BGK, GROUND_BAND, TEAL } from '../../config/biomes-extra';
import { BiomeKit, Rnd, between, makeRand } from './biomeKit';

type G = Phaser.GameObjects.Graphics;
type TrunkCfg = (typeof TEAL)['far'] | (typeof TEAL)['mid'] | (typeof TEAL)['near'];

/** One depth-rank of bare trunks: tapered, slightly leaning, with branch stubs + foliage clumps. */
function trunkRank(g: G, kit: BiomeKit, rnd: Rnd, cfg: TrunkCfg, color: number, foliage: number, outlined: boolean): void {
  const top = -BGK.skyPadTop;
  const bottom = kit.groundY + BGK.skyPadBelowGround;
  for (let i = 0; i < cfg.count; i++) {
    const cx = kit.x0 + (kit.spanW / cfg.count) * (i + 1 / 2) + between(rnd, -cfg.jitterX, cfg.jitterX);
    const cw = between(rnd, cfg.wMin, cfg.wMax);
    const lean = (rnd() - 1 / 2) * 2 * cfg.leanPx;
    const topW = cw * cfg.topWFrac;
    const pts = [
      { x: cx - cw / 2, y: bottom },
      { x: cx + cw / 2, y: bottom },
      { x: cx + topW / 2 + lean, y: top },
      { x: cx - topW / 2 + lean, y: top },
    ];
    if (outlined) {
      // §1: only the near rank keeps an outline — stroke reads as the chunky 2-tone edge
      g.lineStyle(BGK.outlinePx, COL.outline, BGK.outlineAlpha).strokePoints(pts, true, true);
    }
    g.fillStyle(color, 1).fillPoints(pts, true);
    g.lineStyle(cfg.stubPx, color, 1);
    for (let s = 0; s < cfg.stubCount; s++) {
      const sy = between(rnd, GAME_H * TEAL.clumpYMinFrac, GAME_H * TEAL.clumpYMaxFrac);
      const dir = rnd() < 1 / 2 ? -1 : 1;
      // trunk centerline at height sy: cx at the root, cx+lean at the top
      const sx = cx + (lean * (bottom - sy)) / (bottom - top);
      g.lineBetween(sx, sy, sx + dir * cfg.stubLen, sy - cfg.stubDrop);
    }
    if (rnd() < cfg.clumpChance) {
      // sparse yellow-green foliage clusters clinging to trunks (p1 f46, p2 f14)
      const fy = between(rnd, GAME_H * TEAL.clumpYMinFrac, GAME_H * TEAL.clumpYMaxFrac);
      g.fillStyle(foliage, TEAL.foliageAlpha);
      for (let c = 0; c < cfg.clumpN; c++) {
        g.fillCircle(cx + (rnd() - 1 / 2) * 2 * cfg.clumpR, fy + (rnd() - 1 / 2) * cfg.clumpR, cfg.clumpR * (rnd() / 2 + 1 / 2));
      }
    }
  }
}

/**
 * §2.3 teal misty forest (p1 f46/f48/f55/f62/f76; p2 f14/f39/f74): flat teal fog, bare
 * trunks at three depths (near ones thick, crossing the full frame), near-black
 * undergrowth band with bush blobs + pale rocks + optional mossy ruins. The near-black
 * occluder trunks (tell #3) are added by createBiome from the BIOMES spec.
 */
export function paintTealForest(kit: BiomeKit): void {
  const rnd = makeRand(TEAL.seed);
  const x0 = kit.x0;
  const w = kit.spanW;
  const groundY = kit.groundY;
  const bottom = groundY + BGK.skyPadBelowGround;

  // 1) fog backdrop: flat teal + a lighter mist band mid-frame (soft-edged: fade in, fade out)
  const fog = kit.layer(BGK.depth.backdrop, PARALLAX.sky);
  fog.fillStyle(COL.tealFog, 1).fillRect(x0, -BGK.skyPadTop, w, bottom + BGK.skyPadTop);
  const fogY = GAME_H * TEAL.fogBandYFrac;
  const m = COL.mistTeal;
  fog.fillGradientStyle(m, m, m, m, 0, 0, TEAL.fogBandAlpha, TEAL.fogBandAlpha);
  fog.fillRect(x0, fogY, w, TEAL.fogBandH / 2);
  fog.fillGradientStyle(m, m, m, m, TEAL.fogBandAlpha, TEAL.fogBandAlpha, 0, 0);
  fog.fillRect(x0, fogY + TEAL.fogBandH / 2, w, TEAL.fogBandH / 2);

  // 2) three trunk depths — far/mid unlined (§1 outline falloff), near outlined + thick
  trunkRank(kit.layer(BGK.depth.far, PARALLAX.far), kit, rnd, TEAL.far, COL.tealTrunkFar, COL.canopy, false);
  trunkRank(kit.layer(BGK.depth.mid, PARALLAX.mid), kit, rnd, TEAL.mid, COL.tealTrunkMid, COL.canopy, false);
  trunkRank(kit.layer(BGK.depth.near, PARALLAX.near), kit, rnd, TEAL.near, COL.tealTrunkNear, COL.canopyBright, true);

  // 3) undergrowth: near-black band with bush blobs rising over its edge
  kit.groundBand(COL.tealUndergrowth, COL.tealOccluder, COL.tealOccluder);
  const under = kit.layer(BGK.depth.ground, PARALLAX.ground);
  under.fillStyle(COL.tealUndergrowth, 1);
  const edgeY = groundY + GROUND_BAND.topOffset;
  for (let x = x0; x < x0 + w; x += TEAL.under.stepX) {
    under.fillCircle(x + (rnd() - 1 / 2) * TEAL.under.stepX, edgeY + TEAL.under.topLift - between(rnd, TEAL.under.bushRMin, TEAL.under.bushRMax), between(rnd, TEAL.under.bushRMin, TEAL.under.bushRMax));
  }

  // 4) pale rocks + mossy ruin blocks (optional §2.3.5 props)
  const detail = kit.layer(BGK.depth.detail, PARALLAX.ground);
  for (const f of TEAL.rocks.xFracs) {
    kit.rock(detail, GAME_W * f, kit.propBaseY, between(rnd, TEAL.rocks.wMin, TEAL.rocks.wMax), COL.paleRock);
  }
  const R = TEAL.ruin;
  const rx = GAME_W * R.xFrac;
  for (let t = 0; t < R.tiers; t++) {
    const bw = R.blockW * (1 + (R.tiers - 1 - t) / 2); // wider base course
    const by = kit.propBaseY - R.blockH * (t + 1);
    detail.lineStyle(BGK.outlinePx, COL.outline, BGK.outlineAlpha).strokeRoundedRect(rx - bw / 2, by, bw, R.blockH, R.round);
    detail.fillStyle(COL.mossyRuin, 1).fillRoundedRect(rx - bw / 2, by, bw, R.blockH, R.round);
    detail.fillStyle(COL.bambooMoss, R.mossAlpha).fillRect(rx - bw / 2, by, bw, R.mossH);
  }

  kit.leaves([COL.sage2, COL.canopy, COL.mistTeal]);
}
