import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { COL } from '../../palette';
import { Fighter } from '../fighter/Fighter';
import { GestureInput } from '../input/GestureInput';
import { KillBeat } from './KillBeat';
import { BladeTrail } from '../vfx/BladeTrail';
import { STANCES, counterBonus, StanceId } from '../../core/stance';
import { Focus } from '../../core/focus';
import { resolveSlash, SlashInput, SlashResult } from '../../core/slash';
import { Gore } from '../vfx/Gore';
import { Hud } from '../ui/Hud';
import { AIController } from '../ai/AIController';
import { Forest } from '../background/Forest';
import { playSlash, playImpact, playStanceSwitch, playGrunt, resumeAudio, toggleMuted } from '../audio/sfx';
import { Combo } from '../../core/combo';

const GROUND_Y = GAME_H - 96;
const MOVE_SPEED = 0.28; // px per ms

const LIMB_COLOR: Record<string, number> = {
  armF: COL.haori,
  forearmF: COL.haori,
  legF: COL.kimono,
  legB: COL.kimono,
  head: COL.skin,
};

export class DuelScene extends Phaser.Scene {
  private player!: Fighter;
  private enemy!: Fighter;
  private trail!: BladeTrail;
  private gore!: Gore;
  private hud!: Hud;
  private ai!: AIController;
  private forest!: Forest;
  private playerFocus = new Focus();
  private combo = new Combo();
  private keys!: Record<'left' | 'right', Phaser.Input.Keyboard.Key>;
  private busyUntil = 0;
  private playerWindupUntil = 0;
  private over = false;
  private finishing = false;
  private graceUntil = 0;

  constructor() {
    super('Duel');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x4ba1a4);
    this.forest = new Forest(this, GROUND_Y);

    this.player = new Fighter(this, GAME_W * 0.43, GROUND_Y, 1, { stance: 'balanced' });
    this.enemy = new Fighter(this, GAME_W * 0.57, GROUND_Y, -1, {
      stance: 'heavy',
      skin: { haori: COL.haoriEnemy, haoriShade: COL.haoriEnemyShade },
    });

    this.trail = new BladeTrail(this);
    this.gore = new Gore(this);
    this.hud = new Hud(this, { player: this.player, enemy: this.enemy, focus: this.playerFocus });
    this.playerFocus.gain(50); // start with enough Focus to switch once; builds from hits (tunable)

    // spawn grace: both fighters invulnerable + blinking briefly at the start of the duel
    this.over = false;
    this.finishing = false;
    this.combo.reset();
    this.cameras.main.setZoom(1);
    this.graceUntil = this.time.now + 1500;
    for (const f of [this.player, this.enemy]) {
      this.tweens.add({ targets: f, alpha: 0.35, duration: 150, yoyo: true, repeat: 4 });
    }

    new GestureInput(this, {
      onStart: (p) => {
        resumeAudio();
        this.trail.begin();
        this.trail.push(p);
        this.playerWindupUntil = this.time.now + 360; // the AI can react to an incoming slash
      },
      onMove: (p) => this.trail.push(p),
      onEnd: (path, gesture) => {
        this.trail.end();
        this.handleGesture(path, gesture);
      },
    });

    this.ai = new AIController(this, {
      self: this.enemy,
      target: this.player,
      onAttack: () => this.enemyStrike(),
      isTargetWindup: () => this.time.now < this.playerWindupUntil,
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
    kb.on('keydown-R', () => this.scene.restart());
    kb.on('keydown-M', () => toggleMuted());
    kb.once('keydown', () => resumeAudio());

    this.add
      .text(GAME_W / 2, 22, 'A/D move   ·   draw across to slash   ·   SPACE switch stance', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#d8dbf1',
      })
      .setOrigin(0.5)
      .setAlpha(0.7);

    // small homage credit (always visible, low-key)
    this.add
      .text(
        GAME_W - 8,
        GAME_H - 8,
        'Fan homage of Straw Hat Samurai: Duels by Explosive Barrel — unaffiliated, non-commercial.',
        { fontFamily: 'monospace', fontSize: '10px', color: '#eceffe' },
      )
      .setOrigin(1, 1)
      .setAlpha(0.5)
      .setDepth(120);

    // dev hook for inspecting live state from the console
    (window as unknown as { __duel?: DuelScene }).__duel = this;
  }

  /** Dev: snapshot of live combat state. */
  debugState() {
    return {
      playerHP: this.player.health,
      enemyHP: this.enemy.health,
      focus: Math.round(this.playerFocus.value),
      enemyState: this.ai.stateName(),
      dist: Math.round(Math.abs(this.player.x - this.enemy.x)),
    };
  }

  private cycleStance() {
    if (this.over || !this.playerFocus.canSwitch()) return;
    this.playerFocus.spendSwitch();
    const order: StanceId[] = ['light', 'balanced', 'heavy'];
    const i = order.indexOf(this.player.stanceId);
    this.player.stanceId = order[(i + 1) % order.length];
    playStanceSwitch();
  }

