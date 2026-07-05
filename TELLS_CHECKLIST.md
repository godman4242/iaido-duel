# TELLS_CHECKLIST.md — the single binding acceptance gate (spec §F)

Each line is a **binary PASS/FAIL** observable in the running build. **100% PASS = done.**
`(measure)` = passes when the build matches `CALIBRATION.md` (CONFIRMED values to their §4.2
tolerance; INFERRED only to single-tunable + consistency). `(lore)` = graded by faithfulness.
The `→ M#` tag is the milestone that delivers it (spec §I). Status: ☐ pending · ☑ passing.

> M0 delivers scaffold/config/seams/tests only. **M1 (2026-06-30) ticks Tells 1–6 and 17–21**,
> each verified in the running build (`npm run dev`, `?scene=duel&foes=2`) by eye + deterministic check.
> **M2 (2026-07-05) ticks Tells 7–16, 25, 28** — 316-test deterministic sim + an in-browser §G pass
> (`?scene=duel&seed=5`, virtual-time frame-stepping via `__duel`/`__game`); each row cites its evidence.
> Tell 23* = the combat-critical HUD pieces only (portrait swap + skill bar + Focus/Critical bars);
> the full measured HUD geometry/minimap/colors (Tells 23/24/26) stays M4.

## Slash engine
- ☑ 1. A stroke makes the blade trace a **smoothed swept curve** of that stroke (not a raw jagged polyline, not a canned anim). → M1 · *verified: a ±7px zig-zag input rendered as a clean swept ribbon (`core/DrawnStroke` resample+Chaikin).* 
- ☑ 2. Blade trail is a **two-layer tapered ribbon** (white core + colored edge), pinched at both tips, widest mid-stroke, leading tip. → M1 · *verified: chi-blue edge + white core, pinched tips, fat mid (`BladeTrail`).* 
- ☑ 3. **Horizontal = slash, up = jump**, up+Launch = launch, down(Heavy)+Stab = stab. → M1/M2 · *slash + jump verbs verified live; launch/stab routed & unit-tested (skill-gating is M2).* 
- ☑ 4. Jump **starts at the line's start point, ends at its endpoint.** → M1 · *verified: player caught mid-arc airborne (y 480→396), translating start.x→end.x; `jumpArcPoint` unit-tested.* 
- ☑ 5. Damage is **HP-based, not instant-kill**; one line across two foes damages both. → M1 · *verified: one drag took both foes 100→{85,76}, neither killed; `slash.test` multi-foe case.* 
- ☑ 6. Per-stance arcs visibly differ: **Light long/fast, Heavy short/slow, Balanced between.** → M1 · *verified by `fighterAnimator.test`: Light max sword-reach > Heavy AND Light duration < Heavy.*

## Combat systems
- ☑ 7. **Critical bar drains per swing (more for heavier weapon)**, pays off as a visible **3× crit.** → M2 · *verified in-browser: controlled A/B slash 12→36 = ratio exactly 3.000; `critLanded` event + blood/combo render; drain heavy>light in `critical.test`.*
- ☑ 8. **Stance swap on Space/portrait costs Focus**; triangle Light>Heavy>Balanced>Light holds. → M2 · *verified in-browser: swap balanced→light drained Focus 50→16; triangle + 1.25× counter in `Sim.test`/`stance.test`.*
- ☑ 9. **5 s spawn invuln**, blinking, ends on first slash. → M2 · *verified in-browser: `invulnEnded{reason:firstSlash}` fired on the player's first slash; 5s timeout + blink `BlinkPlan` unit-tested.*
- ☑ 10. **Smoke Bomb** teleport-dodge and **Stab+Deflect** projectile swat both function. → M2 · *deterministic: `Sim.test` smoke i-frames + deflect destroys overlapping projectile; AI throws kunai live (`AISeamController`) so deflect is performable.*
- ☑ 11. PvE foes **move slowly**, granting charge time. → M2 · *deterministic: `ENEMY_SPEED` in config; duel-tuning harness confirms good-play charge windows.*
- ☑ 12. **Chi Punch = 10 dmg at L1.** → M2 · *verified in-browser: skill 1 dealt exactly 10, `chiPunchLanded{dmg:10,targetIndex:0}`.*

