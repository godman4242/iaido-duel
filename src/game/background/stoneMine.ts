import Phaser from 'phaser';
import { GAME_W } from '../../config';
import { COL } from '../../palette';
import { PARALLAX } from '../../config/biomes';
import { BGK, GROUND_BAND, MINE, STONE } from '../../config/biomes-extra';
import { BiomeKit, Rnd, between, makeRand } from './biomeKit';

type G = Phaser.GameObjects.Graphics;

/**
 * Wall of huge hand-drawn rounded stones with black seams (§2.4, p1 f12; p2 f38).
 * Black seam field first, then staggered courses of rounded stones with a cel-shade
 * band along each stone's bottom (§1: flat fill + one darker tone).
 */
function stoneCourses(g: G, kit: BiomeKit, rnd: Rnd, rows: number, wMin: number, wMax: number, base: number, shade: number, shadeAlpha: number): void {
  const x0 = kit.x0;
  const w = kit.spanW;
  const top = -BGK.skyPadTop;
  const h = kit.groundY + GROUND_BAND.topOffset + STONE.wallBottomPad - top;
  g.fillStyle(COL.outline, STONE.seamBgAlpha).fillRect(x0, top, w, h);
  const rowH = h / rows;
  for (let r = 0; r < rows; r++) {
    const y = top + r * rowH;
    let x = x0 - rnd() * wMax;
    while (x < x0 + w) {
      const sw = between(rnd, wMin, wMax);
      const jog = (rnd() - 1 / 2) * 2 * STONE.jiggleY;
      const inX = x + STONE.seamPx;
      const inY = y + STONE.seamPx + jog;
      const iw = sw - 2 * STONE.seamPx;
      const ih = rowH - 2 * STONE.seamPx;
      g.fillStyle(base, 1).fillRoundedRect(inX, inY, iw, ih, STONE.round);
      g.fillStyle(shade, shadeAlpha).fillRoundedRect(inX, inY + ih - STONE.shadeH, iw, STONE.shadeH, {
        tl: 0, tr: 0, bl: STONE.round, br: STONE.round,
      });
      x += sw;
    }
  }
}

/**
 * §2.4 mountain path: khaki stone wall filling the frame, grass tufts sprouting from the
 * seams, wooden posts + rope fence + signpost, dark green ground verge.
 */
export function paintStoneWall(kit: BiomeKit): void {
  const rnd = makeRand(STONE.seed);
  const top = -BGK.skyPadTop;
  const wallH = kit.groundY + GROUND_BAND.topOffset + STONE.wallBottomPad - top;
  const rowH = wallH / STONE.rows;

  // 1) the wall — parallax far: it IS the backdrop (p1 f12)
  const wall = kit.layer(BGK.depth.far, PARALLAX.far);
  stoneCourses(wall, kit, rnd, STONE.rows, STONE.stoneWMin, STONE.stoneWMax, COL.stoneKhaki, COL.stoneKhakiShade, STONE.shadeAlpha);

  // 2) grass tufts in the seams
  for (let t = 0; t < STONE.tufts.count; t++) {
    const ty = top + (1 + Math.floor(rnd() * (STONE.rows - 1))) * rowH;
    kit.grassFan(wall, kit.x0 + rnd() * kit.spanW, ty + STONE.seamPx, COL.stoneGrassTuft, STONE.tufts, rnd);
  }

  // 3) verge + posts/rope + signpost on the fighter plane
  kit.groundBand(COL.mineVerge, COL.forestDark, COL.forestDark);
  const detail = kit.layer(BGK.depth.detail, PARALLAX.ground);
  for (let i = 0; i < STONE.tufts.count; i++) {
    kit.grassFan(detail, kit.x0 + (kit.spanW / STONE.tufts.count) * (i + rnd()), kit.propBaseY, COL.forestDark, STONE.tufts, rnd);
  }
  kit.signpost(detail, GAME_W * STONE.signXFrac, kit.propBaseY, COL.minePost, rnd);
  kit.fence(detail, GAME_W * STONE.fence.x0Frac, kit.propBaseY, COL.minePost, STONE.fence, rnd);
}

// ——— mine interior props (p1 f80: barrels, chests, crates, jars along the wall) ———

function barrel(g: G, _kit: BiomeKit, x: number, baseY: number): void {
  const B = MINE.props.barrel;
  const o = BGK.outlinePx;
  g.fillStyle(COL.outline, BGK.outlineAlpha).fillRoundedRect(x - B.w / 2 - o, baseY - B.h - o, B.w + 2 * o, B.h + 2 * o, B.round);
  g.fillStyle(COL.mineProp, 1).fillRoundedRect(x - B.w / 2, baseY - B.h, B.w, B.h, B.round);
  g.fillStyle(COL.minePost, 1).fillEllipse(x, baseY - B.h + B.lidH / 2, B.w - 2 * B.round, B.lidH);
  g.lineStyle(B.bandPx, COL.outline, B.bandAlpha);
  g.lineBetween(x - B.w / 2, baseY - B.h / 2 - B.lidH, x + B.w / 2, baseY - B.h / 2 - B.lidH);
  g.lineBetween(x - B.w / 2, baseY - B.h / 2 + B.lidH, x + B.w / 2, baseY - B.h / 2 + B.lidH);
}

