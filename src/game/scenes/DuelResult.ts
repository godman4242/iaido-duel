// src/game/scenes/DuelResult.ts — M2 §3.13 duel framing (Tell 25), the post-duel tally:
// full-screen ink dim (swallows stray clicks) + centered §7 mottled panel (gold frame,
// corner flourishes, kasa-silhouette accent) + VICTORY/DEFEAT brush title + YOU RECEIVED
// count-up rows (XP + coins) + red CONTINUE action button. The XP/coin VALUES are computed
// by the caller (KILL_REWARD economy math lands in M3) — this screen is display only.
// Zero gameplay literals: config/scenes-extra.ts DUEL_RESULT owns every number.
//
// The integrator mounts one after the KillBeat anatomy has played (or standalone):
//
//   this.result = new DuelResult(this, {
//     victory: winner === 'player',
//     xp: KILL_REWARD.xpPerFoeLevel * foeLevel,        // caller's math, any source
//     coins: KILL_REWARD.coinsPerFoeLevel * foeLevel,
//     onContinue: () => this.restart(),                 // CONTINUE click, fired once
//   });
//   // R-restart while showing: result.destroy() (silent — fires no callbacks).
//
// Hostile-input hardened: NaN/±Infinity/negative/fractional xp/coins render as safe
// integers (0 for non-finite) instead of NaN-ing the tally. Restart-safe: destroy()
// removes every tween, timer and display object it created.
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config/layout';
import { COL } from '../../config/palette';
import { FONT_DISPLAY, FONT_BODY, TEXT_OUTLINE } from '../../config/typography';
import { GOLD_FRAME, cssHex } from '../../config/chrome-extra';
import { DUEL_RESULT as DR } from '../../config/scenes-extra';
import { paintMottled, paintSilhouette } from '../chrome/mottle';
import { actionButton, ChromeHandle } from '../chrome/Panel';

const HALF = 1 / 2;
type G = Phaser.GameObjects.Graphics;

export interface DuelResultOpts {
  victory: boolean;
  /** Earned XP to display (caller-computed; sanitized to a finite non-negative int). */
  xp: number;
  /** Earned coins to display (caller-computed; sanitized like xp). */
  coins: number;
  /** CONTINUE click — fired at most once. The caller decides what follows (restart/town). */
  onContinue?: () => void;
  /** Override DUEL_RESULT.depth (defaults above kill layers, below letterbox bars). */
  depth?: number;
}

/** Non-finite → 0; otherwise clamped to a non-negative rounded integer (display safety). */
function safeAmount(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
}

/**
 * Victory/Defeat tally screen. Construct to show; `destroy()` removes it silently.
 */
export class DuelResult {
  private scene: Phaser.Scene;
  private opts: DuelResultOpts;
  private depth: number;
  private objects: { destroy: () => void }[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];
  private tweens: Phaser.Tweens.Tween[] = [];
  private btn?: ChromeHandle;
  private firedContinue = false;
  private destroyed = false;

