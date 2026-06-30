# M2 — Full Combat (kickoff blueprint)

> Authoritative spec: `~/Downloads/MASTER_PROMPT.md` §M2, §A.1, §A.3, §C, §D.1, §D.3, §D.5, §F, §G.
> This file bridges that spec to the **current repo after M1**. Read alongside `DIVERGENCES.md`,
> `TELLS_CHECKLIST.md`, `CALIBRATION.md`, memory `build-approach-and-spec`, and the reference
> sources (memory `reference-sources` — the Duels longplays + SHS2 for Shunpo/launch/deflect feel).
> M1 made the slash *feel* right; **M2 makes the duel a real fight** — meters, stances, AI, finisher.

---

## 0. The bar for M2 (read literally)
A returning player dropped into a Normal-tier duel **cannot tell it from the original** across the
§G scenario set: a 3× crit, a stance swap that drains Focus, spawn-invuln blink, Smoke-Bomb dodge,
a Stab+Deflect, a telegraphed AI commit, a finisher kill-beat, and the VS→Fight→Result framing.
"Indistinguishable" is judged by eye/ear + the measurable checks below — **not** by reading files.

## 1. Definition of done (binary + measurable — no soft asserts)
M2 is done when **every** line is true. Each has a *measure* you can run, not a vibe.

**A. Green gates (CI — must stay green the whole milestone):**
1. `npx tsc --noEmit` → exit 0.
2. `npx vitest run` → all green, **including the new M2 Sim tests** (combat ported into `core/Sim`).
3. `config-purity` → green; **zero** new gameplay literals outside `src/config/` (core/ stays at zero;
   game/ ratchet shows only *removals*). Regenerate the baseline only to lock paydown, never to bless.
4. `npx vite build` → clean.

**B. Tells (the binding gate — spec §F; M2 owns 7–16, 23*, 25, 28):** each PASS in the running build,
verified by eye **and** by the deterministic measure in §3.
- ☐ 7 Critical bar drains per swing (more for heavier weapon); full → next hit is a visible **3× crit**.
- ☐ 8 Stance swap on Space/portrait **costs Focus**; triangle **Light>Heavy>Balanced>Light** holds with correct reach/speed/damage.
- ☐ 9 **5 s spawn invuln**, blinking, ends on first slash.
- ☐ 10 **Smoke Bomb** teleport-dodge and **Stab+Deflect** projectile swat both function.
- ☐ 11 PvE foes **move slowly**, granting charge time.
- ☐ 12 **Chi Punch = 10 dmg at L1** (CONTRACT — already asserted; wire the move).
- ☐ 13 Every committing AI attack shows a **readable telegraph for ≥ its telegraph duration**.
- ☐ 14 A Normal-tier duel is **winnable and losable, ~20–60 s**.
- ☐ 15 **Kill/finisher beat** (freeze + speed-ramp) fires on a duel-ending blow, **distinct from Shunpo**. `(measure)`
- ☐ 16 **Shunpo** player slow-mo **drains the power meter**. `(lore if unobservable in Duels — see reference-sources: confirmed in SHS2: SPACEBAR)`
- ☐ 25 **Duel framing**: VS splash + opponent name banner + Victory/Defeat result screen.
- ☐ 28 **Four-way slash SFX** (draw / whiff / flesh / armor-parry) each fire on the measured frame. `(measure)`
- ☐ 23\* **Functional** combat HUD (stance portrait LEFT click-to-swap, numbered skill bar 1/2/3, Focus + Critical bars). *Full measured HUD appearance (corners/colors/minimap) is M4 — M2 delivers only the combat-critical, interactive pieces.*

**C. Architecture (the M2 mandate — do NOT skip):**
5. **Combat is ported into `core/Sim`** and driven through the `OpponentController` seam: Focus,
   Critical (+weapon-weight drain), 3× crit resolution, stance switch + triangle, spawn-invuln,
   Smoke-Bomb, Stab/Deflect, Chi Punch, and the kill-beat *trigger* are computed in the deterministic
   sim — **`DuelScene` only renders sim state + emits player intents.** Proven by a `ScriptedController`
   test that plays a full duel to a deterministic outcome (the §C network-seam payoff). *(M1 left this
   logic in `DuelScene`; M2 is where it moves — see DIVERGENCES "Sim is the minimal M0 seam".)*

**D. Chaos + adversarial (per memory `chaos-test-everything`):**
6. Chaos suite (§4) green, **guards proven by planting failures** (revert → red → restore → green).
7. M2 run through the **ultracode adversarial + chaos workflow** (as M0/M1 were); every CONFIRMED
   finding fixed and re-verified before sign-off.

