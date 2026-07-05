// src/game/scenes/DuelIntro.ts — M2 §3.13 duel framing (Tell 25), the pre-fight beats:
//   1. VS splash — full-screen §7 mottled card, both fighter busts + names + brush "VS";
//   2. opponent name banner over the live arena (§5 location-banner recipe);
//   3. READY / FIGHT! beat — `onFight` fires the frame FIGHT! lands (unfreeze the sim there).
// Pure presentation, zero gameplay literals (config/scenes-extra.ts DUEL_INTRO owns every
// number). The integrator mounts one from DuelScene.create():
//
//   this.intro = new DuelIntro(this, {
//     playerName: 'YOU', opponentName: 'RONIN', opponentLevel: 3,
//     onFight: () => this.beginCombat(),   // sim/input unfreeze
//     onDone: () => (this.intro = undefined),
//   });
//   // R-restart mid-intro: intro.skip() (fires onFight+onDone) or intro.destroy() (silent).
//
// Restart-safe: destroy() removes every tween, timer and display object it created
// (scene clocks do NOT reset across DuelScene.restart() — see the M2 port risks).
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config/layout';
import { COL } from '../../config/palette';
import { FONT_DISPLAY, FONT_BODY, TEXT_OUTLINE } from '../../config/typography';
import { BUST_GLYPH, GOLD_FRAME, PANEL, cssHex } from '../../config/chrome-extra';
import { DUEL_INTRO as DI } from '../../config/scenes-extra';
import { paintMottled, goldFrame, cornerFlourishes } from '../chrome/mottle';

const HALF = 1 / 2;
type G = Phaser.GameObjects.Graphics;

export interface DuelIntroOpts {
  playerName: string;
  opponentName: string;
  /** Shown as `NAME (n)` under the right portrait and on the banner (§3 hostile label). */
  opponentLevel?: number;
  /** Fired exactly once, the frame FIGHT! lands — start/unfreeze the sim here. */
  onFight?: () => void;
  /** Fired once, after the last beat fades and the intro has cleaned itself up. */
  onDone?: () => void;
  /** Override DUEL_INTRO.depth (defaults above kill layers, below letterbox bars). */
  depth?: number;
}

interface BrushWordStyle {
  size: number;
  fill: number;
  stroke: number;
  outlineW: number;
  jitterDeg: number;
  jitterY: number;
  letterGap: number;
}

/**
 * Plays the three pre-duel framing beats in order, then destroys itself.
 * Construct to start; `skip()` fast-forwards (still firing onFight/onDone once).
 */
export class DuelIntro {
  private scene: Phaser.Scene;
  private opts: DuelIntroOpts;
  private depth: number;
  private objects: { destroy: () => void }[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];
  private tweens: Phaser.Tweens.Tween[] = [];
  private firedFight = false;
  private firedDone = false;
  private destroyed = false;

  constructor(scene: Phaser.Scene, opts: DuelIntroOpts) {
    this.scene = scene;
    this.opts = opts;
    this.depth = opts.depth ?? DI.depth;
    this.playSplash();
  }

  /** Fast-forward: fire onFight (once), clean up, fire onDone (once). */
  skip(): void {
    if (this.destroyed) return;
    this.fireFight();
    this.destroy();
    this.fireDone();
  }

