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

- **(M1) Second `1.3×` crit leak fixed — `DuelScene.dealSpecial`.** The launch/stab special-move
  path still hard-coded `crit ? 1.3 : 1`; M1 routes it through `CRIT_MULT` (3×) from config, so a
  crit launch/stab now honors the contract like the slash path. (The config-purity ratchet also
  removed the bare `1.3` from `game/`.)

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

- **(RETIRED in M1) `core/anim.ts` grandfather.** It was the one grandfathered core module (16
  literals: walk/idle offsets + easing constants). M1 moved them to `config/anim.ts`
  (`WALK`/`IDLE_BREATH`/`EASE`), emptied `CORE_GRANDFATHERED`, and removed the `anim.ts` baseline
  entry — so **all of `core/` is now held to the zero-literal gate**.

- **AI reaction chances now sourced from `AI_TIERS.normal`** (`config/ai.ts`). The previous
  `AIController` used `reactBlock 0.22 / reactDodge 0.16`; the Normal tier is `0.30 / 0.15`.
  Both are INFERRED (freely tunable, no contract), so this is a seed change, not a contract
  divergence — recorded for traceability.

## M1 — slash vertical slice decisions (2026-06-30)

- **Jump is the drawn line, translated to the samurai.** Spec §D.1: a jump "begins at the line's
  start point, ends at its endpoint." `DuelScene.doJump` arcs the player from `stroke.start.x` to
  `stroke.end.x` (y pinned to the ground, fixed `JUMP_APEX`), matching the spec's instruction to
  "start the line at the samurai for a clean jump." Verified live (player goes airborne and lands at
  the line's end-x). `core/trajectory.jumpArcPoint` is the pure, unit-tested arc.

- **Multi-foe (Tell 5) is demonstrated via `?foes=N`.** The default duel stays 1-v-1 (the AI ronin).
  `?foes=N` (clamped to `MULTI_FOE_MAX`) adds static sparring dummies beside the ronin so one
  horizontal stroke crosses several foes; `doSlash` loops all foes through `resolveSlash`. Verified:
  one drag took two foes 100→{85,76}, killing neither (HP-based, not instakill). This keeps the duel
  feel intact while making the engine fact directly observable.

- **Directional blood uses an EmitterOp reload, not the `particleAngle` setter (Phaser 3.90).**
  Assigning `emitter.particleAngle = {min,max}` does NOT re-aim the cone in 3.90 — its setter calls
  `EmitterOp.onChange`, which only mutates `current` (to `NaN` for an object) and never reassigns
  `start`/`end`. `Gore.spray` instead calls `ops.angle.loadConfig({angle:{min,max}})` so
  `randomRangedValueEmit` reads the new range. Found by the M1 adversarial review (my first visual
  pass was a false positive — the test cut happened to be rightward, matching the frozen default).
  Verified deterministically (op center tracks the cut: right→0°, left→180°, up→270°, down→90°).

- **Blade-trail colored edge = chi-blue (`COL.bladeChi`), not steel-grey.** Makes the two layers
  read as distinct (white core + colored edge, Tell 2) and matches the survey note that the
  reference trail "reads as a blue swept ribbon" (`CALIBRATION.md` row 4).

- **`DrawnStroke` hardened against overflow-scale input.** `resample` now bails to the two endpoints
  when `step` is non-finite, and `buildDrawnStroke` clamps a non-finite `length` to 0, so a ±1e308
  stroke can no longer NaN-out the live hit-polyline. Found by the M1 adversarial review (the
  original overflow chaos test only checked `dir`/`verb`); the test now asserts the full
  finite-points/finite-length invariant, and the guard is proven by reverting it (test goes red).

## M2 — Sim combat port + integration decisions (2026-07-05)

- **Shunpo is bound to SHIFT-hold, not SPACE.** SPACE is contractually the stance swap
  (Tell 8 / spec §D.4: "Space/portrait-click swaps stance and drains Focus"); SHS2 —
  where Shunpo is confirmed — used SPACEBAR. Divergence intentional, mechanics identical:
  hold SHIFT for the slow-mo burst (drains the power meter, ends on release or empty),
  press SPACE / click the portrait to swap stance.

- **Spawn grace `1500ms` → `SPAWN_INVULN_MS` 5000 (CONTRACT, Tell 9).** The pre-port scene
  used an INFERRED 1.5 s `graceUntil`; the contract is **5 s OR until first slash**, now
  computed in `core/Sim` (`invulnMs`/`hasSlashed`). The blink tween is presentation-only:
  it starts when FIGHT! lands and is stopped by the sim's `invulnEnded` event, so the blink
  ends on the exact sim frame (timeout *or* first slash). Related core decision (sim-port):
  invuln is cleared by any **first offensive act** (slash/stab/launch/chiPunch/projectile) —
  a superset of "first slash"; you attack, you lose protection.

- **Player strikes now wind up `PLAYER_WINDUP_MS` (360 ms) before resolving.** Port of the
  pre-port `playerWindupUntil = now + 360` (which only fed the AI's reaction check) into a
  real sim windup: the strike damage lands when `windupMs` expires, not on gesture end.
  This changes the M1 instant-hit feel and is what makes the AI's react-block/dodge and the
  telegraph measures provable in core tests. Flagged for the main-loop feel pass.

- **`DuelScene` is now render-only (the §1.C mandate landed).** All combat math — damage,
  Focus, Critical (+weapon-weight drain, 3× crit), stance triangle, spawn invuln, Smoke
  Bomb i-frames, Stab+Deflect, Chi Punch, projectiles, Shunpo, and the kill latch — runs in
  `core/Sim`; the scene builds `PlayerIntent` from input, feeds `advance(delta ×
  sim.timeScale)`, drains `SimEvent`s into FX/SFX, and copies sim state onto render puppets
  (`Fighter` never writes back; gameplay tweens deleted — jump/knock-up arcs are sim-computed).
  `game/ai/AIController` shrank to a telegraph-caret/pose painter; decisions live in
  `core/AISeamController` behind the seam with an injected mulberry32 rng (`Math.random`
  removed from the AI path). Sim rng seed comes from `?seed=` (dev) or `Date.now()` —
  wall-clock is allowed in `game/`, never in `core/`.

- **`OpponentIntent.throwProjectile` is design-for-test.** No Duels footage shows the duel
  opponent throwing kunai at this tier; the intent exists so the Stab+Deflect measure (Tell
  10) is provable through the seam (ScriptedController throws, the stab pose swats). The AI
  tiers may adopt it later; it is not reachable from the player's input map.

- **Duel framing wiring (Tell 25).** The sim is frozen until `DuelIntro`'s FIGHT! lands
  (`onFight` = the unfreeze; spawn-invuln starts counting there), any click fast-forwards
  the intro, and gesture strokes begun before FIGHT! are discarded (the skip click can
  never clear invuln or queue a slash). `DuelResult` mounts `DUEL_SCENE.resultDelayMs`
  after the KillBeat anatomy and shows `KILL_REWARD` values at foe level 1 (display-only —
  the economy tally math is M3); defeat shows 0/0.

- **Presentation slow-mo follows the sim.** The scene applies `sim.timeScale` (Shunpo) to
  `time.timeScale` AND `tweens.timeScale` together, restores both on the kill beat (before
  FinisherFlash takes the clocks), on scene shutdown, and in `create()` — an R-restart mid
  slow-mo can never leak a stuck timescale into the next duel (port-risk list).

- **`SPAWN_BLINK.repeats = -1` (infinite).** The contract sketched `{periodMs, repeats,
  alphaLow}`; pre-counting cycles would drift from the "ends on first slash" half, so the
  blink repeats until the `invulnEnded` event stops it — the key is kept (honoring the
  contract shape) but pinned to infinite.

## Deferred to later milestones (seeded now, built later)

- **(LANDED in M2) Full §A.1 damage formula.** `core/slash.ts` currently applies
  `(Attack+Weapon) · dmgMult · crit · counter · defenderDamageTakenMult · severedBonus`.
  The spec's full formula adds the `(1 − Defense·DEF_K)` defense term and a
  `defenderCounterPenalty` divisor. `DEF_K = 0.01` and the structure are seeded in
  `config/combat.ts`; wiring the defense term into the resolver is **M2 (full combat)**.

- **(LANDED in M2 — see the M2 section above) `Sim` is the minimal M0 seam.** It owns the fixed-60 Hz deterministic tick, consumes
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

## Distribution & IP posture (2026-07-02 — PUBLIC release is now the goal)

Kheshav's goal update: release the game publicly (free) so the original community can replay
it. This supersedes the 2026-06-29 "private repo" mitigation, which was the load-bearing
justification for mirroring names/plot. Posture for anything that ships publicly:

- **Ship-safe (match exactly):** mechanics, numbers, timing, controls, screen flow, HUD layout,
  palette mood, FX behavior, genre/style family ("flat-vector samurai") — facts and ideas, not
  protectable expression. This is what the §F tells overwhelmingly measure.
- **Not ship-safe publicly (must be original):** the source's title/wordmark (trademark), its
  cast/clan-name roster + plot sequence taken as a whole (protectable characters/plot), traced
  or perceptually-1:1 replica artwork, and verbatim prose (already banned). Free/non-commercial
  release reduces damages, **not** liability — it is not a shield.
- **Public build config:** `TITLE_WORDMARK` ships as **IAIDO DUEL**; campaign data ships an
  **original cast/story in the same register** (rural intrigue, ailing lord, old-guard vanguard,
  haiku title cards — same *form*, our names/words). Tell 35 regrades for the public build to
  "internally consistent original lore"; Tells 33–34 (structure/format) unchanged.
- **Two-track content:** campaign content is data-driven and swappable by design (2026-06-29
  decision), so the private faithful variant remains possible without forking the engine.
- **The one path to a true 1:1 public revival:** permission from the rights holder
  (LutGames / Luther Chan). Worth an email before M4 content lands — dead-Flash devs often
  bless fan revivals. (For pure preservation, the original also survives via Flashpoint.)

## DESIGN-FROM-LORE systems (graded by lore-faithfulness, exempt from frame-exact)

- **War Room rival-clan strategic AI** (spec §A.4) — servers are dead; logic was server-side.
  Documented numbers (kill cap 350, build cap 500, deploy +60/+100/75, flag +120%, lvl-10 gate)
  are CONTRACT and asserted; the rival-clan strategist itself is design-from-lore (greedy:
  reinforce weakest owned border, attack adjacent weaker enemy sector, build when Captain+ and
  flush). Implementation is **M5 (stretch)**.