  constructor(scene: Phaser.Scene, opts: DuelResultOpts) {
    this.scene = scene;
    this.opts = opts;
    this.depth = opts.depth ?? DR.depth;
    this.build();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const t of this.timers) t.remove(false);
    this.timers = [];
    for (const tw of this.tweens) tw.remove();
    this.tweens = [];
    this.btn?.destroy();
    this.btn = undefined;
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }

  private build(): void {
    const cx = GAME_W * HALF;
    const cy = GAME_H * HALF;
    const p = DR.panel;

    // Full-screen ink dim; interactive so stray clicks never reach the arena/HUD below.
    const dim = this.scene.add
      .rectangle(cx, cy, GAME_W, GAME_H, COL.vignetteBlack, DR.dimAlpha)
      .setDepth(this.depth)
      .setInteractive();
    this.objects.push(dim);

    // Centered mottled panel (pops in); everything inside is container-relative.
    const c = this.scene.add.container(cx, cy).setDepth(this.depth + 1);
    this.objects.push(c);
    const g = this.scene.add.graphics();
    const x = -p.w * HALF;
    const y = -p.h * HALF;
    paintMottled(g, x, y, p.w, p.h);
    const sil = DR.silhouette;
    paintSilhouette(g, x + sil.xFrac * p.w, y + sil.yFrac * p.h, sil.wFrac * p.w, sil.hFrac * p.h, sil.alpha);
    this.goldRect(g, x, y, p.w, p.h);
    c.add(g);

    // VICTORY / DEFEAT brush title (per-letter jitter, §8).
    const t = DR.title;
    c.add(
      this.brushWord(
        this.opts.victory ? 'VICTORY' : 'DEFEAT',
        y + DR.titleOffsetY,
        this.opts.victory ? t.winFill : t.loseFill,
        this.opts.victory ? t.winStroke : t.loseStroke,
      ),
    );

    // Small YOU RECEIVED caps over the tally (§7 modal wording).
    const header = this.scene.add
      .text(0, y + DR.headerOffsetY, 'YOU RECEIVED', {
        fontFamily: FONT_BODY,
        fontSize: `${DR.headerSize}px`,
        color: cssHex(COL.chromeCream),
        stroke: cssHex(COL.vignetteBlack),
        strokeThickness: TEXT_OUTLINE.body,
      })
      .setOrigin(HALF);
    c.add(header);

    // Tally rows: icon + label left, count-up value right.
    const rows: { label: string; value: number; icon: 'xp' | 'coin' }[] = [
      { label: 'XP', value: safeAmount(this.opts.xp), icon: 'xp' },
      { label: 'COINS', value: safeAmount(this.opts.coins), icon: 'coin' },
    ];
    rows.forEach((row, i) => {
      const rowY = y + DR.rowsOffsetY + i * DR.tallyRowGap;
      const delay = p.popMs + i * DR.row.staggerMs;
      c.add(this.tallyRow(rowY, row.label, row.value, row.icon, delay));
    });

    // Pop the panel in.
    c.setScale(p.popFromScale).setAlpha(0);
    this.tween({ targets: c, scale: 1, alpha: 1, duration: p.popMs, ease: 'Back.easeOut' });

    // CONTINUE arms after the rows have landed plus a beat.
    const rowsDone = p.popMs + (rows.length - 1) * DR.row.staggerMs + DR.countMs;
    this.after(rowsDone + DR.holdMs, () => {
      this.btn = actionButton(
        this.scene,
        cx,
        cy + p.h * HALF - DR.btn.marginBottom - DR.btn.h * HALF,
        DR.btn.w,
        DR.btn.h,
        'CONTINUE',
        () => this.fireContinue(),
        this.depth + 2,
      );
    });
  }

  /** One tally row (container-relative): icon disc/diamond, cream label, gold count-up value. */
  private tallyRow(
    rowY: number,
    label: string,
    value: number,
    icon: 'xp' | 'coin',
    delay: number,
  ): Phaser.GameObjects.Container {
    const r = DR.row;
    const row = this.scene.add.container(0, rowY).setAlpha(0);
    const left = -r.w * HALF;

    const g = this.scene.add.graphics();
    if (icon === 'coin') {
      // Gold coin disc with a darker rim (§4 loot coin recipe).
      g.fillStyle(COL.coinGold, 1);
      g.fillCircle(left, 0, r.iconR);
      g.lineStyle(GOLD_FRAME.outerW, COL.obiShade, 1);
      g.strokeCircle(left, 0, r.iconR);
    } else {
      // Gold XP diamond (echoes the §5 level-badge shield role).
      g.fillStyle(COL.gold, 1);
      g.beginPath();
      g.moveTo(left, -r.iconR);
      g.lineTo(left + r.iconR, 0);
      g.lineTo(left, r.iconR);
      g.lineTo(left - r.iconR, 0);
      g.closePath();
      g.fillPath();
      g.lineStyle(GOLD_FRAME.outerW, COL.obiShade, 1);
      g.strokePath();
    }
    row.add(g);

    const labelText = this.scene.add
      .text(left + r.iconGapX, 0, label, {
        fontFamily: FONT_BODY,
        fontSize: `${r.labelSize}px`,
        color: cssHex(COL.chromeCream),
        stroke: cssHex(COL.vignetteBlack),
        strokeThickness: TEXT_OUTLINE.body,
      })
      .setOrigin(0, HALF);
    row.add(labelText);

    const valueText = this.scene.add
      .text(r.w * HALF, 0, `+${0}`, {
        fontFamily: FONT_DISPLAY,
        fontStyle: 'bold',
        fontSize: `${r.valueSize}px`,
        color: cssHex(COL.goldTrim),
        stroke: cssHex(COL.vignetteBlack),
        strokeThickness: TEXT_OUTLINE.body,
      })
      .setOrigin(1, HALF);
    row.add(valueText);

    // Fade the row in, then count 0 → value.
    this.tween({ targets: row, alpha: 1, duration: r.fadeMs, delay, ease: 'Sine.easeOut' });
    this.tweens.push(
      this.scene.tweens.addCounter({
        from: 0,
        to: value,
        duration: DR.countMs,
        delay,
        ease: 'Sine.easeOut',
        onUpdate: (tw) => valueText.setText(`+${Math.round(tw.getValue() ?? 0)}`),
        onComplete: () => valueText.setText(`+${value}`),
      }),
    );
    return row;
  }

  /** Thin double gold frame for a rounded panel-relative rect. */
  private goldRect(g: G, x: number, y: number, w: number, h: number): void {
    g.lineStyle(GOLD_FRAME.outerW, COL.goldTrim, 1);
    g.strokeRect(x, y, w, h);
    const gap = GOLD_FRAME.innerGap;
    g.lineStyle(GOLD_FRAME.innerW, COL.goldTrim, GOLD_FRAME.innerAlpha);
    g.strokeRect(x + gap, y + gap, w - gap * 2, h - gap * 2);
  }

  /** Per-letter brush word (rotation + baseline jitter, §8) centered at x=0, given y. */
  private brushWord(word: string, wordY: number, fill: number, stroke: number): Phaser.GameObjects.Container {
    const t = DR.title;
    const c = this.scene.add.container(0, wordY);
    let x = 0;
    for (const ch of word) {
      const letter = this.scene.add
        .text(x, Phaser.Math.Between(-t.jitterY, t.jitterY), ch, {
          fontFamily: FONT_DISPLAY,
          fontStyle: 'bold',
          fontSize: `${t.size}px`,
          color: cssHex(fill),
          stroke: cssHex(stroke),
          strokeThickness: t.outlineW,
        })
        .setOrigin(0, HALF)
        .setAngle(Phaser.Math.FloatBetween(-t.jitterDeg, t.jitterDeg));
      c.add(letter);
      x += letter.width + t.letterGap;
    }
    c.x = -x * HALF; // center the assembled word inside the panel
    return c;
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): void {
    this.tweens.push(this.scene.tweens.add(cfg));
  }

  private after(ms: number, fn: () => void): void {
    this.timers.push(this.scene.time.delayedCall(ms, fn));
  }

  private fireContinue(): void {
    if (this.firedContinue) return;
    this.firedContinue = true;
    this.opts.onContinue?.();
  }
}
