// core/Sim.ts — the deterministic fixed-60Hz combat simulation (M2 port, blueprint §1.C.5/§3.2).
// Combat lives HERE: Focus, Critical (+weapon-weight drain, 3× crit), stance triangle, spawn
// invuln, Chi Punch, Smoke Bomb, Stab+Deflect, projectiles, Shunpo, and the kill-beat trigger.
// DuelScene only renders sim state and emits player intents; the AI drives the SAME intent type
// through the OpponentController seam (spec §C) and the sim never branches on controller type.
//
// Determinism rules: no Math.random / Date.now — randomness enters only as the injected seeded
// rng (consumed by controllers); all motion is computed in fixed ticks (no render tween ever
// writes back). Events are drained per advance() call (poll-friendly, restart-safe).
import { FIXED_DT_MS, MAX_FRAME_MS, SLASH_FRAMES, COMBO_WINDOW_MS } from '../config/timing';
import { STANCE_TABLE, type StanceId } from '../config/stances';
import {
  CRIT_MULT,
  CHI_PUNCH_DMG_L1,
  DAMAGE_FLOOR,
  FOCUS_MAX,
  FOCUS_SWITCH_COST,
  FOCUS_START,
  FOCUS_GAIN_HIT,
  FOCUS_GAIN_PER_SEVER,
  FOCUS_GAIN_SPECIAL,
  WEAPON_WEIGHT,
  JUMP_APEX,
  JUMP_MS,
  LAUNCH_DMG_MULT,
  LAUNCH_KNOCKUP,
  STAB_DMG_MULT,
  SPECIAL_MS,
} from '../config/combat';
import { ARENA_MARGIN, GAME_W } from '../config/layout';
import { AI_TIERS, type AITier, ENEMY_SPEED } from '../config/ai';
import {
  SMOKE_BOMB_DISTANCE,
  SMOKE_BOMB_MS,
  SMOKE_BOMB_IFRAMES_MS,
  SMOKE_BOMB_COOLDOWN_MS,
  DEFLECT_WINDOW_MS,
  DEFLECT_RADIUS,
  PROJECTILE_SPEED,
  PROJECTILE_DMG,
  PROJECTILE_HIT_RADIUS,
  PROJECTILE_SPAWN_OFFSET,
  PROJECTILE_MAX_ACTIVE,
  SHUNPO_MAX,
  SHUNPO_DRAIN_PER_MS,
  SHUNPO_TIMESCALE,
  SHUNPO_MIN_TO_START,
  PLAYER_MOVE_SPEED,
  PLAYER_WINDUP_MS,
  LAUNCH_KNOCKUP_MS,
  SPAWN_INVULN_MS,
  SIM_GROUND_Y,
  STRIKE_TORSO_OFFSET,
  BODY_CAPSULE_TOP,
  BODY_CAPSULE_BOTTOM,
  BODY_CAPSULE_RADIUS,
  BODY_CAPSULE_MID,
  BODY_SEVER_THRESHOLD,
  INTENT_QUEUE_MAX,
  SKILL_VERB,
  TIMER_EPS_MS,
} from '../config/combat-sim';
import { classifyGesture, type Gesture } from './gesture';
import {
  criticalFill,
  criticalAfterSwing,
  criticalAfterStanceSwitch,
  isCritReady,
  consumeCrit,
} from './critical';
import { counterBonus, counterPenalty } from './stance';
import { resolveSlash, defenseTerm, type Limb, type LimbHit, type SlashInput } from './slash';
import { jumpArcPoint } from './trajectory';
import {
  stepProjectile,
  projectileOverlaps,
  projectileOffArena,
  type Projectile,
} from './projectile';
import type { Pt } from './vec';
import type { CombatView, FighterView, OpponentController, OpponentIntent } from './OpponentController';

export type Actor = 'player' | 'opponent';
export type StrikeVerb = 'slash' | 'stab' | 'launch' | 'chiPunch';
export interface PendingStrike {
  verb: StrikeVerb;
  path?: Pt[];
}

/** Full per-fighter sim state (the frozen port contract's FighterSimState). Plain serializable
 *  numbers/booleans/strings only — JSON.stringify of a state trace is the determinism measure. */
export interface FighterSimState {
  x: number;
  y: number; // groundY when grounded; sim-computed arc while airborne (no gameplay tweens)
  facing: 1 | -1; // derived each tick from the opponent's x
  hp: number;
  hpMax: number;
  stance: StanceId;
  focus: number; // 0..FOCUS_MAX — spent by switchStance, gained on hits
  critical: number; // 0..CRITICAL_MAX — passive fill, per-swing drain, full ⇒ next hit 3×
  weaponWeight: number; // per-swing critical drain scale (WEAPON_WEIGHT[stance])
  atkPlusWeapon: number;
  defense: number; // feeds the (1 − Defense·DEF_K) term
  deflectLearned: boolean; // spec §D.1: the stab pose deflects only with Deflect learned
  invulnMs: number; // remaining spawn invuln (SPAWN_INVULN_MS); damage taken = 0 while > 0
  hasSlashed: boolean; // the "until first slash" half of the spawn-invuln contract
  busyMs: number; // recovery lock; strike intents while busy are dropped deterministically
  windupMs: number; // remaining telegraph before pendingStrike resolves (AI reacts to this)
  pendingStrike: PendingStrike | null;
  smokeCooldownMs: number; // smoke-bomb intent ignored while > 0 (spam chaos guard)
  iFramesMs: number; // smoke-bomb i-frames (distinct from spawn invuln)
  deflectMs: number; // deflect window opened by a stab pose (only when deflectLearned)
  shunpo: number; // 0..SHUNPO_MAX power meter
  shunpoActive: boolean;
  prevShunpoHold: boolean; // edge-detect latch for the held shunpo intent
  blocking: boolean; // held block pose (AI react-block); a blocked hit deals 0
  airborneMs: number; // remaining jump/knock-up airtime
  airborneTotalMs: number;
  airFromX: number;
  airToX: number;
  airApex: number;
  smokeMs: number; // remaining teleport slide
  smokeFromX: number;
  smokeToX: number;
  pendingSmokeMs: number; // AI smoke bomb telegraphs for tier telegraphMs before executing
  pendingStanceMs: number; // AI stance switch telegraphs (stanceFlash) before applying (§3.9)
  pendingStanceId: StanceId | null; // the switch that lands when pendingStanceMs expires
  strokeArmed: boolean; // held: the player is mid-draw (the AI's reaction signal — M1 parity)
  combo: number;
  comboLastHitTick: number; // keyed to tFixed (restart-safe, no scene wall-clock)
  critReadyLatch: boolean; // one-shot critReady event edge latch
}

