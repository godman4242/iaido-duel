import Phaser from 'phaser';
import { AIState, AIParams, nextAIState } from '../../core/ai';
import { COL } from '../../palette';
import { Fighter } from '../fighter/Fighter';

const ENEMY_SPEED = 0.17; // px/ms

export type AIControllerOpts = {
  self: Fighter;
  target: Fighter;
  /** Resolve the enemy's strike against the player. Called once when the attack lands. */
  onAttack: () => void;
  /** True while the player is mid-slash (the AI's cue to block/dodge). */
  isTargetWindup: () => boolean;
  params?: Partial<AIParams>;
};

/** Drives the enemy Fighter from the pure AI state machine: approach → telegraph → attack, with reactions. */
export class AIController {
  private state: AIState = 'idle';
  private tInState = 0;
  private params: AIParams;
  private tell: Phaser.GameObjects.Graphics;

  constructor(
    private scene: Phaser.Scene,
    private opts: AIControllerOpts,
  ) {
    this.params = {
      approachRange: 620,
      strikeRange: 132,
      reactBlockChance: 0.33,
      reactDodgeChance: 0.22,
      ...opts.params,
    };
    this.tell = scene.add.graphics();
    this.tell.setDepth(60);
  }

  stateName(): AIState {
    return this.state;
  }

  update(delta: number) {
    const { self, target } = this.opts;
    this.tInState += delta;

    const distance = Math.abs(self.x - target.x);
    const windup = this.opts.isTargetWindup();
    const next = nextAIState(
      this.state,
      this.tInState,
      { distance, playerAttacking: windup, playerWindup: windup, selfRecovering: this.state === 'recover', rng: Math.random() },
      this.params,
    );
    if (next !== this.state) this.enter(next);

    // continuous per-state behaviour
    self.facing = target.x >= self.x ? 1 : -1;
    self.scaleX = self.facing;
    if (this.state === 'approach' && distance > this.params.strikeRange) {
      self.x += -self.facing * 0 + Math.sign(target.x - self.x) * ENEMY_SPEED * delta;
    }
    this.drawTell();
  }

  private enter(state: AIState) {
    const { self } = this.opts;
    // leaving a state: clear its effects
    self.blocking = false;
    self.setGuard('none');
    this.state = state;
    this.tInState = 0;

    switch (state) {
      case 'telegraph':
        self.setGuard('telegraph');
        break;
      case 'attack':
        self.slash();
        this.opts.onAttack();
        break;
      case 'block':
        self.blocking = true;
        self.setGuard('block');
        break;
      case 'dodge': {
        const back = -self.facing * 70;
        this.scene.tweens.add({ targets: self, x: self.x + back, duration: 200, yoyo: true, ease: 'Quad.easeOut' });
        break;
      }
      case 'recover':
      case 'idle':
      case 'approach':
        break;
    }
  }

  private drawTell() {
    this.tell.clear();
    if (this.state !== 'telegraph') return;
    const { self } = this.opts;
    // a red caret above the enemy, pulsing with the wind-up
    const pulse = 0.5 + 0.5 * Math.sin(this.tInState / 50);
    const y = self.y - 150;
    this.tell.fillStyle(COL.blood, 0.5 + 0.5 * pulse);
    this.tell.beginPath();
    this.tell.moveTo(self.x - 10, y);
    this.tell.lineTo(self.x + 10, y);
    this.tell.lineTo(self.x, y + 14);
    this.tell.closePath();
    this.tell.fillPath();
  }
}
