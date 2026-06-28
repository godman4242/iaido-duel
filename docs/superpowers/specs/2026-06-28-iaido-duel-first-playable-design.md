# iaido-duel — First-Playable Design Spec

**Date:** 2026-06-28
**Status:** Approved (design) — pending written-spec review → implementation plan
**Scope:** A measurable FIRST-PLAYABLE single-player draw-to-slash duel. NOT the MMO.

> Faithful, original-asset homage of the **combat core** of *Straw Hat Samurai: Duels* (Explosive
> Barrel; died with Flash, Jan 2021). We re-create all art/audio in the original's style; we do not
> decompile, extract, or ship its assets, logo, or trademarked name. Small credit in About + README:
> "Faithful fan homage of Straw Hat Samurai: Duels by Explosive Barrel — unaffiliated, non-commercial."

---

## 1. Goal & fidelity bar

A single-player duel — you vs. **one** AI samurai — that is **indistinguishable from the gameplay
videos**: same art style, motion, and feel. Won/lost by landing slashes.

**Measurable DONE (first-playable):**
- `npm run dev` runs in the browser and holds **60fps**.
- Draw a line → the blade sweeps **along that exact path**; **all 4** directional gestures work;
  pointer-down → slash-start **< 50ms** (feels instant).
- One AI opponent that **telegraphs, attacks, and can be defeated AND can defeat you**
  (health + win/lose + restart); a full duel resolves in **~20–60s**.
- **3 stances** (Light/Balanced/Heavy) + a **Focus** bar that drains on stance-switch/skill.
- Cut feedback (**dismemberment + blood**) + at least slash/impact **SFX**, re-created to match feel.
- **Fidelity gate:** in the dev side-by-side compare view, palette / proportions / UI / slash motion
  match the reference stills. Iterate until a viewer can't tell them apart.
- **Unit tests pass** for the slash-intersection geometry.

---

## 2. Locked decisions (with veto notes)

| # | Decision | Why | Veto → |
|---|---|---|---|
| D1 | **Phaser 3 + TypeScript + Vite**, **Vitest** for unit tests | Confirmed in kickoff; Phaser handles loop/input/audio/scenes; Vitest is the standard Vite test runner | PixiJS / raw Canvas |
| D2 | **Procedural vector skeleton** fighters (code-drawn shapes on a bone rig) | Limbs are REAL segments → faithful dismemberment + clean, unit-testable slice geometry; exact palette match; tiny repo | Authored sprite sheets (loses arbitrary-path slicing) |
| D3 | **Layered parallax forest background, code-drawn first**, with a `BackgroundLayer` seam to swap in painted PNGs later | Hybrid backdrop quality with zero asset-pipeline risk; sacrifices no mechanics; upgrade only if the fidelity gate demands it | Painted PNG backdrop now |
| D4 | **All 3 stances** + counter triangle (Light▸Heavy▸Balanced▸Light) | Faithful to original; gives AI a stance-matchup layer; Kheshav's call | 2 stances (Light/Heavy) |
| D5 | **All 4 gestures functional in v1** (horizontal slash, up jump, up-flick launch, down stab) | Measurable-DONE requires all 4; gating adds menu/skill scope we don't have yet | Gate launch/stab behind a skill unlock |
| D6 | **Build the dev compare-view this session** | It's the tool that makes "indistinguishable" provable, not vibes | Defer; eyeball against stills |
| D7 | **Full faithful gore + a reduce-blood toggle** | Series signature; toggle is good UX/accessibility | Blood-only / stylized |

---

## 3. Tech & architecture

Custom layer on top of Phaser: **gesture capture → blade-sweep → slice-detection**. Each module has
one job, a defined interface, and is understandable/testable on its own.

