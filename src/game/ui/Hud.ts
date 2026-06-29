import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { COL } from '../../palette';
import { Focus, FOCUS_MAX } from '../../core/focus';
import { Fighter } from '../fighter/Fighter';

type HudOpts = { player: Fighter; enemy: Fighter; focus: Focus };

/** Bottom-left stance portrait + health/Focus bars, plus floating name/health over each fighter. */
export class Hud {
  private g: Phaser.GameObjects.Graphics;
  private stanceLabel: Phaser.GameObjects.Text;
  private pName: Phaser.GameObjects.Text;
  private eName: Phaser.GameObjects.Text;
  private combo: Phaser.GameObjects.Text;
  private comboLabel: Phaser.GameObjects.Text;
  private lastCombo = 0;

  constructor(
    scene: Phaser.Scene,
    private opts: HudOpts,
  ) {
    this.g = scene.add.graphics();
    this.g.setDepth(100);
    const f = { fontFamily: 'serif', fontSize: '13px', color: '#efedc2' };
    this.stanceLabel = scene.add.text(118, GAME_H - 34, '', f).setOrigin(0, 0.5).setDepth(101);
    this.pName = scene.add.text(0, 0, 'YOU', { ...f, fontSize: '12px' }).setOrigin(0.5).setDepth(101);
    this.eName = scene.add
      .text(0, 0, 'RONIN', { ...f, fontSize: '12px' })
      .setOrigin(0.5)
      .setDepth(101);
    this.comboLabel = scene.add
      .text(GAME_W - 20, 16, 'HIT COMBO', { fontFamily: 'monospace', fontSize: '12px', color: '#e8a83a' })
      .setOrigin(1, 0)
      .setDepth(101)
      .setVisible(false);
    this.combo = scene.add
      .text(GAME_W - 20, 30, '', { fontFamily: 'Georgia, serif', fontStyle: 'bold', fontSize: '34px', color: '#c01f29' })
      .setOrigin(1, 0)
      .setDepth(101);
  }

  private bar(x: number, y: number, w: number, h: number, frac: number, color: number) {
    this.g.fillStyle(COL.outline, 0.7).fillRect(x - 2, y - 2, w + 4, h + 4);
    this.g.fillStyle(0x222018, 1).fillRect(x, y, w, h);
    this.g.fillStyle(color, 1).fillRect(x, y, Math.max(0, w * frac), h);
  }

  private portrait(cx: number, cy: number, r: number) {
    const g = this.g;
    g.fillStyle(COL.cream, 1).fillCircle(cx, cy, r + 3);
    g.fillStyle(0x3a2a1c, 1).fillCircle(cx, cy, r);
    // tiny straw-hat glyph + face
    g.fillStyle(COL.skin, 1).fillCircle(cx, cy + 4, r * 0.5);
    g.fillStyle(COL.wood, 1);
    g.beginPath();
    g.moveTo(cx - r * 0.85, cy - 2);
    g.lineTo(cx + r * 0.85, cy - 2);
    g.lineTo(cx, cy - r * 0.9);
    g.closePath();
    g.fillPath();
  }

  private floating(fighter: Fighter, label: Phaser.GameObjects.Text) {
    const top = fighter.y - 128;
    label.setPosition(fighter.x, top - 12);
    const w = 56;
    this.bar(fighter.x - w / 2, top, w, 6, fighter.health / fighter.maxHealth, COL.healthGreen);
  }

  update(comboCount = 0) {
    const { player, enemy, focus } = this.opts;
    this.g.clear();

    // bottom-left player panel
    this.portrait(66, GAME_H - 56, 34);
    this.bar(110, GAME_H - 70, 150, 12, player.health / player.maxHealth, COL.healthGreen);
    this.bar(110, GAME_H - 52, 150, 9, focus.value / FOCUS_MAX, COL.focusBlue);
    this.stanceLabel.setText(`${player.stanceId.toUpperCase()} STANCE${focus.isCrit() ? '  ⚡' : ''}`);

    this.floating(player, this.pName);
    this.floating(enemy, this.eName);

    // HIT COMBO counter (top-right), pulses when it climbs
    const show = comboCount >= 2;
    this.comboLabel.setVisible(show);
    this.combo.setText(show ? String(comboCount) : '');
    if (show && comboCount > this.lastCombo) {
      this.combo.setScale(1.4);
      (this.combo.scene as Phaser.Scene).tweens.add({ targets: this.combo, scale: 1, duration: 160, ease: 'Quad.easeOut' });
    }
    this.lastCombo = comboCount;
  }
}
