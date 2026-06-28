import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { COL } from '../../palette';

export class DuelScene extends Phaser.Scene {
  constructor() {
    super('Duel');
  }

  create() {
    this.cameras.main.setBackgroundColor(COL.forestShadow);
    this.add
      .text(GAME_W / 2, GAME_H / 2, 'iaido-duel', {
        fontFamily: 'serif',
        fontSize: '32px',
        color: '#efedc2',
      })
      .setOrigin(0.5);
  }
}
