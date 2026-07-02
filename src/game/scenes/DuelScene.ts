import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { ARENA_MARGIN } from '../../config/layout';
import { COL } from '../../palette';
import { Fighter } from '../fighter/Fighter';
import { GestureInput } from '../input/GestureInput';
import { KillBeat } from './KillBeat';
import { BladeTrail } from '../vfx/BladeTrail';
import { STANCES, counterBonus, StanceId } from '../../core/stance';
import { Focus } from '../../core/focus';
import { resolveSlash, SlashInput, SlashResult } from '../../core/slash';
import { DrawnStroke } from '../../core/DrawnStroke';
import { jumpArcPoint } from '../../core/trajectory';
import { Gore } from '../vfx/Gore';
import { lootPop } from '../vfx/LootPop';
import { FinisherFlash } from '../vfx/FinisherFlash';
import { Hud } from '../ui/Hud';
import { AIController } from '../ai/AIController';
import { Biome, createBiome } from '../background/createBiome';
import { Letterbox } from '../chrome/Letterbox';
import { SCENE_BIOMES, DUEL_SCENE } from '../../config/scenes-extra';
import { playSlash, playImpact, playStanceSwitch, playGrunt, resumeAudio, toggleMuted } from '../audio/sfx';
import { Combo } from '../../core/combo';
import { SLASH_FRAMES, FIXED_DT_MS } from '../../config/timing';
import {
  CRIT_MULT,
  JUMP_APEX,
  JUMP_MS,
  LAUNCH_DMG_MULT,
  LAUNCH_KNOCKUP,
  STAB_DMG_MULT,
  SPECIAL_MS,
  BLOOD_COUNT,
  BLOOD_COUNT_SEVERED,
  MULTI_FOE_SPACING,
  MULTI_FOE_MAX,
} from '../../config/combat';
import { Pt } from '../../core/vec';

const GROUND_Y = GAME_H - 96;
const MOVE_SPEED = 0.28; // px per ms

/** Per-stance slash recovery lock (frames → ms): Light short/fast, Heavy long/slow (Tell 6). */
const slashRecoveryMs = (stance: StanceId): number => {
  const f = SLASH_FRAMES[stance];
  return (f.windup + f.active + f.recovery) * FIXED_DT_MS;
};

const LIMB_COLOR: Record<string, number> = {
  armF: COL.haori,
  forearmF: COL.haori,
  legF: COL.kimono,
  legB: COL.kimono,
  head: COL.skin,
};

export class DuelScene extends Phaser.Scene {
  private player!: Fighter;
  private enemy!: Fighter; // the AI ronin (foes[0]) — the duel ends on its / the player's death
  private foes: Fighter[] = []; // every damageable foe: the ronin + optional static sparring dummies
  private trail!: BladeTrail;
  private gore!: Gore;
  private hud!: Hud;
  private ai!: AIController;
  private biome!: Biome;
  private travelIn = false;
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

  /** `travelIn` = arrived via a letterboxed travel pan (Town); R-restart resets it. */
  init(data?: { travelIn?: boolean }) {
    this.travelIn = !!data?.travelIn;
  }