/** One-shot beats drained per advance() call. Meters are POLLED state, not events. */
export type SimEvent =
  | { type: 'slashStarted'; actor: Actor; stance: StanceId; verb: StrikeVerb }
  | {
      type: 'telegraphStarted';
      actor: Actor;
      kind: 'slash' | 'smokeBomb' | 'lunge' | 'stanceFlash';
      durationMs: number;
    }
  | {
      type: 'hitLanded';
      actor: Actor; // attacker
      targetIndex: number; // foe index when actor='player'; -1 = the player when actor='opponent'
      dmg: number;
      crit: boolean;
      countered: boolean;
      severedCount: number;
      hits: LimbHit[];
      dir: Pt;
    }
  | { type: 'critLanded'; actor: Actor; dmg: number }
  | { type: 'critReady'; actor: Actor }
  | { type: 'whiffed'; actor: Actor }
  | {
      type: 'blocked';
      actor: Actor; // attacker whose hit was nulled
      point: Pt;
      /** WHY the damage nulled: a held block pose is the true armor-parry; spawn invuln and
       *  smoke i-frames are invulnerability nulls (the scene plays a lighter cue for those). */
      reason: 'block' | 'invuln' | 'iframes';
    }
  | { type: 'stanceSwitched'; actor: Actor; from: StanceId; to: StanceId; focusLeft: number }
  | { type: 'stanceSwitchDenied'; actor: Actor; reason: 'focus' | 'invalidId' }
  | {
      type: 'invulnEnded';
      actor: Actor; // whose invuln ended; foeIndex identifies dummies when actor='opponent'
      foeIndex: number; // -1 = the player
      reason: 'timeout' | 'firstSlash';
    }
  | { type: 'smokeBombUsed'; actor: Actor; fromX: number; toX: number }
  | { type: 'projectileSpawned'; actor: Actor; id: number; x: number; vx: number }
  | { type: 'projectileHit'; actor: Actor; id: number; dmg: number; targetIndex: number } // actor = thrower; targetIndex −1 = the player
  | { type: 'deflectSuccess'; actor: Actor; id: number; point: Pt } // actor = deflector
  | { type: 'chiPunchLanded'; actor: Actor; dmg: number; targetIndex: number } // targetIndex −1 = the player
  | { type: 'jumpStarted'; actor: Actor; fromX: number; toX: number; durationMs: number }
  | { type: 'launchLanded'; actor: Actor; targetIndex: number; knockUp: number }
  | { type: 'shunpoStarted'; actor: Actor }
  | { type: 'shunpoEnded'; actor: Actor; reason: 'released' | 'empty' }
  | { type: 'killBeat'; winner: 'player' | 'opponent' };

/** Per-fighter seed (config/combat-sim PLAYER_BASE / ENEMY_BASE / DUMMY_BASE + spawn x). */
export interface FighterSeed {
  x: number;
  hp: number;
  atkPlusWeapon: number;
  defense: number;
  stance: StanceId;
  weaponWeight?: number; // defaults to WEAPON_WEIGHT[stance]
  deflectLearned?: boolean;
}

export interface SimConfig {
  player: FighterSeed;
  /** foes[0] = the AI ronin (its death ends the duel); extras are static sparring dummies
   *  (?foes=N — Tell 5: one stroke damages several foes; dummy deaths never fire killBeat). */
  foes: FighterSeed[];
  /** Seeded rng (config/combat-sim makeRng) — the ONLY randomness allowed near the sim;
   *  the sim itself never consumes it (fully deterministic), controllers do. */
  rng: () => number;
  /** AI tier: opponent strikes/smoke bombs telegraph for AI_TIERS[tier].telegraphMs (Tell 13). */
  tier?: AITier;
  /** World ground line for the default hit model + synthetic arcs (defaults to SIM_GROUND_Y). */
  groundY?: number;
  /** Posed limb capsules for a target (scene injects render-skeleton limbs; tests inject
   *  fixtures). Absent ⇒ the config-seeded single body capsule per fighter. */
  limbsFor?: (side: 'player' | 'foe', index: number) => Limb[];
}

/** The player's intent for a tick — identical shape to OpponentIntent (the seam's symmetry). */
export type PlayerIntent = OpponentIntent;

const num = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback);

/** Count a timer down one tick. A residue below TIMER_EPS_MS is zero, so exact-multiple
 *  durations (e.g. 21 frames × FIXED_DT_MS) don't leak a 1e-13 float residue that would cost
 *  one extra tick — while non-multiples keep ceil semantics (telegraph ≥ telegraphMs holds). */
const tickDown = (v: number, dt: number): number => {
  const next = v - dt;
  return next <= TIMER_EPS_MS ? 0 : next;
};

