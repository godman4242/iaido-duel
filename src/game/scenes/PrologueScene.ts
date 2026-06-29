// src/game/scenes/PrologueScene.ts
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { GameState } from '../../core/gamestate';

// ── Original narration (our own writing — swappable) ─────────────────────────
// NARRATIVE TEXT IS ORIGINAL-BY-US. Do NOT replace with source prose.
// Swap out here when a verbatim transcription is ready.
const PROLOGUE_NARRATION: readonly string[] = [
  'After the long war, the roads filled with masterless men.',
  'Some sold their swords. Some sold their names.',
  'Most were never heard from again.',
  'One walked toward the capital with a straw hat, an old blade,',
  'and a debt he could not name.',
];

// Milliseconds between lines revealing automatically after the previous one fades in.
const LINE_STAGGER_MS = 900;
// Fade-in duration per narration line.
const LINE_FADE_MS = 700;

export class PrologueScene extends Phaser.Scene {
  private state!: GameState;

  // Narration playback state
  private lineTexts: Phaser.GameObjects.Text[] = [];
  private currentLine = -1;
  private lineTimer: Phaser.Time.TimerEvent | undefined;
  private currentTween: Phaser.Tweens.Tween | undefined;
  private narrationDone = false;
  private inputLocked = false;

  constructor() {
    super('Prologue');
  }

  init(data: { state: GameState }): void {
    this.state = data.state;
    // Reset playback state so the scene can be revisited cleanly.
    this.lineTexts = [];
    this.currentLine = -1;
    this.lineTimer = undefined;
    this.currentTween = undefined;
    this.narrationDone = false;
    this.inputLocked = false;
  }

  create(): void {
    // ── Dark background ───────────────────────────────────────────────────────
    this.cameras.main.setBackgroundColor(0x0d0d0d);

    // ── Ronin silhouette (kasa + body) ────────────────────────────────────────
    this.drawSilhouette();

    // ── Narration text objects (all initially invisible) ──────────────────────
    // Centre the block in the lower half of the screen, matching the form of
    // reference frames t_012–t_031 (dark bg, narration in lower portion).
    const TEXT_Y_START = GAME_H * 0.56;
    const LINE_HEIGHT = 34;

    for (let i = 0; i < PROLOGUE_NARRATION.length; i++) {
      const txt = this.add
        .text(GAME_W / 2, TEXT_Y_START + i * LINE_HEIGHT, PROLOGUE_NARRATION[i], {
          // FIDELITY TODO: source uses a period-style serif/calligraphy font.
          // Swap for a matching web-loaded font asset at the art-fidelity gate.
          fontFamily: '"Georgia", "Times New Roman", serif',
          fontSize: '22px',
          color: '#e8dcc8',
          align: 'center',
          wordWrap: { width: GAME_W * 0.70 },
        })
        .setOrigin(0.5, 0)
        .setAlpha(0)
        .setDepth(20);
      this.lineTexts.push(txt);
    }

    // ── Advance hint (bottom-centre, appears after first line fades in) ───────
    const hint = this.add
      .text(GAME_W / 2, GAME_H - 22, '▶  click or any key to advance', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#7a6a50',
      })
      .setOrigin(0.5, 1)
      .setAlpha(0)
      .setDepth(20);
    this.time.delayedCall(LINE_STAGGER_MS + LINE_FADE_MS, () => {
      this.tweens.add({ targets: hint, alpha: 1, duration: 500, ease: 'Sine.easeIn' });
    });

    // ── Skip control (top-right corner, always visible and interactive) ────────
    const skip = this.add
      .text(GAME_W - 16, 14, 'Skip ▶', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '14px',
        color: '#7a6a50',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(1, 0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => skip.setColor('#e8dcc8'))
      .on('pointerout', () => skip.setColor('#7a6a50'))
      .on('pointerdown', () => this.goToTown());

    // ── Input wiring ──────────────────────────────────────────────────────────
    // Both a pointer click (anywhere) and any key press advance the narration.
    this.input.on('pointerdown', () => this.advance());
    this.input.keyboard?.on('keydown', () => this.advance());

    // Begin narration reveal.
    this.revealNextLine();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Draws a flat black ronin silhouette (kasa hat + standing body) via Graphics.
   * Positioned in the upper-centre of the screen so the narration sits below.
   *
   * FIDELITY TODO: replace with a proper sprite/graphic asset once the art-
   * fidelity pass happens. Current shapes are minimal geometric approximations
   * matching the layout (not the art) of reference frames t_012–t_031.
   */
  private drawSilhouette(): void {
    const gfx = this.add.graphics().setDepth(10);
    gfx.fillStyle(0x080808, 1);

    const cx = GAME_W / 2;
    // Feet of the figure at ~52 % of screen height — keeps it above the narration.
    const feetY = Math.round(GAME_H * 0.52);

    // Robed body (tapered rectangle for torso + legs).
    // FIDELITY TODO: add taper, arm, and sword-carry details from reference.
    const bodyW = 46;
    const bodyH = 108;
    gfx.fillRect(cx - bodyW / 2, feetY - bodyH, bodyW, bodyH);

    // Head (small oval above body).
    const headH = 30;
    const headW = 24;
    gfx.fillEllipse(cx, feetY - bodyH - headH * 0.5, headW, headH);

    // Kasa hat (wide flattened ellipse above head).
    // FIDELITY TODO: match exact kasa proportions from reference frames.
    const kasaY = feetY - bodyH - headH - 4;
    gfx.fillEllipse(cx, kasaY, 116, 30);
  }

  /** Fades in the next narration line; marks `narrationDone` after the last. */
  private revealNextLine(): void {
    this.currentLine++;
    if (this.currentLine >= this.lineTexts.length) {
      this.narrationDone = true;
      return;
    }

    const txt = this.lineTexts[this.currentLine];
    this.currentTween = this.tweens.add({
      targets: txt,
      alpha: 1,
      duration: LINE_FADE_MS,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.currentTween = undefined;
        if (this.currentLine < this.lineTexts.length - 1) {
          // More lines remain — schedule the next after the stagger delay.
          this.lineTimer = this.time.delayedCall(LINE_STAGGER_MS, () => {
            this.lineTimer = undefined;
            this.revealNextLine();
          });
        } else {
          // Last line has finished fading in.
          this.narrationDone = true;
        }
      },
    });
  }

  /**
   * Advances the narration beat:
   *   - Fade in progress → snaps current line to full opacity, moves to next.
   *   - Waiting between lines → cancels the stagger, reveals next immediately.
   *   - All lines shown → transitions to Town.
   */
  private advance(): void {
    if (this.inputLocked) return;

    if (this.currentTween?.isPlaying()) {
      // Snap the current line to full visibility.
      this.currentTween.stop();
      this.currentTween = undefined;
      this.lineTexts[this.currentLine]?.setAlpha(1);

      if (this.currentLine < this.lineTexts.length - 1) {
        this.revealNextLine();
      } else {
        this.narrationDone = true;
      }
      return;
    }

    if (this.lineTimer) {
      // Skip the inter-line pause.
      this.lineTimer.remove();
      this.lineTimer = undefined;
      this.revealNextLine();
      return;
    }

    if (this.narrationDone) {
      this.goToTown();
    }
  }

  /** Locks input and starts Town. */
  private goToTown(): void {
    if (this.inputLocked) return;
    this.inputLocked = true;
    this.scene.start('Town', { state: this.state });
  }
}
