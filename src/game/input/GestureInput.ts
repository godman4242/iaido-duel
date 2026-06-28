import Phaser from 'phaser';
import { Pt } from '../../core/vec';
import { classifyGesture, Gesture } from '../../core/gesture';

export type GestureCallbacks = {
  onStart: (p: Pt) => void;
  onMove: (p: Pt) => void;
  onEnd: (path: Pt[], gesture: Gesture) => void;
};

/** Captures the pointer-drawn polyline and classifies it into a combat gesture. */
export class GestureInput {
  lastLatencyMs = 0;
  private path: Pt[] = [];
  private drawing = false;

  constructor(scene: Phaser.Scene, cb: GestureCallbacks) {
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const t0 = performance.now();
      this.drawing = true;
      this.path = [{ x: p.x, y: p.y }];
      cb.onStart({ x: p.x, y: p.y });
      this.lastLatencyMs = performance.now() - t0;
    });

    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drawing) return;
      const last = this.path[this.path.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 4) return; // throttle by distance
      const pt = { x: p.x, y: p.y };
      this.path.push(pt);
      cb.onMove(pt);
    });

    scene.input.on('pointerup', () => {
      if (!this.drawing) return;
      this.drawing = false;
      cb.onEnd(this.path, classifyGesture(this.path));
    });
  }
}
