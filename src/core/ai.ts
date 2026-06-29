export type AIState = 'idle' | 'approach' | 'telegraph' | 'attack' | 'recover' | 'block' | 'dodge';

export type AISense = {
  distance: number;
  playerAttacking: boolean;
  playerWindup: boolean;
  selfRecovering: boolean;
  rng: number;
};

export type AIParams = {
  approachRange: number;
  strikeRange: number;
  reactBlockChance: number;
  reactDodgeChance: number;
};

// Time (ms) spent in a state before it auto-advances.
export const TELEGRAPH_MS = 520;
export const ATTACK_MS = 180;
export const RECOVER_MS = 620;
export const REACT_MS = 320;

/** Pure transition: given the current state, time-in-state, what it senses, and its params. */
export function nextAIState(state: AIState, t: number, s: AISense, p: AIParams): AIState {
  switch (state) {
    case 'idle':
      if (s.distance <= p.strikeRange) return 'telegraph';
      if (s.distance <= p.approachRange) return 'approach';
      return 'idle';

    case 'approach': {
      if (s.playerWindup) {
        if (s.rng < p.reactBlockChance) return 'block';
        if (s.rng < p.reactBlockChance + p.reactDodgeChance) return 'dodge';
      }
      if (s.distance <= p.strikeRange) return 'telegraph';
      if (s.distance > p.approachRange) return 'idle';
      return 'approach';
    }

    case 'telegraph':
      return t >= TELEGRAPH_MS ? 'attack' : 'telegraph';

    case 'attack':
      return t >= ATTACK_MS ? 'recover' : 'attack';

    case 'recover':
      return t >= RECOVER_MS ? 'idle' : 'recover';

    case 'block':
    case 'dodge':
      return t >= REACT_MS ? 'approach' : state;
  }
}
