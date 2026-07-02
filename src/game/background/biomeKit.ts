import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { COL } from '../../palette';
import {
  BIOME_LAYER_OFFSET_SCALE,
  PARALLAX,
  type BiomeOccluder,
  type BiomeVignette,
} from '../../config/biomes';
import { BGK, GROUND_BAND, LANTERN, LEAF_FX, OCCLUDER, ROCK, SIGNPOST } from '../../config/biomes-extra';

type G = Phaser.GameObjects.Graphics;
export type Rnd = () => number;

/** Deterministic Lehmer PRNG — same layout every run, no Math.random in the art. */
export function makeRand(seed: number): Rnd {
  let s = (Math.abs(Math.floor(seed)) % BGK.rng.mod) || 1;
  return () => {
    s = (s * BGK.rng.mul) % BGK.rng.mod;
    return s / BGK.rng.mod;
  };
}

export const between = (rnd: Rnd, min: number, max: number): number => min + rnd() * (max - min);

type Layer = { gfx: G; parallax: number; baseX: number; swayAmp: number; swayRadPerMs: number };

type FanCfg = { bladesMin: number; bladesMax: number; hMin: number; hMax: number; w: number; spreadPx: number };
type FenceCfg = {
  count: number;
  gap: number;
  postW: number;
  postH: number;
  ropeDrop: number;
  ropeSag: number;
  ropePx: number;
  ropeSegs: number;
};

/**
 * Shared plumbing for the §2 biome kits: layer registry with §9 parallax (layer-offset
 * mode — the camera never scrolls, see config/biomes.ts note), tell-#2 top vignette and
 * tell-#3 foreground occluders, plus the prop painters several biomes share.
 * Each Graphics layer stays a seam where a painted PNG could be swapped in later.
 */
export class BiomeKit {
  readonly scene: Phaser.Scene;
  readonly groundY: number;
  private layers: Layer[] = [];
  private fixed: Phaser.GameObjects.GameObject[] = [];
  private emitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private centerX = GAME_W / 2;

  constructor(scene: Phaser.Scene, groundY: number) {
    this.scene = scene;
    this.groundY = groundY;
  }

  /** Left edge / full width of the overscanned draw area. */
  get x0(): number {
    return -BGK.overscan;
  }
  get spanW(): number {
    return GAME_W + 2 * BGK.overscan;
  }
  /** Baseline where props (posts, lanterns, rocks) sit on the visible ground band. */
  get propBaseY(): number {
    return this.groundY + GROUND_BAND.topOffset + GROUND_BAND.edgeH;
  }

  /**
   * Register a parallax layer. `ratio` is the §9 camera ratio (sky 0 … occluder 1.2);
   * in layer-offset mode the fighter plane (ratio 1.0) is pinned at 0 so the ground
   * never slides under standing fighters, everything else scales by the offset factor.
   */
  layer(depth: number, ratio: number, sway?: { amp: number; radPerMs: number }): G {
    const gfx = this.scene.add.graphics().setDepth(depth);
    const parallax = ratio === PARALLAX.ground ? 0 : ratio * BIOME_LAYER_OFFSET_SCALE;
    this.layers.push({
      gfx,
      parallax,
      baseX: 0,
      swayAmp: sway ? sway.amp : 0,
      swayRadPerMs: sway ? sway.radPerMs : 0,
    });
    return gfx;
  }

  /** Ground band using Forest.ts's proven offsets: fill + darker edge + inner shade. */
  groundBand(bandColor: number, edgeColor: number, shadeColor: number): G {
    const g = this.layer(BGK.depth.ground, PARALLAX.ground);
    const y = this.groundY + GROUND_BAND.topOffset;
    g.fillStyle(bandColor, 1).fillRect(this.x0, y, this.spanW, GAME_H);
    g.fillStyle(edgeColor, 1).fillRect(this.x0, y, this.spanW, GROUND_BAND.edgeH);
    g.fillStyle(shadeColor, GROUND_BAND.shadeAlpha).fillRect(this.x0, y + GROUND_BAND.shadeOffset, this.spanW, GROUND_BAND.shadeH);
    return g;
  }

