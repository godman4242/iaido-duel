// src/game/scenes/PrologueScene.ts
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { PROLOGUE_UI } from '../../config/scenes-extra';
import { GameState } from '../../core/gamestate';
import { StoryCard } from '../chrome/StoryCard';
import { Letterbox } from '../chrome/Letterbox';

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

/**
 * Three-beat opening: (0) the §7 story card — mottled maroon field, right-edge kasa
 * silhouette, staggered tan brush-caps narration (chrome/StoryCard); (1) white
 * "PROLOGUE" card; (2) ensō + epigraph. Exits to Town behind a letterboxed travel
 * pan (tell #9). Click or any key advances; Skip jumps straight to Town.
 */
export class PrologueScene extends Phaser.Scene {
  private state!: GameState;

  // ── Beat state machine: 0 = story card, 1 = card, 2 = ensō ────────────────
  private beatIndex = 0;
  private inputLocked = false;
  private leaving = false;

  private storyCard: StoryCard | undefined;
  // Objects belonging to the current non-story beat (card or ensō) — for cleanup.
  private beatLayer: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Prologue');
  }

  init(data: { state: GameState }): void {
    this.state = data.state;
    // Reset everything for clean re-entry.
    this.beatIndex = 0;
    this.inputLocked = false;
    this.leaving = false;
    this.storyCard = undefined;
    this.beatLayer = [];
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0d0d0d);

    // ── Beat 0: the §7 story card owns its own click-to-advance hit rect ──────
    this.storyCard = new StoryCard(this, PROLOGUE_NARRATION, {
      onAdvance: () => this.advance(),
    });

    // ── Skip control (top-right, above the story card, jumps straight to Town) ─
    const skip = this.add
      .text(GAME_W - 16, 14, 'Skip ▶', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '14px',
        color: '#7a6a50',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(1, 0)
      .setDepth(PROLOGUE_UI.skipDepth)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => skip.setColor('#e8dcc8'))
      .on('pointerout', () => skip.setColor('#7a6a50'))
      .on('pointerdown', () => this.goToTown());

    // ── Global input: any key always advances; clicks advance beats 1–2 (the
    //    story card's own hit rect handles beat 0 so a click never double-fires).
    this.input.keyboard?.on('keydown', () => this.advance());
    this.input.on('pointerdown', () => {
      if (this.beatIndex > 0) this.advance();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Beat sequence
  // ─────────────────────────────────────────────────────────────────────────────

  /** Advances one beat (debounced by inputLocked while a transition plays). */
  private advance(): void {
    if (this.inputLocked || this.leaving) return;
    this.inputLocked = true;
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
   * Story card → Card transition: fades the screen to white over 400 ms (above the
   * story card), then destroys the card and hands off to renderCard().
   */
  private transitionToCard(): void {
    const overlay = this.add
      .rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xffffff, 0)
      .setDepth(PROLOGUE_UI.overlayDepth);

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 400,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.storyCard?.destroy();
        this.storyCard = undefined;
        overlay.destroy();
        this.cameras.main.setBackgroundColor(0xffffff);
        this.renderCard();
      },
    });
  }

  /**
   * Beat 1: white background + centered "PROLOGUE" word.
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

    this.time.delayedCall(80, () => { this.inputLocked = false; });
  }

  /**
   * Beat 2: white background + ensō circle via Graphics + PROLOGUE_EPIGRAPH
   * lines centered beneath.
   * Reference layout: frames t_037–t_043.
   */
  private renderEnso(): void {
    // Clear card-beat objects.
    for (const obj of this.beatLayer) {
      this.tweens.killTweensOf(obj);
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

    this.time.delayedCall(80, () => { this.inputLocked = false; });
  }

  /** Locks input and exits to Town behind the letterbox travel pan (tell #9). */
  private goToTown(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.inputLocked = true;
    const bars = new Letterbox(this);
    bars.slideIn(() => this.scene.start('Town', { state: this.state }));
  }
}
