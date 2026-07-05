// §3.13 duel-framing tests (Tell 25) — DuelResult tally screen: shows the computed XP/coins
// (KILL_REWARD values on victory, 0/0 on defeat — the exact inputs DuelScene.showResult
// passes), sanitizes hostile amounts, latches onContinue once, and destroys cleanly.
// Fake-scene style per FinisherFlash.test.ts; the chrome actionButton is mocked so the
// CONTINUE click handler is capturable without painting.
import { describe, it, expect, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Between: (a: number, b: number) => Math.round((a + b) / 2),
      FloatBetween: (a: number, b: number) => (a + b) / 2,
    },
  },
}));

// Capture the CONTINUE handler DuelResult wires into the chrome action button.
const buttons: Array<{ label: string; onClick: () => void; destroyed: boolean }> = [];
vi.mock('../../chrome/Panel', () => ({
  actionButton: (
    _scene: unknown,
    _cx: number,
    _cy: number,
    _w: number,
    _h: number,
    label: string,
    onClick: () => void,
  ) => {
    const b = { label, onClick, destroyed: false };
    buttons.push(b);
    return {
      destroy: () => {
        b.destroyed = true;
      },
    };
  },
}));

import { DuelResult } from '../DuelResult';
import { KILL_REWARD } from '../../../config/economy';
import type Phaser from 'phaser';

type FakeTween = { cfg: Record<string, unknown>; removed: boolean; remove(): void };
type FakeTimer = { ms: number; fn: () => void; removed: boolean; fired: boolean; remove(): void };

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
  width: number;
  destroyed = false;
  constructor(str: string) {
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
  setText(s: string): this {
    this.str = s;
    return this;
  }
  destroy(): void {
    this.destroyed = true;
  }
}