  private doSlash(path: { x: number; y: number }[]) {
    if (this.time.now < this.busyUntil) return;
    this.busyUntil = this.time.now + 220;
    this.player.slash();

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
    playSlash();
    this.applyAndSpray(this.enemy, result);
    if (result.hits.length && !this.enemy.blocking && !this.inGrace()) {
      playImpact();
      const severed = result.hits.filter((h) => h.severed).length;
      this.playerFocus.gain(16 + severed * 10);
      this.combo.hit(this.time.now);
    } else {
      this.combo.reset();
    }
  }

  /** Killing-blow beat: the loser collapses, then a fast red wash + running silhouette (matches the source). */
  private onKill(playerWon: boolean) {
    if (this.finishing) return;
    this.finishing = true;
    this.over = true;
    (playerWon ? this.enemy : this.player).die();
    // brief on-field collapse glimpse, then the red wash takes over
    this.time.delayedCall(200, () => new KillBeat(this).play(playerWon));
  }

  private handleGesture(path: { x: number; y: number }[], gesture: string) {
    if (this.over || this.time.now < this.busyUntil) return;
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
    this.player.slash();
    playSlash();

    const stance = STANCES[this.player.stanceId];
    if (Math.abs(this.enemy.x - this.player.swordHand().x) > stance.reach) return;
    if (this.enemy.blocking) {
      this.spark({ x: this.enemy.x, y: this.enemy.y - 46 });
      return;
    }
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
    playImpact();
    this.playerFocus.gain(14);
    if (knockUp > 0) {
      this.tweens.add({ targets: this.enemy, y: this.enemy.y - knockUp, duration: 240, yoyo: true, ease: 'Quad.easeOut' });
    }
  }

  private inGrace() {
    return this.time.now < this.graceUntil;
  }

  /** Apply a slash result to a fighter and spray blood / sever decals for each hit. */
  private applyAndSpray(target: Fighter, result: SlashResult) {
    if (!result.hits.length) return;
    if (target.blocking || this.inGrace()) {
      this.spark(result.hits[0].cutPoint);
      return;
    }
    target.applyHit(result);
    for (const h of result.hits) {
      this.gore.spray(h.cutPoint, h.severed ? 16 : 7);
      if (h.severed) {
        this.gore.severDecal(h.cutPoint);
        const color = LIMB_COLOR[h.limbId] ?? (target === this.enemy ? COL.haoriEnemy : COL.haori);
        this.gore.flyLimb(h.cutPoint, target.facing, color);
      }
    }
  }

  /** The enemy's strike at the player (a heavy lunge); misses if the player retreated out of reach. */
  private enemyStrike() {
    if (this.over || this.inGrace()) return;
    const stance = STANCES[this.enemy.stanceId];
    if (Math.abs(this.player.x - this.enemy.x) > stance.reach + 30) return;
    const base = this.enemy.atkPlusWeapon * stance.dmgMult * counterBonus(this.enemy.stanceId, this.player.stanceId);
    const dmg = Math.round(base * STANCES[this.player.stanceId].damageTakenMult);
    this.player.health = Math.max(0, this.player.health - dmg);
    this.player.hitAnim();
    this.player.redraw();
    this.gore.spray({ x: this.player.x, y: this.player.y - 46 }, 9);
    playImpact();
    playGrunt();
  }

  /** A short white block-clink flash. */
  private spark(at: { x: number; y: number }) {
    const s = this.add.graphics().setDepth(70);
    s.fillStyle(0xffffff, 1).fillCircle(at.x, at.y, 6);
    this.tweens.add({
      targets: s,
      scale: 2.4,
      alpha: 0,
      duration: 180,
      onComplete: () => s.destroy(),
    });
  }

  update(_time: number, delta: number) {
    if (!this.finishing && (this.enemy.isDead || this.player.isDead)) {
      this.onKill(this.enemy.isDead);
    }

    let playerMoving = false;
    let enemyMoving = false;

    if (!this.over) {
      let dir = 0;
      if (this.keys.left.isDown) dir -= 1;
      if (this.keys.right.isDown) dir += 1;
      this.player.x = Phaser.Math.Clamp(this.player.x + dir * MOVE_SPEED * delta, 60, GAME_W - 60);
      playerMoving = dir !== 0;

      this.player.facing = this.enemy.x >= this.player.x ? 1 : -1;
      this.player.scaleX = this.player.facing;

      this.forest.update(this.player.x);
      this.ai.update(delta);
      enemyMoving = this.ai.stateName() === 'approach';
      this.trail.update(delta);
    }

    // animate both fighters every frame (incl. the death fall while finishing)
    this.player.update(delta, playerMoving);
    this.enemy.update(delta, enemyMoving);
    this.hud.update(this.combo.value(this.time.now));
  }
}
