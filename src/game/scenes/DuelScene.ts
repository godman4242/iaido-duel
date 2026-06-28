import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { COL } from '../../palette';
import { Fighter } from '../fighter/Fighter';
import { IDLE_POSE, SLASH_POSE } from '../fighter/Skeleton';
import { GestureInput } from '../input/GestureInput';
import { BladeTrail } from '../vfx/BladeTrail';
import { STANCES, counterBonus } from '../../core/stance';
import { Focus } from '../../core/focus';
import { resolveSlash, SlashInput } from '../../core/slash';

const GROUND_Y = GAME_H - 96;
const MOVE_SPEED = 0.28; // px per ms

export class DuelScene extends Phaser.Scene {
  private player!: Fighter;
  private enemy!: Fighter;
  private trail!: BladeTrail;
  private playerFocus = new Focus();
  private keys!: Record<'left' | 'right', Phaser.Input.Keyboard.Key>;
  private hpText!: Phaser.GameObjects.Text;
  private busyUntil = 0;

  constructor() {
    super('Duel');
  }

  create() {
    this.cameras.main.setBackgroundColor(COL.skyTop);
    const g = this.add.graphics();
    g.fillStyle(COL.forestShadow, 1).fillRect(0, GROUND_Y + 60, GAME_W, GAME_H - GROUND_Y);
    g.fillStyle(COL.forestDark, 1).fillRect(0, GROUND_Y + 56, GAME_W, 6);

    this.player = new Fighter(this, GAME_W * 0.43, GROUND_Y, 1, { stance: 'balanced' });
    this.enemy = new Fighter(this, GAME_W * 0.57, GROUND_Y, -1, { stance: 'heavy' });
    this.playerFocus.gain(100); // start ready to crit for testing; tuned later

    this.trail = new BladeTrail(this);

    new GestureInput(this, {
      onStart: (p) => {
        this.trail.begin();
        this.trail.push(p);
      },
      onMove: (p) => this.trail.push(p),
      onEnd: (path, gesture) => {
        this.trail.end();
        if (gesture === 'slash') this.doSlash(path);
      },
    });

    const kb = this.input.keyboard!;
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.hpText = this.add
      .text(GAME_W / 2, 24, '', { fontFamily: 'monospace', fontSize: '16px', color: '#efedc2' })
      .setOrigin(0.5);
  }

  private doSlash(path: { x: number; y: number }[]) {
    if (this.time.now < this.busyUntil) return;
    this.busyUntil = this.time.now + 220;
    this.player.setPose(SLASH_POSE);
    this.time.delayedCall(150, () => this.player.setPose(IDLE_POSE));

    const stance = STANCES[this.player.stanceId];
    const input: SlashInput = {
      path,
      origin: this.player.swordHand(),
      reach: stance.reach,
      dmgMult: stance.dmgMult,
      crit: this.playerFocus.isCrit(),
      counter: counterBonus(this.player.stanceId, this.enemy.stanceId),
    };
    const result = resolveSlash(
      input,
      this.enemy.worldLimbs(),
      this.player.atkPlusWeapon,
      STANCES[this.enemy.stanceId].damageTakenMult,
    );
    if (result.hits.length) this.enemy.applyHit(result);
  }

  update(_time: number, delta: number) {
    // lateral movement to close/open distance
    let dir = 0;
    if (this.keys.left.isDown) dir -= 1;
    if (this.keys.right.isDown) dir += 1;
    this.player.x = Phaser.Math.Clamp(this.player.x + dir * MOVE_SPEED * delta, 60, GAME_W - 60);

    // always face the opponent
    this.player.facing = this.enemy.x >= this.player.x ? 1 : -1;
    this.player.scaleX = this.player.facing;

    this.trail.update(delta);
    this.hpText.setText(
      `enemy HP ${this.enemy.health}/${this.enemy.maxHealth}   [A/D move, draw across to slash]`,
    );
  }
}
