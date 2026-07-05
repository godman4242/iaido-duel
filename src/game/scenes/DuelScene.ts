import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { COL } from '../../palette';
import { Fighter } from '../fighter/Fighter';
import { GestureInput } from '../input/GestureInput';
import { KillBeat } from './KillBeat';
import { BladeTrail } from '../vfx/BladeTrail';
import { Gore } from '../vfx/Gore';
import { lootPop } from '../vfx/LootPop';
import { FinisherFlash } from '../vfx/FinisherFlash';
import { SmokePuff } from '../vfx/SmokePuff';
import { ProjectileView } from '../vfx/ProjectileView';
import { DeflectSpark } from '../vfx/DeflectSpark';
import { Hud } from '../ui/Hud';
import { AIController } from '../ai/AIController';
import { Biome, createBiome } from '../background/createBiome';
import { Letterbox } from '../chrome/Letterbox';
import { DuelIntro } from './DuelIntro';
import { DuelResult } from './DuelResult';
import { SCENE_BIOMES, DUEL_SCENE } from '../../config/scenes-extra';
import { SPAWN_BLINK, CRIT_FLASH } from '../../config/fx-extra';
import { BLOOD_COUNT, BLOOD_COUNT_SEVERED, MULTI_FOE_SPACING } from '../../config/combat';
import {
  makeRng,
  SPAWN_X_FRAC,
  PLAYER_BASE,
  ENEMY_BASE,
  DUMMY_BASE,
  SIM_GROUND_Y,
  STRIKE_TORSO_OFFSET,
} from '../../config/combat-sim';
import { KILL_REWARD } from '../../config/economy';
import {
  playDraw,
  playWhiff,
  playFlesh,
  playArmor,
  playStanceSwitch,
  playGrunt,
  resumeAudio,
  toggleMuted,
} from '../audio/sfx';
import {
  Sim,
  type SimEvent,
  type FighterSimState,
  type FighterSeed,
  type Actor,
} from '../../core/Sim';
import { AISeamController } from '../../core/AISeamController';
import { worldLimbs } from '../fighter/Skeleton';
import type { Limb } from '../../core/slash';
import type { Pt } from '../../core/vec';
import type { StanceId } from '../../core/stance';
import {
  IntentBuffer,
  BlinkPlan,
  nextStance,
  clampFoeCount,
  parseTier,
  parseSeed,
  duelViewOf,
} from './duel-wiring';

/** The sim's world ground line IS the scene's (config-derived — no local literal). */
const GROUND_Y = SIM_GROUND_Y;

const LIMB_COLOR: Record<string, number> = {
  armF: COL.haori,
  forearmF: COL.haori,
  legF: COL.kimono,
  legB: COL.kimono,
  head: COL.skin,
};

/**
 * M2 (blueprint §1.C): DuelScene ONLY renders sim state and emits player intents.
 * All combat math — damage, Focus, Critical, invuln/i-frames, stances, skills, projectiles,
 * Shunpo, the kill latch — lives in core/Sim; the AI drives the SAME intent type through
 * core/AISeamController. This scene: builds PlayerIntent from input, calls sim.advance(),
 * drains SimEvents into FX/SFX, and copies sim state onto render puppets every frame.
 */
export class DuelScene extends Phaser.Scene {
  private sim!: Sim;
  private controller!: AISeamController;
  private player!: Fighter; // render puppet — sim.player is the authority
  private enemy!: Fighter; // render puppet for foes[0], the AI ronin
  private foes: Fighter[] = []; // puppets index-aligned with sim.foes
  private trail!: BladeTrail;
  private gore!: Gore;
  private hud!: Hud;
  private aiPainter!: AIController;
  private biome!: Biome;
  private smoke!: SmokePuff;
  private kunai!: ProjectileView;
  private sparkFx!: DeflectSpark;
  private intro?: DuelIntro;
  private result?: DuelResult;
  private intents = new IntentBuffer();
  private blinkPlan = new BlinkPlan(); // pure start/stop decisions (Tell 9) — unit-tested
  private blinkTweens = new Map<number, Phaser.Tweens.Tween>();
  private keys!: Record<'left' | 'right' | 'shift', Phaser.Input.Keyboard.Key>;
  private travelIn = false;
  private combatStarted = false; // false until DuelIntro's FIGHT! lands (sim frozen)
  private ended = false; // killBeat received — presentation owns the clocks from here
  private strokeArmed = false; // a live drag that started while input was open
  private appliedTimeScale = 1;

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

