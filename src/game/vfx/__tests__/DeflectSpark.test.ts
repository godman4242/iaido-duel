import { describe, it, expect } from 'vitest';

// DeflectSpark imports Phaser as types only — no mock needed; the scene is stubbed.
import type Phaser from 'phaser';
import { DeflectSpark } from '../DeflectSpark';
import { DEFLECT_SWAT, FX_DEPTH } from '../../../config/fx-extra';
import type { Pt } from '../../../core/vec';

class FakeGraphics {
  x = 0;
  y = 0;
  depth = 0;
  destroyed = false;
  cleared = 0;
  circles: number[] = []; // strokeCircle radii, in draw order
  alphas: number[] = []; // lineStyle alphas, in draw order
  setDepth(d: number): this {
    this.depth = d;
    return this;
  }
  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  clear(): this {
    this.cleared++;
    return this;
  }
  fillStyle(): this {
    return this;
  }
  fillCircle(): this {
    return this;
  }
  lineStyle(_w: number, _color: number, alpha: number): this {
    this.alphas.push(alpha);
    return this;
  }
  strokeCircle(_x: number, _y: number, r: number): this {
    this.circles.push(r);
    return this;
  }
  beginPath(): this {
    return this;
  }
  moveTo(): this {
    return this;
  }
  lineTo(): this {
    return this;
  }
  strokePath(): this {
    return this;
  }
  destroy(): void {
    this.destroyed = true;
  }
}

type TweenCfg = {
  targets: { t: number };
  t: number;
  duration: number;
  onUpdate: () => void;
  onComplete: () => void;
};

function makeScene() {
  const made: FakeGraphics[] = [];
  const tweens: TweenCfg[] = [];
  const scene = {
    add: {
      graphics: () => {
        const g = new FakeGraphics();
        made.push(g);
        return g;
      },
    },
    tweens: { add: (cfg: TweenCfg) => tweens.push(cfg) },
  };
  const drive = (cfg: TweenCfg, t: number): void => {
    cfg.targets.t = t;
    cfg.onUpdate();
  };
  return { scene: scene as unknown as Phaser.Scene, made, tweens, drive };
}

describe('DeflectSpark (Tell 10 — the kunai swat flash)', () => {
  it('swat spawns the spark at the deflect point for exactly DEFLECT_SWAT.flashMs', () => {
    const { scene, made, tweens } = makeScene();
    new DeflectSpark(scene).swat({ x: 10, y: 20 });
    expect(made.length).toBe(1);
    expect(made[0].x).toBe(10);
    expect(made[0].y).toBe(20);
    expect(made[0].depth).toBe(FX_DEPTH.deflectSpark);
    expect(tweens.length).toBe(1);
    expect(tweens[0].duration).toBe(DEFLECT_SWAT.flashMs);
    expect(made[0].circles[0]).toBeCloseTo(DEFLECT_SWAT.ringStartR); // birth draw already visible
  });

  it('the ring expands to ringR and the steel fades to zero across the flash', () => {
    const { scene, made, tweens, drive } = makeScene();
    new DeflectSpark(scene).swat({ x: 0, y: 0 });
    const g = made[0];

    drive(tweens[0], 1 / 2);
    const midR = g.circles[g.circles.length - 1];
    expect(midR).toBeGreaterThan(DEFLECT_SWAT.ringStartR);
    expect(midR).toBeLessThan(DEFLECT_SWAT.ringR);

    drive(tweens[0], 1);
    expect(g.circles[g.circles.length - 1]).toBeCloseTo(DEFLECT_SWAT.ringR);
    expect(g.alphas[g.alphas.length - 1]).toBeCloseTo(0); // fully faded at death
  });

  it('onComplete destroys the spark graphics (no per-swat leak)', () => {
    const { scene, made, tweens } = makeScene();
    new DeflectSpark(scene).swat({ x: 5, y: 5 });
    tweens[0].onComplete();
    expect(made[0].destroyed).toBe(true);
  });

  it('chaos: hostile points are skipped, spark storms survive', () => {
    const { scene, made, tweens, drive } = makeScene();
    const spark = new DeflectSpark(scene);

    expect(() => spark.swat(undefined as unknown as Pt)).not.toThrow();
    expect(() => spark.swat({ x: Number.NaN, y: 0 })).not.toThrow();
    expect(() => spark.swat({ x: 0, y: Number.POSITIVE_INFINITY })).not.toThrow();
    expect(made.length).toBe(0); // nothing spawned for garbage points
    expect(tweens.length).toBe(0);

    for (let i = 0; i < 100; i++) spark.swat({ x: i, y: i }); // deflect storm
    expect(made.length).toBe(100);
    for (const cfg of tweens) {
      drive(cfg, 1);
      cfg.onComplete();
    }
    expect(made.every((g) => g.destroyed)).toBe(true);
    for (const g of made) {
      for (const r of g.circles) expect(Number.isFinite(r)).toBe(true);
    }
  });
});
