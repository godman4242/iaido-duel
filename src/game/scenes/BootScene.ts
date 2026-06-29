// src/game/scenes/BootScene.ts
import Phaser from 'phaser';

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
    // Title owns new-game / continue (Continue is enabled there when a save exists).
    this.scene.start('Title');
  }
}