  /** Remove every object/tween/timer this intro created. Fires NO callbacks. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const t of this.timers) t.remove(false);
    this.timers = [];
    for (const tw of this.tweens) tw.remove();
    this.tweens = [];
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }

  // ————— beat 1: the VS splash card —————

  private playSplash(): void {
    const c = this.scene.add.container(0, 0).setDepth(this.depth);
    this.objects.push(c);

    // §7 mottled maroon field + thin gold frame + corner flourishes (panel recipe).
    const g = this.scene.add.graphics();
    paintMottled(g, 0, 0, GAME_W, GAME_H);
    const inset = PANEL.frameInset;
    goldFrame(g, inset, inset, GAME_W - inset * 2, GAME_H - inset * 2);
    cornerFlourishes(g, inset, inset, GAME_W - inset * 2, GAME_H - inset * 2);
    c.add(g);

    // Player LEFT (gold name), opponent RIGHT (red name + level).
    const pb = DI.portraitBox;
    const cy = GAME_H * pb.cyFrac;
    const lvl = this.opts.opponentLevel;
    c.add(this.portrait(GAME_W * pb.cxFracL, cy, 'player', this.opts.playerName));
    c.add(this.portrait(GAME_W * pb.cxFracR, cy, 'enemy', this.opts.opponentName, lvl));

    // The brush "VS" slams down between the boxes — red fill + white outline (§7).
    const vs = this.brushWord('VS', GAME_W * HALF, cy, {
      size: DI.vs.size,
      fill: COL.winRed,
      stroke: DI.vs.outlineColor,
      outlineW: DI.vs.outlineW,
      jitterDeg: DI.vs.jitterDeg,
      jitterY: DI.vs.jitterY,
      letterGap: DI.vs.letterGap,
    });
    vs.setScale(DI.vs.popFromScale).setAlpha(0);
    c.add(vs);
    this.tween({ targets: vs, scale: 1, alpha: 1, duration: DI.vs.popMs, ease: 'Back.easeOut' });

    this.after(DI.vsSplashMs, () => {
      this.tween({
        targets: c,
        alpha: 0,
        duration: DI.splashFadeMs,
        ease: 'Sine.easeIn',
        onComplete: () => {
          this.remove(c);
          this.playBanner();
        },
      });
    });
  }

  /** One VS-card portrait: inset ink box + double gold trim + bust glyph + name. */
  private portrait(
    cx: number,
    cy: number,
    who: 'player' | 'enemy',
    name: string,
    level?: number,
  ): Phaser.GameObjects.Container {
    const pb = DI.portraitBox;
    const sub = this.scene.add.container(cx, cy);
    const g = this.scene.add.graphics();
    const x = -pb.w * HALF;
    const y = -pb.h * HALF;

    // Near-black box + double gold rounded trim (banner/frame recipe).
    g.fillStyle(COL.panelInk, 1);
    g.fillRoundedRect(x, y, pb.w, pb.h, pb.radius);
    g.lineStyle(GOLD_FRAME.outerW, COL.goldTrim, 1);
    g.strokeRoundedRect(x, y, pb.w, pb.h, pb.radius);
    g.lineStyle(GOLD_FRAME.innerW, COL.goldTrim, GOLD_FRAME.innerAlpha);
    g.strokeRoundedRect(
      x + GOLD_FRAME.innerGap,
      y + GOLD_FRAME.innerGap,
      pb.w - GOLD_FRAME.innerGap * 2,
      pb.h - GOLD_FRAME.innerGap * 2,
      pb.radius,
    );

    // Bust inside the inner box.
    const bx = x + pb.bustInset;
    const by = y + pb.bustInset;
    const bw = pb.w - pb.bustInset * 2;
    const bh = pb.h - pb.bustInset * 2;
    if (who === 'player') this.paintPlayerBust(g, bx, by, bw, bh);
    else this.paintEnemyBust(g, bx, by, bw, bh);
    sub.add(g);

    // Name caps under the box: gold = player, red = hostile `NAME (LVL)` (§3).
    const label = name.toUpperCase() + (level != null ? ` (${level})` : '');
    const t = this.scene.add
      .text(0, pb.h * HALF + DI.nameGapY, label, {
        fontFamily: FONT_BODY,
        fontSize: `${DI.nameSize}px`,
        color: cssHex(who === 'player' ? COL.nameGold : COL.nameRed),
        stroke: cssHex(COL.vignetteBlack),
        strokeThickness: TEXT_OUTLINE.nameLabel,
      })
      .setOrigin(HALF, 0);
    sub.add(t);

    // Scale-pop entrance.
    sub.setScale(pb.popFromScale).setAlpha(0);
    this.tween({ targets: sub, scale: 1, alpha: 1, duration: pb.popMs, ease: 'Back.easeOut' });
    return sub;
  }