export class Sim {
  tFixed = 0;
  over = false;
  winner: 'player' | 'opponent' | null = null;
  /** Sim-owned presentation multiplier: 1 normally, SHUNPO_TIMESCALE during shunpo. DuelScene
   *  multiplies the real elapsed ms it feeds advance() by this (slow-mo stays deterministic —
   *  core tests always feed fixed dt). The kill-beat ramp is presentation (KILL_TIMING, s-fx). */
  timeScale = 1;
  readonly player: FighterSimState;
  readonly foes: FighterSimState[];
  readonly projectiles: Projectile[] = [];
  readonly rng: () => number;

  private acc = 0;
  private events: SimEvent[] = [];
  private pendingIntents: OpponentIntent[] = [];
  private held = { move: 0 as -1 | 0 | 1, shunpoHold: false, block: false, strokeArmed: false };
  private nextProjectileId = 1;
  private readonly groundY: number;
  private readonly tier: AITier;
  private readonly limbsFor?: (side: 'player' | 'foe', index: number) => Limb[];

  constructor(
    cfg: SimConfig,
    private readonly controller: OpponentController,
  ) {
    this.groundY = num(cfg.groundY ?? SIM_GROUND_Y, SIM_GROUND_Y);
    this.tier = cfg.tier && AI_TIERS[cfg.tier] ? cfg.tier : 'normal';
    this.limbsFor = cfg.limbsFor;
    // hostile-input guard: a missing rng (untyped JS caller) must not crash controllers later
    this.rng = typeof cfg.rng === 'function' ? cfg.rng : () => 0;
    this.player = this.makeFighter(cfg.player, 1);
    const foeSeeds = cfg.foes.length ? cfg.foes : [cfg.player]; // never zero foes (chaos guard)
    this.foes = foeSeeds.map((s) => this.makeFighter(s, -1));
  }

  /** Back-compat alias: the AI ronin. */
  get opponent(): FighterSimState {
    return this.foes[0];
  }

  private makeFighter(seed: FighterSeed, facing: 1 | -1): FighterSimState {
    const stance: StanceId = STANCE_TABLE[seed.stance] ? seed.stance : 'balanced';
    const x = num(seed.x, 0);
    const hp = Math.max(1, num(seed.hp, 1));
    return {
      x,
      y: this.groundY,
      facing,
      hp,
      hpMax: hp,
      stance,
      focus: FOCUS_START,
      critical: 0,
      weaponWeight: Math.max(0, num(seed.weaponWeight ?? WEAPON_WEIGHT[stance], 0)),
      atkPlusWeapon: Math.max(0, num(seed.atkPlusWeapon, 0)),
      defense: Math.max(0, num(seed.defense, 0)),
      deflectLearned: !!seed.deflectLearned,
      invulnMs: SPAWN_INVULN_MS,
      hasSlashed: false,
      busyMs: 0,
      windupMs: 0,
      pendingStrike: null,
      smokeCooldownMs: 0,
      iFramesMs: 0,
      deflectMs: 0,
      shunpo: SHUNPO_MAX,
      shunpoActive: false,
      prevShunpoHold: false,
      blocking: false,
      airborneMs: 0,
      airborneTotalMs: 0,
      airFromX: x,
      airToX: x,
      airApex: 0,
      smokeMs: 0,
      smokeFromX: x,
      smokeToX: x,
      pendingSmokeMs: 0,
      pendingStanceMs: 0,
      pendingStanceId: null,
      strokeArmed: false,
      combo: 0,
      comboLastHitTick: -(COMBO_WINDOW_MS * 2),
      critReadyLatch: false,
    };
  }

  /**
   * Advance by elapsed real ms; steps the fixed sim in whole FIXED_DT_MS increments and returns
   * the events produced. Discrete intents QUEUE until a step consumes them — on 120Hz+ displays
   * (~8ms deltas) an intent must survive advance() calls that complete no step (intent-drop fix).
   */
  advance(elapsedMs: number, playerIntent: PlayerIntent = {}): SimEvent[] {
    this.ingest(playerIntent);
    if (Number.isFinite(elapsedMs) && elapsedMs > 0) { // hostile dt (NaN/±Inf/negative) must never reach acc — a NaN freezes the sim silently and forever
      this.acc += Math.min(elapsedMs, MAX_FRAME_MS); // spiral-of-death clamp (spec §3)
      while (this.acc >= FIXED_DT_MS) {
        this.step();
        this.acc -= FIXED_DT_MS;
      }
    }
    return this.events.splice(0);
  }

  private ingest(intent: PlayerIntent): void {
    // held fields: latest advance() call wins, sampled every step
    this.held.move = intent.move === -1 || intent.move === 1 ? intent.move : 0;
    this.held.shunpoHold = !!intent.shunpoHold;
    this.held.block = !!intent.block;
    this.held.strokeArmed = !!intent.strokeArmed;
    // discrete fields: bounded FIFO (a zero-delta spam loop cannot grow it unbounded)
    if (
      !this.over &&
      (intent.stroke ||
        intent.switchStance !== undefined ||
        intent.useSkill !== undefined ||
        intent.smokeBomb ||
        intent.throwProjectile) &&
      this.pendingIntents.length < INTENT_QUEUE_MAX
    ) {
      this.pendingIntents.push({
        stroke: intent.stroke,
        switchStance: intent.switchStance,
        useSkill: intent.useSkill,
        smokeBomb: intent.smokeBomb,
        throwProjectile: intent.throwProjectile,
      });
    }
  }

  // ── fixed step ────────────────────────────────────────────────────────────────────────────

