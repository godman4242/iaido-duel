import { GameState } from './gamestate';

/** Bump when the GameState shape changes incompatibly; older saves then fail to load (return null). */
export const SAVE_VERSION = 1;

interface SaveEnvelope {
  version: number;
  state: GameState;
}

export function serialize(state: GameState): string {
  const envelope: SaveEnvelope = { version: SAVE_VERSION, state };
  return JSON.stringify(envelope);
}

export function deserialize(json: string): GameState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isEnvelope(parsed) || parsed.version !== SAVE_VERSION) return null;
  return parsed.state;
}

function isEnvelope(v: unknown): v is SaveEnvelope {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return typeof e.version === 'number' && typeof e.state === 'object' && e.state !== null;
}
