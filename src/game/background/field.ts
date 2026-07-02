import { GAME_W, GAME_H } from '../../config';
import { COL } from '../../palette';
import { PARALLAX } from '../../config/biomes';
import { BGK, FIELD, GROUND_BAND } from '../../config/biomes-extra';
import { BiomeKit, between, makeRand } from './biomeKit';

/**
 * §2.1 sage field (p1 f18/f19/f24/f35; p2 f20/f79): pale sage sky with WAVY cream cloud
 * streaks (the signature), muted blue-green far ridge, olive mid hills with near-black
 * dead trees, dark green ground band with tall-grass clumps, signposts + fence posts.
 */
export function paintField(kit: BiomeKit): void {
  const rnd = makeRand(FIELD.seed);
  const x0 = kit.x0;
  const w = kit.spanW;
  const groundY = kit.groundY;
  const bottom = groundY + BGK.skyPadBelowGround;

  // 1) sky — pale sage gradient
  const sky = kit.layer(BGK.depth.backdrop, PARALLAX.sky);
  sky.fillGradientStyle(COL.fieldSkyTop, COL.fieldSkyTop, COL.fieldSkyLow, COL.fieldSkyLow, 1);
  sky.fillRect(x0, -BGK.skyPadTop, w, bottom + BGK.skyPadTop);

  // 2) huge wavy cream cloud streaks, drifting slowly (§9 secondary motion)
  const C = FIELD.cloud;
  const clouds = kit.layer(BGK.depth.sky, C.parallax, { amp: C.swayAmpPx, radPerMs: C.swayRadPerMs });
  clouds.fillStyle(COL.fieldCloud, C.alpha);
  for (const s of C.streaks) {
    const sy = GAME_H * s.yFrac;
    const sx = GAME_W * s.x0Frac;
    const sw = GAME_W * s.wFrac;
    for (let x = sx; x <= sx + sw; x += C.stepX) {
      const u = (x - sx) / sw;
      const taper = Math.sin(Math.PI * u); // streak thins toward both ends
      const wave = Math.sin(x / C.waveLen) * C.waveAmpPx;
      clouds.fillEllipse(x, sy + wave, C.blobW * (taper / 2 + 1 / 2), C.blobH * taper + 2);
    }
  }

  // 3) far mountain ridge — flat muted blue-green silhouette (no outline at distance, §1)
  const ridge = kit.layer(BGK.depth.far, PARALLAX.far);
  const baseY = GAME_H * FIELD.ridge.yFrac;
  const pts: { x: number; y: number }[] = [{ x: x0, y: baseY }];
  const step = w / FIELD.ridge.peakCount;
  for (let i = 0; i < FIELD.ridge.peakCount; i++) {
    pts.push({ x: x0 + step * (i + 1 / 2), y: baseY - between(rnd, FIELD.ridge.peakHMin, FIELD.ridge.peakHMax) });
    pts.push({ x: x0 + step * (i + 1), y: baseY - between(rnd, 0, FIELD.ridge.valleyH) });
  }
  pts.push({ x: x0 + w, y: bottom }, { x: x0, y: bottom });
  ridge.fillStyle(COL.fieldMountain, 1).fillPoints(pts, true);

  // 4) mid olive hills + near-black dead-tree silhouettes
  const mid = kit.layer(BGK.depth.mid, PARALLAX.mid);
  const hillY = GAME_H * FIELD.hills.yFrac;
  mid.fillStyle(COL.fieldHill, 1);
  for (let i = 0; i < FIELD.hills.count; i++) {
    const hx = x0 + (w / FIELD.hills.count) * (i + 1 / 2) + between(rnd, -FIELD.hills.jitterX, FIELD.hills.jitterX);
    mid.fillEllipse(hx, hillY, between(rnd, FIELD.hills.wMin, FIELD.hills.wMax), FIELD.hills.h);
  }
  mid.fillRect(x0, hillY, w, bottom - hillY);
  const T = FIELD.trees;
  for (let i = 0; i < T.count; i++) {
    const tx = x0 + (w / T.count) * (i + 1 / 2) + between(rnd, -T.jitterX, T.jitterX);
    const th = between(rnd, T.hMin, T.hMax);
    const ty = hillY - between(rnd, 0, T.footLift);
    mid.fillStyle(COL.fieldDeadTree, 1).fillRect(tx - T.w / 2, ty - th, T.w, th);
    mid.lineStyle(T.branchPx, COL.fieldDeadTree, 1);
    const d1 = rnd() < 1 / 2 ? -1 : 1;
    mid.lineBetween(tx, ty - th * T.branchY1Frac, tx + d1 * T.branchLen, ty - th * T.branchY1Frac - T.branchRise);
    mid.lineBetween(tx, ty - th * T.branchY2Frac, tx - d1 * T.branchLen, ty - th * T.branchY2Frac - T.branchRise);
  }

  // 5) ground band + tall-grass clumps + signposts/fence (fighter plane — pinned)
  kit.groundBand(COL.fieldGround, COL.fieldGrass, COL.fieldGrass);
  const detail = kit.layer(BGK.depth.detail, PARALLAX.ground);
  const edgeY = groundY + GROUND_BAND.topOffset + GROUND_BAND.edgeH;
  for (let i = 0; i < FIELD.grass.clumps; i++) {
    kit.grassFan(detail, x0 + (w / FIELD.grass.clumps) * (i + rnd()), edgeY, COL.fieldGrass, FIELD.grass, rnd);
  }
  for (const f of FIELD.signXFracs) kit.signpost(detail, GAME_W * f, kit.propBaseY, COL.fieldPost, rnd);
  kit.fence(detail, GAME_W * FIELD.fence.x0Frac, kit.propBaseY, COL.fieldPost, FIELD.fence, rnd);
}
