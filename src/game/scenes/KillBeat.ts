import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { COL } from '../../palette';
import { drawSkeleton } from '../fighter/drawFighter';
import { IDLE_POSE, SLASH_FOLLOW, SLASH_WINDUP, addOffsets, Pose } from '../fighter/Skeleton';
import { walkOffsets } from '../../core/anim';
import { WIN_SCREEN } from '../../config/fx';
import { FX_DEPTH, KILL_COLORS, KILL_TIMING, WIN_LAYOUT, cssHex } from '../../config/fx-extra';
import { FONT_BODY, FONT_DISPLAY, FONT_SIZE } from '../../config/typography';

/**
 * The end-of-duel result screen, built to the §7 "YOU WIN anatomy" (p1 f03/f07; p2 f11):
 * flat red field; bottom ~12% black ground-silhouette strip with an irregular top edge,
 * grass nicks and debris mounds; 1–3 black fighter victory-pose silhouettes; the title in
 * tall brush caps — red fill + white outline, per-letter rotation/baseline jitter — sitting
 * on an irregular black ink splat with drips. Entry keeps the source's beat: the red wash
 * snaps in fast, a black silhouette sprints across, then the anatomy reveals.
 * The lose variant reuses the same anatomy over the dark grey field.
 */
export class KillBeat {
  constructor(private scene: Phaser.Scene) {}

  play(playerWon: boolean): void {
    const s = this.scene;
    const win = playerWon;
    const cx = GAME_W / 2;
    const fieldCol = win ? COL.finisherRed : KILL_COLORS.loseField;
    const groundCol = win ? KILL_COLORS.splatInk : KILL_COLORS.loseGround;
    const stripTop = GAME_H * (1 - WIN_SCREEN.groundStripFrac);

    // — precompute the irregular ground strip once (stable across the snap-in repaints) —
    const edge: { x: number; y: number }[] = [];
    for (let x = 0; x <= GAME_W + WIN_LAYOUT.groundEdgeStep; x += WIN_LAYOUT.groundEdgeStep) {
      edge.push({
        x: Math.min(x, GAME_W),
        y: stripTop + Phaser.Math.Between(-WIN_LAYOUT.groundEdgeJitter, WIN_LAYOUT.groundEdgeJitter),
      });
    }
    const edgeY = (x: number): number => edge[Phaser.Math.Clamp(Math.round(x / WIN_LAYOUT.groundEdgeStep), 0, edge.length - 1)].y;
    const nicks = Array.from({ length: WIN_SCREEN.grassNickCount }, () => ({
      x: Phaser.Math.Between(0, GAME_W),
      h: Phaser.Math.Between(WIN_LAYOUT.grassNickHMin, WIN_LAYOUT.grassNickHMax),
    }));
    const mounds = Array.from({ length: WIN_SCREEN.debrisMoundCount }, () => ({
      x: Phaser.Math.Between(0, GAME_W),
      w: Phaser.Math.Between(WIN_LAYOUT.moundWMin, WIN_LAYOUT.moundWMax),
      h: Phaser.Math.Between(WIN_LAYOUT.moundHMin, WIN_LAYOUT.moundHMax),
    }));

    // — flat field + ground strip, snapping in fast (matches the source) —
    const wash = s.add.graphics().setDepth(FX_DEPTH.killWash);
    const paint = (a: number): void => {
      wash.clear();
      wash.fillStyle(fieldCol, a).fillRect(0, 0, GAME_W, GAME_H);
      // ground silhouette strip with a wobbling top edge (§7)
      wash.fillStyle(groundCol, a);
      wash.beginPath();
      wash.moveTo(0, GAME_H);
      for (const p of edge) wash.lineTo(p.x, p.y);
      wash.lineTo(GAME_W, GAME_H);
      wash.closePath();
      wash.fillPath();
      // grass nicks — small blades poking up off the edge
      for (const n of nicks) {
        const y0 = edgeY(n.x);
        wash.beginPath();
        wash.moveTo(n.x - WIN_LAYOUT.grassNickW / 2, y0);
        wash.lineTo(n.x + WIN_LAYOUT.grassNickW / 2, y0);
        wash.lineTo(n.x, y0 - n.h);
        wash.closePath();
        wash.fillPath();
      }
      // debris mounds — low humps breaking the strip line
      for (const m of mounds) wash.fillEllipse(m.x, edgeY(m.x), m.w, m.h);
    };
    paint(0);
    s.tweens.addCounter({ from: 0, to: 1, duration: KILL_TIMING.washSnapMs, onUpdate: (t) => paint(t.getValue() ?? 0) });

    // — black running silhouette crossing left → right (legs cycle via walkOffsets) —
    const runScale = KILL_TIMING.runSilScale;
    const runY = stripTop - IDLE_POSE.footF.y * runScale; // feet on the strip's edge
    const sil = s.add.graphics().setDepth(FX_DEPTH.killSil);
    const run = { p: 0 };
    s.tweens.add({
      targets: run,
      p: 1,
      delay: KILL_TIMING.runDelayMs,
      duration: KILL_TIMING.runMs,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        const x = -WIN_LAYOUT.silSpreadX + run.p * (GAME_W + 2 * WIN_LAYOUT.silSpreadX);
        const pose = addOffsets(IDLE_POSE, walkOffsets((run.p * KILL_TIMING.runCycles) % 1, KILL_TIMING.runAmp));
        sil.clear();
        sil.setPosition(x, runY).setScale(runScale);
        drawSkeleton(sil, pose, { severed: new Set(), silhouette: true });
      },
      onComplete: () => sil.destroy(),
    });

