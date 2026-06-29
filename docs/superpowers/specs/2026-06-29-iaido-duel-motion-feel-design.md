# iaido-duel — Session 2: Motion & Feel design

**Date:** 2026-06-29
**Branch:** `feat/first-playable-duel`
**Goal:** Take the first-playable from "clearly the same game" to **indistinguishable on motion & feel**
vs the reference gameplay video, close the last visual nits, and prepare for publish (publish only on
explicit approval after Kheshav plays it).

Faithful homage from our OWN re-created assets only. We measure motion *timings* (facts) from the
reference video to drive our own implementation; we never reproduce the original's art, audio, or code.

---

## 1. Problem

The look is ~there; the **feel is not**. The fighters are static: `Fighter.setPose()` snaps to a pose and a
`delayedCall` snaps it back. `Skeleton.lerpPose` exists but `update()` never interpolates per frame. There
is no idle, no walk cycle, no slash wind-up/follow-through/recover, no hit stagger, no death fall. Slash
easing, blade-trail persistence, kill-beat timing, and AI difficulty are untuned vs the video.

## 2. Measured targets (from `reference/video/part2_open.mkv`, 60fps, frame-stepped 2026-06-29)

These are the numbers the implementation tunes against (verified again at the compare gate):

- **Single slash:** blade sweep travels its arc in ~5–7 frames (**~85–120ms**) with an ease-out; the
  crimson **cut-streak trail** is bright ~3–5 frames and **fully fades over ~200ms**.
- **Combo cadence:** consecutive hits land ~20–30 frames apart (**~350–500ms**); a red **HIT COMBO**
  counter increments 1→2→3→4+ top-right and pulses on increment.
- **Blood:** spray bursts in ~1 frame, particles fall/persist ~10–18 frames (**~200–300ms**), then settle
  as ground decals; white debris flecks fly on heavy impact.
- **Kill beat:** the killing blow cuts to a **red full-screen wash near-instantly** (~1–2 frames after the
  blow — no slow-mo on the final blow); a solid-black **silhouette (kasa + raised sword) runs/leaps L→R**
  across the red for ~0.9s; then the **"YOU WIN"** brush text appears (~at +1.0s).
- **Walk:** standard side-view walk with camera parallax; joint-level cadence not measurable at the
  available zoom — derive a believable cycle (contact→passing→contact, ~0.5–0.6s/cycle, vertical bob,
  arm counter-swing) and tune at the gate.
- **Pointer latency:** keep pointer-down → slash-start under ~50ms.

(Full measurement notes captured during investigation; numbers above are the authoritative targets.)

## 3. Architecture

### 3.1 Animation spine (the core change)

**`src/core/anim.ts` — pure, TDD'd (no Phaser).**
- Easing: `easeOutCubic`, `easeInOutSine`, `easeInQuad` (bounded [0,1], monotonic).
- Phase clock: given a list of named segments with durations and an elapsed time, return
  `{ segment, t }` where `t` is the eased progress within the current segment (e.g. slash =
  windup → strike → recover). Returns a terminal marker when elapsed exceeds total.
- Procedural locomotion offsets: `walkOffsets(phase, amp)` and `idleOffsets(phase, amp)` return small
  per-joint position deltas (numbers) for the legs/pelvis/arms/chest — periodic, with the two legs in
  antiphase and a vertical bob at 2× leg frequency. Pure math → unit-testable.

**`src/game/fighter/FighterAnimator.ts` — thin orchestrator (Phaser-free logic).**
- State: `'idle' | 'walk' | 'slash' | 'hit' | 'dead'`, plus elapsed timers.
- `update(dtMs, ctx)`: compute the **base layer** (idle breathing or walk cycle, from `anim.ts` offsets
  applied to `IDLE_POSE`) then blend an **action overlay** (slash/hit/death via `lerpPose` between
  keyframes with eased `t`). Returns the composed `Pose`.
- Triggers: `setMoving(boolean)`, `startSlash()`, `startHit(dir: 1|-1)`, `startDeath()`. Death is terminal
  (stays in the collapsed pose). Hit auto-returns to locomotion when its timer ends.

**`src/game/fighter/Skeleton.ts` — new keyframe poses.**
- `WALK_CONTACT`, `WALK_PASS` (the two extremes the walk cycle blends/derives from), `SLASH_WINDUP`,
  `SLASH_FOLLOW`, `SLASH_RECOVER`, `HIT_RECOIL`, `DEAD` (collapsed: pelvis dropped, torso rotated down,
  hat displaced).