class FakeContainer {
  destroyed = false;
  children: unknown[] = [];
  alpha = 1;
  scale = 1;
  setDepth(): this {
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

class FakeRect {
  destroyed = false;
  interactive = false;
  setDepth(): this {
    return this;
  }
  setInteractive(): this {
    this.interactive = true;
    return this;
  }
  destroy(): void {
    this.destroyed = true;
  }
}

function makeScene() {
  const texts: FakeText[] = [];
  const rects: FakeRect[] = [];
  const containers: FakeContainer[] = [];
  const tweens: FakeTween[] = [];
  const counters: Array<{ cfg: Record<string, unknown>; removed: boolean; remove(): void }> = [];
  const timers: FakeTimer[] = [];
  const scene = {
    add: {
      rectangle: () => {
        const r = new FakeRect();
        rects.push(r);
        return r;
      },
      container: () => {
        const c = new FakeContainer();
        containers.push(c);
        return c;
      },
      graphics: () => stubGraphics(),
      text: (_x: number, _y: number, str: string) => {
        const t = new FakeText(str);
        texts.push(t);
        return t;
      },
    },
    tweens: {
      add: (cfg: Record<string, unknown>) => {
        const tw: FakeTween = {
          cfg,
          removed: false,
          remove() {
            this.removed = true;
          },
        };
        tweens.push(tw);
        return tw;
      },
      addCounter: (cfg: Record<string, unknown>) => {
        const tw = {
          cfg,
          removed: false,
          remove() {
            this.removed = true;
          },
        };
        counters.push(tw);
        return tw;
      },
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
  const finishCounters = (): void => {
    for (const c of counters) {
      if (!c.removed && typeof c.cfg.onComplete === 'function') (c.cfg.onComplete as () => void)();
    }
  };
  const fireTimers = (): void => {
    for (const t of [...timers]) {
      if (!t.fired && !t.removed) {
        t.fired = true;
        t.fn();
      }
    }
  };
  return {
    scene: scene as unknown as Phaser.Scene,
    texts,
    rects,
    containers,
    tweens,
    counters,
    timers,
    finishCounters,
    fireTimers,
  };
}

const values = (texts: FakeText[]): string[] =>
  texts.filter((t) => t.str.startsWith('+')).map((t) => t.str);

describe('DuelResult — §3.13 tally screen (Tell 25)', () => {
  it('victory shows the computed KILL_REWARD values (the exact inputs DuelScene passes on a win)', () => {
    buttons.length = 0;
    const s = makeScene();
    new DuelResult(s.scene, {
      victory: true,
      xp: KILL_REWARD.xpPerFoeLevel,
      coins: KILL_REWARD.coinsPerFoeLevel,
    });
    s.finishCounters(); // count-ups land on their final values
    expect(values(s.texts)).toContain(`+${KILL_REWARD.xpPerFoeLevel}`);
    expect(values(s.texts)).toContain(`+${KILL_REWARD.coinsPerFoeLevel}`);
    // brush title spells VICTORY (per-letter texts, in order)
    const letters = s.texts.filter((t) => t.str.length === 1).map((t) => t.str).join('');
    expect(letters).toContain('VICTORY');
    // the full-screen dim is interactive — stray clicks can never reach the arena below
    expect(s.rects[0].interactive).toBe(true);
  });

  it('defeat shows 0/0 (the exact inputs DuelScene passes on a loss) and the DEFEAT title', () => {
    buttons.length = 0;
    const s = makeScene();
    new DuelResult(s.scene, { victory: false, xp: 0, coins: 0 });
    s.finishCounters();
    expect(values(s.texts)).toEqual(['+0', '+0']);
    const letters = s.texts.filter((t) => t.str.length === 1).map((t) => t.str).join('');
    expect(letters).toContain('DEFEAT');
  });

  it('CHAOS: NaN/±Infinity/negative/fractional amounts render as safe integers, never NaN', () => {
    buttons.length = 0;
    const s = makeScene();
    new DuelResult(s.scene, { victory: true, xp: Number.NaN, coins: Number.NEGATIVE_INFINITY });
    s.finishCounters();
    expect(values(s.texts)).toEqual(['+0', '+0']);

    const s2 = makeScene();
    new DuelResult(s2.scene, { victory: true, xp: 3.7, coins: -5 });
    s2.finishCounters();
    expect(values(s2.texts)).toEqual(['+4', '+0']); // rounded, floored at 0
    for (const t of [...s.texts, ...s2.texts]) expect(t.str).not.toContain('NaN');
  });

  it('CONTINUE arms after the tally and fires onContinue at most once under click spam', () => {
    buttons.length = 0;
    const s = makeScene();
    const onContinue = vi.fn();
    new DuelResult(s.scene, { victory: true, xp: 10, coins: 5, onContinue });
    expect(buttons).toHaveLength(0); // not armed until the rows have landed plus a beat
    s.fireTimers();
    expect(buttons).toHaveLength(1);
    expect(buttons[0].label).toBe('CONTINUE');
    buttons[0].onClick();
    buttons[0].onClick();
    buttons[0].onClick();
    expect(onContinue).toHaveBeenCalledTimes(1); // latched — restart can never double-fire
  });

  it('destroy() is silent and total: no onContinue, every object/tween/timer/button dead', () => {
    buttons.length = 0;
    const s = makeScene();
    const onContinue = vi.fn();
    const result = new DuelResult(s.scene, { victory: true, xp: 10, coins: 5, onContinue });
    s.fireTimers(); // button exists
    result.destroy();
    result.destroy(); // idempotent
    expect(onContinue).not.toHaveBeenCalled();
    for (const c of s.containers) expect(c.destroyed).toBe(true);
    for (const r of s.rects) expect(r.destroyed).toBe(true);
    expect(buttons[0].destroyed).toBe(true);
    for (const tw of [...s.tweens, ...s.counters]) expect(tw.removed).toBe(true);

    // destroy BEFORE the button timer fires: the stale timer must be inert (no zombie button)
    buttons.length = 0;
    const s3 = makeScene();
    const r3 = new DuelResult(s3.scene, { victory: false, xp: 0, coins: 0, onContinue });
    r3.destroy();
    s3.fireTimers(); // only fires timers destroy() did NOT remove — there must be none left
    expect(buttons).toHaveLength(0); // no zombie CONTINUE after teardown
    expect(onContinue).not.toHaveBeenCalled();
  });
});
