import { describe, it, expect, vi } from 'vitest';

// FinisherFlash only needs Scenes.Events at runtime; drawSkeleton (its silhouette
// painter) needs Math.Vector2. Everything else it touches is scene-shaped, stubbed below.
vi.mock('phaser', () => ({
  default: {
    Scenes: { Events: { UPDATE: 'update', SHUTDOWN: 'shutdown' } },
    Math: {
      Vector2: class {
        x: number;
        y: number;
        constructor(x = 0, y = 0) {
          this.x = x;
          this.y = y;
        }
      },
    },
  },
}));

import type Phaser from 'phaser';
import { FinisherFlash } from '../FinisherFlash';
import { FINISHER_FLASH } from '../../../config/fx';
import { FINISHER_LAYERS } from '../../../config/fx-extra';

type Listener = { fn: (...args: unknown[]) => void; once: boolean };

/** Minimal EventEmitter honoring on/once/off/emit the way FinisherFlash uses them. */
class FakeEmitter {
  private map = new Map<string, Listener[]>();
  on(event: string, fn: (...args: unknown[]) => void): this {
    (this.map.get(event) ?? this.map.set(event, []).get(event)!).push({ fn, once: false });
    return this;
  }
  once(event: string, fn: (...args: unknown[]) => void): this {
    (this.map.get(event) ?? this.map.set(event, []).get(event)!).push({ fn, once: true });
    return this;
  }
  off(event: string, fn: (...args: unknown[]) => void): this {
    const ls = this.map.get(event);
    if (ls) this.map.set(event, ls.filter((l) => l.fn !== fn));
    return this;
  }
  emit(event: string, ...args: unknown[]): void {
    const ls = [...(this.map.get(event) ?? [])];
    for (const l of ls) {
      if (l.once) this.off(event, l.fn);
      l.fn(...args);
    }
  }
}

/** Chainable no-op Graphics stand-in (drawSkeleton calls dozens of paint methods). */
function stubGraphics(x = 0, y = 0): unknown {
  const target: Record<string | symbol, unknown> = { x, y };
  const proxy: Record<string | symbol, unknown> = new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      return (..._args: unknown[]) => proxy;
    },
    set(t, prop, v) {
      t[prop] = v;
      return true;
    },
  });
  return proxy;
}

type FakeContainer = {
  alpha: number;
  depth: number;
  destroyed: boolean;
  children: unknown[];
  setDepth(d: number): FakeContainer;
  setAlpha(a: number): FakeContainer;
  add(c: unknown): FakeContainer;
  destroy(): void;
};

function makeScene() {
  const container: FakeContainer = {
    alpha: 1,
    depth: 0,
    destroyed: false,
    children: [],
    setDepth(d) {
      this.depth = d;
      return this;
    },
    setAlpha(a) {
      this.alpha = a;
      return this;
    },
    add(c) {
      this.children.push(c);
      return this;
    },
    destroy() {
      this.destroyed = true;
    },
  };
  const events = new FakeEmitter();
  const scene = {
    add: { container: () => container },
    make: { graphics: (cfg?: { x?: number; y?: number }) => stubGraphics(cfg?.x, cfg?.y) },
    time: { timeScale: 1 },
    tweens: { timeScale: 1 },
    events,
  };
  return { scene: scene as unknown as Phaser.Scene, raw: scene, container, events };
}

const FULL_MS = FINISHER_FLASH.snapInMs + FINISHER_FLASH.durationMs + FINISHER_LAYERS.fadeOutMs + 1;

describe('FinisherFlash lifecycle', () => {
  it('runs onDone exactly once when the flash plays out on scene updates', () => {
    const { scene, raw, container, events } = makeScene();
    const onDone = vi.fn();
    const flash = new FinisherFlash(scene);
    flash.play([{ x: 100, y: 100, facing: 1 }], { onDone });

    expect(flash.isActive).toBe(true);
    expect(raw.time.timeScale).toBe(FINISHER_FLASH.slowMoScale); // slow-mo applied

    events.emit('update', 0, FULL_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(flash.isActive).toBe(false);
    expect(container.destroyed).toBe(true);
    expect(raw.time.timeScale).toBe(1); // slow-mo restored
    expect(raw.tweens.timeScale).toBe(1);

    events.emit('update', 0, FULL_MS); // handlers must be detached — no double-fire
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('REGRESSION: scene SHUTDOWN mid-flash cleans up but never runs onDone', () => {
    // Pressing R (scene.restart) during the flash fires SHUTDOWN while the scene's own
    // plugins (clock/tweens/display list) are purging. Running onDone there would spawn
    // the KillBeat into the dying scene and leak its graphics/timers into the restart.
    const { scene, raw, container, events } = makeScene();
    const onDone = vi.fn();
    const flash = new FinisherFlash(scene);
    flash.play([{ x: 100, y: 100, facing: 1 }], { onDone });

    events.emit('update', 0, FINISHER_FLASH.snapInMs + 1); // mid-hold
    events.emit('shutdown');

    expect(onDone).not.toHaveBeenCalled();
    expect(flash.isActive).toBe(false);
    expect(container.destroyed).toBe(true);
    expect(raw.time.timeScale).toBe(1); // slow-mo restored even on the shutdown path
    expect(raw.tweens.timeScale).toBe(1);

    events.emit('update', 0, FULL_MS); // detached — nothing revives after shutdown
    expect(onDone).not.toHaveBeenCalled();
  });

  it('is re-entrant-safe: play() while active is a no-op', () => {
    const { scene, events } = makeScene();
    const onDone = vi.fn();
    const second = vi.fn();
    const flash = new FinisherFlash(scene);
    flash.play([], { onDone });
    flash.play([], { onDone: second }); // ignored — a flash is already running

    events.emit('update', 0, FULL_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});
