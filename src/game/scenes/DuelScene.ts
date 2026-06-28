import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { COL } from '../../palette';
import { Fighter } from '../fighter/Fighter';
import { IDLE_POSE, SLASH_POSE } from '../fighter/Skeleton';
import { GestureInput } from '../input/GestureInput';
import { BladeTrail } from '../vfx/BladeTrail';
import { STANCES, counterBonus, StanceId } from '../../core/stance';
import { Focus } from '../../core/focus';
import { resolveSlash, SlashInput, SlashResult } from '../../core/slash';
import { Gore } from '../vfx/Gore';
import { Hud } from '../ui/Hud';

const GROUND_Y = GAME_H - 96;
const MOVE_SPEED = 0.28; // px per ms

export class DuelScene extends Phaser.Scene {
  private player!: Fighter;
  private enemy!: Fighter;
  private trail!: BladeTrail;
  private gore!: Gore;
  private hud!: Hud;
  private playerFocus = new Focus();
  private keys!: Record<'left' | 'right', Phaser.Input.Keyboard.Key>;
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

    this.trail = new BladeTrail(this);
    this.gore = new Gore(this);
    this.hud = new Hud(this, { player: this.player, enemy: this.enemy, focus: this.playerFocus });
    this.playerFocus.gain(50); // start with enough Focus to switch once; builds from hits (tunable)

    new GestureInput(this, {
      onStart: (p) => {
        this.trail.begin();
        this.trail.push(p);
      },
      onMove: (p) => this.trail.push(p),
      onEnd: (path, gesture) => {
        this.trail.end();
        this.handleGesture(path, gesture);
      },
    });

    const kb = this.input.keyboard!;
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    kb.on('keydown-B', () => {
      Gore.reduced = !Gore.reduced;
    });
    kb.on('keydown-SPACE', () => this.cycleStance());

    this.add
      .text(GAME_W / 2, 22, 'A/D move   ·   draw across to slash   ·   SPACE switch stance', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#d8dbf1',
      })
      .setOrigin(0.5)
      .setAlpha(0.7);
  }

  private cycleStance() {
    if (!this.playerFocus.canSwitch()) return;
    this.playerFocus.spendSwitch();
    const order: StanceId[] = ['light', 'balanced', 'heavy'];
    const i = order.indexOf(this.player.stanceId);
    this.player.stanceId = order[(i + 1) % order.length];
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
    this.applyAndSpray(this.enemy, result);
    if (result.hits.length) {
      const severed = result.hits.filter((h) => h.severed).length;
      this.playerFocus.gain(16 + severed * 10);
    }
  }

  private handleGesture(path: { x: number; y: number }[], gesture: string) {
    if (this.time.now < this.busyUntil) return;
    switch (gesture) {
      case 'slash':
        this.doSlash(path);
        break;
      case 'jump':
        this.busyUntil = this.time.now + 480;
        this.tweens.add({ targets: this.player, y: GROUND_Y - 95, duration: 230, yoyo: true, ease: 'Quad.easeOut' });
        break;
      case 'launch':
        this.dealSpecial(0.9, 130);
        break;
      case 'stab':
        this.dealSpecial(1.45, 0);
        break;
    }
  }

  /** A close-range special move (launch / stab): connects if the enemy is within reach. */
  private dealSpecial(mult: number, knockUp: number) {
    this.busyUntil = this.time.now + 320;
    this.player.setPose(SLASH_POSE);
    this.time.delayedCall(150, () => this.player.setPose(IDLE_POSE));

    const stance = STANCES[this.player.stanceId];
    if (Math.abs(this.enemy.x - this.player.swordHand().x) > stance.reach) return;
    const crit = this.playerFocus.isCrit();
    const base =
      this.player.atkPlusWeapon *
      stance.dmgMult *
      mult *
      (crit ? 1.3 : 1) *
      counterBonus(this.player.stanceId, this.enemy.stanceId);
    const dmg = Math.round(base * STANCES[this.enemy.stanceId].damageTakenMult);
    this.enemy.health = Math.max(0, this.enemy.health - dmg);
    this.enemy.redraw();
    this.gore.spray({ x: this.enemy.x, y: this.enemy.y - 46 }, 9);
    this.playerFocus.gain(14);
    if (knockUp > 0) {
      this.tweens.add({ targets: this.enemy, y: this.enemy.y - knockUp, duration: 240, yoyo: true, ease: 'Quad.easeOut' });
    }
  }

  /** Apply a slash result to a fighter and spray blood / sever decals for each hit. */
  private applyAndSpray(target: Fighter, result: SlashResult) {
    if (!result.hits.length) return;
    target.applyHit(result);
    for (const h of result.hits) {
      this.gore.spray(h.cutPoint, h.severed ? 16 : 7);
      if (h.severed) this.gore.severDecal(h.cutPoint);
    }
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
    this.hud.update();
  }
}