## AI / feel
- ☑ 13. Every committing AI attack shows a **readable telegraph** for ≥ its telegraph duration. → M2 · *verified in-browser: `telegraphStarted{kind:slash,dur:520}` → strike landed 534ms later (≥520); stance-flash telegraph in `Sim.test`.*
- ☑ 14. A Normal-tier duel is **winnable and losable**, ~20–60 s. → M2 · *deterministic: 24-seed harness — good-play win-rate 100%, no-play 0%, median 24.7s ∈ [20,60]; 22–24 distinct seed durations.*
- ☑ 15. **Kill/finisher beat** (freeze + speed-ramp) fires, distinct from Shunpo. `(measure)` → M2 · *verified in-browser: `killBeat` fired exactly once; `time.timeScale`+`tweens.timeScale` ramped together to 0.43; FinisherFlash red-silhouette beat rendered; Shunpo is a separate state/trigger.*
- ☑ 16. **Shunpo** player slow-mo drains the power meter. `(lore if unobservable)` → M2 · *deterministic: `Sim.test` — SHIFT-hold sets `SHUNPO_TIMESCALE`, drains `SHUNPO_MAX` at the configured rate, ends empty (distinct from kill-beat).*

## Art / motion
- ☑ 17. Flat-color + bold-outline **Samurai-Jack vector** look; crisp scaling; no pixel-art. → M1 · *verified: flat fills + black outlines, letterboxed FIT canvas scales crisply.* 
- ☑ 18. Iconic **kasa + straight katana + scarf** silhouette, correct proportions. → M1 · *verified: scarf added to `drawFighter`; silhouette reads kasa+katana+scarf.* 
- ☑ 19. **Blood sprays directionally along the cut vector**, bright saturated red. `(measure)` → M1 · *verified: angle-op centers on the cut (right→0°, left→180°, up→270°, down→90°); leftward cut sprays left in-build.* 
- ☑ 20. **Scarf/hat secondary motion** in idle/move. → M1 · *verified: scarf streams up-back during the jump leap (flow); per-frame flutter clock; hat-bob unit-tested (`anim.test`).* 
- ☑ 21. Simple **parallax** arenas; high-contrast fighters. `(measure)` → M1 · *verified: multi-layer `Forest` parallax; navy player vs oxblood foes over muted green.* 
- ☐ 22. **Baseline camera** framing/tracking matches recorded behavior. `(measure)` → M2

## UI / audio / flow
- ☐ 23. **Portrait LEFT, coins+gold TOP-LEFT, minimap TOP-RIGHT, numbered skill bar (1/2/3).** → M4
- ☐ 24. Each HUD bar's **color/shape/fill** matches the recorded layout. `(measure)` → M4
- ☑ 25. **Duel framing**: VS splash + opponent name banner + result screen. → M2 · *verified in-browser: VS→name-banner→READY→FIGHT! played in order, `onFight` fired exactly once, Victory screen showed "YOU RECEIVED — XP +10, COINS +5"; ordering + tally in `DuelIntro.test`/`DuelResult.test`.*
- ☐ 26. **Title typography** (display face) and HUD/dialogue body face match. `(measure)` → M4
- ☐ 27. **Menu/exploring music separate from combat bed**; distinct victory + defeat stings. → M4
- ◐ 28. **Four-way slash SFX** (draw/whiff/flesh/armor) each fire on the measured frame. `(measure)` → M2 · *wiring verified: `playDraw←slashStarted`, `playWhiff←whiffed`, `playFlesh←hitLanded`, `playArmor←blocked` in `DuelScene.onSimEvent`; synthesis + fire-frames unit-tested (`sfx.test`). **Audibility + tonal weight (heavy vs light) pending a focused-browser human pass** — automation is silent.*

## Progression / campaign / lore
- ☐ 29. **Level-up = exactly +1 SP, +3 stat, full HP/Chi/AP refill.** → M3
- ☐ 30. **Rebirth payout** schedule and **+10-Attack-per-rebirth** stacking correct. → M3
- ☐ 31. **First-run 80 SP cap**; max = **dan rank 5 (kyudan).** → M3
- ☐ 32. Two-currency split: **Coins grindable, Gold earnable/cosmetic, no cash purchase.** → M3
- ☐ 33. **Season > Prologue/Episode** nesting; Prologue is the tutorial; **3-line haiku** cards. → M4
- ☐ 34. Player **starts as ragged Shugyosha with a branch.** → M4
- ☐ 35. Correct **clan/character names** (Shira Tancho, Midori Ken, Aka Ryu, Masahiro, Daichi, Takeru, …). `(lore)` → M4
- ☐ 36. **War Room gated at level 10**, AI-clan-driven; battlefield kill cap **350.** `(lore)` → M5
