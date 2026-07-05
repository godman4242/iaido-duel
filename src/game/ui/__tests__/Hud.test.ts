import { describe, it, expect, vi } from 'vitest';

// Hud needs no Phaser runtime beyond Geom.Point (explore-mode XP shield); everything
// else it touches is scene-shaped and stubbed below (FinisherFlash.test.ts precedent).
vi.mock('phaser', () => ({
  default: {
    Geom: {
      Point: class {
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
import { Hud, type HudDuelView } from '../Hud';
import {
  SKILL_SLOTS,
  SKILL_SLOT_RECTS,
  HUD_CRIT_BAR,
  HUD_SHUNPO_BAR,
  STANCE_PORTRAIT_HIT,
  HUD_STANCE_COLORS,
  HUD_STANCE_MARK,
  HUD_INTERACT,
} from '../../../config/hud-extra';
import { HUD_COMBAT, HUD_EXPLORE, GAME_W, GAME_H } from '../../../config/layout';
import { FOCUS_MAX } from '../../../config/combat';
import { SKILL_VERB } from '../../../config/combat-sim';

// ————————————————————————————————————————————————— scene stubs —————

type GCall = { m: string; args: unknown[] };

/** Chainable Graphics stand-in that records every painted call. */
function recordingGraphics(log: GCall[]): unknown {
  const target: Record<string | symbol, unknown> = {};
  const proxy: Record<string | symbol, unknown> = new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      return (...args: unknown[]) => {
        log.push({ m: String(prop), args });
        return proxy;
      };
    },
    set(t, prop, v) {
      t[prop] = v;
      return true;
    },
  });
  return proxy;
}

class FakeText {
  x: number;
  y: number;
  str: string;
  width = 0;
  visible = true;
  destroyed = false;
  constructor(x: number, y: number, str: string) {
    this.x = x;
    this.y = y;
    this.str = str;
  }
  setOrigin(): this {
    return this;
  }
  setDepth(): this {
    return this;
  }
  setStroke(): this {
    return this;
  }
  setScale(): this {
    return this;
  }
  setVisible(v: boolean): this {
    this.visible = v;
    return this;
  }
  setText(t: string): this {
    this.str = t;
    return this;
  }
  destroy(): void {
    this.destroyed = true;
  }
}

class FakeZone {
  x: number;
  y: number;
  w: number;
  h: number;
  destroyed = false;
  interactive = false;
  origin: [number, number] | null = null;
  private handlers = new Map<string, Array<(...a: unknown[]) => void>>();
  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }
  setOrigin(ox: number, oy: number): this {
    this.origin = [ox, oy];
    return this;
  }
  setInteractive(): this {
    this.interactive = true;
    return this;
  }
  on(e: string, fn: (...a: unknown[]) => void): this {
    (this.handlers.get(e) ?? this.handlers.set(e, []).get(e)!).push(fn);
    return this;
  }
  emit(e: string, ...a: unknown[]): void {
    for (const fn of this.handlers.get(e) ?? []) fn(...a);
  }
  destroy(): void {
    this.destroyed = true;
  }
}

function makeScene() {
  const gcalls: GCall[] = [];
  const texts: FakeText[] = [];
  const zones: FakeZone[] = [];
  const tweens: unknown[] = [];
  const raw = {
    add: {
      graphics: () => recordingGraphics(gcalls),
      text: (x: number, y: number, str: string) => {
        const t = new FakeText(x, y, str);
        texts.push(t);
        return t;
      },
      zone: (x: number, y: number, w: number, h: number) => {
        const z = new FakeZone(x, y, w, h);
        zones.push(z);
        return z;
      },
    },
    tweens: {
      add: (cfg: unknown) => {
        tweens.push(cfg);
        return {};
      },
    },
    time: { now: 0 },
  };
  return { scene: raw as unknown as Phaser.Scene, raw, gcalls, texts, zones, tweens };
}

const near = (a: unknown, b: number): boolean => typeof a === 'number' && Math.abs(a - b) < 1e-9;

const zoneAt = (zones: FakeZone[], r: { x: number; y: number; w: number; h: number }): FakeZone => {
  const z = zones.find((z) => z.x === r.x && z.y === r.y && z.w === r.w && z.h === r.h);
  expect(z, `zone at ${r.x},${r.y}`).toBeDefined();
  return z!;
};

/** fillRect widths painted at (x, y) — bar anatomy paints back then fill at the same origin. */
const fillWidthsAt = (log: GCall[], x: number, y: number): number[] =>
  log
    .filter((c) => c.m === 'fillRect' && near(c.args[0], x) && near(c.args[1], y))
    .map((c) => c.args[2] as number);

const baseView = (over: Partial<HudDuelView> = {}): HudDuelView => ({
  hp: 100,
  hpMax: 100,
  focus: 50,
  critical: 40,
  critReady: false,
  shunpo: 25,
  shunpoActive: false,
  stance: 'balanced',
  stanceLocked: false,
  combo: 0,
  ...over,
});

// ————————————————————————————————————————————————— config coherence —————

describe('combat HUD config (hud-extra M2 keys)', () => {
  it('SKILL_SLOTS is the single mapping source and stays aligned with the sim SKILL_VERB map', () => {
    expect(SKILL_SLOTS.length).toBe(HUD_COMBAT.skillSlots.count);
    expect(SKILL_SLOT_RECTS.length).toBe(SKILL_SLOTS.length);
    SKILL_SLOTS.forEach((s, i) => {
      const slot = (i + 1) as 1 | 2 | 3;
      expect(s.id).toBe(SKILL_VERB[slot]); // press N → the sim verb the contract maps
      expect(s.key).toBe(String(slot)); // key hint matches the slot number
    });
  });

  it('all interactive geometry is finite and on-stage (chaos: no NaN/off-screen rects)', () => {
    const rects = [...SKILL_SLOT_RECTS, HUD_CRIT_BAR, HUD_SHUNPO_BAR, STANCE_PORTRAIT_HIT];
    for (const r of rects) {
      for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isFinite(v)).toBe(true);
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(GAME_W);
      expect(r.y + r.h).toBeLessThanOrEqual(GAME_H);
    }
  });

  it('every stance id carries a portrait color', () => {
    for (const s of ['light', 'balanced', 'heavy'] as const)
      expect(Number.isFinite(HUD_STANCE_COLORS[s])).toBe(true);
  });
});

// ————————————————————————————————————————————————— skill bar —————

describe('skill bar (blueprint §3.8 — numbered slots, click or 1/2/3)', () => {
  it('renders 3 numbered slots with key hints from SKILL_SLOTS', () => {
    const { scene, texts } = makeScene();
    new Hud(scene).update();
    const strs = texts.map((t) => t.str);
    for (const s of SKILL_SLOTS) expect(strs).toContain(s.key);
  });

  it('clicking each slot zone fires the callback with the config-mapped skill id', () => {
    const { scene, zones } = makeScene();
    const hud = new Hud(scene);
    hud.setInteractiveEnabled(true); // combat is live (FIGHT! landed) — zones are hot
    hud.update();
    const fired: Array<[string, number]> = [];
    hud.onSkillSlot((id, slot) => fired.push([id, slot]));
    SKILL_SLOT_RECTS.forEach((r) => {
      const stop = vi.fn();
      zoneAt(zones, r).emit('pointerdown', null, 0, 0, { stopPropagation: stop });
      expect(stop).toHaveBeenCalledTimes(1); // HUD click must not leak into a slash stroke
    });
    expect(fired).toEqual([
      ['chiPunch', 1],
      ['smokeBomb', 2],
      ['stab', 3],
    ]);
  });

  it('fireSkillSlot(n) is the shared key-handler path: returns the id and fires the callback', () => {
    const { scene } = makeScene();
    const hud = new Hud(scene);
    const fired: string[] = [];
    hud.onSkillSlot((id) => fired.push(id));
    expect(hud.fireSkillSlot(1)).toBe('chiPunch'); // the Tell 12 measure hook: press 1 → Chi Punch
    expect(hud.fireSkillSlot(2)).toBe('smokeBomb');
    expect(hud.fireSkillSlot(3)).toBe('stab');
    expect(fired).toEqual(['chiPunch', 'smokeBomb', 'stab']);
  });

  it('CHAOS: hostile slot numbers return null, never throw, never fire', () => {
    const { scene } = makeScene();
    const hud = new Hud(scene);
    const cb = vi.fn();
    hud.onSkillSlot(cb);
    for (const bad of [0, -1, 4, 99, 1.5, NaN, Infinity, -Infinity])
      expect(hud.fireSkillSlot(bad)).toBeNull();
    expect(cb).not.toHaveBeenCalled();
  });

  it('CHAOS: firing with no callback registered is a safe no-op that still returns the id', () => {
    const { scene } = makeScene();
    const hud = new Hud(scene);
    expect(hud.fireSkillSlot(1)).toBe('chiPunch');
    expect(() => hud.update()).not.toThrow();
  });

  it('CHAOS: 1000 spam-clicks on slot 1 fire 1000 times without throwing or corrupting state', () => {
    const { scene, zones } = makeScene();
    const hud = new Hud(scene);
    hud.setInteractiveEnabled(true);
    hud.update();
    const cb = vi.fn();
    hud.onSkillSlot(cb);
    const z = zoneAt(zones, SKILL_SLOT_RECTS[0]);
    for (let i = 0; i < 1000; i++) z.emit('pointerdown', null, 0, 0, undefined);
    expect(cb).toHaveBeenCalledTimes(1000);
    expect(() => hud.update()).not.toThrow();
  });

  it('cooldown wipe and disabled dim render from the passed-in skill views', () => {
    const { scene, gcalls } = makeScene();
    const hud = new Hud(scene);
    hud.setDuelSource(() =>
      baseView({
        skills: [
          { enabled: true, cooldownFrac: 0.5 },
          { enabled: false, cooldownFrac: 0 },
          { enabled: true, cooldownFrac: 0 },
        ],
      }),
    );
    gcalls.length = 0;
    hud.update();
    const r0 = SKILL_SLOT_RECTS[0];
    const r1 = SKILL_SLOT_RECTS[1];
    const pad = 2; // HUD_BARS.pad
    // slot 1: top-down wipe at half the inner height
    expect(fillWidthsAt(gcalls, r0.x + pad, r0.y + pad)).toContainEqual(r0.w - pad * 2);
    const wipe = gcalls.find(
      (c) =>
        c.m === 'fillRect' &&
        near(c.args[0], r0.x + pad) &&
        near(c.args[1], r0.y + pad) &&
        near(c.args[3], (r0.h - pad * 2) * 0.5),
    );
    expect(wipe).toBeDefined();
    // slot 2: full-size disabled overlay
    const dim = gcalls.find(
      (c) =>
        c.m === 'fillRect' &&
        near(c.args[0], r1.x + pad) &&
        near(c.args[1], r1.y + pad) &&
        near(c.args[3], r1.h - pad * 2),
    );
    expect(dim).toBeDefined();
  });
});

// ————————————————————————————————————————————————— stance portrait —————

describe('stance portrait (Tell 8/23* — click-to-swap, reflects current stance)', () => {
  it('the portrait zone matches STANCE_PORTRAIT_HIT and clicking it requests a stance swap', () => {
    const { scene, zones } = makeScene();
    const hud = new Hud(scene);
    hud.setInteractiveEnabled(true);
    hud.update();
    const cb = vi.fn();
    hud.onStanceSwap(cb);
    zoneAt(zones, STANCE_PORTRAIT_HIT).emit('pointerdown', null, 0, 0, undefined);
    expect(cb).toHaveBeenCalledTimes(1);
    hud.requestStanceSwap(); // the Space-key path shares the same seam
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('clicks are gated to combat mode (explore-mode HUD must not emit duel intents)', () => {
    const { scene, zones } = makeScene();
    const hud = new Hud(scene);
    hud.setMode('explore');
    hud.update();
    const cb = vi.fn();
    const skill = vi.fn();
    hud.onStanceSwap(cb);
    hud.onSkillSlot(skill);
    const stop = vi.fn();
    zoneAt(zones, STANCE_PORTRAIT_HIT).emit('pointerdown', null, 0, 0, { stopPropagation: stop });
    zoneAt(zones, SKILL_SLOT_RECTS[0]).emit('pointerdown', null, 0, 0, { stopPropagation: stop });
    expect(cb).not.toHaveBeenCalled();
    expect(skill).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it('CHAOS: portrait click with no callback registered never throws', () => {
    const { scene, zones } = makeScene();
    const hud = new Hud(scene);
    hud.setInteractiveEnabled(true);
    hud.update();
    expect(() =>
      zoneAt(zones, STANCE_PORTRAIT_HIT).emit('pointerdown', null, 0, 0, undefined),
    ).not.toThrow();
  });

  it('REGRESSION: while DISARMED (DuelIntro up) a zone click neither fires nor stopPropagations — the intro-skip click falls through', () => {
    // Repro of the finding: Hud boots in combat mode BEFORE FIGHT!, so its zones used to
    // cancel pointerdown via stopPropagation and the scene-level intro fast-forward never
    // saw clicks landing on the (invisible, overlay-covered) portrait/skill rects.
    const { scene, zones } = makeScene();
    const hud = new Hud(scene); // default: interactive DISARMED until startCombat()
    hud.update();
    const swap = vi.fn();
    const skill = vi.fn();
    hud.onStanceSwap(swap);
    hud.onSkillSlot(skill);
    const stop = vi.fn();
    zoneAt(zones, STANCE_PORTRAIT_HIT).emit('pointerdown', null, 0, 0, { stopPropagation: stop });
    for (const r of SKILL_SLOT_RECTS)
      zoneAt(zones, r).emit('pointerdown', null, 0, 0, { stopPropagation: stop });
    expect(stop).not.toHaveBeenCalled(); // the click reaches the scene → intro.skip() works
    expect(swap).not.toHaveBeenCalled();
    expect(skill).not.toHaveBeenCalled();

    // FIGHT! lands → zones arm: clicks now fire AND are consumed (no stray slash strokes)
    hud.setInteractiveEnabled(true);
    zoneAt(zones, STANCE_PORTRAIT_HIT).emit('pointerdown', null, 0, 0, { stopPropagation: stop });
    expect(swap).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);

    // kill beat → disarmed again: a dead HUD must not swallow result-screen clicks
    hud.setInteractiveEnabled(false);
    zoneAt(zones, STANCE_PORTRAIT_HIT).emit('pointerdown', null, 0, 0, { stopPropagation: stop });
    expect(swap).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('the portrait rim retints when the polled stance changes (dirty-chrome redraw)', () => {
    const { scene, gcalls } = makeScene();
    const hud = new Hud(scene);
    let stance = 'light';
    hud.setDuelSource(() => baseView({ stance }));
    hud.update();
    const rimTriples = (log: GCall[]): unknown[][] =>
      log
        .filter(
          (c) =>
            c.m === 'lineStyle' &&
            near(c.args[0], HUD_STANCE_MARK.rimW) &&
            near(c.args[2], HUD_STANCE_MARK.rimAlpha),
        )
        .map((c) => c.args);
    expect(rimTriples(gcalls).some((a) => a[1] === HUD_STANCE_COLORS.light)).toBe(true);
    stance = 'heavy';
    gcalls.length = 0;
    hud.update(); // stance change must mark the chrome dirty and repaint the rim
    expect(rimTriples(gcalls).some((a) => a[1] === HUD_STANCE_COLORS.heavy)).toBe(true);
  });
});

// ————————————————————————————————————————————————— meters —————

describe('Focus + Critical + Shunpo bars (Tell 7/16 — polled sim state)', () => {
  it('bar fills track the duel snapshot fractions at the config geometry', () => {
    const { scene, gcalls } = makeScene();
    const hud = new Hud(scene);
    hud.setDuelSource(() => baseView()); // focus 50/100, critical 40/100, shunpo 25/100
    gcalls.length = 0;
    hud.update();
    const bars = HUD_EXPLORE.bars;
    // Focus (chi) bar: 50/FOCUS_MAX
    expect(fillWidthsAt(gcalls, bars.x, bars.y + bars.h + bars.gap)).toContainEqual(
      bars.w * (50 / FOCUS_MAX),
    );
    // Critical bar: 40/100 at HUD_CRIT_BAR
    const critW = fillWidthsAt(gcalls, HUD_CRIT_BAR.x, HUD_CRIT_BAR.y);
    expect(critW.some((w) => near(w, HUD_CRIT_BAR.w * 0.4))).toBe(true);
    // Shunpo strip: 25/100 at HUD_SHUNPO_BAR
    const shW = fillWidthsAt(gcalls, HUD_SHUNPO_BAR.x, HUD_SHUNPO_BAR.y);
    expect(shW.some((w) => near(w, HUD_SHUNPO_BAR.w * 0.25))).toBe(true);
  });

  it('crit-ready renders the glow ring; stanceLocked shows the red status caps', () => {
    const { scene, gcalls, texts } = makeScene();
    const hud = new Hud(scene);
    hud.setDuelSource(() => baseView({ critical: 100, critReady: true, stanceLocked: true }));
    gcalls.length = 0;
    hud.update();
    const glow = gcalls.find(
      (c) => c.m === 'strokeRect' && near(c.args[0], HUD_CRIT_BAR.x - HUD_CRIT_BAR.glowPad),
    );
    expect(glow).toBeDefined();
    const status = texts.find((t) => t.str === 'CANNOT CHANGE STANCE');
    expect(status?.visible).toBe(true);
  });

  it('combat meters are hidden in explore mode (no crit/shunpo paint, label invisible)', () => {
    const { scene, gcalls, texts } = makeScene();
    const hud = new Hud(scene);
    hud.setMode('explore');
    gcalls.length = 0;
    hud.update();
    expect(fillWidthsAt(gcalls, HUD_CRIT_BAR.x, HUD_CRIT_BAR.y)).toEqual([]);
    const label = texts.find((t) => t.str === 'CRITICAL');
    expect(label?.visible).toBe(false);
  });

  it('CHAOS: a fully poisoned snapshot (NaN/±Infinity/negatives/wrong types) never throws and every painted number stays finite', () => {
    const { scene, gcalls } = makeScene();
    const hud = new Hud(scene);
    hud.setDuelSource(() => ({
      hp: NaN,
      hpMax: Infinity,
      focus: -5,
      critical: Number.POSITIVE_INFINITY,
      critReady: true,
      shunpo: NaN,
      shunpoActive: 1 as unknown as boolean,
      stance: undefined as unknown as string,
      stanceLocked: 'yes' as unknown as boolean,
      combo: NaN,
      skills: [
        { enabled: false, cooldownFrac: NaN },
        { enabled: true, cooldownFrac: Infinity },
        { enabled: true, cooldownFrac: -3 },
      ],
    }));
    gcalls.length = 0;
    expect(() => hud.update()).not.toThrow();
    expect(() => hud.update()).not.toThrow(); // second frame: dirty path settled
    const bad = gcalls.filter((c) =>
      c.args.some((a) => typeof a === 'number' && !Number.isFinite(a)),
    );
    expect(bad).toEqual([]);
  });

  it('CHAOS: a NaN scene clock cannot poison press flashes or the ready pulse', () => {
    const { scene, raw, gcalls } = makeScene();
    const hud = new Hud(scene);
    (raw.time as { now: number }).now = NaN;
    hud.setDuelSource(() => baseView({ critical: 100, critReady: true }));
    hud.fireSkillSlot(1);
    hud.requestStanceSwap();
    gcalls.length = 0;
    expect(() => hud.update()).not.toThrow();
    const bad = gcalls.filter((c) =>
      c.args.some((a) => typeof a === 'number' && !Number.isFinite(a)),
    );
    expect(bad).toEqual([]);
  });
});

// ————————————————————————————————————————————————— lifecycle —————

describe('lifecycle', () => {
  it('press feedback ring appears after fireSkillSlot within the flash window', () => {
    const { scene, gcalls } = makeScene();
    const hud = new Hud(scene);
    hud.update();
    hud.fireSkillSlot(1); // t=0, flash until pressFlashMs
    gcalls.length = 0;
    hud.update();
    const r = SKILL_SLOT_RECTS[0];
    const ring = gcalls.find(
      (c) =>
        c.m === 'strokeRoundedRect' &&
        near(c.args[0], r.x - HUD_INTERACT.ringPad) &&
        near(c.args[1], r.y - HUD_INTERACT.ringPad),
    );
    expect(ring).toBeDefined();
  });

  it('destroy() tears down zones and texts; callbacks are released', () => {
    const { scene, zones, texts } = makeScene();
    const hud = new Hud(scene);
    hud.update();
    hud.onStanceSwap(vi.fn());
    hud.destroy();
    expect(zones.length).toBe(SKILL_SLOTS.length + 1); // portrait + 3 slots, nothing extra
    for (const z of zones) expect(z.destroyed).toBe(true);
    for (const t of texts) expect(t.destroyed).toBe(true);
  });
});
