// src/game/scenes/PrologueScene.ts
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { GameState } from '../../core/gamestate';

// ── Content constants (our original writing — swappable) ─────────────────────
// NARRATIVE TEXT IS ORIGINAL-BY-US. Do NOT replace with source prose/poem.
// Swap out here when a verbatim transcription is ready.
const PROLOGUE_NARRATION: readonly string[] = [
  'After the long war, the roads filled with masterless men.',
  'Some sold their swords. Some sold their names.',
  'Most were never heard from again.',
  'One walked toward the capital with a straw hat, an old blade,',
  'and a debt he could not name.',
];

const PROLOGUE_CARD = 'PROLOGUE';

// Original epigraph (our own haiku) — swappable.
const PROLOGUE_EPIGRAPH: readonly string[] = [
  'Wind across the reeds —',
  'one sword answers to no lord,',
  'the road keeps no name.',
];

// Milliseconds between lines revealing automatically after the previous one fades in.
const LINE_STAGGER_MS = 900;
// Fade-in duration per narration line.
const LINE_FADE_MS = 700;

export class PrologueScene extends Phaser.Scene {
  private state!: GameState;

  // ── Beat state machine: 0 = narration, 1 = card, 2 = enso ──────────────────
  private beatIndex = 0;
  private inputLocked = false;

  // ── Narration-beat state ────────────────────────────────────────────────────
  private lineTexts: Phaser.GameObjects.Text[] = [];
  private currentLine = -1;
  private lineTimer: Phaser.Time.TimerEvent | undefined;
  private currentTween: Phaser.Tweens.Tween | undefined;
  private narrationDone = false;

