// config/combat-sim.ts — M2 sim-port tunables (owner: sim-port; kept separate from combat.ts
// so core-pure and sim-port never edit the same file — frozen port contract, configKeys.toAdd).
// All INFERRED seeds unless marked; calibration may overwrite numbers, never the structure.
import type { StanceId } from './stances';
import { SPAWN_INVULN_S } from './combat';
import { GAME_W, GAME_H } from './layout';
import { FX_GROUND_OFFSET } from './fx-extra';

// ── Smoke Bomb (spec §D.1: teleport-dodge; the AI's react-dodge plays the same intent) ──────
export const SMOKE_BOMB_DISTANCE = 180; // px teleported away from the opponent
export const SMOKE_BOMB_MS = 160; // ms the teleport slide takes
export const SMOKE_BOMB_IFRAMES_MS = 420; // i-frames from execution (distinct from spawn invuln)
export const SMOKE_BOMB_COOLDOWN_MS = 2500; // intent ignored while cooling (spam chaos guard)

// ── Stab + Deflect (spec §D.1: the stab pose deflects kunai/arrows when Deflect is learned) ─
export const DEFLECT_WINDOW_MS = 260; // deflect window opened by a stab pose
export const DEFLECT_RADIUS = 64; // px — projectile within this of the deflector is swatted
export const PROJECTILE_SPEED = 0.55; // px/ms kunai speed
export const PROJECTILE_DMG = 8; // flat kunai damage
export const PROJECTILE_HIT_RADIUS = 26; // px — projectile within this of a fighter lands
export const PROJECTILE_SPAWN_OFFSET = 40; // px in front of the thrower
export const PROJECTILE_MAX_ACTIVE = 8; // hard cap on live kunai (spam-every-tick chaos guard)

// ── Shunpo (SHS2 heritage; Tell 16) — player slow-mo burst draining a power meter ───────────
export const SHUNPO_MAX = 100; // power meter capacity (starts full)
export const SHUNPO_DRAIN_PER_S = 34; // drain per second while active
export const SHUNPO_DRAIN_PER_MS = SHUNPO_DRAIN_PER_S / 1000; // derived — per-ms for fixed ticks
export const SHUNPO_TIMESCALE = 0.35; // sim-owned presentation multiplier while active
export const SHUNPO_MIN_TO_START = 10; // meter needed to start a burst (empty-meter chaos guard)

// ── Movement / windup (ports of DuelScene literals — frozen port contract) ──────────────────
export const PLAYER_MOVE_SPEED = 0.28; // px/ms (was DuelScene MOVE_SPEED)
export const PLAYER_WINDUP_MS = 360; // player strike telegraph (was playerWindupUntil = now+360)
export const LAUNCH_KNOCKUP_MS = 480; // knock-up airtime on a landed launch (was 240ms up + yoyo)

// ── Per-fighter seeds (ports of DuelScene fighter-construction literals) ────────────────────
export const SPAWN_X_FRAC = { player: 0.43, opponent: 0.57 } as const;
export const PLAYER_BASE = {
  hp: 100,
  atkPlusWeapon: 10,
  defense: 5,
  stance: 'balanced' as StanceId,
  deflectLearned: true, // M2: player has Deflect (skill-tree gating is M3)
} as const;
export const ENEMY_BASE = {
  hp: 100,
  atkPlusWeapon: 7,
  defense: 5,
  stance: 'heavy' as StanceId,
  deflectLearned: false,
} as const;
export const DUMMY_BASE = {
  hp: 100,
  atkPlusWeapon: 7,
  defense: 5,
  stance: 'balanced' as StanceId,
  deflectLearned: false,
} as const;

// ── Derived values so core/ stays zero-literal (RAD_TO_DEG precedent) ───────────────────────
export const SPAWN_INVULN_MS = SPAWN_INVULN_S * 1000; // CONTRACT 5s, in fixed-tick ms
export const SIM_GROUND_Y = GAME_H - FX_GROUND_OFFSET; // sim's world ground line (= scene GROUND_Y)
export const ARENA_X_MAX = GAME_W; // right despawn bound for projectiles

// ── Sim hit-model defaults (used when the scene has not injected posed limbs) ───────────────
// One vertical body capsule per fighter; sever is impossible on the default body (Infinity
// threshold) — severing needs real posed limbs from the render skeleton (scene-injected).
export const STRIKE_TORSO_OFFSET = 46; // px above ground: torso line (was DuelScene's y-46 sprays)
export const BODY_CAPSULE_TOP = 150; // px above ground — capsule top
export const BODY_CAPSULE_BOTTOM = 20; // px above ground — capsule bottom
export const BODY_CAPSULE_RADIUS = 22; // px — capsule radius
export const BODY_CAPSULE_MID = (BODY_CAPSULE_TOP + BODY_CAPSULE_BOTTOM) / 2; // derived — slash-origin height (keeps the reach gate horizontal against the default capsule)
export const BODY_SEVER_THRESHOLD = Number.POSITIVE_INFINITY; // default body never severs

// Float-noise tolerance for fixed-tick countdown timers: a residue below this is zero. Keeps
// exact-multiple durations (e.g. 21 frames × FIXED_DT_MS) from leaking a 1e-13 residue that
// would cost one extra tick, while preserving ceil semantics (telegraph ≥ telegraphMs holds).
export const TIMER_EPS_MS = 1e-6;

// ── Intent plumbing ─────────────────────────────────────────────────────────────────────────
// Discrete intents queue until a fixed step consumes them (the 120Hz+ intent-drop fix);
// the queue is bounded so a zero-delta spam loop cannot grow it without bound.
export const INTENT_QUEUE_MAX = 8;

// Skill-slot → sim verb mapping (single mapping source for useSkill 1/2/3; HUD geometry and
// key labels live in config/hud-extra.ts SKILL_SLOTS — s-hud owns that file).
export const SKILL_VERB = { 1: 'chiPunch', 2: 'smokeBomb', 3: 'stab' } as const;

// ── Seeded RNG (mulberry32) ─────────────────────────────────────────────────────────────────
// Math.random is banned in core/ (determinism); the sim/AI consume an injected `() => number`.
// The algorithm constants below are NOT gameplay tunables — they are the mulberry32 definition,
// housed in config/ so core/ stays literal-free (RAD_TO_DEG / CRITICAL_FILL_PER_MS precedent).
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
