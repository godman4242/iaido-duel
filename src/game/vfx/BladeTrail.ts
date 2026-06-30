import Phaser from 'phaser';
import { Pt } from '../../core/vec';
import { buildDrawnStroke } from '../../core/DrawnStroke';
import { COL } from '../../palette';
import { BLADE_CORE_WIDTH, BLADE_EDGE_WIDTH, BLADE_FADE_MS, BLADE_MIN_TAPER } from '../../config/combat';

/**
 * The blade trail (spec §D.1, Tells 1 & 2): the raw hand-path is resampled + smoothed into a clean
 * swept curve (NEVER the jittery raw polyline — that reads as MS-Paint), then rendered as a
 * TWO-LAYER TAPERED RIBBON — a wide blade-colored edge under a bright white core, both pinched to
 * zero at the tips and widest mid-stroke, with the newest point as the leading tip the blade chases.
 */
export class BladeTrail {
  private g: Phaser.GameObjects.Graphics;
  private raw: Pt[] = [];
  private alpha = 0;
  private fading = false;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics();
    this.g.setDepth(50);
  }

  begin(): void {
    this.raw = [];
    this.alpha = 1;
    this.fading = false;
  }

  push(p: Pt): void {
    this.raw.push(p);
    this.redraw();
  }

  /** Stop drawing; the streak now fades out as an afterimage arc. */
  end(): void {
    this.fading = true;
  }

  update(deltaMs: number): void {
    if (!this.fading || this.alpha <= 0) return;
    this.alpha = Math.max(0, this.alpha - deltaMs / BLADE_FADE_MS);
    this.redraw();
  }

  /** Unit normals along the smoothed polyline (perpendicular to the local tangent). */
  private normals(pts: Pt[]): Pt[] {
    const n = pts.length;
    const out: Pt[] = [];
    let last: Pt = { x: 0, y: -1 };
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      const tx = b.x - a.x;
      const ty = b.y - a.y;
      const len = Math.hypot(tx, ty);
      if (len > 0) last = { x: -ty / len, y: tx / len };
      out.push(last);
    }
    return out;
  }

  /** Fill a tapered ribbon: half-width = maxHalf · taper(t), taper(t)=sin(πt) pinched at both tips. */
  private ribbon(pts: Pt[], norms: Pt[], maxHalf: number, floor: number, color: number, alpha: number): void {
    const n = pts.length;
    const left: Phaser.Math.Vector2[] = [];
    const right: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      const taper = Math.max(floor, Math.sin(Math.PI * t));
      const hw = maxHalf * taper;
      const nx = norms[i].x * hw;
      const ny = norms[i].y * hw;
      left.push(new Phaser.Math.Vector2(pts[i].x + nx, pts[i].y + ny));
      right.push(new Phaser.Math.Vector2(pts[i].x - nx, pts[i].y - ny));
    }
    const poly = left.concat(right.reverse());
    this.g.fillStyle(color, alpha);
    this.g.fillPoints(poly, true);
  }

  private redraw(): void {
    this.g.clear();
    if (this.alpha <= 0) return;
    const pts = buildDrawnStroke(this.raw).points;
    if (pts.length < 2) return;
    const norms = this.normals(pts);
    // colored edge (under) — chi-blue, pinched to zero at both tips (reference reads as a blue ribbon)
    this.ribbon(pts, norms, BLADE_EDGE_WIDTH, 0, COL.bladeChi, this.alpha);
    // bright white core (over) — a continuous thread, kept just visible at the tips by the taper floor
    this.ribbon(pts, norms, BLADE_CORE_WIDTH, BLADE_MIN_TAPER, COL.bladeEdge, this.alpha);
  }
}