    // — the full anatomy reveals after the run-in —
    s.time.delayedCall(KILL_TIMING.revealMs, () => {
      this.victorySilhouettes(cx, stripTop);
      const titleY = GAME_H * WIN_LAYOUT.titleYFrac;
      this.inkSplat(cx, titleY);
      this.title(cx, titleY, win);
      s.add
        .text(cx, titleY + WIN_LAYOUT.promptGapY, 'press R to duel again', {
          fontFamily: FONT_BODY,
          fontSize: `${FONT_SIZE.body}px`,
          color: cssHex(KILL_COLORS.promptText),
        })
        .setOrigin(1 / 2)
        .setAlpha(WIN_LAYOUT.promptAlpha)
        .setDepth(FX_DEPTH.killTitle);
    });
  }

  /** 1–3 black fighter-pose silhouettes standing on the strip (§7 — poses vary). */
  private victorySilhouettes(cx: number, stripTop: number): void {
    const poses: Pose[] = [IDLE_POSE, SLASH_WINDUP, SLASH_FOLLOW];
    const count = Phaser.Math.Between(1, WIN_SCREEN.silhouetteCountMax);
    const k = WIN_LAYOUT.silScale;
    for (let i = 0; i < count; i++) {
      const pose = poses[i % poses.length];
      const x = cx + (i - (count - 1) / 2) * WIN_LAYOUT.silSpreadX;
      const facing = i % 2 === 0 ? 1 : -1;
      const g = this.scene.add.graphics().setDepth(FX_DEPTH.killSil);
      g.setPosition(x, stripTop + WIN_LAYOUT.silYInset - pose.footF.y * k).setScale(k * facing, k);
      drawSkeleton(g, pose, { severed: new Set(), silhouette: true });
    }
  }

  /** Irregular black ink splat with drips + loose spatter dots, backing the title (§7). */
  private inkSplat(cx: number, cy: number): void {
    const g = this.scene.add.graphics().setDepth(FX_DEPTH.killSplat).setPosition(cx, cy);
    g.fillStyle(KILL_COLORS.splatInk, 1);
    const hw = WIN_SCREEN.splatW / 2;
    const hh = WIN_SCREEN.splatH / 2;
    g.fillEllipse(0, 0, WIN_SCREEN.splatW, WIN_SCREEN.splatH);
    // ragged blobs pushing past the main body
    for (let i = 0; i < WIN_LAYOUT.splatBlobCount; i++) {
      g.fillCircle(
        Phaser.Math.Between(-hw, hw),
        Phaser.Math.Between(-hh, hh),
        Phaser.Math.Between(WIN_LAYOUT.splatBlobRMin, WIN_LAYOUT.splatBlobRMax),
      );
    }
    // drips hanging off the lower edge
    for (let i = 0; i < WIN_SCREEN.splatDripCount; i++) {
      const x = Phaser.Math.Between(-hw + WIN_LAYOUT.splatDripW, hw - WIN_LAYOUT.splatDripW);
      const y0 = hh * Math.sqrt(Math.max(0, 1 - (x / hw) * (x / hw))) - WIN_LAYOUT.splatDripW;
      const len = Phaser.Math.Between(WIN_LAYOUT.splatDripLenMin, WIN_LAYOUT.splatDripLenMax);
      g.fillRect(x - WIN_LAYOUT.splatDripW / 2, y0, WIN_LAYOUT.splatDripW, len);
      g.fillCircle(x, y0 + len, WIN_LAYOUT.splatDripW / 2 + 1);
    }
    // loose spatter dots thrown around the splat
    for (let i = 0; i < WIN_LAYOUT.splatDotCount; i++) {
      g.fillCircle(
        Phaser.Math.Between(-WIN_LAYOUT.splatSpreadX, WIN_LAYOUT.splatSpreadX),
        Phaser.Math.Between(-WIN_LAYOUT.splatSpreadY, WIN_LAYOUT.splatSpreadY),
        Phaser.Math.Between(WIN_LAYOUT.splatDotRMin, WIN_LAYOUT.splatDotRMax),
      );
    }
  }

  /** Tall brush caps, red fill + white outline, per-letter rotation/baseline jitter (§7). */
  private title(cx: number, cy: number, win: boolean): void {
    const style = {
      fontFamily: FONT_DISPLAY,
      fontStyle: 'bold',
      fontSize: `${FONT_SIZE.winTitle}px`,
      color: cssHex(win ? KILL_COLORS.winTitleFill : KILL_COLORS.loseTitleFill),
      stroke: cssHex(win ? KILL_COLORS.winTitleOutline : KILL_COLORS.loseTitleOutline),
      strokeThickness: WIN_SCREEN.titleOutlinePx,
    };
    const box = this.scene.add.container(0, cy).setDepth(FX_DEPTH.killTitle);
    let x = 0;
    for (const ch of win ? 'YOU WIN' : 'YOU LOSE') {
      if (ch === ' ') {
        x += WIN_LAYOUT.spaceW;
        continue;
      }
      const t = this.scene
        .add.text(x, Phaser.Math.Between(-WIN_LAYOUT.titleJitterY, WIN_LAYOUT.titleJitterY), ch, style)
        .setOrigin(0, 1 / 2)
        .setAngle(Phaser.Math.FloatBetween(-WIN_SCREEN.titleLetterJitterDeg, WIN_SCREEN.titleLetterJitterDeg));
      box.add(t);
      x += t.width + WIN_LAYOUT.letterPad;
    }
    box.x = cx - x / 2; // center the assembled word
  }
}