  create() {
    // §2 biome kit (config switch in SCENE_BIOMES) — parallax layers, top vignette,
    // foreground occluders in front of the fighters (tells #2/#3).
    this.cameras.main.setBackgroundColor(DUEL_SCENE.bgColor);
    this.biome = createBiome(this, SCENE_BIOMES.duel, GROUND_Y);

    this.player = new Fighter(this, GAME_W * 0.43, GROUND_Y, 1, { stance: 'balanced' });
    this.enemy = new Fighter(this, GAME_W * 0.57, GROUND_Y, -1, {
      stance: 'heavy',
      skin: { haori: COL.haoriEnemy, haoriShade: COL.haoriEnemyShade },
      atkPlusWeapon: 7,
    });
    this.foes = [this.enemy];
    // ?foes=N adds static sparring dummies beside the ronin so one stroke can cross several foes
    // (Tell 5 — HP damage, multi-foe, instakills none). Default 1 = the unchanged 1-v-1 AI duel.
    const requested = Number(new URLSearchParams(location.search).get('foes')) || 1;
    const extra = Math.min(MULTI_FOE_MAX, Math.max(1, requested)) - 1;
    for (let i = 1; i <= extra; i++) {
      const dummy = new Fighter(this, this.enemy.x + i * MULTI_FOE_SPACING, GROUND_Y, -1, {
        stance: 'balanced',
        skin: { haori: COL.haoriEnemy, haoriShade: COL.haoriEnemyShade },
        atkPlusWeapon: 7,
      });
      this.foes.push(dummy);
    }

    this.trail = new BladeTrail(this, DUEL_SCENE.arcVariant);
    this.gore = new Gore(this, GROUND_Y); // ground-bound: pools + spatter sit on the arena floor
    this.hud = new Hud(this, { player: this.player, enemy: this.enemy, focus: this.playerFocus });

    // Arriving from Town's travel pan: open under the black bars, then release them (tell #9).
    if (this.travelIn) {
      const bars = new Letterbox(this);
      bars.snapIn();
      bars.slideOut();
      // consume the flag IN the stored scene data too — scene.restart() reuses the old data,
      // so without this an R-restart would replay the travel pan every time
      (this.sys.settings.data as { travelIn?: boolean }).travelIn = false;
    }
    // reset Focus on restart (scene instance is reused)
    this.playerFocus.value = 0;
    this.playerFocus.gain(50); // start with enough Focus to switch once; builds from hits (tunable)

    // spawn grace: both fighters invulnerable + blinking briefly at the start of the duel
    this.over = false;
    this.finishing = false;
    this.combo.reset();
    this.cameras.main.setZoom(1);
    this.graceUntil = this.time.now + 1500;
    for (const f of [this.player, ...this.foes]) {
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
      onEnd: (stroke) => {
        this.trail.end();
        this.handleGesture(stroke);
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

  /** A horizontal slash: the SMOOTHED stroke is the hit polyline; it damages EVERY foe it crosses
   *  (HP-based, instakills none at full HP — Tell 5). Blood gouts along the cut vector (Tell 19). */
  private doSlash(stroke: DrawnStroke) {
    if (this.time.now < this.busyUntil) return;
    const stance = STANCES[this.player.stanceId];
    this.busyUntil = this.time.now + slashRecoveryMs(this.player.stanceId); // per-stance lock (Tell 6)
    this.player.slash();
    playSlash();

    let anyHit = false;
    let severedTotal = 0;
    for (const foe of this.foes) {
      if (foe.isDead) continue;
      const input: SlashInput = {
        path: stroke.points,
        origin: this.player.slashOrigin(),
        reach: stance.reach,
        dmgMult: stance.dmgMult,
        crit: this.playerFocus.isCrit(),
        counter: counterBonus(this.player.stanceId, foe.stanceId),
      };
      const result = resolveSlash(
        input,
        foe.worldLimbs(),
        this.player.atkPlusWeapon,
        STANCES[foe.stanceId].damageTakenMult,
      );
      this.applyAndSpray(foe, result, stroke.dir);
      if (result.hits.length && !foe.blocking && !this.inGrace()) {
        anyHit = true;
        severedTotal += result.hits.filter((h) => h.severed).length;
      }
    }
    if (anyHit) {
      playImpact();
      this.playerFocus.gain(16 + severedTotal * 10);
      this.combo.hit(this.time.now);
    } else {
      this.combo.reset();
    }
  }

  /** Killing-blow sequence (§4 + tells #5a/#8): the loser collapses while a dark pool
   *  spreads under the corpse and loot tumbles out; after a brief on-field glimpse the
   *  finisher flash (black silhouettes over flat red, slow-mo) fires, then the §7 KillBeat. */
  private onKill(playerWon: boolean) {
    if (this.finishing) return;
    this.finishing = true;
    this.over = true;
    const loser = playerWon ? this.enemy : this.player;
    loser.die();
    this.gore.pool({ x: loser.x, y: 0 }); // persists — the pool marks the corpse (tell #8)
    if (playerWon) {
      lootPop(this, { x: loser.x, y: loser.y - DUEL_SCENE.lootChestOffsetY }, GROUND_Y);
    }
    this.time.delayedCall(DUEL_SCENE.collapseGlimpseMs, () => {
      const sils = [this.player, ...this.foes].map((f) => ({
        x: f.x,
        y: f.y,
        facing: f.facing,
        pose: f.pose,
      }));
      new FinisherFlash(this).play(sils, {
        groundY: GROUND_Y,
        onDone: () => new KillBeat(this).play(playerWon),
      });
    });
  }

  /** Direction = verb (spec §D.1): horizontal→slash, up→jump, big-up→launch, down→stab. */
  private handleGesture(stroke: DrawnStroke) {
    if (this.over || this.time.now < this.busyUntil) return;
    switch (stroke.verb) {
      case 'slash':
        this.doSlash(stroke);
        break;
      case 'jump':
        this.doJump(stroke);
        break;
      case 'launch':
        this.dealSpecial(LAUNCH_DMG_MULT, LAUNCH_KNOCKUP, { x: 0, y: -1 });
        break;
      case 'stab':
        this.dealSpecial(STAB_DMG_MULT, 0, { x: this.player.facing, y: 0 });
        break;
    }
  }

  /** Jump arc — BEGINS at the line's start point, ENDS at its endpoint (Tell 4). */
  private doJump(stroke: DrawnStroke) {
    this.busyUntil = this.time.now + JUMP_MS;
    const clampX = (x: number) => Phaser.Math.Clamp(x, ARENA_MARGIN, GAME_W - ARENA_MARGIN);
    const from: Pt = { x: clampX(stroke.start.x), y: GROUND_Y };
    const to: Pt = { x: clampX(stroke.end.x), y: GROUND_Y };
    const st = { t: 0 };
    this.tweens.add({
      targets: st,
      t: 1,
      duration: JUMP_MS,
      onUpdate: () => {
        const p = jumpArcPoint(from, to, JUMP_APEX, st.t);
        this.player.x = p.x;
        this.player.y = p.y;
      },
      onComplete: () => {
        this.player.x = to.x;
        this.player.y = GROUND_Y;
      },
    });
  }

  /** A close-range special move (launch / stab): connects if the enemy is within reach. */
  private dealSpecial(mult: number, knockUp: number, dir: Pt) {
    this.busyUntil = this.time.now + SPECIAL_MS;
    this.player.slash();
    playSlash();

    const stance = STANCES[this.player.stanceId];
    if (Math.abs(this.enemy.x - this.player.slashOrigin().x) > stance.reach) return;
    if (this.enemy.blocking) {
      this.spark({ x: this.enemy.x, y: this.enemy.y - 46 });
      return;
    }
    const crit = this.playerFocus.isCrit();
    const base =
      this.player.atkPlusWeapon *
      stance.dmgMult *
      mult *
      (crit ? CRIT_MULT : 1) * // CONTRACT 3× (was a stray 1.3× here — DIVERGENCES.md)
      counterBonus(this.player.stanceId, this.enemy.stanceId);
    const dmg = Math.round(base * STANCES[this.enemy.stanceId].damageTakenMult);
    this.enemy.health = Math.max(0, this.enemy.health - dmg);
    this.enemy.redraw();
    this.gore.spray({ x: this.enemy.x, y: this.enemy.y - 46 }, BLOOD_COUNT, dir);
    playImpact();
    this.playerFocus.gain(14);
    if (knockUp > 0) {
      this.tweens.add({ targets: this.enemy, y: this.enemy.y - knockUp, duration: 240, yoyo: true, ease: 'Quad.easeOut' });
    }
  }

  private inGrace() {
    return this.time.now < this.graceUntil;
  }

  /** Apply a slash result to a fighter and spray blood / sever decals for each hit, along `dir`. */
  private applyAndSpray(target: Fighter, result: SlashResult, dir: Pt) {
    if (!result.hits.length) return;
    if (target.blocking || this.inGrace()) {
      this.spark(result.hits[0].cutPoint);
      return;
    }
    target.applyHit(result);
    for (const h of result.hits) {
      this.gore.spray(h.cutPoint, h.severed ? BLOOD_COUNT_SEVERED : BLOOD_COUNT, dir);
      if (h.severed) {
        this.gore.severDecal(h.cutPoint);
        const color = LIMB_COLOR[h.limbId] ?? (target === this.player ? COL.haori : COL.haoriEnemy);
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
    // blood gouts away from the attacker (along the enemy→player vector)
    this.gore.spray({ x: this.player.x, y: this.player.y - 46 }, BLOOD_COUNT, { x: this.player.x - this.enemy.x, y: 0 });
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
      this.player.x = Phaser.Math.Clamp(this.player.x + dir * MOVE_SPEED * delta, ARENA_MARGIN, GAME_W - ARENA_MARGIN);
      playerMoving = dir !== 0;

      this.player.facing = this.enemy.x >= this.player.x ? 1 : -1;
      this.player.scaleX = this.player.facing;

      this.ai.update(delta);
      enemyMoving = this.ai.stateName() === 'approach';
      this.trail.update(delta);
    }

    // parallax + secondary motion keep breathing through the kill sequence
    this.biome.update(delta, this.player.x);

    // animate every fighter each frame (incl. the death fall while finishing); dummies idle in place
    this.player.update(delta, playerMoving);
    this.enemy.update(delta, enemyMoving);
    for (const f of this.foes) if (f !== this.enemy) f.update(delta, false);
    this.hud.update(this.combo.value(this.time.now));
  }
}