**`src/game/fighter/Fighter.ts`** — owns a `FighterAnimator`; gains `update(dtMs, {moving})` that pulls the
composed pose and calls `setPose`; exposes the trigger methods (delegating to the animator). Existing
slice/sever/`worldLimbs`/`applyHit` behaviour is unchanged.

**`src/game/scenes/DuelScene.ts`** — `update()` calls `player.update`/`enemy.update` each frame with their
moving state, and fires `startSlash`/`startHit`/`startDeath` at the existing combat moments. The old
`setPose(SLASH_POSE)` + `delayedCall(IDLE_POSE)` snapping is removed.

### 3.2 Feel tuning
- Slash overlay timed to the measured arc (strike ~100ms ease-out, recover ~150ms).
- **`src/game/vfx/BladeTrail.ts`**: trail segments persist and fade over ~200ms (crimson cut-streak look).
- **Kill beat** extracted to a small module **`src/game/scenes/KillBeat.ts`** (keeps `DuelScene` focused):
  fast red wash on the killing blow + a running black silhouette (reuse `drawSkeleton(..., {silhouette})`
  translating L→R) into the "YOU WIN"/"YOU LOSE" screen, per the measured timing.

### 3.3 Combo counter
- **`src/core/combo.ts` — pure, TDD'd.** `Combo` tracks count + last-hit time; `hit(now)` increments if
  within the window (~1200ms) else resets to 1; `value(now)` returns 0 once the window lapses; `reset()`
  on a missed slash. The HUD reads it.
- **`src/game/ui/Hud.ts`**: render the red **HIT COMBO** number top-right, pulsing on increment.

### 3.4 Fidelity nits
- **Enemy tint:** `Fighter` takes an optional palette variant; enemy uses an oxblood/crimson haori
  (`haori`/`haoriShade`/`haoriTrim` overrides) vs the player's navy, so "you" vs "RONIN" read apart.
  `drawFighter.ts` reads colours from the passed variant instead of hard-coded `COL`.
- **Flying severed limbs:** on a sever, spawn a short-lived piece drawn from the limb's capsule that arcs
  under gravity with spin, then fades (extends `Gore` or a small new VFX).
- **Forest:** bigger foreground trees + a sky peek in `Forest.ts` for a more naturalistic read.

### 3.5 AI balance
- Tune `AIParams` (ranges, react chances), the state durations in `ai.ts`, and damage/health so a duel
  resolves in **20–60s**, genuinely winnable **and** losable by an active player; readable telegraphs; not
  brutal. **Single Normal level (no toggle).** The pure `nextAIState` stays TDD'd; tuned constants are
  verified at the compare gate.

## 4. Component boundaries (what depends on what)

```
core/anim.ts        (pure: easing, phase clock, locomotion offsets)   ← unit tests
core/combo.ts       (pure: combo counter)                             ← unit tests
core/ai.ts          (pure: state machine, existing + tuned)           ← unit tests
   ↑
fighter/Skeleton.ts (Pose type, keyframes, lerpPose, worldLimbs)
fighter/FighterAnimator.ts (composes base+overlay → Pose)
fighter/Fighter.ts  (renderer/container; owns animator; update + triggers)
fighter/drawFighter.ts (reads a palette variant)
   ↑
scenes/DuelScene.ts (drives update/triggers; combat resolution)
scenes/KillBeat.ts  (red wash + silhouette run → win/lose screen)
ui/Hud.ts           (combo counter); vfx/BladeTrail.ts; vfx/Gore.ts (limb-fly); background/Forest.ts
```

## 5. Testing

- **New unit tests:** `anim.test.ts` (easing bounds/monotonicity; phase segmentation incl. terminal;
  walk-cycle periodicity + leg antiphase + bob frequency), `combo.test.ts` (increment within window,
  timeout → 0, miss → reset).
- **Existing suites stay green:** slash geometry, stance, focus, gesture, ai, skeleton, smoke, vec (22+).
- `npm run build` clean (tsc + vite).

## 6. Proof (Definition of Done for the session)

1. `npm test` — all green (new + existing); paste output.
2. `npm run build` — clean; paste output.
3. Before/after **compare-view** screenshot (`?compare=forest_fight.png`).
4. A short **duel clip** showing the new walk, slash, and death (recorded by driving the live build in
   Chrome).
5. Name the single biggest remaining gap; fix or flag it.

Publish (push to a new GitHub repo, public/private to be chosen) happens ONLY after Kheshav plays the
build and says go.

## 7. Out of scope

MMO / PvP / clans / world map; multiple opponents / levels / skill tree; menu metagame. One polished,
indistinguishable duel.
