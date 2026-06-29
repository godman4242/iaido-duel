// src/game/scenes/BootScene.ts
import Phaser from 'phaser';
import { loadGame, saveGame, createNewGame } from '../persistence/Save';

/** Entry point: routes to the campaign, preserving the standalone duel + fidelity gate. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const params = new URLSearchParams(location.search);
    // Preserve the finished duel and the ?compare= fidelity gate.
    if (params.get('scene') === 'duel' || params.has('compare')) {
      this.scene.start('Duel');
      return;
    }
    // Plan 1 Task 4: boot straight into the world with a loaded-or-new save.
    // (Task 5 inserts the Title screen and moves new/continue there.)
    const state = loadGame() ?? createNewGame();
    saveGame(state);
    this.scene.start('Town', { state });
  }
}
