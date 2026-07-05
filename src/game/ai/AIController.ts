import type Phaser from 'phaser';
import { COL } from '../../palette';
import type { Fighter } from '../fighter/Fighter';

/**
 * M2 port: the AI's DECISIONS moved behind the seam (core/AISeamController — FSM + seeded
 * rng emitting OpponentIntent through core/Sim). This class is now only the render half:
 * a telegraph-caret / guard-pose painter that READS the ronin's sim state every frame
 * (blueprint §1.C: DuelScene renders sim state; the port-contract inventory names this
 * exact shrink). It never moves the fighter, never rolls rng, never deals damage.
 */

/** The slice of the ronin's FighterSimState the painter reads (structural, read-only). */
export type TelegraphView = {
  x: number;
  y: number;
  windupMs: number; // > 0 ⇒ a strike telegraph is held (Tell 13)
  pendingSmokeMs: number; // > 0 ⇒ a smoke-bomb telegraph is held
  blocking: boolean; // held block pose (react-block)
};

/** The puppet slice the painter drives (structural — Fighter satisfies it). */
export type GuardPuppet = Pick<Fighter, 'setGuard'>;

export class AIController {
  private tell: Phaser.GameObjects.Graphics;
  private tPulse = 0;

  constructor(
    scene: Phaser.Scene,
    private self: GuardPuppet,
  ) {
    this.tell = scene.add.graphics();
    this.tell.setDepth(60);
  }

  /** Mirror the sim's telegraph/block state onto the puppet pose + the pulsing caret. */
  update(view: TelegraphView, delta: number): void {
    this.tPulse += Number.isFinite(delta) && delta > 0 ? delta : 0;
    const telegraphing = view.windupMs > 0 || view.pendingSmokeMs > 0;
    if (view.blocking === true) this.self.setGuard('block');
    else if (telegraphing) this.self.setGuard('telegraph');
    else this.self.setGuard('none');
    this.drawTell(view, telegraphing);
  }

  destroy(): void {
    this.tell.destroy();
  }

  /** A red caret above the ronin, pulsing while a committing action is telegraphed. */
  private drawTell(view: TelegraphView, telegraphing: boolean): void {
    this.tell.clear();
    if (!telegraphing || !Number.isFinite(view.x) || !Number.isFinite(view.y)) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.tPulse / 50);
    const y = view.y - 150;
    this.tell.fillStyle(COL.blood, 0.5 + 0.5 * pulse);
    this.tell.beginPath();
    this.tell.moveTo(view.x - 10, y);
    this.tell.lineTo(view.x + 10, y);
    this.tell.lineTo(view.x, y + 14);
    this.tell.closePath();
    this.tell.fillPath();
  }
}