  private step(): void {
    const dt = FIXED_DT_MS;
    if (!this.over) {
      // 1. facing derived from opponent x (slash-origin side, smoke direction, stab arc)
      this.player.facing = this.foes[0].x >= this.player.x ? 1 : -1;
      for (const f of this.foes) f.facing = this.player.x >= f.x ? 1 : -1;

      // 2. timers, motion integration, passive meters
      this.tickFighter(this.player, 'player', -1, dt);
      this.foes.forEach((f, i) => this.tickFighter(f, 'opponent', i, dt));

      // 3. expired windups resolve in FIXED order: opponent first, then player — on
      //    simultaneous fatal blows the opponent's lands first and the player dies
      //    (deterministic tie rule; killBeat latched exactly once).
      this.resolveExpiredStrike(this.foes[0], 'opponent');
      if (!this.over) this.resolveExpiredStrike(this.player, 'player');

      // 4. opponent intent through the seam (same apply path as the player)
      if (!this.over) {
        const oppIntent = this.controller.decide(this.view(), dt);
        this.applyIntent(this.foes[0], 'opponent', oppIntent, dt);
      }

      // 5. player intent: one queued discrete intent + the held fields
      if (!this.over) {
        const discrete = this.pendingIntents.shift() ?? {};
        this.applyIntent(
          this.player,
          'player',
          {
            ...discrete,
            move: this.held.move,
            shunpoHold: this.held.shunpoHold,
            block: this.held.block,
            strokeArmed: this.held.strokeArmed,
          },
          dt,
        );
      }

      // 5b. zero-windup strikes resolve the SAME tick they were queued — the player's drawn
      //     slash lands ON gesture end (PLAYER_WINDUP_MS = 0, the M1/original signature feel).
      //     Windups > 0 are untouched (windupMs gate); opponent-first keeps the §3 tie rule.
      if (!this.over) this.resolveExpiredStrike(this.foes[0], 'opponent');
      if (!this.over) this.resolveExpiredStrike(this.player, 'player');

      // 6. projectiles (after intents so a stab THIS tick can swat a kunai THIS tick)
      if (!this.over) this.stepProjectiles(dt);

      // 7. sim-owned presentation multiplier (shunpo only; kill-beat ramp is presentation)
      this.timeScale = !this.over && this.player.shunpoActive ? SHUNPO_TIMESCALE : 1;
    }
    this.tFixed += dt;
  }

  private tickFighter(f: FighterSimState, side: Actor, foeIndex: number, dt: number): void {
    // spawn invuln timeout half (the first-slash half clears in queueStrike)
    if (f.invulnMs > 0) {
      f.invulnMs = tickDown(f.invulnMs, dt);
      if (f.invulnMs === 0) {
        this.events.push({ type: 'invulnEnded', actor: side, foeIndex, reason: 'timeout' });
      }
    }
    f.busyMs = tickDown(f.busyMs, dt);
    f.smokeCooldownMs = tickDown(f.smokeCooldownMs, dt);
    f.iFramesMs = tickDown(f.iFramesMs, dt);
    f.deflectMs = tickDown(f.deflectMs, dt);
    if (f.pendingStrike) f.windupMs = tickDown(f.windupMs, dt);

    // AI smoke-bomb telegraph → execute at expiry
    if (f.pendingSmokeMs > 0) {
      f.pendingSmokeMs = tickDown(f.pendingSmokeMs, dt);
      if (f.pendingSmokeMs === 0) this.executeSmokeBomb(f, side);
    }

    // AI stance-flash telegraph → the switch applies at expiry (§3.9: telegraph-enter →
    // stance-land ≥ telegraphMs; the player's own switch stays instant in trySwitchStance)
    if (f.pendingStanceMs > 0) {
      f.pendingStanceMs = tickDown(f.pendingStanceMs, dt);
      if (f.pendingStanceMs === 0) {
        const id = f.pendingStanceId;
        f.pendingStanceId = null;
        if (id) this.executeStanceSwitch(f, side, id);
      }
    }

    // teleport slide (sim-owned motion — no tween writes x)
    if (f.smokeMs > 0) {
      f.smokeMs = tickDown(f.smokeMs, dt);
      const t = 1 - f.smokeMs / SMOKE_BOMB_MS;
      f.x = f.smokeFromX + (f.smokeToX - f.smokeFromX) * t;
    }

    // airborne arc (jump / launch knock-up) via core/trajectory
    if (f.airborneMs > 0) {
      f.airborneMs = tickDown(f.airborneMs, dt);
      const t = f.airborneTotalMs > 0 ? 1 - f.airborneMs / f.airborneTotalMs : 1;
      const p = jumpArcPoint(
        { x: f.airFromX, y: this.groundY },
        { x: f.airToX, y: this.groundY },
        f.airApex,
        t,
      );
      f.x = p.x;
      f.y = p.y;
      if (f.airborneMs === 0) f.y = this.groundY;
    }

    // Critical passive fill + one-shot ready edge
    f.critical = criticalFill(f.critical, dt);
    if (isCritReady(f.critical)) {
      if (!f.critReadyLatch) {
        f.critReadyLatch = true;
        this.events.push({ type: 'critReady', actor: side });
      }
    } else {
      f.critReadyLatch = false;
    }

    // Shunpo drain while active; ends on empty
    if (f.shunpoActive) {
      f.shunpo = Math.max(0, f.shunpo - SHUNPO_DRAIN_PER_MS * dt);
      if (f.shunpo === 0) {
        f.shunpoActive = false;
        this.events.push({ type: 'shunpoEnded', actor: side, reason: 'empty' });
      }
    }
  }

  // ── intents ───────────────────────────────────────────────────────────────────────────────

