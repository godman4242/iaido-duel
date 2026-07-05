import { Pt } from './vec';
import { Capsule, polylineCapsuleOverlap, firstPointInCapsule } from './geometry';
import { CRIT_MULT, SEVERED_DAMAGE_BONUS, DEF_K, DAMAGE_FLOOR } from '../config/combat';

export type Limb = { id: string; capsule: Capsule; severThreshold: number };

export type SlashInput = {
  path: Pt[];
  origin: Pt;
  reach: number;
  dmgMult: number;
  crit: boolean;
  counter: number;
  /**
   * defenderCounterPenalty (spec §A.1): divisor when the DEFENDER's stance beats the
   * attacker's — use core/stance.counterPenalty(). Omitted/hostile values resolve to 1.
   */
  counterPenalty?: number;
};

export type LimbHit = { limbId: string; overlap: number; severed: boolean; cutPoint: Pt };
export type SlashResult = { hits: LimbHit[]; totalDamage: number };

const mid = (c: Capsule): Pt => ({ x: (c.a.x + c.b.x) / 2, y: (c.a.y + c.b.y) / 2 });

/**
 * The `(1 − Defense·DEF_K)` term of the §A.1 damage formula (wired in M2; seeded in M0).
 * Hostile Defense clamps sanely: NaN/negative → 0 (defense can never AMPLIFY damage);
 * huge/+Infinity → term 0 (DAMAGE_FLOOR keeps a landed hit ≥ 1 — spec: "clamp final ≥ 1").
 */
export function defenseTerm(defense: number): number {
  const d = Number.isNaN(defense) ? 0 : Math.max(0, defense);
  return Math.max(0, 1 - d * DEF_K);
}

export function resolveSlash(
  input: SlashInput,
  limbs: Limb[],
  atkPlusWeapon: number,
  defenderDamageTakenMult: number,
  defenderDefense = 0,
): SlashResult {
  const hits: LimbHit[] = [];
  for (const limb of limbs) {
    const m = mid(limb.capsule);
    // reach gate: limb must be within the attacker's reach of the slash origin
    if (Math.hypot(m.x - input.origin.x, m.y - input.origin.y) > input.reach) continue;
    const overlap = polylineCapsuleOverlap(input.path, limb.capsule);
    if (overlap <= 0) continue;
    const cut = firstPointInCapsule(input.path, limb.capsule) ?? m;
    hits.push({
      limbId: limb.id,
      overlap,
      severed: overlap >= limb.severThreshold,
      cutPoint: cut,
    });
  }
  let totalDamage = 0;
  if (hits.length) {
    const severed = hits.filter((h) => h.severed).length;
    // divisor guard: only a finite, positive penalty divides (chaos: 0/NaN/±Inf → neutral 1)
    const penRaw = input.counterPenalty ?? 1;
    const pen = Number.isFinite(penRaw) && penRaw > 0 ? penRaw : 1;
    // §A.1 (decided formula): (Atk+Weapon) · dmgMult · counter · crit · (1 − Defense·DEF_K),
    // then defender-side taken-mult + sever bonus, ÷ defenderCounterPenalty, clamp final ≥ 1.
    const base =
      atkPlusWeapon *
      input.dmgMult *
      (input.crit ? CRIT_MULT : 1) *
      input.counter *
      defenseTerm(defenderDefense);
    const raw = (base * defenderDamageTakenMult * (1 + SEVERED_DAMAGE_BONUS * severed)) / pen;
    totalDamage = Math.max(DAMAGE_FLOOR, Math.round(Number.isFinite(raw) ? raw : 0));
  }
  return { hits, totalDamage };
}
