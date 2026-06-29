// src/game/scenes/TitleScene.ts
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { createNewGame, loadGame, saveGame, hasSave } from '../persistence/Save';
import { Forest } from '../background/Forest';

// ── Swappable title wordmark ──────────────────────────────────────────────────
// Change both values here to rename the title in one place.
// FIDELITY TODO: the source uses a hand-painted brush font for both lines
// ("STRAW HAT SAMURAI" italic, "DUELS" large red brush-stroke). The current
// implementation uses Phaser text with stroke to approximate the look.
// Replace with a real brush font (e.g. a web-loaded TTF like "Rye" or "Boogaloo")
// or sprite-sheet glyphs at the art-fidelity gate.
const TITLE_WORDMARK = {
  top: 'STRAW HAT SAMURAI',
  main: 'DUELS',
} as const;

// Ground level matches DuelScene so the Forest proportions are identical.
const GROUND_Y = GAME_H - 96;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    // Fallback teal matches Forest's mistTeal so there's no colour flash while layers render.
    this.cameras.main.setBackgroundColor(0x4ba1a4);

    // ── Forest backdrop (static — TitleScene never drives parallax) ───────────
    new Forest(this, GROUND_Y);

    // ── Dark top band ─────────────────────────────────────────────────────────
    // Source: band spans top ~12 % of 720 px ≈ 86 px; adapted to 576 → ~70 px;
    // using 80 px so the wordmark sits comfortably inside it.
    const BAND_H = 80;
    const band = this.add.graphics().setDepth(10);
    band.fillStyle(0x000000, 0.68);
    band.fillRect(0, 0, GAME_W, BAND_H);

    // ── Wordmark line 1: "STRAW HAT SAMURAI" ─────────────────────────────────
    // Source: white italic text, ~21 px, top-left inside the dark band.
    this.add
      .text(28, 16, TITLE_WORDMARK.top, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontStyle: 'italic bold',
        fontSize: '21px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 1,
      })
      .setDepth(11);

    // ── Wordmark line 2: "DUELS" ──────────────────────────────────────────────
    // Source: large red brush-stroke word, bold, with dark outline.
    // Starting y = BAND_H so the word drops below the dark band (matches frames).
    // FIDELITY TODO: see module-level note — swap this text for a brush-font asset.
    this.add
      .text(22, BAND_H, TITLE_WORDMARK.main, {
        fontFamily: '"Arial Black", Impact, Arial, sans-serif',
        fontStyle: 'bold',
        fontSize: '92px',
        color: '#cc1515',
        stroke: '#1a0505',
        strokeThickness: 7,
        shadow: {
          offsetX: 3,
          offsetY: 4,
          color: '#000000',
          blur: 6,
          stroke: true,
          fill: true,
        },
      })
      .setDepth(11);

    // ── Right-side panel: NEW GAME / CONTINUE ────────────────────────────────
    // Replaces the source's account panel (username/password/register/login).
    // Proportional position from source 1280×720: panel centre ≈ (1060, 270)
    //   → (1060/1280)*1024 ≈ 848, (270/720)*576 ≈ 216.
    const panelCX = 832;
    const panelTopY = 210;
    const BTN_W = 224;
    const BTN_H = 52;
    const BTN_GAP = 18;

    this.woodenButton(panelCX, panelTopY, BTN_W, BTN_H, 'NEW GAME', true, () => {
      const s = createNewGame();
      saveGame(s);
      this.scene.start('Town', { state: s });
    });

    this.woodenButton(
      panelCX,
      panelTopY + BTN_H + BTN_GAP,
      BTN_W,
      BTN_H,
      'CONTINUE',
      hasSave(),
      () => {
        const s = loadGame();
        if (s) this.scene.start('Town', { state: s });
      },
    );

    // ── Bottom-right: homage credit ───────────────────────────────────────────
    // Mirrors the style used in DuelScene.
    this.add
      .text(
        GAME_W - 8,
        GAME_H - 8,
        'Fan homage of Straw Hat Samurai: Duels by Explosive Barrel — unaffiliated, non-commercial.',
        { fontFamily: 'monospace', fontSize: '10px', color: '#eceffe' },
      )
      .setOrigin(1, 1)
      .setAlpha(0.5)
      .setDepth(120);
  }

  /**
   * Draws a wooden-style button matching the source's Register/Login aesthetic:
   * dark border, brown fill, highlight band, white label.
   *
   * @param cx      Centre-x of the button.
   * @param cy      Centre-y of the button.
   * @param w       Button width.
   * @param h       Button height.
   * @param label   Button text.
   * @param enabled If false the button is drawn dimmed and is not interactive.
   * @param onClick Callback fired on pointerdown (ignored when disabled).
   */
  private woodenButton(
    cx: number,
    cy: number,
    w: number,
    h: number,
    label: string,
    enabled: boolean,
    onClick: () => void,
  ): void {
    const gfx = this.add.graphics().setDepth(12);
    const RADIUS = 5;

    // Colour tokens (enabled / disabled variants)
    const T = {
      borderEnabled:   0x2a1004,
      fillEnabled:     0x7b3a10,
      sheenEnabled:    0xb05a1e,
      sheenHover:      0xd4701e,
      borderDisabled:  0x221208,
      fillDisabled:    0x3a2510,
    } as const;

    const labelEnabled  = '#f2e5c0';
    const labelDisabled = '#6a5a40';

    const draw = (hover: boolean) => {
      gfx.clear();

      if (enabled) {
        // Drop-shadow / bottom border
        gfx.fillStyle(T.borderEnabled, 1);
        gfx.fillRoundedRect(cx - w / 2 - 2, cy - h / 2 + 3, w + 4, h + 2, RADIUS + 1);
        // Main face
        gfx.fillStyle(hover ? T.sheenEnabled : T.fillEnabled, 1);
        gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, RADIUS);
        // Top-highlight sheen band (gives a raised 3-D look matching the source)
        gfx.fillStyle(hover ? T.sheenHover : T.sheenEnabled, 0.42);
        gfx.fillRoundedRect(cx - w / 2 + 5, cy - h / 2 + 4, w - 10, h * 0.36, RADIUS / 2);
      } else {
        gfx.fillStyle(T.borderDisabled, 1);
        gfx.fillRoundedRect(cx - w / 2 - 2, cy - h / 2 + 3, w + 4, h + 2, RADIUS + 1);
        gfx.fillStyle(T.fillDisabled, 1);
        gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, RADIUS);
      }
    };

    draw(false);

    const txt = this.add
      .text(cx, cy, label, {
        fontFamily: '"Arial Black", Impact, sans-serif',
        fontStyle: 'bold',
        fontSize: '18px',
        color: enabled ? labelEnabled : labelDisabled,
        stroke: enabled ? '#2a1004' : '#221208',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(13);

    if (!enabled) return;

    // Invisible rectangle for hit testing — no fill, just interactive.
    this.add
      .rectangle(cx, cy, w, h)
      .setDepth(14)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        draw(true);
        txt.setColor('#ffffff');
      })
      .on('pointerout', () => {
        draw(false);
        txt.setColor(labelEnabled);
      })
      .on('pointerdown', onClick);
  }
}