## 2. What M0/M1 already give you (build on it — do not re-create)
- `config/` — `combat.ts` (FOCUS_MAX/SWITCH_COST/CRIT_THRESHOLD, CRIT_MULT 3, DEF_K, SPAWN_INVULN_S 5,
  CHI_PUNCH_DMG_L1 10, COUNTER_BONUS 1.25), `stances.ts` (STANCE_TABLE, STANCE_BEATS, mastery),
  `ai.ts` (AI_TIERS telegraph/attack/recover/react/counter-pick, ENEMY_SPEED, DUEL_TARGET_SECONDS),
  `timing.ts` (FIXED_HZ, SLASH_FRAMES, MAX_FRAME_MS). **Add M2 keys here, never as literals.**
- `core/Sim.ts` — fixed-60 Hz deterministic tick + controller seam (today applies stance-switch + a
  landed slash only). **Grow combat HERE.**
- `core/slash.ts` — `resolveSlash` (§A.1 damage incl. crit 3×, counter, defense-taken). Wire the full
  `(1 − Defense·DEF_K)` term (seeded, deferred from M0 — see DIVERGENCES).
- `core/DrawnStroke.ts`, `core/trajectory.ts`, `core/gesture.ts`, `core/focus.ts`, `core/stance.ts`,
  `core/combo.ts`, `core/ai.ts` (FSM `idle→approach→telegraph→attack→recover` + block/dodge).
- `game/ai/AIController.ts` (drives the FSM + draws a telegraph caret), `game/scenes/KillBeat.ts`
  (red-wash finisher), `game/vfx/{BladeTrail,Gore}`, `game/ui/Hud.ts`, `game/audio/sfx.ts`.

## 3. Work items — file-level, with the **measure** that proves each (⇉ = ultracode-parallelizable)
1. **Critical meter** (`core/critical.ts` NEW ⇉) — passive fill; **drain per swing scaled by weapon
   weight**; ≥ threshold ⇒ next landed hit is 3×; stance-switch also deducts (patch behavior).
   *Measure:* unit test — N swings reduce the bar by `weaponDrain·N`; at full, the next `resolveSlash`
   returns exactly `3×` base; a Heavy weapon drains strictly more than Light per swing.
2. **Sim combat port** (`core/Sim.ts` + `core/Sim.test.ts` ⇉) — move stance-switch-cost (Focus),
   Critical, invuln window, Chi Punch, and the kill-beat trigger into `step()`/`apply()`.
   *Measure:* a `ScriptedController` duel produces a byte-identical outcome across two runs (determinism)
   AND a known script kills the opponent at the expected tick; `DuelScene` reads `sim.player/opponent`.
3. **Stance triangle in play** (config already has it) — switching applies reach/speed/damage; counter
   bonus 1.25 / penalty ÷1.25. *Measure:* Light-vs-Heavy landed hit deals `×1.25` of the non-counter
   case; reach/speed differ per `STANCE_TABLE` (extends the M1 per-stance arc test).
4. **Spawn invuln** (`core/Sim` + blink in `Fighter`) — `SPAWN_INVULN_S` (5 s) OR until first slash.
   *Measure:* damage applied at t<5 s with no prior slash = 0; first slash clears invuln; blink tween present.
5. **Smoke Bomb** (`game` + intent in seam) ⇉ — teleport-dodge with i-frames; AI uses it to dodge Stab.
   *Measure:* on `smokeBomb` intent the actor’s x jumps by the configured distance over the configured
   ms and takes 0 damage during; a Sim test asserts the i-frame window.
6. **Stab + Deflect** (`game/vfx` projectile + `core`) ⇉ — down-stroke stab; with Deflect, the stab
   pose removes an incoming kunai/arrow. *Measure:* a projectile overlapping the stab arc during the
   deflect window is destroyed and deals 0; without Deflect it lands.
7. **Chi Punch** (skill 1) — flat **10** dmg at L1. *Measure:* a chi punch reduces target HP by exactly 10.
8. **Skills 1/2/3 bar** (`game/ui/Hud`) — numbered slots fired by click or `1/2/3`. *Measure:* pressing
   `1` triggers Chi Punch; slots map to the configured skill ids; bar renders 3 numbered slots.
9. **AI telegraphs through the seam** (`AIController` + `core/ai`) — every committing action holds a
   readable pose for **≥ `AI_TIERS[tier].telegraphMs`** before it lands. *Measure:* a Sim/clock test
   asserts (telegraph-enter → strike-land) ≥ telegraphMs for slash, smoke-bomb, lunge, stance-flash.