  // Objects belonging to the narration beat (silhouette, hint, lines) — for cleanup.
  private narrationLayer: Phaser.GameObjects.GameObject[] = [];
  // Objects belonging to the current non-narration beat (card or ensō) — for cleanup.
  private beatLayer: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Prologue');
  }

  init(data: { state: GameState }): void {
    this.state = data.state;
    // Reset everything for clean re-entry.
    this.beatIndex = 0;
    this.inputLocked = false;
    this.lineTexts = [];
    this.currentLine = -1;
    this.lineTimer = undefined;
    this.currentTween = undefined;
    this.narrationDone = false;
    this.narrationLayer = [];
    this.beatLayer = [];
  }

  create(): void {
    // ── Skip control (top-right corner, always visible, jumps straight to Town) ─
    const skip = this.add
      .text(GAME_W - 16, 14, 'Skip ▶', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '14px',
        color: '#7a6a50',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(1, 0)
      .setDepth(50)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => skip.setColor('#e8dcc8'))
      .on('pointerout', () => skip.setColor('#7a6a50'))
      .on('pointerdown', () => this.goToTown());

    // ── Global input — click or any key advances the current beat ───────────────
    this.input.on('pointerdown', () => this.advance());
    this.input.keyboard?.on('keydown', () => this.advance());

    // Begin at beat 0 (narration).
    this.renderNarration();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Beat sequence
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Advances the scene forward one step:
   * - Beat 0 (narration): delegates to advanceNarration() which handles
   *   snap/reveal; when all lines are done, calls nextBeat() immediately
   *   (no double-input stall — fixes Task 1 carryover minor).
   * - Beats 1–2 (card, ensō): any input immediately moves to the next beat.
   */
  private advance(): void {
    if (this.inputLocked) return;

    if (this.beatIndex === 0) {
      this.advanceNarration();
      return;
    }

    // Beats 1 and 2: click / any-key immediately advances.
    this.nextBeat();
  }

  /**
   * Narration-specific advance:
   * - Tween playing → snap current line to full opacity, reveal next (or proceed).
   * - Timer waiting → cancel stagger, reveal next immediately.
   * - narrationDone → proceed to next beat immediately.
   *
   * FIX (vs Task 1 carryover minor): snapping the last line now calls nextBeat()
   * directly instead of setting a flag and requiring a second input.
   */
  private advanceNarration(): void {
    if (this.currentTween?.isPlaying()) {
      this.currentTween.stop();
      this.currentTween = undefined;
      this.lineTexts[this.currentLine]?.setAlpha(1);

      if (this.currentLine < this.lineTexts.length - 1) {
        // Cancel any inter-line stagger and reveal the next line immediately.
        this.lineTimer?.remove();
        this.lineTimer = undefined;
        this.revealNextLine();
      } else {
        // Last line snapped — immediately proceed; no second input required.
        this.nextBeat();
      }
      return;
    }

    if (this.lineTimer) {
      // Waiting between lines — cancel stagger and show next immediately.
      this.lineTimer.remove();
      this.lineTimer = undefined;
      this.revealNextLine();
      return;
    }

    if (this.narrationDone) {
      this.nextBeat();
    }
  }

  /**
   * Increments beatIndex and renders the corresponding beat, or goes to Town
   * after the last beat.
   */
  private nextBeat(): void {
    if (this.inputLocked) return;
    this.beatIndex++;

    switch (this.beatIndex) {
      case 1:
        this.transitionToCard();
        break;
      case 2:
        this.renderEnso();
        break;
      default:
        this.goToTown();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Beat renderers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Beat 0: dark background + ronin silhouette + staggered narration reveal.
   * Reference layout: frames t_012–t_031.
   */
  private renderNarration(): void {
    this.cameras.main.setBackgroundColor(0x0d0d0d);

    const silhouette = this.drawSilhouette();
    this.narrationLayer.push(silhouette);

    // Centre the narration block in the lower half of the screen.
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
          wordWrap: { width: GAME_W * 0.7 },
        })
        .setOrigin(0.5, 0)
        .setAlpha(0)
        .setDepth(20);
      this.lineTexts.push(txt);
      this.narrationLayer.push(txt);
    }

    // Advance hint — appears after the first line has faded in.
    const hint = this.add
      .text(GAME_W / 2, GAME_H - 22, '▶  click or any key to advance', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#7a6a50',
      })
      .setOrigin(0.5, 1)
      .setAlpha(0)
      .setDepth(20);
    this.narrationLayer.push(hint);
    this.time.delayedCall(LINE_STAGGER_MS + LINE_FADE_MS, () => {
      this.tweens.add({ targets: hint, alpha: 1, duration: 500, ease: 'Sine.easeIn' });
    });

    this.revealNextLine();
  }

  /**
   * Narration → Card transition: fades the screen to white over 400 ms, then
   * destroys the narration layer and hands off to renderCard().
   * Input is locked for the fade duration to prevent double-advance.
   */
  private transitionToCard(): void {
    this.inputLocked = true;

    // Full-screen white overlay fades in over the narration content.
    const overlay = this.add
      .rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xffffff, 0)
      .setDepth(45);

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 400,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        for (const obj of this.narrationLayer) {
          obj.destroy();
        }
        this.narrationLayer = [];
        overlay.destroy();
        this.cameras.main.setBackgroundColor(0xffffff);
        this.inputLocked = false;
        this.renderCard();
      },
    });
  }

  /**
   * Beat B: white background + centered "PROLOGUE" word.
   * Reference layout: frames t_033–t_036.
   */
  private renderCard(): void {
    // FIDELITY TODO: source uses a large brush/bold display font for the card
    // word. Replace fontFamily with a loaded brush font asset at the art-fidelity
    // gate.
    const cardText = this.add
      .text(GAME_W / 2, GAME_H / 2, PROLOGUE_CARD, {
        fontFamily: '"Arial Black", "Arial Bold", Arial, sans-serif',
        fontSize: '72px',
        color: '#111111',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(20);

    this.beatLayer.push(cardText);

    this.tweens.add({
      targets: cardText,
      alpha: 1,
      duration: 500,
      ease: 'Sine.easeIn',
    });
  }

  /**
   * Beat C: white background + ensō circle via Graphics + PROLOGUE_EPIGRAPH
   * lines centered beneath.
   * Reference layout: frames t_037–t_043.
   */
  private renderEnso(): void {
    // Clear card-beat objects.
    for (const obj of this.beatLayer) {
      obj.destroy();
    }
    this.beatLayer = [];

    // ── Ensō circle ───────────────────────────────────────────────────────────
    // FIDELITY TODO: replace with a real brush-stroke ensō image asset at the
    // art-fidelity gate. Current shape is a thick near-complete stroked arc with
    // a small gap and slight rotation, matching the layout/sequence of frames
    // t_037–t_043 in form only — not in calligraphic quality.
    const gfx = this.add.graphics().setDepth(20);
    const cx = GAME_W / 2;
    const cy = GAME_H * 0.38;
    const radius = 80;

    gfx.lineStyle(14, 0x1a1a1a, 1);
    // Arc of ~340°: gap near the top, rotated ~10° clockwise.
    // start = 10°, end = 350° (leaves a ~20° opening at the top-right).
    gfx.beginPath();
    gfx.arc(
      cx,
      cy,
      radius,
      Phaser.Math.DegToRad(10),
      Phaser.Math.DegToRad(350),
      false,
    );
    gfx.strokePath();
    this.beatLayer.push(gfx);

    // ── Epigraph lines ────────────────────────────────────────────────────────
    // FIDELITY TODO: use a brush/italic serif font at the art-fidelity gate.
    const epigraphYStart = cy + radius + 36;
    const epigraphLineH = 30;

    for (let i = 0; i < PROLOGUE_EPIGRAPH.length; i++) {
      const line = this.add
        .text(cx, epigraphYStart + i * epigraphLineH, PROLOGUE_EPIGRAPH[i], {
          fontFamily: '"Georgia", "Times New Roman", serif',
          fontSize: '20px',
          color: '#1a1a1a',
          align: 'center',
          fontStyle: 'italic',
        })
        .setOrigin(0.5, 0)
        .setAlpha(0)
        .setDepth(20);
      this.beatLayer.push(line);

      this.tweens.add({
        targets: line,
        alpha: 1,
        duration: 600,
        delay: i * 300,
        ease: 'Sine.easeIn',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Narration helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Draws a flat black ronin silhouette (kasa hat + standing body) via Graphics.
   * Positioned in the upper-centre so narration sits below.
   *
   * FIDELITY TODO: replace with a proper sprite/graphic asset at the art-fidelity
   * gate. Current shapes are minimal geometric approximations matching the layout
   * (not the art) of reference frames t_012–t_031.
   */
  private drawSilhouette(): Phaser.GameObjects.Graphics {
    const gfx = this.add.graphics().setDepth(10);
    gfx.fillStyle(0x080808, 1);

    const cx = GAME_W / 2;
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

    return gfx;
  }

  /** Fades in the next narration line; marks narrationDone after the last. */
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
          // Last line has finished fading in naturally.
          this.narrationDone = true;
        }
      },
    });
  }

  /** Locks input and starts the Town scene. */
  private goToTown(): void {
    if (this.inputLocked) return;
    this.inputLocked = true;
    this.scene.start('Town', { state: this.state });
  }
}