  private applyIntent(f: FighterSimState, side: Actor, intent: OpponentIntent, dt: number): void {
    if (this.over) return;
    f.blocking = !!intent.block;
    f.strokeArmed = !!intent.strokeArmed; // mid-draw signal the AI reacts to (M1 parity)
    this.applyMove(f, side, intent.move, dt);
    if (side === 'player') this.applyShunpoHold(f, side, !!intent.shunpoHold);
    if (intent.switchStance !== undefined) this.trySwitchStance(f, side, intent.switchStance);
    if (intent.smokeBomb) this.trySmokeBomb(f, side);
    if (intent.throwProjectile) this.tryThrowProjectile(f, side);
    if (intent.useSkill !== undefined) {
      const verb = (SKILL_VERB as Record<number, string>)[intent.useSkill];
      if (verb === 'smokeBomb') this.trySmokeBomb(f, side);
      else if (verb === 'chiPunch' || verb === 'stab') {
        this.tryQueueStrike(f, side, verb as StrikeVerb, undefined);
      }
    }
    if (intent.stroke) this.applyStroke(f, side, intent.stroke);
  }

  private applyMove(f: FighterSimState, side: Actor, move: unknown, dt: number): void {
    const dir = move === -1 || move === 1 ? move : 0;
    if (dir === 0 || f.airborneMs > 0 || f.smokeMs > 0) return;
    const speed = side === 'player' ? PLAYER_MOVE_SPEED : ENEMY_SPEED; // PvE foes move slowly (Tell 11)
    f.x = clampArenaX(f.x + dir * speed * dt);
  }

  private applyShunpoHold(f: FighterSimState, side: Actor, held: boolean): void {
    if (held && !f.prevShunpoHold && !f.shunpoActive && f.shunpo >= SHUNPO_MIN_TO_START) {
      f.shunpoActive = true;
      this.events.push({ type: 'shunpoStarted', actor: side });
    } else if (!held && f.shunpoActive) {
      f.shunpoActive = false;
      this.events.push({ type: 'shunpoEnded', actor: side, reason: 'released' });
    }
    f.prevShunpoHold = held;
  }

  private trySwitchStance(f: FighterSimState, side: Actor, id: StanceId): void {
    if (!STANCE_TABLE[id]) {
      this.events.push({ type: 'stanceSwitchDenied', actor: side, reason: 'invalidId' });
      return;
    }
    if (f.pendingStanceMs > 0) return; // a telegraphed switch is already committed (spam guard)
    if (id === f.stance) return; // no-op, no cost, no event
    if (f.focus < FOCUS_SWITCH_COST) {
      this.events.push({ type: 'stanceSwitchDenied', actor: side, reason: 'focus' });
      return;
    }
    if (side === 'opponent') {
      // §3.9: every committing AI action telegraphs ≥ tier telegraphMs before it LANDS —
      // the stance-flash telegraph fires now, the switch applies when the window expires
      // (mirrors the pendingSmokeMs pattern). The player's own switch stays instant.
      const durationMs = AI_TIERS[this.tier].telegraphMs;
      f.pendingStanceMs = durationMs;
      f.pendingStanceId = id;
      this.events.push({ type: 'telegraphStarted', actor: side, kind: 'stanceFlash', durationMs });
      return;
    }
    this.executeStanceSwitch(f, side, id);
  }

  /** Apply a validated stance switch (player: instantly; opponent: on stance-flash expiry).
   *  Focus can only GROW between queue and expiry (nothing else spends it), so the queue-time
   *  focus check still holds here; re-guard id/stance defensively for the delayed path. */
  private executeStanceSwitch(f: FighterSimState, side: Actor, id: StanceId): void {
    if (!STANCE_TABLE[id] || id === f.stance) return;
    const from = f.stance;
    f.focus = Math.max(0, f.focus - FOCUS_SWITCH_COST);
    f.stance = id;
    f.weaponWeight = WEAPON_WEIGHT[id];
    f.critical = criticalAfterStanceSwitch(f.critical); // patch behavior (Tell 7)
    this.events.push({ type: 'stanceSwitched', actor: side, from, to: id, focusLeft: f.focus });
  }

  private trySmokeBomb(f: FighterSimState, side: Actor): void {
    if (f.smokeCooldownMs > 0 || f.smokeMs > 0 || f.pendingSmokeMs > 0) return; // spam guard
    f.smokeCooldownMs = SMOKE_BOMB_COOLDOWN_MS;
    if (side === 'opponent') {
      // every committing AI action telegraphs ≥ tier telegraphMs before it lands (spec §A.3)
      const durationMs = AI_TIERS[this.tier].telegraphMs;
      f.pendingSmokeMs = durationMs;
      this.events.push({ type: 'telegraphStarted', actor: side, kind: 'smokeBomb', durationMs });
    } else {
      this.executeSmokeBomb(f, side); // the player's dodge is not delayed
    }
  }

  private executeSmokeBomb(f: FighterSimState, side: Actor): void {
    const fromX = f.x;
    const toX = clampArenaX(f.x - f.facing * SMOKE_BOMB_DISTANCE); // away from the opponent
    f.smokeMs = SMOKE_BOMB_MS;
    f.smokeFromX = fromX;
    f.smokeToX = toX;
    f.iFramesMs = SMOKE_BOMB_IFRAMES_MS;
    this.events.push({ type: 'smokeBombUsed', actor: side, fromX, toX });
  }

