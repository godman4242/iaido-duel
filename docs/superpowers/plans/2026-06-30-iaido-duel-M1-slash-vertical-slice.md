# M1 — Slash Vertical Slice (kickoff blueprint)

> Authoritative spec: `~/Downloads/MASTER_PROMPT.md` §M1, §D.1, §D.2, §4.2, §F. This file bridges
> that spec to the **current repo** after M0. Read alongside `DIVERGENCES.md`, `TELLS_CHECKLIST.md`,
> `CALIBRATION.md`, and memory `build-approach-and-spec`. M1 is the make-or-break **feel** milestone.

## Definition of done (binary, measurable)
1. **Tells 1–6 and 17–20 PASS** in the running build (see `TELLS_CHECKLIST.md`), each verified by
   eye against the reference footage, not just by code.
2. `npx tsc --noEmit` exit 0 · `npx vitest run` all green · `config-purity` green.
3. **`core/anim.ts` de-grandfathered:** its motion-feel constants moved into config, then removed
   from `CORE_GRANDFATHERED` in `config-purity.test.ts` → **all of `core/` is literal-free.**
4. **Chaos tests pass** (see below) — proven, not asserted.
5. `CALIBRATION.md` rows for slash timing / blade-trail / blood updated to `CONFIRMED` wherever a
   value was actually frame-stepped (Ruffle); tells `1–6, 17–20` ticked with evidence.

## What M0 already gives you (build on it, don't re-create)
- `src/config/*` — all gameplay constants. Add M1 keys here, never as literals in core/game.
  Relevant: `combat.ts` (LAUNCH_DY, CRIT_MULT, reach via stances), `stances.ts` (reach/speed/dmg),
  `timing.ts` (FIXED_HZ, SLASH_FRAMES, MAX_FRAME_MS), `palette.ts` (blade/bladeEdge/bladeChi, blood).
- `core/Sim.ts` — fixed-60Hz deterministic tick + `OpponentController` seam. Wire M1 combat through
  it (don't grow logic only inside `game/scenes/DuelScene.ts`).
- `core/slash.ts` — `resolveSlash` (polyline∩limb capsule, reach gate, §A.1 damage). Already crit=3×.
- `core/gesture.ts` — `classifyGesture` (horizontal=slash, up=jump, up+big=launch, down=stab).

## Work items (file-level, ultracode-parallelizable where marked ⇉)
1. **`DrawnStroke`** (new `core/DrawnStroke.ts`) ⇉ — pointer path → **resampled to even spacing** →
   **smoothed** (Chaikin or Catmull-Rom). This smoothed curve IS both the blade trajectory and the
   hit polyline (spec §D.1). New config keys: resample spacing, smoothing iterations. **Parity test:**
   an equivalent mouse path and touch path produce an **identical `DrawnStroke`** (Tell parity, §3).
2. **Blade trail** (`game/vfx/BladeTrail.ts`) — **two-layer tapered ribbon**: bright white/near-white
   core (`COL.bladeEdge`) + thinner blade-colored edge (`COL.blade`), **pinched to zero width at both
   endpoints, widest mid-stroke, leading tip the blade chases.** Config keys: width, fade ms, taper.
   Do NOT render the raw jittery hand-path (reads as MS-Paint — an explicit tell). Tells 1, 2.
3. **Direction-as-verb wiring** — route `classifyGesture` results through the sim: horizontal→slash,
   up→jump (**starts at stroke start point, ends at endpoint**), down+Stab(Heavy)→stab, up+Launch→
   launch. Tells 3, 4.
4. **HP damage, multi-foe** — one stroke crossing two foes damages **both, kills neither at full HP**
   (loop foes through `resolveSlash`). Tell 5.
5. **Per-stance arc geometry** — Light = long sweeping fast arcs, Heavy = short slow heavy, Balanced
   between; drive from `STANCE_TABLE` reach/speed + `SLASH_FRAMES`. Tell 6.
6. **Directional blood** (`game/vfx/Gore.ts`) ⇉ — gout **along the cut vector**, bright saturated red
   (`COL.blood`/`bloodDark`) over the muted ground; §4.2 default particle count/spread. Move Gore's
   literals into config. Tell 19.
7. **Calibrated canvas** — letterbox to `GAME_W`/`GAME_H`; high-contrast fighters over parallax. Tell 21 seed.
8. **Secondary motion + de-grandfather `anim.ts`** ⇉ — hat bob + scarf/garment trail in idle/move;
   move `anim.ts` walk/idle offsets + easing into a new `config/anim.ts` (or `timing.ts`), then drop
   it from `CORE_GRANDFATHERED`. Tells 18, 20.

## Chaos tests (required — prove guards by planting failures)
Empty stroke `[]`; single-point `[{x,y}]`; two identical points (zero-length); NaN/Infinity/huge/
negative coords; thousands-of-point polyline; ultra-fast repeated strokes in one tick; stroke entirely
outside every foe's reach; stroke overlapping many foes at once; resample/smooth of a degenerate path.
None may throw, hang, NaN-out, or instakill.

## Calibration to attempt (Ruffle frame-step → overwrite INFERRED seeds, mark CONFIRMED)
Slash windup/active/recovery **per stance** (±1 frame; anchor Light SPEED=1.4 CONTRACT); blade-trail
width (±1px) + fade (±20ms); blood directionality/count. Record source+timestamp in `CALIBRATION.md`.

## Verification protocol (the gate)
1. tsc + vitest + config-purity green (paste output).
2. Run the build (`npm run dev` / Chrome MCP). Perform the **scenario set**: a Light slash, a Heavy
   slash, a jump, a stab, a multi-foe stroke. Screenshot/frame-step each vs the footage.
3. Tick Tells 1–6, 17–21 in `TELLS_CHECKLIST.md` only with visual evidence; log any divergence.
4. Run M1 through **ultracode adversarial + chaos verification** (as M0 did) before declaring done.

## Approach
ultracode, milestone-gated: fan out the ⇉ items (DrawnStroke math+tests, Gore, anim config, parity
tests) in parallel; keep the **blade-trail feel loop sequential + visually gated by the main agent**;
adversarially + chaos verify; the human-facing feel check is the main loop running the build.
