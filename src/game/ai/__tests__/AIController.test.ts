// AIController is now ONLY the render half of the AI (M2 port): a telegraph-caret /
// guard-pose painter reading the ronin's sim state. These tests drive it with a fake
// scene/graphics (phaser is types-only in the module) and chaos-poisoned views.
import { describe, it, expect } from 'vitest';
import type Phaser from 'phaser';
import { AIController, type TelegraphView } from '../AIController';
import type { GuardLevel } from '../../fighter/FighterAnimator';

class FakeGraphics {
  depth = 0;
  destroyed = false;
  cleared = 0;
  fillPaths = 0;
  fillStyles: Array<{ color: number; alpha: number }> = [];
  setDepth(d: number): this {
    this.depth = d;
    return this;
  }
  clear(): this {
    this.cleared++;
    return this;
  }
  fillStyle(color: number, alpha: number): this {
    this.fillStyles.push({ color, alpha });
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
  closePath(): this {
    return this;
  }
  fillPath(): this {
    this.fillPaths++;
    return this;
  }
  destroy(): void {
    this.destroyed = true;
  }
}

function make() {
  const gfx = new FakeGraphics();
  const scene = { add: { graphics: () => gfx } } as unknown as Phaser.Scene;
  const guards: GuardLevel[] = [];
  const puppet = { setGuard: (g: GuardLevel) => guards.push(g) };
  const painter = new AIController(scene, puppet);
  return { gfx, guards, painter };
}

const view = (over: Partial<TelegraphView> = {}): TelegraphView => ({
  x: 600,
  y: 480,
  windupMs: 0,
  pendingSmokeMs: 0,
  pendingStanceMs: 0,
  blocking: false,
  ...over,
});

describe('game/ai AIController — telegraph/pose painter (reads sim state, decides nothing)', () => {
  it('draws the caret while a strike windup is held and clears it when idle (Tell 13)', () => {
    const { gfx, guards, painter } = make();
    painter.update(view({ windupMs: 520 }), 16);
    expect(guards[guards.length - 1]).toBe('telegraph');
    expect(gfx.fillPaths).toBe(1);
    painter.update(view(), 16);
    expect(guards[guards.length - 1]).toBe('none');
    expect(gfx.fillPaths).toBe(1); // cleared, nothing new drawn
    expect(gfx.cleared).toBe(2); // clear() runs every update
  });

  it('a pending smoke-bomb telegraph also shows the caret; block pose wins over telegraph', () => {
    const { gfx, guards, painter } = make();
    painter.update(view({ pendingSmokeMs: 520 }), 16);
    expect(guards[guards.length - 1]).toBe('telegraph');
    expect(gfx.fillPaths).toBe(1);
    painter.update(view({ windupMs: 300, blocking: true }), 16);
    expect(guards[guards.length - 1]).toBe('block');
  });

  it('REGRESSION (§3.9): a pending stance-flash telegraph paints the caret like any commit', () => {
    // Before the fix, an AI stance switch applied instantly and NOTHING consumed the
    // stanceFlash telegraph — the build showed no readable tell for it (finding §3.9).
    const { gfx, guards, painter } = make();
    painter.update(view({ pendingStanceMs: 520 }), 16);
    expect(guards[guards.length - 1]).toBe('telegraph');
    expect(gfx.fillPaths).toBe(1);
    painter.update(view(), 16);
    expect(guards[guards.length - 1]).toBe('none'); // clears when the switch lands
  });

  it('chaos: non-finite position suppresses the caret instead of painting NaN geometry', () => {
    const { gfx, painter } = make();
    painter.update(view({ windupMs: 400, x: Number.NaN }), 16);
    painter.update(view({ windupMs: 400, y: Number.POSITIVE_INFINITY }), 16);
    expect(gfx.fillPaths).toBe(0);
  });

  it('chaos: NaN/negative delta never poisons the pulse alpha (stays finite in 0..1)', () => {
    const { gfx, painter } = make();
    painter.update(view({ windupMs: 400 }), Number.NaN);
    painter.update(view({ windupMs: 400 }), -50);
    painter.update(view({ windupMs: 400 }), Number.POSITIVE_INFINITY);
    expect(gfx.fillStyles.length).toBeGreaterThan(0);
    for (const s of gfx.fillStyles) {
      expect(Number.isFinite(s.alpha)).toBe(true);
      expect(s.alpha).toBeGreaterThanOrEqual(0);
      expect(s.alpha).toBeLessThanOrEqual(1);
    }
  });

  it('chaos: negative windup reads as idle (no caret, guard none)', () => {
    const { gfx, guards, painter } = make();
    painter.update(view({ windupMs: -1 }), 16);
    expect(guards[guards.length - 1]).toBe('none');
    expect(gfx.fillPaths).toBe(0);
  });

  it('destroy() frees the caret graphics', () => {
    const { gfx, painter } = make();
    painter.destroy();
    expect(gfx.destroyed).toBe(true);
  });
});
