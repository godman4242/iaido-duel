import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { COL } from '../../palette';
import { drawSkeleton } from '../fighter/drawFighter';
import { IDLE_POSE, SLASH_FOLLOW, addOffsets } from '../fighter/Skeleton';
import { walkOffsets } from '../../core/anim';

/** The killing-blow end sequence: fast red wash, a running silhouette, then the result screen. */
export class KillBeat {
  constructor(private scene: Phaser.Scene) {}

  play(playerWon: boolean): void {
    const s = this.scene;
    const win = playerWon;

    // fast red wash (snaps in ~140ms — matches the source)
    const wash = s.add.graphics().setDepth(190);
    const paint = (a: number) => {
      wash.clear();
      wash.fillStyle(win ? COL.winRed : 0x1d2127, a).fillRect(0, 0, GAME_W, GAME_H);
      wash.fillStyle(win ? COL.winRedDeep : 0x0f1216, a).fillRect(0, GAME_H * 0.64, GAME_W, GAME_H);
    };
    paint(0);
    s.tweens.addCounter({ from: 0, to: 1, duration: 140, onUpdate: (t) => paint(t.getValue() ?? 0) });

    // black running silhouette crossing left → right (legs cycle via walkOffsets)
    const sil = s.add.graphics().setDepth(192);
    const groundY = GAME_H * 0.74;
    const run = { p: 0 };
    s.tweens.add({
      targets: run,
      p: 1,
      delay: 120,
      duration: 900,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        const x = -120 + run.p * (GAME_W + 240);
        const pose = addOffsets(IDLE_POSE, walkOffsets((run.p * 4) % 1, 1.3));
        sil.clear();
        sil.setPosition(x, groundY).setScale(1.7);
        drawSkeleton(sil, pose, { severed: new Set(), silhouette: true });
      },
    });

    // result text + restart prompt after the run-in
    s.time.delayedCall(980, () => {
      const cx = GAME_W / 2;
      const heap = s.add.graphics().setDepth(191).setPosition(cx + 130, GAME_H * 0.72);
      heap.fillStyle(COL.outline, 1);
      heap.fillEllipse(0, 18, 150, 34);
      heap.fillEllipse(-60, 4, 60, 26);

      const flourish = s.add.graphics().setDepth(192).setPosition(cx - 40, GAME_H * 0.74).setScale(1.7);
      drawSkeleton(flourish, SLASH_FOLLOW, { severed: new Set(), silhouette: true });

      s.add
        .text(cx, 130, win ? 'YOU WIN' : 'YOU LOSE', {
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontStyle: 'bold italic',
          fontSize: '78px',
          color: '#f4efe2',
          stroke: '#3a0608',
          strokeThickness: 8,
        })
        .setOrigin(0.5)
        .setDepth(200);
      s.add
        .text(cx, 196, 'press R to duel again', { fontFamily: 'monospace', fontSize: '18px', color: '#f4efe2' })
        .setOrigin(0.5)
        .setAlpha(0.85)
        .setDepth(200);
    });
  }
}
