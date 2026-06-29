import { describe, it, expect } from 'vitest';
import { Combo, COMBO_WINDOW_MS } from '../combo';

describe('combo', () => {
  it('counts consecutive hits inside the window', () => {
    const c = new Combo();
    expect(c.hit(0)).toBe(1);
    expect(c.hit(400)).toBe(2);
    expect(c.hit(800)).toBe(3);
  });
  it('resets to 1 when the window lapses between hits', () => {
    const c = new Combo();
    c.hit(0);
    expect(c.hit(COMBO_WINDOW_MS + 1)).toBe(1);
  });
  it('value() decays to 0 after the window with no new hit', () => {
    const c = new Combo();
    c.hit(0);
    expect(c.value(500)).toBe(1);
    expect(c.value(COMBO_WINDOW_MS + 1)).toBe(0);
  });
  it('reset() clears the count', () => {
    const c = new Combo();
    c.hit(0);
    c.reset();
    expect(c.value(0)).toBe(0);
  });
});
