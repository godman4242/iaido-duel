import { describe, it, expect, vi } from 'vitest';

// ProjectileView needs Phaser only for Scenes.Events.SHUTDOWN.
vi.mock('phaser', () => ({
  default: { Scenes: { Events: { SHUTDOWN: 'shutdown' } } },
}));

import type Phaser from 'phaser';
import { ProjectileView, type SimProjectileLike } from '../ProjectileView';
import { GAME_H } from '../../../config';
import { RAD_TO_DEG } from '../../../config/combat';
import { STRIKE_TORSO_OFFSET } from '../../../config/combat-sim';
import { FX_DEPTH, FX_GROUND_OFFSET, PROJECTILE_VIEW } from '../../../config/fx-extra';

class FakeGraphics {
  x = 0;
  y = 0;
  scaleX = 1;
  scaleY = 1;
  rotation = 0;
  depth = 0;
  destroyed = false;
  setDepth(d: number): this {
    this.depth = d;
    return this;
  }
  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  destroy(): void {
    this.destroyed = true;
  }
  lineStyle(): this {
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
  fillStyle(): this {
    return this;
  }
  fillTriangle(): this {
    return this;
  }
  strokeCircle(): this {
    return this;
  }
}

class FakeEmitterBus {
  private handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  once(event: string, fn: (...args: unknown[]) => void): this {
    (this.handlers.get(event) ?? this.handlers.set(event, []).get(event)!).push(fn);
    return this;
  }
  emit(event: string): void {
    const fns = this.handlers.get(event) ?? [];
    this.handlers.set(event, []);
    for (const fn of fns) fn();
  }
}

function makeScene() {
  const made: FakeGraphics[] = [];
  const events = new FakeEmitterBus();
  const scene = {
    add: {
      graphics: () => {
        const g = new FakeGraphics();
        made.push(g);
        return g;
      },
    },
    events,
  };
  return { scene: scene as unknown as Phaser.Scene, made, events };
}

const FLIGHT_Y = GAME_H - FX_GROUND_OFFSET - STRIKE_TORSO_OFFSET;
const p = (id: number, x: number, vx: number): SimProjectileLike => ({ id, x, vx });

describe('ProjectileView (Tell 10 — kunai mirror of sim.projectiles)', () => {
  it('births a kunai on first sight, moves it on later syncs, never re-creates', () => {
    const { scene, made } = makeScene();
    const view = new ProjectileView(scene);
    view.sync([p(1, 50, 0.5)]);
    expect(view.count()).toBe(1);
    expect(made.length).toBe(1);
    expect(made[0].x).toBe(50);
    expect(made[0].y).toBe(FLIGHT_Y); // torso-height strike line
    expect(made[0].depth).toBe(FX_DEPTH.projectile);

    view.sync([p(1, 60, 0.5)]);
    expect(made.length).toBe(1); // same sprite, moved — the sim is the position authority
    expect(made[0].x).toBe(60);
  });

  it('noses point along the travel direction', () => {
    const { scene, made } = makeScene();
    const view = new ProjectileView(scene);
    view.sync([p(1, 100, -0.5), p(2, 200, 0.5), p(3, 300, 0)]);
    expect(made[0].scaleX).toBe(-1);
    expect(made[1].scaleX).toBe(1);
    expect(made[2].scaleX).toBe(1);
  });

  it('destroys a view the moment its id vanishes (hit / deflected / off-arena)', () => {
    const { scene, made } = makeScene();
    const view = new ProjectileView(scene);
    view.sync([p(1, 50, 0.5), p(2, 80, -0.5)]);
    view.sync([p(2, 70, -0.5)]);
    expect(view.count()).toBe(1);
    expect(made[0].destroyed).toBe(true);
    expect(made[1].destroyed).toBe(false);
    view.sync([]);
    expect(view.count()).toBe(0);
    expect(made[1].destroyed).toBe(true);
  });

  it('wobble is deterministic from sim tFixed and bounded by the config amplitude', () => {
    const { scene, made } = makeScene();
    const view = new ProjectileView(scene);
    view.sync([p(1, 50, 0.5)], 123);
    const r1 = made[0].rotation;
    view.sync([p(1, 50, 0.5)], 123);
    expect(made[0].rotation).toBe(r1); // same tick → same pose (no wall-clock)
    const maxRad = PROJECTILE_VIEW.wobbleDeg / RAD_TO_DEG;
    for (const t of [0, 16.67, 33.33, 250, 9999]) {
      view.sync([p(1, 50, 0.5)], t);
      expect(Math.abs(made[0].rotation)).toBeLessThanOrEqual(maxRad + Number.EPSILON);
    }
  });

  it('honors an injected groundY (scene owns the floor line)', () => {
    const { scene, made } = makeScene();
    const view = new ProjectileView(scene, 400);
    view.sync([p(1, 10, 1)]);
    expect(made[0].y).toBe(400 - STRIKE_TORSO_OFFSET);
  });

  it('chaos: NaN positions, duplicate ids, hostile tFixed and 200-kunai floods survive', () => {
    const { scene, made } = makeScene();
    const view = new ProjectileView(scene);

    view.sync([p(1, Number.NaN, 0.5)]); // non-finite x → unrendered
    expect(view.count()).toBe(0);

    view.sync([p(1, 50, 0.5)]);
    view.sync([p(1, Number.NaN, 0.5)]); // live kunai going NaN → dropped, not frozen
    expect(view.count()).toBe(0);
    expect(made[made.length - 1].destroyed).toBe(true);

    view.sync([p(7, 10, 1), p(7, 20, 1)]); // duplicate ids → one view, last write wins
    expect(view.count()).toBe(1);

    view.sync([p(7, 10, 1)], Number.NaN); // hostile clock → neutral pose, no NaN leak
    expect(Number.isFinite(made[made.length - 1].rotation)).toBe(true);

    const flood: SimProjectileLike[] = [];
    for (let i = 0; i < 200; i++) flood.push(p(i, i, i % 2 ? 1 : -1));
    expect(() => view.sync(flood)).not.toThrow();
    expect(view.count()).toBe(200);
    view.sync([]);
    expect(view.count()).toBe(0);
  });

  it('scene SHUTDOWN destroys every live view', () => {
    const { scene, made, events } = makeScene();
    const view = new ProjectileView(scene);
    view.sync([p(1, 50, 0.5), p(2, 80, -0.5)]);
    events.emit('shutdown');
    expect(made.every((g) => g.destroyed)).toBe(true);
    expect(view.count()).toBe(0);
  });
});