  private tryThrowProjectile(f: FighterSimState, side: Actor): void {
    if (f.busyMs > 0 || f.pendingStrike || this.projectiles.length >= PROJECTILE_MAX_ACTIVE) return;
    this.clearInvulnOnFirstAct(f, side);
    const p: Projectile = {
      id: this.nextProjectileId++,
      x: f.x + f.facing * PROJECTILE_SPAWN_OFFSET,
      vx: f.facing * PROJECTILE_SPEED,
      dmg: PROJECTILE_DMG,
      fromOpponent: side === 'opponent',
    };
    this.projectiles.push(p);
    this.events.push({ type: 'projectileSpawned', actor: side, id: p.id, x: p.x, vx: p.vx });
  }

  private applyStroke(
    f: FighterSimState,
    side: Actor,
    stroke: { path: Pt[]; verb?: Gesture },
  ): void {
    const path = Array.isArray(stroke.path)
      ? stroke.path.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
      : [];
    // ONE classifier decision: trust the verb carried from DrawnStroke (player); classify only
    // for path-only controllers (scripted/AI) — port-contract "two classifiers drifting" risk.
    const known: Gesture[] = ['slash', 'jump', 'launch', 'stab'];
    const verb: Gesture =
      stroke.verb && known.includes(stroke.verb) ? stroke.verb : classifyGesture(path);
    if (verb === 'jump') {
      this.tryJump(f, side, path);
      return;
    }
    this.tryQueueStrike(f, side, verb, path);
  }

  private tryJump(f: FighterSimState, side: Actor, path: Pt[]): void {
    if (f.busyMs > 0 || f.pendingStrike || f.airborneMs > 0 || f.smokeMs > 0) return;
    // the jump BEGINS at the line's start point and ENDS at its endpoint (spec §D.1, Tell 4)
    const fromX = clampArenaX(path.length ? path[0].x : f.x);
    const toX = clampArenaX(path.length ? path[path.length - 1].x : f.x);
    f.busyMs = JUMP_MS;
    f.airborneMs = JUMP_MS;
    f.airborneTotalMs = JUMP_MS;
    f.airFromX = fromX;
    f.airToX = toX;
    f.airApex = JUMP_APEX;
    this.events.push({ type: 'jumpStarted', actor: side, fromX, toX, durationMs: JUMP_MS });
  }

  private tryQueueStrike(
    f: FighterSimState,
    side: Actor,
    verb: StrikeVerb,
    path: Pt[] | undefined,
  ): void {
    if (f.busyMs > 0 || f.pendingStrike || f.airborneMs > 0 || f.smokeMs > 0) return; // dropped deterministically
    this.clearInvulnOnFirstAct(f, side);
    const windupMs = side === 'player' ? PLAYER_WINDUP_MS : AI_TIERS[this.tier].telegraphMs;
    f.windupMs = windupMs;
    f.pendingStrike = { verb, path };
    if (verb !== 'chiPunch') {
      this.events.push({ type: 'slashStarted', actor: side, stance: f.stance, verb });
    }
    if (side === 'opponent') {
      this.events.push({
        type: 'telegraphStarted',
        actor: side,
        kind: verb === 'slash' ? 'slash' : 'lunge',
        durationMs: windupMs,
      });
    }
    // the stab pose IS the deflect (spec §D.1) — window spans the windup pose plus the config window
    if (verb === 'stab' && f.deflectLearned) f.deflectMs = windupMs + DEFLECT_WINDOW_MS;
  }

  private clearInvulnOnFirstAct(f: FighterSimState, side: Actor): void {
    f.hasSlashed = true;
    if (f.invulnMs > 0) {
      f.invulnMs = 0;
      const foeIndex = side === 'player' ? -1 : this.foes.indexOf(f);
      this.events.push({ type: 'invulnEnded', actor: side, foeIndex, reason: 'firstSlash' });
    }
  }

  // ── strike resolution ─────────────────────────────────────────────────────────────────────

  private resolveExpiredStrike(f: FighterSimState, side: Actor): void {
    if (!f.pendingStrike || f.windupMs > 0 || this.over) return;
    const strike = f.pendingStrike;
    f.pendingStrike = null;
    const frames = SLASH_FRAMES[f.stance];
    f.busyMs =
      strike.verb === 'slash'
        ? (frames.windup + frames.active + frames.recovery) * FIXED_DT_MS
        : SPECIAL_MS;
    if (strike.verb === 'slash') this.resolveSlashStrike(f, side, strike.path ?? []);
    else if (strike.verb === 'chiPunch') this.resolveChiPunch(f, side);
    else this.resolveSpecial(f, side, strike.verb);
  }

  /** Targets of one strike: the player's blade crosses EVERY living foe (Tell 5); a foe's
   *  strike targets the player. */
  private targetsOf(side: Actor): Array<{ t: FighterSimState; index: number }> {
    if (side === 'player') {
      return this.foes.map((t, index) => ({ t, index })).filter(({ t }) => t.hp > 0);
    }
    return [{ t: this.player, index: -1 }];
  }

  private limbsOf(index: number): Limb[] {
    const side = index === -1 ? 'player' : 'foe';
    const injected = this.limbsFor?.(side, Math.max(0, index));
    // Hostile-input guard (untyped JS limbsFor — the one injected callback without one):
    // drop shape-invalid limbs so a malformed entry degrades to a whiff / the default body
    // capsule instead of a mid-tick TypeError (mirrors the stroke-path point filter).
    const valid = Array.isArray(injected)
      ? injected.filter(
          (l): l is Limb =>
            !!l &&
            typeof l === 'object' &&
            !!l.capsule &&
            typeof l.capsule === 'object' &&
            !!l.capsule.a &&
            !!l.capsule.b &&
            typeof l.capsule.a.x === 'number' &&
            typeof l.capsule.a.y === 'number' &&
            typeof l.capsule.b.x === 'number' &&
            typeof l.capsule.b.y === 'number',
        )
      : [];
    if (valid.length) return valid;
    const t = index === -1 ? this.player : this.foes[index];
    return [
      {
        id: 'body',
        capsule: {
          a: { x: t.x, y: t.y - BODY_CAPSULE_TOP },
          b: { x: t.x, y: t.y - BODY_CAPSULE_BOTTOM },
          r: BODY_CAPSULE_RADIUS,
        },
        severThreshold: BODY_SEVER_THRESHOLD,
      },
    ];
  }