| Module | Responsibility | Depends on | Tested by |
|---|---|---|---|
| **InputGesture** | Capture pointer polyline (down→move→up); classify direction; emit `{path:Point[], dir, duration}`. Pointer-down→start <50ms. | Phaser input | unit (classification) + manual latency |
| **SlashGeometry** ⭐ | PURE, no Phaser. Drawn polyline ∩ fighter limb-capsules → `{limbId, hit, cutPoint, severed}[]`, reach-gated by stance. | none | **unit (the core)** |
| **Fighter** | Vector skeleton (hat·head·neck·torso·upperArm·foreArm·hand·sword·thigh·shin·foot); each bone a segment+radius+vector fill. Exposes `limbSegments()`; applies wounds/sever/blood/health; pose & animation. | SlashGeometry, Gore | unit (limb exposure, health) |
| **Stance** | 3 stances → `{reach, speed, dmgMult, defMult}`; counter triangle; switch cost. | Focus | unit (triangle, mults) |
| **Focus** | Meter: fills in combat, drained by switch/skill, sets crit (×1.3) when high. | — | unit (fill/drain/crit) |
| **AI** | State machine: idle→approach→telegraph→attack→recover + block/dodge/counter; reads player distance & stance. | Fighter, Stance | unit (transitions) + manual feel |
| **BladeVFX** | Red slash trail along the exact drawn path; impact flash; killing-blow slow-mo. | Phaser graphics | manual |
| **Gore** | Crimson blood spray (`#a50103`), dismemberment render, cut decals; reduce-blood toggle. | Phaser particles | manual |
| **HUD** | Bottom-left stance portrait + green health + blue Focus + stance name; floating name/health over each fighter. | Fighter, Stance, Focus | manual vs. stills |
| **DuelScene** | Orchestrates arena/background, two fighters, HUD, win/lose/restart, pacing. | all | manual |
| **CompareView** (dev-only, flag/route) | Canvas beside a gitignored reference still. | DuelScene | the fidelity gate |

---

## 4. The mechanic (match the videos)

- **Draw-to-slash:** the blade visibly sweeps **along the exact path drawn**. Slash line length scales
  with the Speed stat.
- **Gestures:** Horizontal → **slash across** · Up → **jump** · Up-flick → **launch enemy** ·
  Down → **ground stab**.
- **Stances:** switch via **spacebar / portrait** at the cost of **Focus**; each changes
  reach/speed/damage.
- **Cuts:** visible damage / **dismemberment** + **blood** in the original's style; **killing cut**
  gets a brief **slow-mo** impact beat.
- **AI:** telegraphs attacks and **reacts** (block/dodge/counter); not a passive dummy.

---

## 5. Slash geometry — the TDD core (most detail; it's the testable heart)

**Model.** A fighter's body is a set of **capsules**: each limb bone is a segment `(a, b)` with a
radius `r`. A drawn slash is a **polyline** `P = [p0..pn]` in world space.

**Cut test (per limb).** A limb is **hit** when the slash polyline intersects the limb capsule AND the
intersection lies within the current stance's **reach** of the attacker's hand origin. The cut's
"strength" = the length of the slash segment that passes through the capsule (longer, faster strokes
cut deeper). A limb is **severed** when cut-strength ≥ `severThreshold(limb)`; otherwise **wounded**.

**Outputs.** `resolveSlash(path, fighter, stance) → { hits: {limbId, cutPoint, severed}[], totalDamage }`
where `damage = (ATK + weaponDmg) × stance.dmgMult`, multiplied by **1.3** when Focus is high (crit),
reduced by target `defMult`.

**Unit tests (Vitest, pure — write FIRST, TDD):**
1. polyline × segment intersection: crossing / not-crossing / tangent / shared-endpoint / zero-length.
2. capsule radius respected (near-miss within `r` = hit; outside = miss).
3. reach gating: in-reach hits; out-of-reach (esp. Heavy short reach) misses.
4. sever threshold: short nick = wound; long fast stroke = sever.
5. multi-limb single stroke (one drag crosses arm + torso) → multiple hits, ordered along the path.
6. damage math: stance mults (0.9/1.2/1.4), the ×1.3 crit, def reduction, crit gating by Focus.

---

## 6. Stances & Focus economy

| Stance | Reach | Speed | Dmg × | Def × | Notes |
|---|---|---|---|---|---|
| Light | long | fast | 0.9 | 1.0 | beats Heavy |
| Balanced | medium | medium | 1.2 | 1.0 | beats Light |
| Heavy | short | slow | 1.4 | 0.8 | beats Balanced; −20% def |

