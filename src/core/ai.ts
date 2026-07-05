// core/ai.ts — pure AI state machine. State durations come from config/ai.ts (Normal tier by
// default; M2: callers may pass per-tier durations in AIParams so easy/hard drive the same FSM).
import { AI_TIERS } from '../config/ai';

export type AIState = 'idle' | 'approach' | 'telegraph' | 'attack' | 'recover' | 'block' | 'dodge';

export type AISense = {
  distance: number;
  playerAttacking: boolean;
  playerWindup: boolean;
  selfRecovering: boolean;
  rng: number;
  /** M2 (spec §D.1): the player's telegraphed strike is a stab — the AI prefers the
   *  Smoke-Bomb dodge over a block against it. Optional for back-compat. */
  playerStabIncoming?: boolean;
};

export type AIParams = {
  approachRange: number;
  strikeRange: number;
  reactBlockChance: number;
  reactDodgeChance: number;
  // M2 optional per-tier durations (default: the Normal-tier constants below)
  telegraphMs?: number;
  attackMs?: number;
  recoverMs?: number;
  reactMs?: number;
};

// Time (ms) spent in a state before it auto-advances — sourced from the Normal AI tier.
export const TELEGRAPH_MS = AI_TIERS.normal.telegraphMs;
export const ATTACK_MS = AI_TIERS.normal.attackMs;
export const RECOVER_MS = AI_TIERS.normal.recoverMs;
export const REACT_MS = AI_TIERS.normal.reactMs;

/** Pure transition: given the current state, time-in-state, what it senses, and its params. */
export function nextAIState(state: AIState, t: number, s: AISense, p: AIParams): AIState {
  const telegraphMs = p.telegraphMs ?? TELEGRAPH_MS;
  const attackMs = p.attackMs ?? ATTACK_MS;
  const recoverMs = p.recoverMs ?? RECOVER_MS;
  const reactMs = p.reactMs ?? REACT_MS;
  switch (state) {
    case 'idle':
      if (s.distance <= p.strikeRange) return 'telegraph';
      if (s.distance <= p.approachRange) return 'approach';
      return 'idle';

    case 'approach': {
      if (s.playerWindup) {
        // an incoming STAB is dodged (Smoke Bomb) in preference to a block (spec §D.1)
        if (s.playerStabIncoming && s.rng < p.reactDodgeChance) return 'dodge';
        if (s.rng < p.reactBlockChance) return 'block';
        if (s.rng < p.reactBlockChance + p.reactDodgeChance) return 'dodge';
      }
      if (s.distance <= p.strikeRange) return 'telegraph';
      if (s.distance > p.approachRange) return 'idle';
      return 'approach';
    }

    case 'telegraph':
      return t >= telegraphMs ? 'attack' : 'telegraph';

    case 'attack':
      return t >= attackMs ? 'recover' : 'attack';

    case 'recover':
      return t >= recoverMs ? 'idle' : 'recover';

    case 'block':
    case 'dodge':
      return t >= reactMs ? 'approach' : state;
  }
}
