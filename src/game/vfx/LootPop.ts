import Phaser from 'phaser';
import { Pt } from '../../core/vec';
import { COL } from '../../palette';
import { LOOT_FX } from '../../config/fx';
import { FX_DEPTH, LOOT_DROP, MS_PER_S } from '../../config/fx-extra';

/**
 * Loot pop (ART_DIRECTION §4 + tell #8): coins (gold discs with a shine tick) and item
 * papers (white rects) tumble out of a kill with physics — an upward cone burst, gravity,
 * ground bounces — then settle and twinkle. Loot PERSISTS for the whole fight.
 *
 * Integrator hook: call `lootPop(scene, { x, y }, groundY)` on a kill.
 */

type Piece = {
  g: Phaser.GameObjects.Graphics;
  vx: number;
  vy: number;
  spin: number; // deg/s
  floorY: number;
  elapsed: number;
  settled: boolean;
};

// shine-tick tone: COL has no plain white — the paper tone reads white at this size.
const SHINE_WHITE = COL.lootPaper;

function drawCoin(g: Phaser.GameObjects.Graphics): void {
  const r = LOOT_FX.coinRadius;
  g.fillStyle(COL.coinGold, 1);
  g.fillCircle(0, 0, r);
  g.lineStyle(LOOT_DROP.coinRimW, COL.obiShade, 1); // darker gold rim
  g.strokeCircle(0, 0, r - LOOT_DROP.coinRimW / 2);
  g.lineStyle(LOOT_DROP.shineW, SHINE_WHITE, 1); // shine tick across the upper-left face
  g.beginPath();
  g.moveTo(-LOOT_DROP.shineLen, -LOOT_DROP.shineLen / 2);
  g.lineTo(0, -LOOT_DROP.shineLen);
  g.strokePath();
}

function drawPaper(g: Phaser.GameObjects.Graphics): void {
  const w = LOOT_FX.paperW;
  const h = LOOT_FX.paperH;
  g.fillStyle(COL.lootPaper, 1);
  g.fillRect(-w / 2, -h / 2, w, h);
  g.lineStyle(LOOT_DROP.paperOutlineW, COL.outline, 1);
  g.strokeRect(-w / 2, -h / 2, w, h);
  g.lineStyle(1, COL.outline, LOOT_DROP.paperFoldAlpha); // faint fold line
  g.beginPath();
  g.moveTo(-w / 2, 0);
  g.lineTo(w / 2, 0);
  g.strokePath();
}

/** Spawn one tumbling piece launched in an upward cone from `at`. */
function spawnPiece(scene: Phaser.Scene, at: Pt, groundY: number, draw: (g: Phaser.GameObjects.Graphics) => void): Piece {
  const g = scene.add.graphics().setPosition(at.x, at.y).setDepth(FX_DEPTH.loot);
  draw(g);
  const speed = Phaser.Math.FloatBetween(LOOT_FX.popSpeedMin, LOOT_FX.popSpeedMax);
  // straight up ± the ejection half-cone
  const a = -Math.PI / 2 + Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-LOOT_FX.popConeDeg, LOOT_FX.popConeDeg));
  return {
    g,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    spin: Phaser.Math.Between(-LOOT_FX.spinDegPerS, LOOT_FX.spinDegPerS),
    floorY: groundY + Phaser.Math.Between(-LOOT_DROP.groundJitter, LOOT_DROP.groundJitter),
    elapsed: 0,
    settled: false,
  };
}

/**
 * Pop coins + item papers out of a kill at `at`; they arc, bounce on `groundY`, settle,
 * then twinkle in place forever (loot persists — tell #8).
 */
export function lootPop(scene: Phaser.Scene, at: Pt, groundY: number, counts?: { coins?: number; papers?: number }): void {
  const coins = counts?.coins ?? Phaser.Math.Between(LOOT_DROP.coinsMin, LOOT_DROP.coinsMax);
  const papers = counts?.papers ?? Phaser.Math.Between(LOOT_DROP.papersMin, LOOT_DROP.papersMax);
  const pieces: Piece[] = [];
  for (let i = 0; i < coins; i++) pieces.push(spawnPiece(scene, at, groundY, drawCoin));
  for (let i = 0; i < papers; i++) pieces.push(spawnPiece(scene, at, groundY, drawPaper));

  const settle = (p: Piece): void => {
    p.settled = true;
    p.g.y = p.floorY;
    // subtle twinkle: a slow alpha shimmer on the settled piece (§4 "settle, twinkle")
    scene.tweens.add({
      targets: p.g,
      alpha: LOOT_DROP.twinkleAlphaLow,
      duration: LOOT_FX.twinklePeriodMs / 2,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  };

  const onUpdate = (_time: number, deltaMs: number): void => {
    const dt = deltaMs / MS_PER_S;
    let flying = 0;
    for (const p of pieces) {
      if (p.settled) continue;
      p.elapsed += deltaMs;
      p.vy += LOOT_FX.gravityY * dt;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      p.g.angle += p.spin * dt;
      if (p.g.y >= p.floorY) {
        p.g.y = p.floorY;
        if (p.vy <= LOOT_DROP.restSpeed || p.elapsed >= LOOT_FX.settleMs) {
          settle(p);
          continue;
        }
        p.vy = -p.vy * LOOT_FX.bounce; // tumble bounce
        p.vx *= LOOT_DROP.groundFriction;
        p.spin *= LOOT_DROP.spinDamp;
      } else if (p.elapsed >= LOOT_FX.settleMs) {
        // safety: force-settle anything still airborne past the settle budget
        settle(p);
        continue;
      }
      flying++;
    }
    if (flying === 0) scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));
}
