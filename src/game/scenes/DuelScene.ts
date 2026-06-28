import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { COL } from '../../palette';
import { Fighter } from '../fighter/Fighter';

const GROUND_Y = GAME_H - 96;

export class DuelScene extends Phaser.Scene {
  constructor() {
    super('Duel');
  }

  create() {
    // placeholder sky + ground until the parallax forest lands (Task 19)
    this.cameras.main.setBackgroundColor(COL.skyTop);
    const g = this.add.graphics();
    g.fillStyle(COL.forestShadow, 1).fillRect(0, GROUND_Y + 60, GAME_W, GAME_H - GROUND_Y);
    g.fillStyle(COL.forestDark, 1).fillRect(0, GROUND_Y + 56, GAME_W, 6);

    // self-register with the scene via their constructors
    new Fighter(this, GAME_W * 0.34, GROUND_Y, 1, { stance: 'balanced' });
    new Fighter(this, GAME_W * 0.66, GROUND_Y, -1, { stance: 'heavy' });

    this.add
      .text(GAME_W / 2, 24, 'iaido-duel', { fontFamily: 'serif', fontSize: '20px', color: '#efedc2' })
      .setOrigin(0.5);
  }
}