  /**
   * tell #2 / §1: soft black gradient hugging the top edge (+ bottom, lightly). Camera-fixed.
   * Three stacked passes (h, h/2, h/4) compound to a near-black top edge with a curved
   * falloff — the reference frames read ~solid black at y=0 (p1 f06/f12/f18/f46).
   */
  vignette(v: BiomeVignette): void {
    const g = this.scene.add.graphics().setDepth(BGK.depth.vignette);
    const k = COL.vignetteBlack;
    let h = GAME_H * v.topHeightFrac;
    for (let pass = 0; pass < BGK.vignettePasses; pass++) {
      g.fillGradientStyle(k, k, k, k, v.topAlpha, v.topAlpha, 0, 0);
      g.fillRect(this.x0, 0, this.spanW, h);
      h /= 2;
    }
    g.fillGradientStyle(k, k, k, k, 0, 0, v.bottomAlpha, v.bottomAlpha);
    const bh = GAME_H * v.bottomHeightFrac;
    g.fillRect(this.x0, GAME_H - bh, this.spanW, bh);
    this.fixed.push(g);
  }

  /** tell #3: dark low-detail trunk/culm/post crossing the frame IN FRONT of the fighters. */
  occluders(spec: BiomeOccluder, style: 'trunk' | 'culm' | 'post'): void {
    const rnd = makeRand(OCCLUDER.seed);
    const g = this.layer(BGK.depth.occluder, spec.parallax);
    const color = COL[spec.colorKey];
    const top = -BGK.skyPadTop;
    const bottom = this.groundY + BGK.skyPadBelowGround;
    for (let i = 0; i < spec.count; i++) {
      const cx = GAME_W * OCCLUDER.xFracs[i % OCCLUDER.xFracs.length];
      const cw = between(rnd, spec.widthMin, spec.widthMax);
      const lean = (rnd() - 1 / 2) * 2 * OCCLUDER.leanPx;
      if (style === 'trunk') {
        const pts = [
          { x: cx - (cw * OCCLUDER.rootFlareFrac) / 2, y: bottom },
          { x: cx + (cw * OCCLUDER.rootFlareFrac) / 2, y: bottom },
          { x: cx + cw / 2 + lean, y: top },
          { x: cx - cw / 2 + lean, y: top },
        ];
        g.fillStyle(color, spec.alpha).fillPoints(pts, true);
        // tell #3: occluders read DARKER than their layer kin (low detail, blur-feel)
        g.fillStyle(COL.outline, OCCLUDER.darkenAlpha).fillPoints(pts, true);
        const by = GAME_H * OCCLUDER.branch.yFrac;
        const dir = rnd() < 1 / 2 ? -1 : 1;
        g.lineStyle(cw * OCCLUDER.branch.wFrac, color, spec.alpha);
        g.lineBetween(cx + lean / 2, by, cx + dir * OCCLUDER.branch.len, by - OCCLUDER.branch.rise);
      } else {
        g.fillStyle(color, spec.alpha).fillRect(cx - cw / 2, top, cw, bottom - top);
        g.fillStyle(COL.outline, OCCLUDER.darkenAlpha).fillRect(cx - cw / 2, top, cw, bottom - top);
        if (style === 'culm') {
          g.fillStyle(COL.outline, OCCLUDER.ringAlpha);
          let y = top + between(rnd, 0, OCCLUDER.ringGap);
          while (y < bottom) {
            g.fillRect(cx - cw / 2, y, cw, OCCLUDER.ringH);
            y += OCCLUDER.ringGap * (1 + (rnd() - 1 / 2) * OCCLUDER.ringJitter);
          }
        } else {
          const by = GAME_H * OCCLUDER.postBeam.yFrac;
          g.fillStyle(color, spec.alpha).fillRect(cx - OCCLUDER.postBeam.len / 2, by, OCCLUDER.postBeam.len, OCCLUDER.postBeam.h);
        }
      }
    }
  }