  private resolveSlashStrike(f: FighterSimState, side: Actor, path: Pt[]): void {
    const stance = STANCE_TABLE[f.stance];
    const ready = isCritReady(f.critical);
    const origin: Pt = { x: f.x, y: f.y - BODY_CAPSULE_MID };
    const dir = strokeDir(path, f.facing);
    let anyHit = false;
    let severedTotal = 0;
    let dmgTotal = 0;
    for (const { t, index } of this.targetsOf(side)) {
      const input: SlashInput = {
        path,
        origin,
        reach: stance.reach,
        dmgMult: stance.dmgMult,
        crit: ready,
        counter: counterBonus(f.stance, t.stance),
        counterPenalty: counterPenalty(f.stance, t.stance),
      };
      const result = resolveSlash(
        input,
        this.limbsOf(index),
        f.atkPlusWeapon,
        STANCE_TABLE[t.stance].damageTakenMult,
        t.defense,
      );
      if (!result.hits.length) continue;
      const point = result.hits[0].cutPoint;
      const applied = this.applyDamage(t, index, side, result.totalDamage, point);
      if (applied <= 0) continue; // blocked / invuln / i-frames — no focus, no combo
      anyHit = true;
      const severed = result.hits.filter((h) => h.severed).length;
      severedTotal += severed;
      dmgTotal += applied;
      this.events.push({
        type: 'hitLanded',
        actor: side,
        targetIndex: index,
        dmg: applied,
        crit: ready,
        countered: input.counter > 1,
        severedCount: severed,
        hits: result.hits,
        dir,
      });
    }
    if (anyHit) {
      this.gainFocus(f, FOCUS_GAIN_HIT + severedTotal * FOCUS_GAIN_PER_SEVER);
      this.comboHit(f);
      if (ready) {
        f.critical = consumeCrit(f.critical).value; // one-shot 3× payout, bar resets
        this.events.push({ type: 'critLanded', actor: side, dmg: dmgTotal });
      } else {
        f.critical = criticalAfterSwing(f.critical, f.weaponWeight);
      }
    } else {
      f.combo = 0;
      f.critical = criticalAfterSwing(f.critical, f.weaponWeight); // a whiffed swing still drains
      this.events.push({ type: 'whiffed', actor: side });
    }
  }

  private resolveSpecial(f: FighterSimState, side: Actor, verb: 'stab' | 'launch'): void {
    const stance = STANCE_TABLE[f.stance];
    const targets = this.targetsOf(side); // specials hit the primary target only
    if (!targets.length) return; // defensive: no living target (chaos guard)
    const [{ t, index }] = targets;
    const ready = isCritReady(f.critical);
    if (Math.abs(t.x - f.x) > stance.reach) {
      f.combo = 0;
      f.critical = criticalAfterSwing(f.critical, f.weaponWeight);
      this.events.push({ type: 'whiffed', actor: side });
      return;
    }
    const mult = verb === 'stab' ? STAB_DMG_MULT : LAUNCH_DMG_MULT;
    const counter = counterBonus(f.stance, t.stance);
    const raw =
      ((f.atkPlusWeapon *
        stance.dmgMult *
        mult *
        (ready ? CRIT_MULT : 1) *
        counter *
        defenseTerm(t.defense) *
        STANCE_TABLE[t.stance].damageTakenMult) /
        counterPenalty(f.stance, t.stance));
    const dmg = Math.max(DAMAGE_FLOOR, Math.round(Number.isFinite(raw) ? raw : 0));
    const point: Pt = { x: t.x, y: t.y - STRIKE_TORSO_OFFSET };
    const applied = this.applyDamage(t, index, side, dmg, point);
    if (applied <= 0) {
      f.critical = criticalAfterSwing(f.critical, f.weaponWeight);
      return; // blocked event already emitted
    }
    const dir: Pt = verb === 'stab' ? { x: f.facing, y: 0 } : { x: 0, y: -1 };
    this.events.push({
      type: 'hitLanded',
      actor: side,
      targetIndex: index,
      dmg: applied,
      crit: ready,
      countered: counter > 1,
      severedCount: 0,
      hits: [],
      dir,
    });
    this.gainFocus(f, FOCUS_GAIN_SPECIAL);
    this.comboHit(f);
    if (ready) {
      f.critical = consumeCrit(f.critical).value;
      this.events.push({ type: 'critLanded', actor: side, dmg: applied });
    } else {
      f.critical = criticalAfterSwing(f.critical, f.weaponWeight);
    }
    if (verb === 'launch' && !this.over && t.hp > 0) {
      t.airborneMs = LAUNCH_KNOCKUP_MS;
      t.airborneTotalMs = LAUNCH_KNOCKUP_MS;
      t.airFromX = t.x;
      t.airToX = t.x;
      t.airApex = LAUNCH_KNOCKUP;
      this.events.push({ type: 'launchLanded', actor: side, targetIndex: index, knockUp: LAUNCH_KNOCKUP });
    }
  }

