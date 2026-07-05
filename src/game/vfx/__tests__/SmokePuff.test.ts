import { describe, it, expect, vi } from 'vitest';

// SmokePuff needs Phaser only for Scenes.Events.SHUTDOWN; everything else is scene-shaped.
vi.mock('phaser', () => ({
  default: { Scenes: { Events: { SHUTDOWN: 'shutdown' } } },
}));

import type Phaser from 'phaser';
import { SmokePuff } from '../SmokePuff';
import { GAME_H } from '../../../config';
import { FX_DEPTH, FX_GROUND_OFFSET, SMOKE_PUFF } from '../../../config/fx-extra';
import { SMOKE_BOMB_MS } from '../../../config/combat-sim';

type Listener = { fn: (...args: unknown[]) => void; once: boolean };
class FakeEmitterBus {
  private map = new Map<string, Listener[]>();
  once(event: string, fn: (...args: unknown[]) => void): this {
    (this.map.get(event) ?? this.map.set(event, []).get(event)!).push({ fn, once: true });
    return this;
  }
  on(event: string, fn: (...args: unknown[]) => void): this {
    (this.map.get(event) ?? this.map.set(event, []).get(event)!).push({ fn, once: false });
    return this;
  }
  emit(event: string, ...args: unknown[]): void {
    const ls = [...(this.map.get(event) ?? [])];
    this.map.set(
      event,
      (this.map.get(event) ?? []).filter((l) => !l.once),
    );
    for (const l of ls) l.fn(...args);
  }
}

/** Chainable no-op graphics for the texture-generation pass. */
function stubGraphics(): unknown {
  const proxy: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get: () => (..._args: unknown[]) => proxy,
    },
  );
  return proxy;
}

type Emitted = { x: number; y: number; count: number };
type Timer = { ms: number; fn: () => void; removed: boolean; remove: (dispatch?: boolean) => void };

function makeScene() {
  const emitted: Emitted[] = [];
  const emitter = {
    depth: 0,
    destroyed: false,
    config: null as unknown,
    setDepth(d: number) {
      this.depth = d;
      return this;
    },
    emitParticleAt(x: number, y: number, count: number) {
      emitted.push({ x, y, count });
    },
    destroy() {
      this.destroyed = true;
    },
  };
  const timers: Timer[] = [];
  const events = new FakeEmitterBus();
  const scene = {
    textures: { exists: () => false },
    make: { graphics: (_cfg?: unknown, _add?: boolean) => stubGraphics() },
    add: {
      particles: (_x: number, _y: number, _key: string, cfg: unknown) => {
        emitter.config = cfg;
        return emitter;
      },
    },
    time: {
      delayedCall: (ms: number, fn: () => void): Timer => {
        const t: Timer = {
          ms,
          fn,
          removed: false,
          remove() {
            this.removed = true;
          },
        };
        timers.push(t);
        return t;
      },
    },
    events,
  };
  return { scene: scene as unknown as Phaser.Scene, emitted, emitter, timers, events };
}

const DEFAULT_Y = GAME_H - FX_GROUND_OFFSET - SMOKE_PUFF.centerYOffset;

describe('SmokePuff (Tell 10 — smoke-bomb teleport dodge)', () => {
  it('teleport bursts the full cloud at the origin NOW and schedules the reappear poof at SMOKE_BOMB_MS', () => {
    const { scene, emitted, timers } = makeScene();
    const puff = new SmokePuff(scene);
    puff.teleport(100, 300);

    expect(emitted.length).toBe(SMOKE_PUFF.particleCount); // origin cloud only
    for (const e of emitted) {
      expect(Math.abs(e.x - 100)).toBeLessThanOrEqual(SMOKE_PUFF.radius);
      expect(Math.abs(e.y - DEFAULT_Y)).toBeLessThanOrEqual(SMOKE_PUFF.radius);
    }
    expect(timers.length).toBe(1);
    expect(timers[0].ms).toBe(SMOKE_BOMB_MS); // poof lands exactly when the sim slide ends

    timers[0].fn();
    const poof = emitted.slice(SMOKE_PUFF.particleCount);
    expect(poof.length).toBe(SMOKE_PUFF.reappearCount); // smaller destination poof
    for (const e of poof) expect(Math.abs(e.x - 300)).toBeLessThanOrEqual(SMOKE_PUFF.radius);
  });

  it('emitter ranges are FINAL at construction — no post-construction EmitterOp writes (the 3.90 no-op trap)', () => {
    const { scene, emitter } = makeScene();
    void new SmokePuff(scene);
    const cfg = emitter.config as { angle: { min: number; max: number }; lifespan: number };
    expect(cfg.angle).toEqual({ min: SMOKE_PUFF.angleMin, max: SMOKE_PUFF.angleMax });
    expect(cfg.lifespan).toBe(SMOKE_PUFF.riseMs);
    expect(emitter.depth).toBe(FX_DEPTH.smoke);
  });

  it('destroy cancels the pending reappear poof — no late particles after a restart', () => {
    const { scene, emitted, timers } = makeScene();
    const puff = new SmokePuff(scene);
    puff.teleport(100, 300);
    puff.destroy();
    expect(timers[0].removed).toBe(true);
    const before = emitted.length;
    timers[0].fn(); // even if the clock still fires it, the destroyed guard holds
    expect(emitted.length).toBe(before);
  });

  it('scene SHUTDOWN auto-destroys; later calls are silent no-ops (restart safety)', () => {
    const { scene, emitted, emitter, events } = makeScene();
    const puff = new SmokePuff(scene);
    events.emit('shutdown');
    expect(emitter.destroyed).toBe(true);
    const before = emitted.length;
    expect(() => puff.teleport(50, 90)).not.toThrow();
    expect(emitted.length).toBe(before);
    expect(() => puff.destroy()).not.toThrow(); // idempotent
  });

  it('chaos: NaN/Infinity coordinates and hostile counts never throw, never emit garbage', () => {
    const { scene, emitted, timers } = makeScene();
    const puff = new SmokePuff(scene);

    puff.burst(Number.NaN);
    puff.burst(Number.POSITIVE_INFINITY);
    puff.burst(0, Number.NaN);
    expect(emitted.length).toBe(0); // non-finite centers emit nothing

    puff.teleport(Number.NaN, Number.NaN);
    expect(emitted.length).toBe(0);
    expect(timers.length).toBe(0); // no poof scheduled for a nowhere destination

    puff.burst(0, undefined, Number.NaN); // hostile count → default count
    expect(emitted.length).toBe(SMOKE_PUFF.particleCount);

    puff.burst(0, undefined, 1e9); // spam count → hard cap
    expect(emitted.length).toBe(SMOKE_PUFF.particleCount + SMOKE_PUFF.maxPerBurst);

    puff.burst(0, undefined, -5); // negative → nothing
    expect(emitted.length).toBe(SMOKE_PUFF.particleCount + SMOKE_PUFF.maxPerBurst);
    for (const e of emitted) {
      expect(Number.isFinite(e.x)).toBe(true);
      expect(Number.isFinite(e.y)).toBe(true);
    }
  });
});
