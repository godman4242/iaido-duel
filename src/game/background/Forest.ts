import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { COL } from '../../palette';

type Layer = { gfx: Phaser.GameObjects.Graphics; parallax: number; baseX: number };

/**
 * Layered, hazy parallax forest matching the videos' misty bamboo grove.
 * Built code-first; each layer is a seam where a painted PNG could be swapped in later.
 */
export class Forest {
  private layers: Layer[] = [];
  private leaves: Phaser.GameObjects.Particles.ParticleEmitter;
  private centerX = GAME_W / 2;

  constructor(scene: Phaser.Scene, groundY: number) {
    // --- haze / depth: teal mist, lighter at top, darkening into the grove ---
    const haze = scene.add.graphics().setDepth(-20);
    haze.fillGradientStyle(COL.mistTeal, COL.mistTeal, COL.mistTealDeep, COL.mistTealDeep, 1);
    haze.fillRect(-120, 0, GAME_W + 240, groundY + 80);
    haze.fillStyle(COL.mistTealDark, 0.45).fillRect(-120, groundY - 150, GAME_W + 240, 230);
    this.add(haze, 0);

    // --- top canopy band: bright yellow-green leaves ---
    const canopy = scene.add.graphics().setDepth(-16);
    this.canopies(canopy, 60, 120, COL.canopy, 1);
    this.canopies(canopy, 20, 78, COL.canopyBright, 0.9);
    this.add(canopy, 0.03);

    // --- far trunks: hazy, teal-toned ---
    const far = scene.add.graphics().setDepth(-15);
    this.bamboo(far, groundY, COL.mistTealDeep, 9, 0.6);
    this.add(far, 0.05);

    // --- mid: foliage clumps + dark trunks ---
    const mid = scene.add.graphics().setDepth(-10);
    this.bamboo(mid, groundY, COL.trunk, 11, 1);
    this.canopies(mid, groundY - 170, 86, COL.forestShadow, 0.92);
    this.add(mid, 0.09);

    // --- near dark trunks framing the arena ---
    const near = scene.add.graphics().setDepth(-8);
    this.bamboo(near, groundY, COL.trunk, 6, 0.95);
    this.add(near, 0.14);

    // --- soft bokeh light motes ---
    const bokeh = scene.add.graphics().setDepth(-7);
    for (let i = 0; i < 26; i++) {
      const x = (i * 9973) % (GAME_W + 100);
      const y = ((i * 6151) % (groundY - 40)) + 10;
      bokeh.fillStyle(i % 3 === 0 ? COL.cream : COL.sage2, 0.06 + ((i * 7) % 5) * 0.012);
      bokeh.fillCircle(x, y, 6 + ((i * 13) % 16));
    }
    this.add(bokeh, 0.02);

    // --- ground: grass band ---
    const ground = scene.add.graphics().setDepth(-5);
    ground.fillStyle(COL.forestMid, 1).fillRect(-120, groundY + 56, GAME_W + 240, GAME_H);
    ground.fillStyle(COL.forestDark, 1).fillRect(-120, groundY + 52, GAME_W + 240, 6);
    ground.fillStyle(COL.forestShadow, 0.5).fillRect(-120, groundY + 62, GAME_W + 240, 10);
    this.add(ground, 0);

    // --- drifting leaves ---
    if (!scene.textures.exists('leaf')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillEllipse(5, 3, 10, 5);
      g.generateTexture('leaf', 10, 6);
      g.destroy();
    }
    this.leaves = scene.add.particles(0, -10, 'leaf', {
      x: { min: 0, max: GAME_W },
      lifespan: 9000,
      speedY: { min: 12, max: 30 },
      speedX: { min: -14, max: 14 },
      scale: { min: 0.6, max: 1.2 },
      rotate: { min: 0, max: 360 },
      alpha: { min: 0.25, max: 0.6 },
      tint: [COL.sage2, COL.forestBright, COL.wood],
      frequency: 520,
      quantity: 1,
    });
    this.leaves.setDepth(-3);
  }

  private add(gfx: Phaser.GameObjects.Graphics, parallax: number) {
    this.layers.push({ gfx, parallax, baseX: 0 });
  }

  /** A row of overlapping canopy blobs along a baseline. */
  private canopies(g: Phaser.GameObjects.Graphics, baseY: number, h: number, color: number, alpha: number) {
    g.fillStyle(color, alpha);
    for (let x = -60; x < GAME_W + 60; x += 64) {
      const wob = ((x * 31) % 40) - 20;
      g.fillCircle(x, baseY + wob, h * (0.7 + (((x * 17) % 10) / 30)));
    }
    g.fillRect(-120, baseY, GAME_W + 240, h + 80);
  }

  /** Vertical bamboo / tree trunks. */
  private bamboo(g: Phaser.GameObjects.Graphics, groundY: number, color: number, width = 7, alpha = 1) {
    g.fillStyle(color, alpha);
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * ((GAME_W - 80) / 8) + (((i * 53) % 30) - 15);
      g.fillRect(x, -20, width, groundY + 40);
    }
  }

  update(playerX: number) {
    const off = playerX - this.centerX;
    for (const l of this.layers) l.gfx.x = l.baseX - off * l.parallax;
  }
}
