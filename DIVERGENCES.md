# DIVERGENCES.md

Every departure from a documented value, every resolved open question, and every
DESIGN-FROM-LORE system — with rationale (spec §J.3, §4.3). CONTRACT values are never
silently changed; if footage ever contradicts one, the contract wins and the contradiction
is logged here.

## Fixed divergences (prior build → contract)

- **Critical multiplier `1.3×` → `3×` (CONTRACT, spec §A.1).** `core/slash.ts` previously used
  `crit ? 1.3 : 1`. Now sources `CRIT_MULT = 3` from `config/combat.ts`. `slash.test.ts` updated
  to assert the contract result (a crit nick now reads `66`, was `28`). Asserted by
  `config/__tests__/contract-audits.test.ts`.

## Intentional, rationale-backed deviations

- **`ScriptedController` placed in `core/`, not `game/`** (spec §C lists it under `game/`).
  Rationale: it is pure and Phaser-free, and `core/__tests__/opponent-seam.test.ts` must not
  import from the presentation layer. Keeping it in `core/` preserves the clean `core`→`game`
  dependency direction. No behavioral difference.

- **`config-purity` enforcement is two-tier** (`src/__tests__/config-purity.baseline.json`).
  Rationale: purifying *every* literal across `core/` + `game/` in M0 is infeasible (M0 is
  scaffolding). Instead: **(1)** all of `src/core/**` is held to **zero** violations (the
  deterministic, render-free sim must be pure) — `geometry.ts` was purified (its sampling-step
  knob moved to `config/combat.ts` `HIT_SAMPLE_STEPS`, the `0.5` cell-center rewritten as
  `(i*2+1)/(steps*2)`); the **only** grandfathered core file is `core/anim.ts`, whose constants
  are genuine **motion-feel tunables** moved to config in **M1** (see below). **(2)** `game/**`
  (+ grandfathered core) is ratcheted against a committed per-file **value multiset** — the build
  fails on any **new or substituted** value (substitution was un-caught by the prior count-only
  ratchet); removals (debt paydown) are allowed. The scanner catches numeric literals, **BigInt**
  literals, and numbers **smuggled as string/template text** (`Number('500')`, `` `30` ``) — all
  three verified by an adversarial probe. The baseline (mostly `game/` rendering: `Forest` 127,
  `drawFighter` 114, `Skeleton` 106, …) shrinks as M1–M5 give those modules their own config.

- **`core/anim.ts` is the one grandfathered core module** (16 literals). Its walk/idle offsets
  (foot-swing `±18`, bob/breath amplitudes) and easing constants are **secondary-motion feel**
  tunables (spec §4.2 locomotion & secondary motion) — they belong in config, but that is M1
  (motion-feel) work. Listed explicitly in `CORE_GRANDFATHERED` so the exception is visible, not silent.

- **AI reaction chances now sourced from `AI_TIERS.normal`** (`config/ai.ts`). The previous
  `AIController` used `reactBlock 0.22 / reactDodge 0.16`; the Normal tier is `0.30 / 0.15`.
  Both are INFERRED (freely tunable, no contract), so this is a seed change, not a contract
  divergence — recorded for traceability.

## Deferred to later milestones (seeded now, built later)

- **Full §A.1 damage formula.** `core/slash.ts` currently applies
  `(Attack+Weapon) · dmgMult · crit · counter · defenderDamageTakenMult · severedBonus`.
  The spec's full formula adds the `(1 − Defense·DEF_K)` defense term and a
  `defenderCounterPenalty` divisor. `DEF_K = 0.01` and the structure are seeded in
  `config/combat.ts`; wiring the defense term into the resolver is **M2 (full combat)**.

- **`Sim` is the minimal M0 seam.** It owns the fixed-60 Hz deterministic tick, consumes
  `OpponentIntent` without branching on controller type, and applies stance-switch + a landed
  slash. Its `advance()` clamps catch-up time to `MAX_FRAME_MS` (250) and ignores
  NaN/Infinity/non-positive frames — the spiral-of-death guard the accumulator pattern requires
  (spec §3) before it is wired to the render loop in M1. Porting full combat (Focus/Critical,
  weapon weight, Smoke Bomb, kill-beat) out of `game/scenes/DuelScene.ts` into `Sim` is **M2**.

- **Resolved open question — CONTRACT audit coverage.** §G.a enumerates a *subset* of CONTRACT
  values; §E says *all* CONTRACT values are frozen by tests. Resolved in favor of §E: the audit
  now asserts every CONTRACT value present in config (incl. Light SPEED 1.4, stance cap ×1.4, the
  stance triangle, Chi/Ninja unlock cadence, equipment/merchant/ninja economy, and all War Room
  numbers), and the four CONTRACT values that were missing from config entirely (elemental cap
  300, chi cap 100, ninja rare-outfit 15g, duel-token tiers) were added and asserted.

- **`OpponentIntent.stroke` is `{ path: Pt[] }`**, not a named `DrawnStroke` type. The resampled +
  smoothed `DrawnStroke` (two-layer tapered ribbon source-of-truth) is introduced in **M1**.

## DESIGN-FROM-LORE systems (graded by lore-faithfulness, exempt from frame-exact)

- **War Room rival-clan strategic AI** (spec §A.4) — servers are dead; logic was server-side.
  Documented numbers (kill cap 350, build cap 500, deploy +60/+100/75, flag +120%, lvl-10 gate)
  are CONTRACT and asserted; the rival-clan strategist itself is design-from-lore (greedy:
  reinforce weakest owned border, attack adjacent weaker enemy sector, build when Captain+ and
  flush). Implementation is **M5 (stretch)**.