  private resolveChiPunch(f: FighterSimState, side: Actor): void {
    const stance = STANCE_TABLE[f.stance];
    const targets = this.targetsOf(side);
    if (!targets.length) return; // defensive: no living target (chaos guard)
    const [{ t, index }] = targets;
    if (Math.abs(t.x - f.x) > stance.reach) {
      this.events.push({ type: 'whiffed', actor: side });
      return;
    }
    const point: Pt = { x: t.x, y: t.y - STRIKE_TORSO_OFFSET };
    const applied = this.applyDamage(t, index, side, CHI_PUNCH_DMG_L1, point); // CONTRACT flat 10
    if (applied > 0) {
      // targetIndex travels IN the event — the scene must never re-derive the victim from
      // post-damage state (a killing blow would flinch the wrong puppet in multi-foe duels)
      this.events.push({ type: 'chiPunchLanded', actor: side, dmg: applied, targetIndex: index });
    }
  }

  /** Single damage gate: spawn invuln, smoke i-frames and block all null damage (blocked beat);
   *  kills latch over/winner exactly once (dummy deaths never end the duel). Returns applied dmg. */
  private applyDamage(
    t: FighterSimState,
    targetIndex: number,
    attacker: Actor,
    dmg: number,
    point: Pt,
  ): number {
    if (this.over) return 0;
    if (t.invulnMs > 0 || t.iFramesMs > 0 || t.blocking) {
      // reason distinguishes the true armor-parry (block pose) from invulnerability nulls —
      // the scene must not play the parry cue for a spawn-invulnerable / smoke-i-frame target
      const reason = t.blocking ? 'block' : t.invulnMs > 0 ? 'invuln' : 'iframes';
      this.events.push({ type: 'blocked', actor: attacker, point, reason });
      return 0;
    }
    const applied = Math.max(0, Math.min(t.hp, Math.round(num(dmg, 0))));
    t.hp -= applied;
    if (t.hp === 0) {
      if (targetIndex === -1) this.latchKill('opponent');
      else if (targetIndex === 0) this.latchKill('player');
    }
    return applied;
  }

  private latchKill(winner: 'player' | 'opponent'): void {
    if (this.over) return;
    this.over = true;
    this.winner = winner;
    if (this.player.shunpoActive) {
      this.player.shunpoActive = false;
      this.events.push({ type: 'shunpoEnded', actor: 'player', reason: 'released' });
    }
    this.timeScale = 1; // the kill-beat freeze/ramp is presentation (KILL_TIMING), not sim time
    this.events.push({ type: 'killBeat', winner });
  }

  private gainFocus(f: FighterSimState, n: number): void {
    f.focus = Math.max(0, Math.min(FOCUS_MAX, f.focus + n));
  }

  private comboHit(f: FighterSimState): void {
    f.combo = this.tFixed - f.comboLastHitTick > COMBO_WINDOW_MS ? 1 : f.combo + 1;
    f.comboLastHitTick = this.tFixed;
  }

  // ── projectiles ───────────────────────────────────────────────────────────────────────────

  private stepProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      stepProjectile(p, dt);
      const targets = p.fromOpponent
        ? [{ t: this.player, index: -1 }]
        : this.foes.map((t, index) => ({ t, index })).filter(({ t }) => t.hp > 0);
      const thrower: Actor = p.fromOpponent ? 'opponent' : 'player';
      let consumed = false;
      for (const { t, index } of targets) {
        // Stab+Deflect (Tell 10): a kunai overlapping the stab arc during the window dies
        if (t.deflectMs > 0 && projectileOverlaps(p, t.x, DEFLECT_RADIUS)) {
          this.events.push({
            type: 'deflectSuccess',
            actor: index === -1 ? 'player' : 'opponent',
            id: p.id,
            point: { x: p.x, y: t.y - STRIKE_TORSO_OFFSET },
          });
          consumed = true;
          break;
        }
        if (projectileOverlaps(p, t.x, PROJECTILE_HIT_RADIUS)) {
          const applied = this.applyDamage(t, index, thrower, p.dmg, {
            x: p.x,
            y: t.y - STRIKE_TORSO_OFFSET,
          });
          if (applied > 0) {
            this.events.push({
              type: 'projectileHit',
              actor: thrower,
              id: p.id,
              dmg: applied,
              targetIndex: index, // the victim travels in the event (never re-derived by the scene)
            });
          }
          consumed = true;
          break;
        }
      }
      if (consumed || projectileOffArena(p)) this.projectiles.splice(i, 1);
    }
  }

  // ── seam view ─────────────────────────────────────────────────────────────────────────────

  private snapshot(f: FighterSimState): FighterView {
    return {
      ...f,
      pendingStrike: f.pendingStrike ? { verb: f.pendingStrike.verb } : null,
    };
  }

  private view(): CombatView {
    return {
      self: this.snapshot(this.foes[0]),
      opponent: this.snapshot(this.player),
      distance: Math.abs(this.foes[0].x - this.player.x),
      selfStance: this.foes[0].stance,
      opponentStance: this.player.stance,
      tFixed: this.tFixed,
    };
  }
}

// ── pure helpers (module-local, literal-free) ─────────────────────────────────────────────────

function clampArenaX(x: number): number {
  const v = Number.isFinite(x) ? x : ARENA_MARGIN;
  return Math.max(ARENA_MARGIN, Math.min(GAME_W - ARENA_MARGIN, v));
}

/** Unit cut vector start→end of a stroke; degenerate paths fall back to the facing direction. */
function strokeDir(path: Pt[], facing: 1 | -1): Pt {
  if (path.length >= 2) {
    const dx = path[path.length - 1].x - path[0].x;
    const dy = path[path.length - 1].y - path[0].y;
    const d = Math.hypot(dx, dy);
    if (d > 0 && Number.isFinite(d)) return { x: dx / d, y: dy / d };
  }
  return { x: facing, y: 0 };
}
