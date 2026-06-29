// src/game/scenes/TownScene.ts
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { GameState } from '../../core/gamestate';

/** Placeholder hub — Plan 3 replaces this with the walkable Kasuta town. */
export class TownScene extends Phaser.Scene {
  private state!: GameState;

  constructor() {
    super('Town');
  }

  init(data: { state: GameState }): void {
    this.state = data.state;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1b1410');
    this.add
      .text(GAME_W / 2, GAME_H / 2 - 18, this.state.area.toUpperCase(), {
        fontFamily: 'serif',
        fontSize: '40px',
        color: '#e9dcc3',
      })
      .setOrigin(0.5);
    this.add
      .text(
        GAME_W / 2,
        GAME_H / 2 + 28,
        `Lv ${this.state.player.level} · ${this.state.player.coins} coin · engine foundation OK`,
        { fontFamily: 'serif', fontSize: '18px', color: '#b8a888' },
      )
      .setOrigin(0.5);
  }
}
