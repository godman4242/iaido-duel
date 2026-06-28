import Phaser from 'phaser';
import { GAME_W, GAME_H } from './config';
import { DuelScene } from './game/scenes/DuelScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#0d0d0d',
  scene: [DuelScene],
  render: { antialias: true, roundPixels: false },
});
