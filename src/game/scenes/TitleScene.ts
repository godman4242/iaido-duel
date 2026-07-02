// src/game/scenes/TitleScene.ts — §7 loading/title look (p2 f80): pure black field,
// small white brush-caps kicker centered, huge red dry-brush title word (per-letter
// jitter for the irregular brush baseline), a LOADING… beat that resolves into the
// NEW GAME / CONTINUE menu, and a white TIP line at the very bottom.
// FIDELITY TODO (§8): FONT_DISPLAY is a heavy-condensed system stand-in; swap in a
// loaded open-licensed dry-brush face at the art-fidelity gate.
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config/layout';
import { COL } from '../../config/palette';
import { FONT_DISPLAY, FONT_BODY, FONT_SIZE, TEXT_OUTLINE } from '../../config/typography';
import { TITLE_SCREEN as TS, cssHex } from '../../config/chrome-extra';
import { createNewGame, loadGame, saveGame, hasSave } from '../persistence/Save';

// ── Swappable title wordmark ──────────────────────────────────────────────────
// Our own title in the source's typographic role (small kicker over a huge red
// brush word). We never ship the original title/logo.
const TITLE_WORDMARK = {
  kicker: 'IAIDO',
  main: 'DUEL',
} as const;

// Rotating boot-screen tips — original copy (ours), same role as the source's TIP line.
const TIPS: readonly string[] = [
  'TIP: DRAW YOUR STROKE THROUGH A FOE — THE CUT FOLLOWS YOUR LINE.',
  'TIP: A HEAVY STANCE HITS HARDER BUT RECOVERS SLOWER.',
  'TIP: FULL FOCUS TURNS YOUR NEXT CUT INTO A CRITICAL STRIKE.',
  'TIP: EACH STANCE BEATS ONE OTHER — READ YOUR OPPONENT BEFORE YOU DRAW.',
];

const HALF = 1 / 2;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COL.vignetteBlack);

    // ── Kicker: small white brush caps, tracked out, centered ────────────────
    this.add
      .text(GAME_W * HALF, TS.kickerY, TITLE_WORDMARK.kicker, {
        fontFamily: FONT_DISPLAY,
        fontStyle: 'bold',
        fontSize: `${TS.kickerSize}px`,
        color: cssHex(COL.chromeCream),
      })
      .setLetterSpacing(TS.kickerLetterSpacing)
      .setOrigin(HALF);

    // ── Title: huge red dry-brush word, one Text per letter with deterministic
    //    rotation/baseline jitter (§8 "slightly irregular baseline") ───────────
    const letters = [...TITLE_WORDMARK.main].map((ch, i) => {
      const t = this.add
        .text(0, 0, ch, {
          fontFamily: FONT_DISPLAY,
          fontStyle: 'bold',
          fontSize: `${FONT_SIZE.title}px`,
          color: cssHex(COL.winRed),
          stroke: cssHex(COL.winRedDeep),
          strokeThickness: TEXT_OUTLINE.display,
        })
        .setOrigin(0, HALF)
        .setAngle(Math.sin(i * TS.titleJitterPhase) * TS.titleJitterDeg);
      return t;
    });
    const totalW =
      letters.reduce((sum, t) => sum + t.width, 0) + TS.titleLetterSpacing * (letters.length - 1);
    let x = (GAME_W - totalW) * HALF;
    letters.forEach((t, i) => {
      t.setPosition(x, TS.titleY + Math.sin(i * TS.titleJitterPhaseY) * TS.titleJitterY);
      x += t.width + TS.titleLetterSpacing;
    });

    // ── LOADING… beat, then the menu fades in where it sat ───────────────────
    const loading = this.add
      .text(GAME_W * HALF, TS.menuY, 'LOADING...', {
        fontFamily: FONT_DISPLAY,
        fontStyle: 'bold',
        fontSize: `${TS.menuSize}px`,
        color: cssHex(COL.chromeCream),
      })
      .setOrigin(HALF);
    this.time.delayedCall(TS.loadingHoldMs, () => {
      this.tweens.add({
        targets: loading,
        alpha: 0,
        duration: TS.menuFadeMs,
        onComplete: () => {
          loading.destroy();
          this.buildMenu();
        },
      });
    });

    // ── TIP line at the very bottom (white caps) ──────────────────────────────
    this.add
      .text(GAME_W * HALF, GAME_H - TS.tipMarginBottom, Phaser.Utils.Array.GetRandom([...TIPS]), {
        fontFamily: FONT_BODY,
        fontSize: `${TS.tipSize}px`,
        color: cssHex(COL.chromeCream),
        stroke: cssHex(COL.vignetteBlack),
        strokeThickness: TEXT_OUTLINE.body,
      })
      .setOrigin(HALF, 1);

    // ── Homage credit, right-aligned one line above the tip ──────────────────
    this.add
      .text(
        GAME_W - TS.tipMarginBottom,
        GAME_H - TS.creditMarginBottom,
        'Fan homage of Straw Hat Samurai: Duels by Explosive Barrel — unaffiliated, non-commercial.',
        { fontFamily: 'monospace', fontSize: `${TS.tipSize}px`, color: cssHex(COL.chromeCream) },
      )
      .setOrigin(1, 1)
      .setAlpha(HALF);
  }

  /** NEW GAME / CONTINUE rows in the LOADING slot: white brush caps, red on hover. */
  private buildMenu(): void {
    this.menuRow(TS.menuY, 'NEW GAME', true, () => {
      const s = createNewGame();
      saveGame(s);
      this.scene.start('Prologue', { state: s });
    });
    this.menuRow(TS.menuY + TS.menuGap, 'CONTINUE', hasSave(), () => {
      const s = loadGame();
      if (s) this.scene.start('Town', { state: s });
    });
  }

  private menuRow(y: number, label: string, enabled: boolean, onClick: () => void): void {
    const txt = this.add
      .text(GAME_W * HALF, y, label, {
        fontFamily: FONT_DISPLAY,
        fontStyle: 'bold',
        fontSize: `${TS.menuSize}px`,
        color: cssHex(COL.chromeCream),
        stroke: cssHex(COL.vignetteBlack),
        strokeThickness: TEXT_OUTLINE.body,
      })
      .setOrigin(HALF)
      .setAlpha(0);
    this.tweens.add({ targets: txt, alpha: enabled ? 1 : TS.disabledAlpha, duration: TS.menuFadeMs });
    if (!enabled) return;
    txt
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        txt.setColor(cssHex(COL.winRed));
        txt.setScale(TS.hoverScale);
      })
      .on('pointerout', () => {
        txt.setColor(cssHex(COL.chromeCream));
        txt.setScale(1);
      })
      .on('pointerdown', onClick);
  }
}