  /** Drifting leaf motes (§9 "secondary motion everywhere") — Forest.ts's shipped emitter. */
  leaves(tints: number[]): void {
    if (!this.scene.textures.exists('leaf')) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(LEAF_FX.texColor, 1);
      g.fillEllipse(LEAF_FX.texCx, LEAF_FX.texCy, LEAF_FX.texRw, LEAF_FX.texRh);
      g.generateTexture('leaf', LEAF_FX.texW, LEAF_FX.texH);
      g.destroy();
    }
    this.emitter = this.scene.add.particles(0, LEAF_FX.spawnY, 'leaf', {
      x: { min: 0, max: GAME_W },
      lifespan: LEAF_FX.lifespanMs,
      speedY: { min: LEAF_FX.speedYMin, max: LEAF_FX.speedYMax },
      speedX: { min: LEAF_FX.speedXMin, max: LEAF_FX.speedXMax },
      scale: { min: LEAF_FX.scaleMin, max: LEAF_FX.scaleMax },
      rotate: { min: 0, max: LEAF_FX.rotMax },
      alpha: { min: LEAF_FX.alphaMin, max: LEAF_FX.alphaMax },
      tint: tints,
      frequency: LEAF_FX.freqMs,
      quantity: 1,
    });
    this.emitter.setDepth(BGK.depth.particles);
  }

  // ——— shared prop painters (chunky black outlines per §1 / tell #10) ———

  /** Outlined flat-fill rect — the §1 two-pass look (black slab under a flat fill). */
  oRect(g: G, x: number, y: number, w: number, h: number, color: number): void {
    const o = BGK.outlinePx;
    g.fillStyle(COL.outline, BGK.outlineAlpha).fillRect(x - o, y - o, w + 2 * o, h + 2 * o);
    g.fillStyle(color, 1).fillRect(x, y, w, h);
  }

  /** Wooden signpost with pointed direction boards + gold letter-marks (p1 f12/f18). */
  signpost(g: G, x: number, baseY: number, postColor: number, rnd: Rnd): void {
    const s = SIGNPOST;
    this.oRect(g, x - s.postW / 2, baseY - s.postH, s.postW, s.postH, postColor);
    let by = baseY - s.postH + s.boardTopOffset;
    for (let b = 0; b < 2; b++) {
      const dir = (b + Math.floor(rnd() * 2)) % 2 === 0 ? 1 : -1;
      const back = x - dir * (s.boardW / 2 - s.tipPx);
      const pts = [
        { x: back, y: by },
        { x: back + dir * (s.boardW - s.tipPx), y: by },
        { x: back + dir * s.boardW, y: by + s.boardH / 2 },
        { x: back + dir * (s.boardW - s.tipPx), y: by + s.boardH },
        { x: back, y: by + s.boardH },
      ];
      g.lineStyle(BGK.outlinePx, COL.outline, BGK.outlineAlpha).strokePoints(pts, true, true);
      g.fillStyle(postColor, 1).fillPoints(pts, true);
      g.fillStyle(COL.goldTrim, s.dashAlpha);
      g.fillRect(back + dir * s.dashGap - s.dashW / 2, by + s.boardH / 2 - s.dashH / 2, s.dashW, s.dashH);
      by += s.boardH + s.boardGap;
    }
  }

  /** Pale stone lantern (bamboo grove floor prop, p1 f18). */
  stoneLantern(g: G, x: number, baseY: number): void {
    const L = LANTERN;
    let y = baseY - L.baseH;
    this.oRect(g, x - L.baseW / 2, y, L.baseW, L.baseH, COL.paleRock);
    y -= L.pillarH;
    this.oRect(g, x - L.pillarW / 2, y, L.pillarW, L.pillarH, COL.paleRock);
    y -= L.boxH;
    this.oRect(g, x - L.boxW / 2, y, L.boxW, L.boxH, COL.paleRock);
    g.fillStyle(COL.outline, L.windowAlpha).fillRect(x - L.windowW / 2, y + (L.boxH - L.windowH) / 2, L.windowW, L.windowH);
    const o = BGK.outlinePx;
    g.fillStyle(COL.outline, BGK.outlineAlpha).fillTriangle(x - L.roofW / 2 - o, y, x + L.roofW / 2 + o, y, x, y - L.roofH - o);
    g.fillStyle(COL.paleRock, 1).fillTriangle(x - L.roofW / 2, y, x + L.roofW / 2, y, x, y - L.roofH);
    g.fillStyle(COL.paleRock, 1).fillCircle(x, y - L.roofH, L.capR);
  }

  /** Rounded pale rock settled into the band (p2 f14 undergrowth). */
  rock(g: G, x: number, baseY: number, w: number, color: number): void {
    const h = w * ROCK.hFrac;
    const cy = baseY + ROCK.sink - h / 2;
    const o = BGK.outlinePx;
    g.fillStyle(COL.outline, BGK.outlineAlpha).fillEllipse(x, cy, w + 2 * o, h + 2 * o);
    g.fillStyle(color, 1).fillEllipse(x, cy, w, h);
    g.fillStyle(COL.outline, ROCK.shadeAlpha).fillEllipse(x, cy + h * ROCK.shadeDyFrac, w * ROCK.shadeWFrac, h * ROCK.shadeHFrac);
  }

  /** Fan of grass-blade triangles (band edges, wall seams). */
  grassFan(g: G, x: number, baseY: number, color: number, cfg: FanCfg, rnd: Rnd): void {
    const n = Math.round(between(rnd, cfg.bladesMin, cfg.bladesMax));
    g.fillStyle(color, 1);
    for (let i = 0; i < n; i++) {
      const bx = x + (rnd() - 1 / 2) * 2 * cfg.spreadPx;
      const bh = between(rnd, cfg.hMin, cfg.hMax);
      const lean = (rnd() - 1 / 2) * 2 * cfg.w;
      g.fillTriangle(bx - cfg.w / 2, baseY, bx + cfg.w / 2, baseY, bx + lean, baseY - bh);
    }
  }

  /** Short fence run: outlined posts + sagging rope lines (p1 f12 path edge). */
  fence(g: G, x0: number, baseY: number, postColor: number, cfg: FenceCfg, rnd: Rnd): void {
    const xs: number[] = [];
    for (let i = 0; i < cfg.count; i++) xs.push(x0 + i * cfg.gap + (rnd() - 1 / 2) * 2);
    for (const x of xs) this.oRect(g, x - cfg.postW / 2, baseY - cfg.postH, cfg.postW, cfg.postH, postColor);
    g.lineStyle(cfg.ropePx, postColor, 1);
    for (let i = 0; i + 1 < xs.length; i++) {
      const a = xs[i];
      const b = xs[i + 1];
      const y = baseY - cfg.postH + cfg.ropeDrop;
      const pts: { x: number; y: number }[] = [];
      for (let s = 0; s <= cfg.ropeSegs; s++) {
        const t = s / cfg.ropeSegs;
        pts.push({ x: a + (b - a) * t, y: y + Math.sin(Math.PI * t) * cfg.ropeSag });
      }
      g.strokePoints(pts, false, false);
    }
  }

  /** Layer-offset parallax + slow sway; `cameraX` is the world focus (player x today). */
  update(_dt: number, cameraX: number): void {
    const off = cameraX - this.centerX;
    const t = this.scene.time.now;
    for (const l of this.layers) {
      const sway = l.swayAmp !== 0 ? Math.sin(t * l.swayRadPerMs) * l.swayAmp : 0;
      l.gfx.x = l.baseX - off * l.parallax + sway;
    }
  }

  destroy(): void {
    for (const l of this.layers) l.gfx.destroy();
    for (const f of this.fixed) f.destroy();
    this.emitter?.destroy();
    this.layers = [];
    this.fixed = [];
  }
}
