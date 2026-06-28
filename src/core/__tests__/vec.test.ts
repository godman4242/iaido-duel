import { describe, it, expect } from 'vitest';
import { sub, add, scale, dot, len, dist } from '../vec';

describe('vec', () => {
  it('sub/add/scale', () => {
    expect(sub({ x: 5, y: 3 }, { x: 2, y: 1 })).toEqual({ x: 3, y: 2 });
    expect(add({ x: 1, y: 1 }, { x: 2, y: 3 })).toEqual({ x: 3, y: 4 });
    expect(scale({ x: 2, y: -3 }, 2)).toEqual({ x: 4, y: -6 });
  });
  it('dot/len/dist', () => {
    expect(dot({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(0);
    expect(len({ x: 3, y: 4 })).toBe(5);
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