  /** Kasa bust — same flat-cel recipe as the dialogue portrait (chrome BUST_GLYPH). */
  private paintPlayerBust(g: G, x: number, y: number, w: number, h: number): void {
    g.fillStyle(COL.kimono, 1);
    this.fillGlyphPoly(g, BUST_GLYPH.body, x, y, w, h);
    g.fillStyle(COL.skin, 1);
    g.fillCircle(x + BUST_GLYPH.face.x * w, y + BUST_GLYPH.face.y * h, BUST_GLYPH.face.r * w);
    g.fillStyle(COL.hatStraw, 1);
    this.fillGlyphPoly(g, BUST_GLYPH.kasa, x, y, w, h);
    const b = BUST_GLYPH.brim;
    g.lineStyle(b.w * h, COL.hatShade, 1);
    g.beginPath();
    g.moveTo(x + b.x1 * w, y + b.y1 * h);
    g.lineTo(x + b.x2 * w, y + b.y2 * h);
    g.strokePath();
  }

  /** Ronin bust — oxblood haori shoulders, bare head, topknot, headband (§3 archetype). */
  private paintEnemyBust(g: G, x: number, y: number, w: number, h: number): void {
    const eb = DI.enemyBust;
    g.fillStyle(COL.haoriEnemy, 1);
    this.fillGlyphPoly(g, BUST_GLYPH.body, x, y, w, h);
    g.fillStyle(COL.skin, 1);
    g.fillCircle(x + BUST_GLYPH.face.x * w, y + BUST_GLYPH.face.y * h, BUST_GLYPH.face.r * w);
    // Hair cap + topknot.
    g.fillStyle(COL.hair, 1);
    g.fillEllipse(x + eb.hair.cx * w, y + eb.hair.cy * h, eb.hair.w * w, eb.hair.h * h);
    g.fillCircle(x + eb.knot.cx * w, y + eb.knot.cy * h, eb.knot.r * w);
    // Headband strip across the forehead (scarf vermilion, distinct from blood red).
    g.fillStyle(COL.scarf, 1);
    g.fillRect(x + eb.band.x1 * w, y + eb.band.y * h, (eb.band.x2 - eb.band.x1) * w, eb.band.h * h);
  }

  private fillGlyphPoly(g: G, pts: readonly (readonly number[])[], x: number, y: number, w: number, h: number): void {
    g.beginPath();
    g.moveTo(x + pts[0][0] * w, y + pts[0][1] * h);
    for (let i = 1; i < pts.length; i++) g.lineTo(x + pts[i][0] * w, y + pts[i][1] * h);
    g.closePath();
    g.fillPath();
  }

  // ————— beat 2: opponent name banner over the live arena —————

  private playBanner(): void {
    const b = DI.banner;
    const c = this.scene.add.container(GAME_W * HALF, GAME_H * b.yFrac).setDepth(this.depth);
    this.objects.push(c);

    const label =
      this.opts.opponentName.toUpperCase() +
      (this.opts.opponentLevel != null ? ` (${this.opts.opponentLevel})` : '');
    const t = this.scene.add
      .text(0, 0, label, {
        fontFamily: FONT_DISPLAY,
        fontStyle: 'bold',
        fontSize: `${b.textSize}px`,
        color: cssHex(COL.chromeCream),
        stroke: cssHex(COL.vignetteBlack),
        strokeThickness: TEXT_OUTLINE.body,
      })
      .setOrigin(HALF);

    // Black rounded bar + double gold outline sized to the text (§5 banner recipe).
    const w = t.width + b.padX * 2;
    const g = this.scene.add.graphics();
    g.fillStyle(COL.panelInk, 1);
    g.fillRoundedRect(-w * HALF, -b.h * HALF, w, b.h, b.radius);
    g.lineStyle(GOLD_FRAME.outerW, COL.goldTrim, 1);
    g.strokeRoundedRect(-w * HALF, -b.h * HALF, w, b.h, b.radius);
    g.lineStyle(GOLD_FRAME.innerW, COL.goldTrim, GOLD_FRAME.innerAlpha);
    g.strokeRoundedRect(
      -w * HALF + GOLD_FRAME.innerGap,
      -b.h * HALF + GOLD_FRAME.innerGap,
      w - GOLD_FRAME.innerGap * 2,
      b.h - GOLD_FRAME.innerGap * 2,
      b.radius,
    );
    c.add(g);
    c.add(t);

    c.setAlpha(0);
    this.tween({ targets: c, alpha: 1, duration: b.fadeMs, ease: 'Sine.easeOut' });
    this.after(b.fadeMs + DI.bannerHoldMs, () => {
      this.tween({
        targets: c,
        alpha: 0,
        duration: b.fadeMs,
        ease: 'Sine.easeIn',
        onComplete: () => {
          this.remove(c);
          this.playReadyFight();
        },
      });
    });
  }