10. **Winnable/losable Normal duel** — tune so a "good-play" script wins and a "no-play" script loses,
    median length 20–60 s. *Measure:* over ≥20 seeded sims, good-play win-rate high, no-play win-rate 0,
    median duration ∈ [20 s, 60 s] (`DUEL_TARGET_SECONDS`).
11. **Finisher kill-beat** (`game/scenes/KillBeat` + `core` trigger) — freeze + speed-ramp on the fatal
    blow, **distinct from Shunpo**. *Measure:* `time.timeScale` ramps to the configured factor over the
    configured ms then restores; trigger is the kill event, not the Shunpo input.
12. **Shunpo** (SHOULD) — player slow-mo burst draining a power meter (SPACEBAR; confirmed in SHS2).
    *Measure:* on Shunpo, `timeScale` = configured slow factor and the meter drains at the configured
    rate; ends when the meter empties; visually + mechanically distinct from the kill-beat.
13. **Duel framing** (`game/scenes/DuelIntro` + result ⇉) — VS splash w/ both portraits + opponent
    name banner → optional Ready/Fight → Victory/Defeat tally (XP + coins). *Measure:* the three screens
    appear in order; result shows the computed XP/coins.
14. **Four-way slash SFX** (`game/audio/sfx`) — draw / whiff / flesh / armor-parry, each on the measured
    frame; heavy vs light tonal weight. *Measure:* whiff fires when no limb is hit; flesh on a body hit;
    armor-parry on a blocked hit; draw on stroke start (frame logged vs `CALIBRATION`).

## 4. Chaos tests (required — prove guards by planting failures)
Sim fed: simultaneous player+AI kills on the same tick; a switchStance to an invalid id; smokeBomb spam
every tick; Critical drain below 0 / fill above max; invuln + kill on the same frame; a deflect with no
projectile; Shunpo with an empty meter; kill-beat re-entry (two fatal blows one tick); NaN/Inf dt
(already guarded); a duel that never lands a hit (timeout path). **None may throw, hang, NaN, double-fire
the finisher, or apply damage during invuln.** Add an adversarial probe for each guard.

## 5. Calibration to attempt (Ruffle frame-step → overwrite INFERRED seeds, mark CONFIRMED)
Crit flash magnitude/duration; Focus/Critical bar fill+drain rates; spawn-invuln blink cadence;
Smoke-Bomb puff + teleport distance/ms; kill-beat freeze frames + ramp curve/duration (§4.2 ±1f/±20ms);
the four SFX trigger frames (§4.2 ±1f). Record source + timestamp + status in `CALIBRATION.md`.

## 6. Verification protocol (the gate — same rigor as M1)
1. Paste green tsc + vitest + config-purity + build.
2. Run the build (`npm run dev`, `?scene=duel`). Perform the **§G scenario set**: 3× crit, Focus-draining
   stance swap, spawn-invuln blink, Smoke-Bomb dodge, Stab+Deflect, telegraphed AI commit, kill-beat,
   VS intro, Victory screen. Screenshot/frame-step each; for `(measure)` tells, read the deterministic
   value (timeScale, frame counts, HP deltas) — do not eyeball.
3. Tick Tells 7–16, 23\*, 25, 28 in `TELLS_CHECKLIST.md` **only with evidence**; log divergences.
4. Run M2 through the **ultracode adversarial + chaos workflow**; fix every CONFIRMED finding; re-verify.
5. Update `CALIBRATION.md`/`DIVERGENCES.md`; commit on Kheshav's go.

## 7. Approach (ultracode, milestone-gated)
Build the tightly-coupled `Sim` combat port **sequentially** (keep tsc + vitest + purity green at every
step). Fan out the ⇉ items (Critical meter, Smoke Bomb, Stab/Deflect, duel-framing screens) in parallel.
The **feel loop stays main-loop-gated**: I run the build and frame-step the kill-beat/telegraph/crit
against the reference longplays (memory `reference-sources`) before ticking any Tell. Then adversarially
+ chaos verify, fix, re-verify. Token cost is not a constraint; correctness and indistinguishability are.

## 8. Definition of NOT-done (cut lines — keep scope honest)
Out of M2 (do not start): progression/economy/level-up (M3); full measured HUD corners/minimap/colors,
title typography, music separation, campaign/haiku/NPCs (M4); War Room (M5). If a §M2 MUST can't hit its
measure, it stays ☐ and is logged — never ticked on faith.
