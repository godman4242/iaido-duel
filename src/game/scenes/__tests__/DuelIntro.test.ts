// §3.13 duel-framing tests (Tell 25) — DuelIntro beat order + callback latches, driven with
// a fake scene in the FinisherFlash.test.ts style. The three pre-fight beats must appear in
// order (VS splash → name banner → READY/FIGHT!), onFight/onDone must fire exactly once
// (including under skip() spam), and destroy() must be silent and total (restart safety).
import { describe, it, expect, vi } from 'vitest';

// DuelIntro needs Phaser.Math.Between/FloatBetween at runtime (brush-word jitter); everything
// else it touches is scene-shaped and stubbed below. Deterministic midpoint jitter (= 0).
vi.mock('phaser', () => ({
  default: {
    Math: {
      Between: (a: number, b: number) => Math.round((a + b) / 2),
      FloatBetween: (a: number, b: number) => (a + b) / 2,
    },
  },
}));

import { DuelIntro } from '../DuelIntro';
import type Phaser from 'phaser';

type FakeTween = { cfg: Record<string, unknown>; removed: boolean; completed: boolean; remove(): void };
type FakeTimer = { ms: number; fn: () => void; removed: boolean; fired: boolean; remove(): void };

/** Chainable no-op Graphics stand-in (mottle painters call dozens of paint methods). */
function stubGraphics(): unknown {
  const target: Record<string | symbol, unknown> = {};
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

class FakeText {
  str: string;
  x: number;
  y: number;
  width: number;
  destroyed = false;
  constructor(x: number, y: number, str: string) {
    this.x = x;
    this.y = y;
    this.str = str;
    this.width = str.length * 10;
  }
  setOrigin(): this {
    return this;
  }
  setAngle(): this {
    return this;
  }
  setDepth(): this {
    return this;
  }
  destroy(): void {
    this.destroyed = true;
  }
}

class FakeContainer {
  x: number;
  y: number;
  alpha = 1;
  scale = 1;
  depth = 0;
  destroyed = false;
  children: unknown[] = [];
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  setDepth(d: number): this {
    this.depth = d;
    return this;
  }
  setAlpha(a: number): this {
    this.alpha = a;
    return this;
  }
  setScale(s: number): this {
    this.scale = s;
    return this;
  }
  add(c: unknown): this {
    this.children.push(c);
    return this;
  }
  destroy(): void {
    this.destroyed = true;
    // Phaser semantics: destroying a container destroys its children (nested included)
    for (const ch of this.children) (ch as { destroy?: () => void }).destroy?.();
  }
}

function makeScene() {
  const texts: FakeText[] = [];
  const containers: FakeContainer[] = [];
  const tweens: FakeTween[] = [];
  const timers: FakeTimer[] = [];
  const scene = {
    add: {
      container: (x: number, y: number) => {
        const c = new FakeContainer(x, y);
        containers.push(c);
        return c;
      },
      graphics: () => stubGraphics(),
      text: (x: number, y: number, str: string) => {
        const t = new FakeText(x, y, str);
        texts.push(t);
        return t;
      },
    },
    tweens: {
      add: (cfg: Record<string, unknown>) => {
        const tw: FakeTween = {
          cfg,
          removed: false,
          completed: false,
          remove() {
            this.removed = true;
          },
        };
        tweens.push(tw);
        return tw;
      },
      killTweensOf: () => undefined,
    },
    time: {
      delayedCall: (ms: number, fn: () => void) => {
        const t: FakeTimer = {
          ms,
          fn,
          removed: false,
          fired: false,
          remove() {
            this.removed = true;
          },
        };
        timers.push(t);
        return t;
      },
    },
  };
  /** Fire pending timers + tween onCompletes until the intro reaches quiescence. */
  const drain = (): void => {
    for (let guard = 0; guard < 64; guard++) {
      const timer = timers.find((t) => !t.fired && !t.removed);
      if (timer) {
        timer.fired = true;
        timer.fn();
        continue;
      }
      const tw = tweens.find((t) => !t.completed && !t.removed && typeof t.cfg.onComplete === 'function');
      if (tw) {
        tw.completed = true;
        (tw.cfg.onComplete as () => void)();
        continue;
      }
      return;
    }
    throw new Error('drain(): intro never reached quiescence (beat loop?)');
  };
  return { scene: scene as unknown as Phaser.Scene, texts, containers, tweens, timers, drain };
}

const mkIntro = (s: ReturnType<typeof makeScene>, log: string[]) =>
  new DuelIntro(s.scene, {
    playerName: 'You',
    opponentName: 'Ronin',
    opponentLevel: 3,
    onFight: () => log.push('fight'),
    onDone: () => log.push('done'),
  });

describe('DuelIntro — §3.13 beat order + latches (Tell 25)', () => {
  it('plays VS splash → name banner → READY → FIGHT! in order; onFight then onDone, once each', () => {
    const s = makeScene();
    const log: string[] = [];
    mkIntro(s, log);
    s.drain();

    expect(log).toEqual(['fight', 'done']); // exactly once each, fight strictly first

    // screen order via text creation order: 'V' only in VS; the banner is the SECOND
    // 'RONIN (3)' (the first is the VS-card portrait label); 'A' only in READY; 'G' only in FIGHT!
    const strs = s.texts.map((t) => t.str);
    const vsAt = strs.indexOf('V');
    const bannerAt = strs.lastIndexOf('RONIN (3)');
    const readyAt = strs.indexOf('A');
    const fightAt = strs.indexOf('G');
    expect(vsAt).toBeGreaterThanOrEqual(0);
    expect(bannerAt).toBeGreaterThan(vsAt);
    expect(readyAt).toBeGreaterThan(bannerAt);
    expect(fightAt).toBeGreaterThan(readyAt);

    // §3 label roles present on the VS card: gold player caps + red hostile NAME (LVL)
    expect(strs).toContain('YOU');
    expect(strs.filter((x) => x === 'RONIN (3)')).toHaveLength(2); // portrait + banner

    // after the last beat the intro destroyed everything it created
    for (const c of s.containers) expect(c.destroyed).toBe(true);
    for (const t of s.texts) expect(t.destroyed).toBe(true);
  });

  it('skip() spam fast-forwards: onFight/onDone exactly once, all beats dead afterwards', () => {
    const s = makeScene();
    const log: string[] = [];
    const intro = mkIntro(s, log);
    intro.skip();
    intro.skip();
    intro.skip();
    expect(log).toEqual(['fight', 'done']);
    s.drain(); // any stale timers/tweens must be inert (removed by destroy)
    expect(log).toEqual(['fight', 'done']);
    for (const c of s.containers) expect(c.destroyed).toBe(true);
  });

  it('destroy() mid-beat is SILENT (no callbacks — the R-restart path) and total', () => {
    const s = makeScene();
    const log: string[] = [];
    const intro = mkIntro(s, log);
    s.timers[0].fired = true;
    s.timers[0].fn(); // advance into the splash-fade beat before tearing down
    intro.destroy();
    s.drain();
    expect(log).toEqual([]); // never fires onFight/onDone
    for (const c of s.containers) expect(c.destroyed).toBe(true);
    for (const tw of s.tweens) expect(tw.removed || tw.completed).toBe(true);
    intro.skip(); // skip AFTER destroy stays silent (destroyed latch)
    expect(log).toEqual([]);
  });

  it('a skip that lands mid-FIGHT!-beat still fires each callback once (no double latch)', () => {
    const s = makeScene();
    const log: string[] = [];
    const intro = mkIntro(s, log);
    // drive beats until onFight has fired naturally (FIGHT! is on screen), then skip
    for (let guard = 0; guard < 64 && !log.includes('fight'); guard++) {
      const timer = s.timers.find((t) => !t.fired && !t.removed);
      if (timer) {
        timer.fired = true;
        timer.fn();
        continue;
      }
      const tw = s.tweens.find((t) => !t.completed && !t.removed && typeof t.cfg.onComplete === 'function');
      if (tw) {
        tw.completed = true;
        (tw.cfg.onComplete as () => void)();
      }
    }
    expect(log).toEqual(['fight']);
    intro.skip(); // the impatient click during FIGHT! — must not re-fire onFight
    expect(log).toEqual(['fight', 'done']);
    s.drain();
    expect(log).toEqual(['fight', 'done']);
  });
});
