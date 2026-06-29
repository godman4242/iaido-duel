import Phaser from 'phaser';
import { GAME_W, GAME_H, DEV } from './config';
import { BootScene } from './game/scenes/BootScene';
import { TitleScene } from './game/scenes/TitleScene';
import { PrologueScene } from './game/scenes/PrologueScene';
import { TownScene } from './game/scenes/TownScene';
import { DuelScene } from './game/scenes/DuelScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#0d0d0d',
  scene: [BootScene, TitleScene, PrologueScene, TownScene, DuelScene],
  render: { antialias: true, roundPixels: false },
});

// Dev-only fidelity gate: ?compare=<still> pins a reference frame beside the game.
if (DEV) {
  const params = new URLSearchParams(location.search);
  if (params.has('compare')) {
    void import('./dev/CompareView').then((m) =>
      m.mountCompareView(params.get('compare') || 'forest_fight.png'),
    );
  }
}
