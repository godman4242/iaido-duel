import Phaser from 'phaser';
import { GAME_W, GAME_H, DEV } from './config';
import { BootScene } from './game/scenes/BootScene';
import { TitleScene } from './game/scenes/TitleScene';
import { PrologueScene } from './game/scenes/PrologueScene';
import { TownScene } from './game/scenes/TownScene';
import { DuelScene } from './game/scenes/DuelScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0d0d0d',
  // Calibrated canvas: render at the native stage size and LETTERBOX to fit the viewport, centered,
  // so the vector art scales crisply at any window size (spec §4.2 stage size; Tells 17 & 21).
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height: GAME_H,
  },
  scene: [BootScene, TitleScene, PrologueScene, TownScene, DuelScene],
  render: { antialias: true, roundPixels: false },
});

// Dev-only fidelity gate: ?compare=<still> pins a reference frame beside the game.
if (DEV) {
  // Handle for automated verification (hidden-tab runs drive game.loop.step with virtual time).
  (window as unknown as { __game?: Phaser.Game }).__game = game;
  const params = new URLSearchParams(location.search);
  if (params.has('compare')) {
    void import('./dev/CompareView').then((m) =>
      m.mountCompareView(params.get('compare') || 'forest_fight.png'),
    );
  }
}