    // fresh per-duel state (the scene INSTANCE is reused across restarts — port-risk list)
    this.combatStarted = false;
    this.ended = false;
    this.strokeArmed = false;
    this.intents.clear();
    this.blinkPlan.reset();
    this.blinkTweens.clear();
    this.intro = undefined;
    this.result = undefined;
    this.appliedTimeScale = 1;
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.cameras.main.setZoom(1);

    // ── the deterministic sim (fresh every create()) + the AI behind the seam ──────────
    const params = new URLSearchParams(location.search);
    const seed = parseSeed(params.get('seed'), Date.now());
    const tier = parseTier(params.get('tier'));
    const rng = makeRng(seed);
    const foeCount = clampFoeCount(params.get('foes')); // ?foes=N sparring dummies (Tell 5)
    const px = GAME_W * SPAWN_X_FRAC.player;
    const ex = GAME_W * SPAWN_X_FRAC.opponent;
    const foeSeeds: FighterSeed[] = [{ x: ex, ...ENEMY_BASE }];
    for (let i = 1; i < foeCount; i++) foeSeeds.push({ x: ex + i * MULTI_FOE_SPACING, ...DUMMY_BASE });
    this.controller = new AISeamController({ rng, tier, groundY: GROUND_Y });
    this.sim = new Sim(
      {
        player: { x: px, ...PLAYER_BASE },
        foes: foeSeeds,
        rng,
        tier,
        groundY: GROUND_Y,
        // posed render-skeleton capsules at SIM positions (sim = position authority)
        limbsFor: (side, index): Limb[] => {
          const simF = side === 'player' ? this.sim.player : this.sim.foes[index];
          const puppet = side === 'player' ? this.player : this.foes[index];
          if (!simF || !puppet) return [];
          return worldLimbs(puppet.pose, { x: simF.x, y: simF.y }, simF.facing);
        },
      },
      this.controller,
    );

    // ── render puppets (sim copies onto these every frame; they never write back) ──────
    this.player = new Fighter(this, px, GROUND_Y, 1, { stance: PLAYER_BASE.stance });
    this.enemy = new Fighter(this, ex, GROUND_Y, -1, {
      stance: ENEMY_BASE.stance,
      skin: { haori: COL.haoriEnemy, haoriShade: COL.haoriEnemyShade },
    });
    this.foes = [this.enemy];
    for (let i = 1; i < foeCount; i++) {
      this.foes.push(
        new Fighter(this, ex + i * MULTI_FOE_SPACING, GROUND_Y, -1, {
          stance: DUMMY_BASE.stance,
          skin: { haori: COL.haoriEnemy, haoriShade: COL.haoriEnemyShade },
        }),
      );
    }

    this.trail = new BladeTrail(this, DUEL_SCENE.arcVariant);
    this.gore = new Gore(this, GROUND_Y); // ground-bound: pools + spatter sit on the arena floor
    this.smoke = new SmokePuff(this, GROUND_Y);
    this.kunai = new ProjectileView(this, GROUND_Y);
    this.sparkFx = new DeflectSpark(this);

