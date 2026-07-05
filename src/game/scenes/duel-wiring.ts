// game/scenes/duel-wiring.ts — pure, Phaser-free glue between DuelScene and core/Sim
// (M2 integration, blueprint §1.C: "DuelScene only renders sim state + emits player intents").
// Everything here is deterministic and unit-chaos-tested: URL-param parsing, the stance
// cycle, the per-frame intent buffer, and the sim → HUD snapshot mapping. Zero gameplay
// literals — every number comes from src/config/** (config-purity born-zero rule).
import { MULTI_FOE_MAX, FOCUS_SWITCH_COST } from '../../config/combat';
import { SMOKE_BOMB_COOLDOWN_MS } from '../../config/combat-sim';
import { AI_TIERS, type AITier } from '../../config/ai';
import { SKILL_SLOTS } from '../../config/hud-extra';
import { isCritReady } from '../../core/critical';
import type { PlayerIntent } from '../../core/Sim';
import type { StanceId } from '../../core/stance';
import type { Gesture } from '../../core/gesture';
import type { Pt } from '../../core/vec';
import type { HudDuelView } from '../ui/Hud';

/** SPACE / portrait-click stance rotation (the pre-port DuelScene cycle, order preserved). */
export const STANCE_CYCLE: readonly StanceId[] = ['light', 'balanced', 'heavy'];

/** Next stance in the cycle; an unknown current id resets to the cycle start (chaos guard). */
export function nextStance(current: StanceId): StanceId {
  const i = STANCE_CYCLE.indexOf(current);
  return STANCE_CYCLE[(i + 1) % STANCE_CYCLE.length];
}

/** ?foes=N → total foe count in [1, MULTI_FOE_MAX]; hostile input (NaN/±Inf/negative/fractional) → 1. */
export function clampFoeCount(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(MULTI_FOE_MAX, Math.max(1, Math.floor(n)));
}

/** ?tier= → a real AI tier; anything else (incl. prototype-pollution keys) → 'normal'. */
export function parseTier(raw: string | null): AITier {
  return raw !== null && Object.prototype.hasOwnProperty.call(AI_TIERS, raw)
    ? (raw as AITier)
    : 'normal';
}

/** ?seed= → a positive integer rng seed; hostile/absent input falls back (never 0/NaN). */
export function parseSeed(raw: string | null, fallback: number): number {
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  const f = Number.isFinite(fallback) ? Math.floor(Math.abs(fallback)) : 1;
  return f > 0 ? f : 1;
}

/**
 * Per-frame player-intent assembly: discrete acts (stroke / stance switch / skill) queue
 * between frames and are drained ONCE into the sim's advance() call together with the
 * held fields (move / shunpoHold). The sim's own bounded queue handles 120Hz+ pacing;
 * this buffer only bridges "event handler fired mid-frame" → "one intent per update()".
 */
export class IntentBuffer {
  private queued: PlayerIntent = {};

  /** Drawn gesture — the verb travels WITH the path (ONE classifier decision, port contract). */
  queueStroke(path: Pt[], verb?: Gesture): void {
    this.queued.stroke = { path, verb };
  }

  queueStance(id: StanceId): void {
    this.queued.switchStance = id;
  }

  /** Skill slot 1..SKILL_SLOTS.length; hostile slots (0, negative, fractional, NaN, out of range) are ignored. */
  queueSkill(slot: number): void {
    if (!Number.isInteger(slot) || slot < 1 || slot > SKILL_SLOTS.length) return;
    this.queued.useSkill = slot as 1 | 2 | 3;
  }

  /** True if a discrete intent is waiting (for tests / debug). */
  hasQueued(): boolean {
    return (
      this.queued.stroke !== undefined ||
      this.queued.switchStance !== undefined ||
      this.queued.useSkill !== undefined
    );
  }

  /** Merge queued discrete intents with this frame's held fields, then clear the queue. */
  drain(held: { move: -1 | 0 | 1; shunpoHold: boolean }): PlayerIntent {
    const out: PlayerIntent = {
      ...this.queued,
      move: held.move === -1 || held.move === 1 ? held.move : 0,
      shunpoHold: held.shunpoHold === true,
    };
    this.queued = {};
    return out;
  }

  clear(): void {
    this.queued = {};
  }
}

/** 0..1 with NaN/±Infinity collapsed to 0 (HUD-safe fraction). */
function frac01(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

/** The slice of FighterSimState the HUD snapshot needs (structural — sim.player satisfies it). */
export interface DuelViewSource {
  hp: number;
  hpMax: number;
  focus: number;
  critical: number;
  shunpo: number;
  shunpoActive: boolean;
  stance: StanceId;
  smokeCooldownMs: number;
  combo: number;
}

/**
 * Map the polled sim player state into the Hud's duel snapshot (port contract: meters are
 * polled, not evented). Slot state is presentation-only — the sim stays the authority that
 * accepts/denies (fireSkillSlot always forwards; see Hud contract).
 */
export function duelViewOf(p: DuelViewSource, over: boolean): HudDuelView {
  const cooling = Number.isFinite(p.smokeCooldownMs) && p.smokeCooldownMs > 0;
  return {
    hp: p.hp,
    hpMax: p.hpMax,
    focus: p.focus,
    critical: p.critical,
    critReady: isCritReady(p.critical),
    shunpo: p.shunpo,
    shunpoActive: p.shunpoActive === true,
    stance: p.stance,
    stanceLocked: !(p.focus >= FOCUS_SWITCH_COST), // NaN focus reads locked (fail-closed)
    combo: Number.isFinite(p.combo) ? p.combo : 0,
    skills: SKILL_SLOTS.map((s) => ({
      enabled: !over && (s.id !== 'smokeBomb' || !cooling),
      cooldownFrac: s.id === 'smokeBomb' ? frac01(p.smokeCooldownMs / SMOKE_BOMB_COOLDOWN_MS) : 0,
    })),
  };
}
