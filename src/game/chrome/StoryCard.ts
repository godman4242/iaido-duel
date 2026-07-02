// src/game/chrome/StoryCard.ts — the §7 story card (p1 f01): a full-screen mottled
// maroon field with smoke swirls, a black kasa-figure silhouette bleeding off the
// right edge, a black ground band at the bottom, and centered tan brush-caps
// paragraphs that fade in one after another. A click (or the caller) advances.
//
// The Prologue (and later campaign interludes) constructs one per story beat:
//   const card = new StoryCard(scene, ['first paragraph.', 'second.'], { onAdvance });
// All prose passed through here is OURS — never the original game's lines.
// STORY_CARD_SAMPLE below is original placeholder text authored for this build.
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config/layout';
import { COL } from '../../config/palette';
import { FONT_BODY, TEXT_OUTLINE } from '../../config/typography';
import { CHROME_DEPTH, CHROME_COL, STORY_CARD as SC, cssHex } from '../../config/chrome-extra';
import { paintMottled, paintSilhouette } from './mottle';

const HALF = 1 / 2;

/** Original placeholder copy (ours) for wiring/tests — real beats pass their own prose. */
export const STORY_CARD_SAMPLE: readonly string[] = [
  'The old masters taught that a duel is decided before the blade ever leaves the scabbard.',
  'You have walked the eastern road for three winters, trading your name for a straw hat and your past for silence.',
  'Tonight the road ends at a lantern-lit village — and someone there is already waiting for you to draw.',
];

export class StoryCard {
  private scene: Phaser.Scene;
  private objects: { destroy: () => void }[] = [];
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    paragraphs: readonly string[],
    opts: { onAdvance?: () => void; depth?: number } = {},
  ) {
    this.scene = scene;
    const depth = opts.depth ?? CHROME_DEPTH.storyCard;

    // Mottled maroon field + right-edge silhouette + black ground band.
    const g = scene.add.graphics().setDepth(depth);
    paintMottled(g, 0, 0, GAME_W, GAME_H);
    paintSilhouette(
      g,
      SC.silhouetteXFrac * GAME_W,
      SC.silhouetteYFrac * GAME_H,
      SC.silhouetteWFrac * GAME_W,
      SC.silhouetteHFrac * GAME_H,
    );
    g.fillStyle(COL.vignetteBlack, 1);
    g.fillRect(0, GAME_H * (1 - SC.groundBandFrac), GAME_W, GAME_H * SC.groundBandFrac);
    this.objects.push(g);

    // Centered tan brush-caps paragraphs, staggered fade-in (measure first, then center).
    const texts = paragraphs.map((p) =>
      scene.add
        .text(GAME_W * HALF, 0, p.toUpperCase(), {
          fontFamily: FONT_BODY,
          fontSize: `${SC.textSize}px`,
          color: cssHex(CHROME_COL.storyTan),
          stroke: cssHex(COL.vignetteBlack),
          strokeThickness: TEXT_OUTLINE.body,
          align: 'center',
          wordWrap: { width: GAME_W * SC.wrapWFrac },
          lineSpacing: SC.lineSpacing,
        })
        .setOrigin(HALF, 0)
        .setAlpha(0)
        .setDepth(depth + 1),
    );
    const blockH = texts.reduce((sum, t) => sum + t.height, 0) + SC.paraGap * (texts.length - 1);
    let yCursor = GAME_H * SC.blockCenterYFrac - blockH * HALF;
    texts.forEach((t, i) => {
      t.setY(yCursor);
      yCursor += t.height + SC.paraGap;
      scene.tweens.add({
        targets: t,
        alpha: 1,
        duration: SC.paraFadeMs,
        delay: i * SC.paraStaggerMs,
        ease: 'Sine.easeIn',
      });
      this.objects.push(t);
    });

    if (opts.onAdvance) {
      const hint = scene.add
        .text(GAME_W * HALF, GAME_H - SC.hintMarginBottom, 'CLICK TO CONTINUE', {
          fontFamily: FONT_BODY,
          fontSize: `${SC.textSize}px`,
          color: cssHex(COL.chromeCream),
          stroke: cssHex(COL.vignetteBlack),
          strokeThickness: TEXT_OUTLINE.body,
        })
        .setOrigin(HALF, 1)
        .setAlpha(SC.hintAlpha)
        .setDepth(depth + 1);
      this.objects.push(hint);

      const hit = scene.add
        .rectangle(GAME_W * HALF, GAME_H * HALF, GAME_W, GAME_H)
        .setDepth(depth + 2)
        .setInteractive({ useHandCursor: true })
        .once('pointerdown', () => opts.onAdvance?.());
      this.objects.push(hit);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const o of this.objects) {
      this.scene.tweens.killTweensOf(o);
      o.destroy();
    }
    this.objects = [];
  }
}
