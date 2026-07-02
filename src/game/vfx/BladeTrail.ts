import Phaser from 'phaser';
import { Pt } from '../../core/vec';
import { buildDrawnStroke } from '../../core/DrawnStroke';
import { SLASH_ARC } from '../../config/fx';
import { ARC_VARIANTS, ArcVariant, FX_DEPTH } from '../../config/fx-extra';

/**
 * The slash arc (ART_DIRECTION §4, tell #4): a FAT tapered crescent along the drawn stroke —
 * a broad weapon-colored body under a lighter core, both pinched at the tips and widest
 * mid-stroke. The raw hand-path is resampled + smoothed first (never the jittery polyline).
 * Weapon variants: steel (default) / blue katana / red sabre, selectable via `setVariant`
 * or the constructor param. On release the arc HANGS at full alpha ~200ms, then fades.
 */
export class BladeTrail {
  private g: Phaser.GameObjects.Graphics;
  private raw: Pt[] = [];
  private alpha = 0;
  private hangLeft = 0;
  private fading = false;

  constructor(
    scene: Phaser.Scene,
    private variant: ArcVariant = 'steel',
  ) {
    this.g = scene.add.graphics();
    this.g.setDepth(FX_DEPTH.bladeTrail);
  }

  /** Swap the weapon color (steel default; blue katana / red sabre per §4). */
  setVariant(v: ArcVariant): void {
    this.variant = v;
  }

  begin(): void {
    this.raw = [];
    this.alpha = 1;
    this.hangLeft = 0;
    this.fading = false;
  }

  push(p: Pt): void {
    this.raw.push(p);
    this.redraw();
  }

  /** Stop drawing; the crescent hangs at full alpha for SLASH_ARC.hangMs, then fades. */
  end(): void {
    this.fading = true;
    this.hangLeft = SLASH_ARC.hangMs;
  }

  update(deltaMs: number): void {
    if (!this.fading || this.alpha <= 0) return;
    if (this.hangLeft > 0) {
      this.hangLeft -= deltaMs; // §4: the arc hangs ~200ms before fading
      return;
    }
    this.alpha = Math.max(0, this.alpha - deltaMs / SLASH_ARC.fadeMs);
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

  /**
   * Fill a tapered ribbon: half-width = maxHalf · taper(t). The taper is sin(πt) raised to
   * 1/taperPow — an exponent < 1 keeps the body FAT through the middle (the §4 crescent)
   * and pinches it sharply at both tips. `floor` keeps the core visible at the tips.
   */
  private ribbon(pts: Pt[], norms: Pt[], maxHalf: number, floor: number, color: number, alpha: number): void {
    const n = pts.length;
    const left: Phaser.Math.Vector2[] = [];
    const right: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      const taper = Math.max(floor, Math.sin(Math.PI * t) ** (1 / SLASH_ARC.taperPow));
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
    const arc = ARC_VARIANTS[this.variant];
    // weapon-colored body (under) — broad, pinched to zero at both tips (§4 fat crescent)
    this.ribbon(pts, norms, SLASH_ARC.bodyHalfWidth, 0, arc.body, this.alpha);
    // lighter core (over) — a continuous thread, kept just visible at the tips by the floor
    this.ribbon(pts, norms, SLASH_ARC.coreHalfWidth, SLASH_ARC.minTaper, arc.core, this.alpha);
  }
}
