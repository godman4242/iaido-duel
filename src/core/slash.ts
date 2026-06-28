import { Pt } from './vec';
import { Capsule, polylineCapsuleOverlap, firstPointInCapsule } from './geometry';

export type Limb = { id: string; capsule: Capsule; severThreshold: number };

export type SlashInput = {
  path: Pt[];
  origin: Pt;
  reach: number;
  dmgMult: number;
  crit: boolean;
  counter: number;
};

export type LimbHit = { limbId: string; overlap: number; severed: boolean; cutPoint: Pt };
export type SlashResult = { hits: LimbHit[]; totalDamage: number };

const mid = (c: Capsule): Pt => ({ x: (c.a.x + c.b.x) / 2, y: (c.a.y + c.b.y) / 2 });

export function resolveSlash(
  input: SlashInput,
  limbs: Limb[],
  atkPlusWeapon: number,
  defenderDamageTakenMult: number,
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
    const base = atkPlusWeapon * input.dmgMult * (input.crit ? 1.3 : 1) * input.counter;
    totalDamage = Math.round(base * defenderDamageTakenMult * (1 + 0.5 * severed));
  }
  return { hits, totalDamage };
}