- **Counter triangle:** Light▸Heavy▸Balanced▸Light (attacker in the winning stance gets a bonus /
  reduced incoming). Exact bonus value is a tuning constant.
- **Focus bar:** rises as you land/trade hits; **stance-switch and skills deduct** from it; high Focus
  grants the **×1.3 crit**. Exact fill rate & per-switch cost are tuning constants (flagged §10).

---

## 7. AI opponent

State machine: `IDLE → APPROACH → TELEGRAPH → ATTACK → RECOVER`, with reactive branches
`BLOCK / DODGE / COUNTER`. The AI:
- closes distance, then **telegraphs** (wind-up pose + brief tell) before an attack — readable like the
  video, so the player can react;
- can **block/dodge** an incoming slash and **counter** during the player's recovery;
- is **stance-aware** (may switch to gain the triangle advantage);
- has tunable reaction time so it can both **lose to** and **beat** a competent player within ~20–60s.

Spawn grace: brief invulnerability at duel start (echoes the original's spawn protection).

---

## 8. Art, VFX & audio (original, re-created)

- **Palette (eyedropped from authentic source art — these are OUR targets):**
  - Forest: `#49a431` bright · `#2e922e`/`#31a030` mid · `#1d7330`/`#173012` deep shadow ·
    `#62905e`/`#78a760` sage.
  - Kimono: `#e8f3ef`/`#e9eddb` off-white · `#dadfc3` shadow.
  - Hat/wood/sandals: `#794702`. Outlines: `#040304`. Sky/highlight: `#d8dbf1`/`#eceffe`.
  - Blood/red: `#a50103`/`#950202`. Parchment/UI cream: `#efedc2`. Gold accents: `~#e8a83a`.
  - HUD bars: health green `~#5bbf2e`, Focus blue `~#3a7fd5`.
- **Proportions:** slim, grounded samurai ~**7–7.5 heads** tall; conical **straw hat** pulled low
  (the iconic read) + obscured face; hooded haori, white hakama, tan waraji; katana at hip / ready.
  Clean **vector cel-shaded** look (flat fills + soft shading + smooth black outline).
- **Background:** layered parallax forest — gradient sky → tree-silhouette layers → ground; bokeh +
  drifting leaves; built code-first, swap seam for painted art.
- **BladeVFX:** crimson slash trail tracing the **exact drawn path**, fading; white-hot impact flash;
  killing-blow slow-mo (~0.2–0.4s, tune vs. video).
- **Gore:** crimson spray particles, severed-limb sprites (detached skeleton parts), lingering cut
  decals; **reduce-blood** toggle in options.
- **Audio (synthesized / re-recorded, never ripped):** slash whoosh, blade/flesh impact, stance-switch
  chime, hit grunt.

---

## 9. HUD / scene / flow

- **HUD (bottom-anchored):** bottom-left circular **stance portrait** (click to switch) + stacked
  **green health** over **blue Focus** + **stance name**; floating **name + small health bar** over
  each fighter; reduce-blood toggle + restart in a minimal options affordance.
- **DuelScene:** fixed-arena side view (no world map). Start → spawn grace → fight → first to 0 health
  loses → **win/lose banner + Restart**. Pacing target ~20–60s.

---

## 10. Out of scope (v1) & open items

**Out of scope:** MMO / PvP / clans / world map / minimap, inventory / loot / gear rarity, multiple
opponents, menu & juice polish, account/online.

**Open items to verify against a combat-dense clip during the fidelity gate (tuning, not blockers):**
- exact **slash arc easing + duration** (frame-count a swing);
- **killing-blow slow-mo** presence/length;
- **blood spray shape** + dismemberment trigger;
- Focus **fill rate / per-switch cost**.

---

## 11. Testing strategy

- **Unit (Vitest):** SlashGeometry (the core, §5), Stance triangle/mults, Focus fill/drain/crit, AI
  transitions. Written **test-first** for the geometry.
- **Manual fidelity gate:** the dev CompareView — palette/proportions/UI/slash-motion vs. stills.
- **Build proof:** `npm run build` + test output pasted; a short duel clip showing win + lose + restart.
