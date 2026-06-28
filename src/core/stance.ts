export type StanceId = 'light' | 'balanced' | 'heavy';

export type Stance = {
  id: StanceId;
  reach: number;
  speed: number;
  dmgMult: number;
  damageTakenMult: number;
};

export const STANCES: Record<StanceId, Stance> = {
  light: { id: 'light', reach: 300, speed: 1.4, dmgMult: 0.9, damageTakenMult: 1.0 },
  balanced: { id: 'balanced', reach: 200, speed: 1.0, dmgMult: 1.2, damageTakenMult: 1.0 },
  heavy: { id: 'heavy', reach: 120, speed: 0.7, dmgMult: 1.4, damageTakenMult: 1.25 },
};

// Counter triangle: light beats heavy, heavy beats balanced, balanced beats light.
const BEATS: Record<StanceId, StanceId> = { light: 'heavy', heavy: 'balanced', balanced: 'light' };

export function counterBonus(attacker: StanceId, defender: StanceId): number {
  return BEATS[attacker] === defender ? 1.25 : 1.0;
}
