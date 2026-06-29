import Phaser from 'phaser';
import { Pt } from '../../core/vec';
import { COL } from '../../palette';

/** Renders the drawn slash path as a tapered crimson streak with a white edge gleam, then fades. */
export class BladeTrail {
  private g: Phaser.GameObjects.Graphics;
  private pts: Pt[] = [];
  private alpha = 0;
  private fading = false;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics();
    this.g.setDepth(50);
  }

  begin(): void {
    this.pts = [];
    this.alpha = 1;
    this.fading = false;
  }

  push(p: Pt): void {
    this.pts.push(p);
    this.redraw();
  }

  /** Stop drawing; the streak now fades out. */
  end(): void {
    this.fading = true;
  }

  update(deltaMs: number): void {
    if (!this.fading || this.alpha <= 0) return;
    this.alpha = Math.max(0, this.alpha - deltaMs / 200);
    this.redraw();
  }

  private redraw(): void {
    const g = this.g;
    g.clear();
    if (this.pts.length < 2 || this.alpha <= 0) return;
    const n = this.pts.length;
    // tapered crimson body: thin at the tail, thick at the leading edge
    for (let i = 1; i < n; i++) {
      const t = i / (n - 1);
      const w = 2 + 11 * t;
      g.lineStyle(w, COL.blood, this.alpha);
      g.beginPath();
      g.moveTo(this.pts[i - 1].x, this.pts[i - 1].y);
      g.lineTo(this.pts[i].x, this.pts[i].y);
      g.strokePath();
    }
    // white edge gleam along the whole stroke
    g.lineStyle(2, COL.bladeEdge, this.alpha * 0.9);
    g.strokePoints(
      this.pts.map((p) => new Phaser.Math.Vector2(p.x, p.y)),
      false,
    );
  }
}