  // ————— beat 3: READY / FIGHT! —————

  private playReadyFight(): void {
    const rf = DI.readyFight;
    const cx = GAME_W * HALF;
    const cy = GAME_H * rf.cyFrac;

    const ready = this.brushWord('READY', cx, cy, {
      size: rf.readySize,
      fill: COL.chromeCream,
      stroke: COL.vignetteBlack,
      outlineW: TEXT_OUTLINE.display,
      jitterDeg: DI.vs.jitterDeg,
      jitterY: DI.vs.jitterY,
      letterGap: DI.vs.letterGap,
    }).setDepth(this.depth);
    this.objects.push(ready);
    ready.setScale(rf.readyPopFromScale).setAlpha(0);
    this.tween({ targets: ready, scale: 1, alpha: 1, duration: rf.popMs, ease: 'Back.easeOut' });

    this.after(rf.popMs + DI.readyFightMs, () => {
      this.remove(ready);

      const fight = this.brushWord('FIGHT!', cx, cy, {
        size: rf.fightSize,
        fill: COL.winRed,
        stroke: DI.vs.outlineColor,
        outlineW: DI.vs.outlineW,
        jitterDeg: DI.vs.jitterDeg,
        jitterY: DI.vs.jitterY,
        letterGap: DI.vs.letterGap,
      }).setDepth(this.depth);
      this.objects.push(fight);
      fight.setScale(rf.fightPopFromScale).setAlpha(0);
      this.tween({ targets: fight, scale: 1, alpha: 1, duration: rf.popMs, ease: 'Back.easeOut' });
      this.fireFight(); // the sim unfreezes the moment FIGHT! lands

      this.after(rf.popMs + DI.readyFightMs, () => {
        this.tween({
          targets: fight,
          alpha: 0,
          duration: rf.fadeMs,
          ease: 'Sine.easeIn',
          onComplete: () => {
            this.destroy();
            this.fireDone();
          },
        });
      });
    });
  }

  // ————— shared helpers —————

  /** Per-letter brush word (rotation + baseline jitter, §8) centered on (cx, cy). */
  private brushWord(word: string, cx: number, cy: number, s: BrushWordStyle): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, cy);
    let x = 0;
    for (const ch of word) {
      const t = this.scene.add
        .text(x, Phaser.Math.Between(-s.jitterY, s.jitterY), ch, {
          fontFamily: FONT_DISPLAY,
          fontStyle: 'bold',
          fontSize: `${s.size}px`,
          color: cssHex(s.fill),
          stroke: cssHex(s.stroke),
          strokeThickness: s.outlineW,
        })
        .setOrigin(0, HALF)
        .setAngle(Phaser.Math.FloatBetween(-s.jitterDeg, s.jitterDeg));
      c.add(t);
      x += t.width + s.letterGap;
    }
    c.x = cx - x * HALF;
    return c;
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): void {
    this.tweens.push(this.scene.tweens.add(cfg));
  }

  private after(ms: number, fn: () => void): void {
    this.timers.push(this.scene.time.delayedCall(ms, fn));
  }

  /** Destroy one tracked object early (kills its tweens too). */
  private remove(o: { destroy: () => void }): void {
    this.objects = this.objects.filter((x) => x !== o);
    this.scene.tweens.killTweensOf(o as Phaser.GameObjects.GameObject);
    o.destroy();
  }

  private fireFight(): void {
    if (this.firedFight) return;
    this.firedFight = true;
    this.opts.onFight?.();
  }

  private fireDone(): void {
    if (this.firedDone) return;
    this.firedDone = true;
    this.opts.onDone?.();
  }
}