function crate(g: G, kit: BiomeKit, x: number, baseY: number): void {
  const C = MINE.props.crate;
  kit.oRect(g, x - C.w / 2, baseY - C.w, C.w, C.w, COL.mineProp);
  g.lineStyle(C.plankPx, COL.outline, C.plankAlpha);
  g.strokeRect(x - C.w / 2 + C.inset, baseY - C.w + C.inset, C.w - 2 * C.inset, C.w - 2 * C.inset);
  g.lineBetween(x - C.w / 2 + C.inset, baseY - C.w + C.inset, x + C.w / 2 - C.inset, baseY - C.inset);
  g.lineBetween(x + C.w / 2 - C.inset, baseY - C.w + C.inset, x - C.w / 2 + C.inset, baseY - C.inset);
}

function chest(g: G, kit: BiomeKit, x: number, baseY: number): void {
  const C = MINE.props.chest;
  const o = BGK.outlinePx;
  kit.oRect(g, x - C.w / 2, baseY - C.h, C.w, C.h, COL.mineProp);
  g.fillStyle(COL.outline, BGK.outlineAlpha).fillRoundedRect(x - C.w / 2 - o, baseY - C.h - C.lidH - o, C.w + 2 * o, C.lidH + o, { tl: C.round, tr: C.round, bl: 0, br: 0 });
  g.fillStyle(COL.minePost, 1).fillRoundedRect(x - C.w / 2, baseY - C.h - C.lidH, C.w, C.lidH, { tl: C.round, tr: C.round, bl: 0, br: 0 });
  g.fillStyle(COL.coinGold, 1).fillRect(x - C.latchW / 2, baseY - C.h - C.latchH / 2, C.latchW, C.latchH);
}

function urn(g: G, kit: BiomeKit, x: number, baseY: number): void {
  const U = MINE.props.urn;
  const o = BGK.outlinePx;
  g.fillStyle(COL.outline, BGK.outlineAlpha).fillEllipse(x, baseY - U.h / 2, U.w + 2 * o, U.h + 2 * o);
  g.fillStyle(COL.mineProp, 1).fillEllipse(x, baseY - U.h / 2, U.w, U.h);
  kit.oRect(g, x - U.neckW / 2, baseY - U.h - U.neckH, U.neckW, U.neckH, COL.mineProp);
  g.fillStyle(COL.paleRock, U.sheenAlpha).fillEllipse(x - U.w / 2 / 2, baseY - U.h * U.sheenYFrac, U.w / 2 / 2, U.h / 2);
}

/**
 * §2.4 mine-interior variant (p1 f80; p2 f74): same stone courses darkened, a black
 * doorway with timber lintel, vertical support beams with caps, sepia props (barrels/
 * crates/chests/jars) and a dark plank floor.
 */
export function paintMine(kit: BiomeKit): void {
  const rnd = makeRand(MINE.seed);
  const top = -BGK.skyPadTop;

  // 1) darkened stone wall (black shade tone — interiors read cool-dark, §1)
  const wall = kit.layer(BGK.depth.far, PARALLAX.far);
  stoneCourses(wall, kit, rnd, MINE.rows, MINE.stoneWMin, MINE.stoneWMax, COL.mineStoneDark, COL.outline, MINE.shadeAlpha);

  // 2) doorway: black opening + timber lintel/posts (p1 f80 center)
  const D = MINE.door;
  const doorway = kit.layer(BGK.depth.mid, PARALLAX.mid);
  const dx = GAME_W * D.xFrac;
  const doorBase = kit.groundY + GROUND_BAND.topOffset;
  doorway.fillStyle(COL.panelInk, 1).fillRect(dx - D.w / 2, doorBase - D.h, D.w, D.h);
  kit.oRect(doorway, dx - D.w / 2 - D.postW, doorBase - D.h, D.postW, D.h, COL.minePost);
  kit.oRect(doorway, dx + D.w / 2, doorBase - D.h, D.postW, D.h, COL.minePost);
  kit.oRect(doorway, dx - D.w / 2 - D.postW - D.lintelOverhang, doorBase - D.h - D.lintelH, D.w + 2 * D.postW + 2 * D.lintelOverhang, D.lintelH, COL.minePost);

  // 3) timber support beams + top runner beam
  const beams = kit.layer(BGK.depth.mid, PARALLAX.mid);
  const B = MINE.beams;
  kit.oRect(beams, kit.x0, top + B.topBeamY, kit.spanW, B.topBeamH, COL.minePost);
  for (const f of B.xFracs) {
    const bx = GAME_W * f;
    kit.oRect(beams, bx - B.w / 2, top, B.w, doorBase - top, COL.minePost);
    kit.oRect(beams, bx - B.capW / 2, top + B.topBeamY - B.capH, B.capW, B.capH, COL.minePost);
  }

  // 4) floor: dark stone band + plank seam lines
  kit.groundBand(COL.dungeonFloor, COL.panelInk, COL.panelInk);
  const F = MINE.floor;
  const floor = kit.layer(BGK.depth.ground, PARALLAX.ground);
  floor.lineStyle(2, COL.outline, F.plankLineAlpha);
  const rowY = kit.propBaseY + F.plankRowGap;
  floor.lineBetween(kit.x0, rowY, kit.x0 + kit.spanW, rowY);
  for (let x = kit.x0 + between(rnd, 0, F.seamGapX); x < kit.x0 + kit.spanW; x += F.seamGapX) {
    floor.lineBetween(x, rowY, x + (rnd() - 1 / 2) * 2, rowY + F.seamLen);
  }

  // 5) props along the wall (alternating types, p1 f80)
  const detail = kit.layer(BGK.depth.detail, PARALLAX.ground);
  const painters = [barrel, chest, crate, urn, barrel];
  MINE.props.xFracs.forEach((f, i) => painters[i % painters.length](detail, kit, GAME_W * f, kit.propBaseY));
}