    // ── HUD: polled sim snapshot + interactive stance portrait / skill slots (Tell 8/12/23*) ──
    this.hud = new Hud(this);
    this.hud.setDuelSource(() => duelViewOf(this.sim.player, this.sim.over));
    this.hud.onStanceSwap(() => {
      if (this.canAct()) this.intents.queueStance(nextStance(this.sim.player.stance));
    });
    this.hud.onSkillSlot((_id, slot) => {
      if (this.canAct()) this.intents.queueSkill(slot);
    });
    this.hud.attachNameLabel(this.player, 'YOU', 'player');
    this.hud.attachNameLabel(this.enemy, 'RONIN', 'hostile', {
      hp: () => (this.sim.opponent.hpMax > 0 ? this.sim.opponent.hp / this.sim.opponent.hpMax : 0),
    });

    // Arriving from Town's travel pan: open under the black bars, then release them (tell #9).
    if (this.travelIn) {
      const bars = new Letterbox(this);
      bars.snapIn();
      bars.slideOut();
      // consume the flag IN the stored scene data too — scene.restart() reuses the old data,
      // so without this an R-restart would replay the travel pan every time
      (this.sys.settings.data as { travelIn?: boolean }).travelIn = false;
    }

    // ── input → intents (the seam's player half) ────────────────────────────────────────
    new GestureInput(this, {
      onStart: (p) => {
        resumeAudio();
        if (!this.canAct()) return;
        this.strokeArmed = true;
        this.trail.begin();
        this.trail.push(p);
      },
      onMove: (p) => {
        if (this.strokeArmed) this.trail.push(p);
      },
      onEnd: (stroke) => {
        if (!this.strokeArmed) return; // e.g. the click that skipped the intro
        this.strokeArmed = false;
        this.trail.end();
        // verb travels WITH the path — ONE classifier decision (port contract)
        this.intents.queueStroke(stroke.points, stroke.verb);
      },
    });

    this.aiPainter = new AIController(this, this.enemy);

