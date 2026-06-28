import { describe, it, expect } from 'vitest';
import { classifyGesture } from '../gesture';

const P = (a: [number, number][]) => a.map(([x, y]) => ({ x, y }));

describe('classifyGesture', () => {
  it('horizontal => slash', () => expect(classifyGesture(P([[0, 0], [200, 10]]))).toBe('slash'));
  it('small up => jump', () => expect(classifyGesture(P([[0, 0], [5, -80]]))).toBe('jump'));
  it('big fast up => launch', () => expect(classifyGesture(P([[0, 0], [5, -220]]))).toBe('launch'));
  it('down => stab', () => expect(classifyGesture(P([[0, 0], [5, 200]]))).toBe('stab'));
});