    const kb = this.input.keyboard!;
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      shift: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT), // Shunpo hold (DIVERGENCES: SPACE is the stance swap)
    };
    kb.on('keydown-B', () => {
      Gore.reduced = !Gore.reduced;
    });
    kb.on('keydown-SPACE', () => {
      if (this.canAct()) this.hud.requestStanceSwap(); // same path as the portrait click (Tell 8/23*)
    });
    // keys 1/2/3 share the HUD slot path (press flash + config-mapped skill id — Tell 12)
    (['keydown-ONE', 'keydown-TWO', 'keydown-THREE'] as const).forEach((evName, i) => {
      kb.on(evName, () => {
        if (this.canAct()) this.hud.fireSkillSlot(i + 1);
      });
    });
    kb.on('keydown-R', () => this.scene.restart());
    kb.on('keydown-M', () => toggleMuted());
    kb.once('keydown', () => resumeAudio());

    this.add
      .text(
        GAME_W / 2,
        22,
        'A/D move · draw to slash · SPACE stance · SHIFT slow-mo · 1/2/3 skills',
        {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#d8dbf1',
        },
      )
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

    // ── duel framing (Tell 25): VS splash → name banner → READY/FIGHT! → combat ─────────
    this.intro = new DuelIntro(this, {
      playerName: 'YOU',
      opponentName: 'RONIN',
      onFight: () => this.startCombat(), // the sim-unfreeze moment (s-framing contract)
      onDone: () => {
        this.intro = undefined;
      },
    });
    // any click fast-forwards the intro (?scene=duel boots straight in, skippable)
    this.input.on('pointerdown', () => {
      if (!this.combatStarted) this.intro?.skip();
    });

    // restart-safety: kill overlay timers/tweens and restore the clocks (port-risk list)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.intro?.destroy();
      this.intro = undefined;
      this.result?.destroy();
      this.result = undefined;
      this.hud.destroy();
      this.aiPainter.destroy();
      this.time.timeScale = 1;
      this.tweens.timeScale = 1;
    });

    // dev hook for inspecting live state from the console
    (window as unknown as { __duel?: DuelScene }).__duel = this;
  }

  /** Dev: snapshot of live combat state (browser-verification contract fields). */
  debugState() {
    const p = this.sim.player;
    const e = this.sim.opponent;
    return {
      playerHP: p.hp,
      enemyHP: e.hp,
      focus: Math.round(p.focus),
      enemyState: this.controller.stateName(),
      dist: Math.round(Math.abs(p.x - e.x)),
      critical: Math.round(p.critical),
      invulnRemaining: Math.round(p.invulnMs),
      shunpoMeter: Math.round(p.shunpo),
      stances: { player: p.stance, enemy: e.stance },
    };
  }

  /** Player input is open: FIGHT! landed and the duel has not been decided. */
  private canAct(): boolean {
    return this.combatStarted && !this.ended && !this.sim.over;
  }

  /** FIGHT! lands: unfreeze the sim, arm the HUD zones, start the spawn-invuln blink (Tell 9). */
  private startCombat(): void {
    if (this.combatStarted) return;
    this.combatStarted = true;
    // HUD zones only consume clicks while combat is LIVE — during DuelIntro they must let
    // the click fall through to the scene-level intro-skip listener (stopPropagation fix)
    this.hud.setInteractiveEnabled(true);
    for (const key of this.blinkPlan.begin(this.foes.length)) this.startBlink(key);
  }

  // ── spawn-invuln blink: started at combat start, stopped by the invulnEnded sim event ──

  private startBlink(key: number): void {
    const target = key === -1 ? this.player : this.foes[key];
    if (!target) return;
    this.blinkTweens.get(key)?.stop();
    this.blinkTweens.set(
      key,
      this.tweens.add({
        targets: target,
        alpha: SPAWN_BLINK.alphaLow,
        duration: SPAWN_BLINK.periodMs,
        yoyo: true,
        repeat: SPAWN_BLINK.repeats, // infinite — invulnEnded stops it on the exact sim frame
      }),
    );
  }

  private stopBlink(key: number): void {
    const tw = this.blinkTweens.get(key);
    if (tw) {
      tw.stop();
      this.blinkTweens.delete(key);
    }
    const target = key === -1 ? this.player : this.foes[key];
    target?.setAlpha(1);
  }

  // ── sim events → presentation (FX / SFX / anims); NO combat math here ──────────────────

  private attackerStance(actor: Actor): StanceId {
    return actor === 'player' ? this.sim.player.stance : this.sim.opponent.stance;
  }

  private targetPuppet(actor: Actor, targetIndex: number): Fighter {
    if (actor === 'opponent') return this.player;
    return this.foes[targetIndex] ?? this.enemy;
  }

  private torsoPoint(f: Fighter): Pt {
    return { x: f.x, y: f.y - STRIKE_TORSO_OFFSET };
  }

  private onSimEvent(ev: SimEvent): void {
    switch (ev.type) {
      case 'slashStarted':
        if (ev.actor === 'player') this.player.slash(); // the AI's swing plays at resolution
        playDraw(ev.stance); // SFX_FIRE_FRAMES.draw = strokeStart (Tell 28)
        break;
      case 'hitLanded': {
        const target = this.targetPuppet(ev.actor, ev.targetIndex);
        if (ev.actor === 'opponent') this.enemy.slash(); // the telegraphed strike lands now
        target.hitAnim();
        if (ev.hits.length) {
          for (const h of ev.hits) {
            this.gore.spray(h.cutPoint, h.severed ? BLOOD_COUNT_SEVERED : BLOOD_COUNT, ev.dir);
            if (h.severed) {
              target.severed.add(h.limbId);
              this.gore.severDecal(h.cutPoint);
              const color =
                LIMB_COLOR[h.limbId] ?? (target === this.player ? COL.haori : COL.haoriEnemy);
              this.gore.flyLimb(h.cutPoint, target.facing, color);
            }
          }
        } else {
          // specials (stab/launch) carry no limb list — blood gouts from the torso along dir
          this.gore.spray(this.torsoPoint(target), BLOOD_COUNT, ev.dir);
        }
        if (ev.actor === 'opponent') playGrunt();
        playFlesh(this.attackerStance(ev.actor)); // SFX_FIRE_FRAMES.flesh = resolve
        break;
      }
      case 'critLanded':
        if (ev.actor === 'player') this.critFlash(); // the visible 3× beat (Tell 7)
        break;
      case 'whiffed':
        if (ev.actor === 'opponent') this.enemy.slash(); // the missed swing still plays
        playWhiff(this.attackerStance(ev.actor)); // SFX_FIRE_FRAMES.whiff = resolve
        break;
      case 'blocked':
        this.sparkFx.swat(ev.point); // spark on every null (swat doubles as the block spark)
        // the armor-parry CUE is reserved for a true block pose — spawn-invuln and smoke
        // i-frame nulls read as a lighter spark-only beat (Tell 28 parry ≠ invuln null)
        if (ev.reason === 'block') playArmor(this.attackerStance(ev.actor)); // SFX_FIRE_FRAMES.armor = resolve
        break;
      case 'stanceSwitched':
        playStanceSwitch();
        break;
      case 'invulnEnded': {
        const key = this.blinkPlan.onInvulnEnded(ev.foeIndex);
        if (key !== null) this.stopBlink(key); // exact sim frame (Tell 9)
        break;
      }
      case 'smokeBombUsed':
        this.smoke.teleport(ev.fromX, ev.toX); // puff at vanish + reappear (Tell 10)
        break;
      case 'deflectSuccess':
        this.sparkFx.swat(ev.point); // kunai swat flash (Tell 10)
        playArmor();
        break;
      case 'projectileHit': {
        const victim = this.targetPuppet(ev.actor, ev.targetIndex); // victim travels in the event
        victim.hitAnim();
        if (victim === this.player) playGrunt();
        break;
      }
      case 'chiPunchLanded': {
        // the sim carries the victim IN the event — never re-derive from post-damage state
        // (a killing blow used to flinch the wrong puppet in ?foes>=2 duels)
        const victim = this.targetPuppet(ev.actor, ev.targetIndex);
        victim.hitAnim();
        this.sparkFx.swat(this.torsoPoint(victim)); // impact flash (Tell 12)
        playFlesh(this.attackerStance(ev.actor));
        break;
      }
      case 'killBeat':
        this.onKillBeat(ev.winner);
        break;
      // polled/painter-covered beats: meters, telegraphs, jumps, shunpo edges
      case 'telegraphStarted':
      case 'critReady':
      case 'stanceSwitchDenied':
      case 'projectileSpawned':
      case 'jumpStarted':
      case 'launchLanded':
      case 'shunpoStarted':
      case 'shunpoEnded':
        break;
    }
  }

  /** Full-screen white pop on a landed 3× crit (config CRIT_FLASH — Tell 7). */
  private critFlash(): void {
    const wash = this.add
      .rectangle(0, 0, GAME_W, GAME_H, CRIT_FLASH.color, CRIT_FLASH.magnitude)
      .setOrigin(0, 0)
      .setDepth(CRIT_FLASH.depth);
    this.tweens.add({
      targets: wash,
      alpha: 0,
      duration: CRIT_FLASH.durationMs,
      onComplete: () => wash.destroy(),
    });
  }

  /** Killing-blow sequence (§4 + tells #5a/#8), fired EXACTLY once by the sim's killBeat:
   *  collapse glimpse → FinisherFlash (red silhouettes, slow-mo) → KillBeat → result tally. */
  private onKillBeat(winner: 'player' | 'opponent'): void {
    if (this.ended) return; // defense-in-depth; the sim already latches killBeat once
    // presentation clocks back to neutral BEFORE FinisherFlash takes them over
    this.appliedTimeScale = 1;
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.ended = true;
    this.hud.setInteractiveEnabled(false); // dead HUD zones must not swallow result-screen clicks
    const playerWon = winner === 'player';
    const loser = playerWon ? this.enemy : this.player;
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
        onDone: () => {
          new KillBeat(this).play(playerWon);
          this.time.delayedCall(DUEL_SCENE.resultDelayMs, () => this.showResult(playerWon));
        },
      });
    });
  }

  /** Victory/Defeat tally (Tell 25) — display-only values, economy math is M3. */
  private showResult(playerWon: boolean): void {
    this.result = new DuelResult(this, {
      victory: playerWon,
      xp: playerWon ? KILL_REWARD.xpPerFoeLevel : 0,
      coins: playerWon ? KILL_REWARD.coinsPerFoeLevel : 0,
      onContinue: () => this.scene.restart(),
    });
  }

  // ── per-frame: intents in → sim advance → events out → puppets/HUD mirror sim ──────────

  private buildIntent() {
    let move = 0;
    if (this.keys.left.isDown) move -= 1;
    if (this.keys.right.isDown) move += 1;
    return this.intents.drain({
      move: move as -1 | 0 | 1,
      shunpoHold: this.keys.shift.isDown, // SHIFT hold = Shunpo (Tell 16)
      strokeArmed: this.strokeArmed, // mid-draw — the AI's reaction signal (M1 parity)
    });
  }

  /** Copy sim state onto a render puppet (render never writes back — port contract). */
  private syncPuppet(puppet: Fighter, f: FighterSimState): void {
    puppet.x = f.x;
    puppet.y = f.y;
    puppet.facing = f.facing;
    puppet.scaleX = f.facing;
    puppet.stanceId = f.stance;
    puppet.blocking = f.blocking;
    if (puppet.health > 0 && f.hp <= 0) puppet.die(); // death anim exactly once per puppet
    puppet.health = f.hp;
  }

  /** Sim-owned slow-mo (Shunpo) onto the presentation clocks — tweens AND timers together,
   *  skipped once the kill sequence starts (FinisherFlash owns the clocks then). */
  private applyPresentationScale(scale: number): void {
    if (this.ended || scale === this.appliedTimeScale) return;
    this.appliedTimeScale = scale;
    this.time.timeScale = scale;
    this.tweens.timeScale = scale;
  }

  update(_time: number, delta: number) {
    const simScale = this.sim.timeScale; // 1, or SHUNPO_TIMESCALE while slow-mo is active
    const dt = (Number.isFinite(delta) ? delta : 0) * simScale;

    let events: SimEvent[] = [];
    if (this.combatStarted && !this.sim.over) {
      events = this.sim.advance(dt, this.buildIntent()); // pre-scaled feed (port contract)
    }

    // mirror sim → puppets, then let the events dress the new frame
    this.syncPuppet(this.player, this.sim.player);
    this.sim.foes.forEach((f, i) => {
      const puppet = this.foes[i];
      if (puppet) this.syncPuppet(puppet, f);
    });
    for (const ev of events) this.onSimEvent(ev);
    this.applyPresentationScale(this.sim.timeScale);

    this.kunai.sync(this.sim.projectiles, this.sim.tFixed); // sim is the kunai authority
    this.trail.update(dt);
    // parallax + secondary motion keep breathing through the kill sequence
    this.biome.update(dt, this.player.x);

    // animate every fighter each frame (incl. the death fall while finishing)
    const opp = this.sim.opponent;
    const playerMoving = this.canAct() && !this.intentsIdle();
    this.player.update(dt, playerMoving);
    this.enemy.update(dt, !this.ended && this.controller.stateName() === 'approach');
    for (const f of this.foes) if (f !== this.enemy) f.update(dt, false);
    this.aiPainter.update(
      {
        x: opp.x,
        y: opp.y,
        windupMs: opp.windupMs,
        pendingSmokeMs: opp.pendingSmokeMs,
        pendingStanceMs: opp.pendingStanceMs, // stance-flash telegraph paints the caret too (§3.9)
        blocking: opp.blocking,
      },
      dt,
    );
    this.hud.update();
  }

  /** True when no walk key is held (walk-cycle flag only — the sim reads the real intent). */
  private intentsIdle(): boolean {
    return !this.keys.left.isDown && !this.keys.right.isDown;
  }
}
