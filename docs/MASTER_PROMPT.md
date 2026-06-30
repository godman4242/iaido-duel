# MASTER PROMPT — Single-Player Web Clone of "Straw Hat Samurai: Duels"

> Hand this entire document to a coding agent or developer. It is self-contained. It is buildable from turn one: every gameplay constant has a concrete default in §A (the Default Constants Table), so **you never block on missing data and you never invent a number silently.** Calibration against reference footage is a *parallel refinement pass that overwrites defaults*, never a prerequisite for writing code.

---

## 0. What you are building, and the bar

You are building a **single-player, web (HTML5) clone** of the 2015 Flash game *Straw Hat Samurai: Duels* (LutGames / Explosive Barrel / Luther Chan), a prequel side-scrolling samurai action-RPG whose signature is **draw-a-line-and-the-blade-traces-it** combat.

**The bar (read literally):** the goal is **perceptual indistinguishability of the *experience*** — a person who played the original in 2015, shown two side-by-side builds, **cannot reliably tell which is the clone** across the scenario set in §G. "Indistinguishable" means matching the *perceived* pixels, palette, motion timing/easing, slash feel, audio-cue timing, UI layout, and screen flow — **judged by eye and ear, not by comparing files.**

> **This is NOT byte-level asset reproduction.** Byte-for-byte copying of the original's files is explicitly **forbidden** (see §1). Equivalence is judged perceptually. Wherever this document says "match," it means *match what a player perceives*, achieved with **your own recreated assets** calibrated to the original's measured dimensions, palette, and timing.

**The single binding acceptance gate is the Tells Checklist (§F).** It is a list of binary, observable PASS/FAIL checks. Everything else in §G (side-by-side frame-stepping, the optional human "feel" panel) is *evidence that supports* the checklist, not a competing authority. If two acceptance mechanisms ever disagree, **§F wins.** The "returning player can't tell" sentence is the **north-star intent**; the operational, build-loop definition of done is "100% of §F passes."

---

## 1. Legal / asset constraint (obey strictly)

**Allowed (do these):** study reference footage and the original running under Ruffle/Flash emulation; **measure** timing by frame-stepping; **sample** palette with an eyedropper; **trace** silhouettes/proportions to recreate matching vector art; reproduce **mechanics, numbers, layout, and the names of mechanics/characters/clans/skills** (these are factual references); compose **your own** music and SFX that hit the same cue timing and tonal role; write **your own** dialogue/haiku prose in the same register.

**Forbidden (never do these):** ripping, extracting, or decompiling the original SWF to **redistribute** its assets; shipping the original's art, audio, font, or story-text **files** (verbatim or with trivial edits); pasting the original's prose/dialogue/haiku text verbatim.

**Rule of thumb:** *Measurement is fine. Redistribution of copied bytes is not. When in doubt, recreate — don't copy.*

---

## 2. Scope — SINGLE-PLAYER ONLY (this is a constraint, not a content cut)

"Single-player only" means **no networked or real-money systems** — no online multiplayer, no accounts, no live chat, no real-money store. It does **NOT** mean a smaller content surface: the online systems are **reframed as full single-player AI features**, and you must budget for them as real features.

| Original online system | Single-player replacement |
|---|---|
| PvP duels & tournaments | **AI duel opponents** via the `OpponentController` seam (§3), with difficulty tiers (§A) |
| **War Room** clan/sector conquest | Optional **rival-AI-clan** strategy meta-layer: a Risk-style sector map on an accelerated local clock; battles drop into the wave-survival arena. Gated at player **level 10** (preserve the landmark), AI vs player. |
| Premium **Gold** currency + real-money custom armor | Keep **Gold** as an *earnable/cosmetic* currency; **remove cash purchase entirely.** |
| Live chat | Drop. |

**Multiplayer-ready architecture is mandatory:** isolate input, simulation, and rendering; make the duel simulation deterministic and fed by an abstract `OpponentController` (today: AI; tomorrow: network). **The combat core must never know whether its opponent is local AI or remote** (§3, §C).

---

## 3. Tech stack, platform, and the central-config rule

- **Web, HTML5, TypeScript.** Rendering: **Phaser 3** (the existing build already uses Phaser 3 with a hand-rolled `core/` simulation + `game/` presentation split — **continue with Phaser 3**; do not re-platform to PixiJS or raw Canvas). Art is **runtime-drawn vector shapes / self-authored SVG** that scale crisply — **no pixel-art look.** WebGL renderer with Canvas2D fallback.
- **60 fps fixed-timestep simulation.** Decouple sim tick from render (accumulator). All gameplay timing expressed in **seconds or frames**, sourced from config — **never** as literals in logic.
- **Mouse + touch parity** via pointer events. *Acceptance criterion for parity (not a vibe):* an equivalent input path produces an **identical `DrawnStroke`** (same resampled polyline, same classified verb) on both mouse and touch.

**The central-config rule (and how it is enforced — the previous build violated this, so enforcement is mandatory):**
- All tunable gameplay numbers, hex colors, timings, and layout constants live under **`src/config/`** split into: `combat.ts`, `stances.ts`, `economy.ts`, `palette.ts`, `timing.ts`, `layout.ts`, `ai.ts`, `audio.ts`. The §A table maps every constant to its file.
- **Nothing gameplay-affecting may be a numeric literal outside `src/config/`.** Enforce this with a **test in CI** (`config-purity.test.ts`) that scans `src/core/**` and `src/game/**` for disallowed numeric literals (allow-list: `0`, `1`, `-1`, `2`, array indices, and anything imported from `src/config/`) and **fails the build** on violation. Ship this test as part of M0.
- Each constant in config is tagged in a comment as `// CONTRACT` (frozen — see §A/§E) or `// INFERRED` (tunable by calibration).

---

## 4. Reference & calibration — a PARALLEL refinement pass, NOT a gate

> **The previous build skipped calibration because the prompt made it a hard gate on footage a sandboxed agent cannot obtain. That failure is fixed here.** You **start coding immediately** against the §A defaults. Calibration runs alongside and **overwrites** `INFERRED` config values as evidence arrives. **No milestone is blocked waiting for footage.**

**Reference-unobtainable fallback (mandatory branch):** If a system cannot be observed in any footage or runnable build — **this is expected for the online War Room and PvP, whose servers are dead and whose logic was server-side** — reclassify it from **CALIBRATE** to **DESIGN-FROM-LORE**: build it from the documented numbers + §A defaults, record it as design-from-lore in `DIVERGENCES.md`, and **exempt it from frame-exact / side-by-side acceptance** (it is graded only by the lore-faithfulness tells in §F, not by footage comparison).

### 4.1 Sources to study (when reachable)
- Longplays/gameplay videos of *Duels* and predecessors *Straw Hat Samurai* (2008) and *Straw Hat Samurai 2* (for inherited Shunpo slow-mo, air-launch, projectile-deflect feel).
- The original under **Ruffle** for frame-stepping and eyedropper sampling.
- Wikis (`strawhatsamuraiduels.fandom.com`, archived `strawhatsamuraiduels.com`) for numbers/names/story/patch-notes.
- Portal pages (Kongregate, Armor Games, ModDB) and the OST upload (note the explicit "Main Menu / Exploring" theme label).

### 4.2 Calibration tasks (each has a concrete target tolerance)
For every task: replace the `INFERRED` default in config with the measured value, record **source + footage timestamp + CONFIRMED/INFERRED** status in `CALIBRATION.md`.

- **Stage size & aspect** — measure native Flash stage; set canvas to letterbox to it. *Target: exact px W×H and ratio.* (Default: 1024×576, 16:9 — the original was likely nearer 4:3/~640–800w; confirm and correct.)
- **Palette (eyedropper)** — produce a **named swatch table** (see §B for the required keys) with **single locked hex** per entry (not a range). Count distinct **background bands**; note any **per-region / time-of-day** palette shift. *Target: exact hex per swatch; ±0 tolerance once locked.*
- **Slash timing (frame-step), per stance** — windup → active → recovery **frame counts** + easing. *Target: ±1 frame vs CONFIRMED footage.* Anchor: Light slash **SPEED = 1.4** (the only published constant; see §A for its defined units).
- **Blade-trail render** — stroke width, two-layer core/edge colors, opacity, taper, fade duration of (a) the in-progress line and (b) the afterimage arc. *Target: width ±1px, fade ±20ms.*
- **Camera** — baseline framing + impact modifiers (zoom-in, shake, slow-mo). *Target: magnitudes ±10%, durations ±20ms.*
- **Kill/finisher beat** — freeze-frame + speed-ramp on a fatal/duel-ending blow (distinct from Shunpo); trigger condition. *Target: freeze ±1 frame, ramp curve + duration ±20ms.*
- **Shunpo** — slow-mo factor + power-drain rate; **verify presence in *Duels* specifically** (confirmed in SHS2). If unobservable → DESIGN-FROM-LORE.
- **Blood FX** — directionality (gout **along the cut vector** vs omnidirectional), particle count/spread/droplet size, whether droplets become **persistent ground/background decals for the fight**, settle/fade time, whether the body shows a blood/damage state.
- **Parallax** — count layers + relative scroll ratios.
- **Audio-cue timing** — the animation frame on which draw/slash/impact SFX fire; menu-vs-combat music separation. *Target: ±1 frame.*
- **HUD layout & appearance** — confirm corners (portrait LEFT, coins/gold TOP-LEFT, minimap TOP-RIGHT, numbered skill bar); measure each bar's **order, color, shape (rect vs segmented pips vs radial-around-portrait), fill direction, size**, portrait-frame art, and **enemy-HP presentation** (top bar vs floating). *Target: positions ±4px at native resolution; colors exact hex.*
- **Typography** — identify the **display** face (brushy/blocky: title/haiku/banners) and **body** face (clean: HUD numbers/dialogue); haiku card text orientation; meter number font. Recreate (do not ship) a matching face.
- **Locomotion & secondary motion** — idle-breath cadence, walk/run cadence, **straw-hat bob + scarf/garment trailing**, how a heavy weapon slows cadence.
- **Jump** — arc shape (parabolic), gravity, apex height vs character, air-control, landing dust/squash, camera-follow-during-jump.

### 4.3 Phase-0 deliverables (produced in M0, refined continuously)
1. `CALIBRATION.md` — every measured value + footage timestamp + CONFIRMED/INFERRED.
2. Populated `src/config/` (seeded from §A defaults, then overwritten by measurements).
3. `TELLS_CHECKLIST.md` — §F rendered as a live binary checklist; **the acceptance spec.**
4. `DIVERGENCES.md` — every CONTRACT value you cannot honor, every open question you resolved, every DESIGN-FROM-LORE system, with rationale.

---

## A. DEFAULT CONSTANTS TABLE — build against these on turn one

> **Provenance tags:** **`CONTRACT`** = documented in research; **frozen**; a unit test asserts it; calibration may **NOT** change it (if footage contradicts it, log in `DIVERGENCES.md`, keep the contract, surface it). **`INFERRED`** = a starting default (several already chosen by the existing build); calibration **may** overwrite it; **no test asserts a specific value**, only internal consistency. **No `INFERRED` hex/number printed anywhere in this prompt is canonical** — it is a seed.

### A.1 Combat core
| Constant | Default | Tag | Notes |
|---|---|---|---|
| **`SPEED` units** | animation-playback multiplier on the windup→active→recovery sequence; **1.0 = baseline Balanced cadence** | CONTRACT (definition) | Resolves the "1.4 has no units" ambiguity. All stance speeds are relative to this. |
| Light slash SPEED | **1.4** (fixed, mastery-independent) | CONTRACT | The only published timing constant; reference unit. |
| Balanced / Heavy SPEED | 1.0 / 0.7 | INFERRED | Scale with mastery (Balanced→1.2 at lvl9). |
| Critical multiplier | **3×** | CONTRACT | ⚠️ The existing code uses **1.3×** — that is a **divergence to fix**: set to 3× and log the prior value in `DIVERGENCES.md`. |
| Stance damage cap | ×1.4 | CONTRACT | Light & Heavy noted at ×1.4. |
| Heavy stance defense penalty | **−20%** | CONTRACT | |
| Counter-triangle bonus | ×1.25 dmg dealt (and ÷ equivalent taken) | INFERRED | Triangle membership is CONTRACT (below); the magnitude is INFERRED. |
| Spawn invuln | **5 s** or until first slash | CONTRACT | Blinking character; ends on first slash. |
| Chi Punch dmg @ L1 | **10** (flat) | CONTRACT | HP-scale anchor; slash out-damages it after ~L5. |
| Focus max / switch cost / crit-ready threshold | 100 / 34 / 80 | INFERRED | From existing build; tune in calibration. |
| Stance triangle | **Light > Heavy, Heavy > Balanced, Balanced > Light** | CONTRACT | Winner deals more AND takes less. |
| Stance reach (px) | Light 300 / Balanced 200 / Heavy 120 | INFERRED | From existing build. |
| Stance dmg mult (mastery L1→L9) | Light ×0.5→×0.9; Balanced ×1.0→×1.2; Heavy ×1.4 (no mastery gain) | CONTRACT | |
| Launch unlock (stance level) | Light **3**, others **5** | CONTRACT | |

**Damage formula (decided — stop deferring it).** Use **pure Attack** (drawn-line length and draw-speed do **NOT** scale damage; they only affect reach/whiff via the polyline and the stance reach gate):

```
landed = polyline of DrawnStroke intersects a limb capsule
         AND limb midpoint is within stance.reach of the slash origin (extended-hand point)
base   = (Attack + WeaponDamage)
       * stance.dmgMult            // mastery-scaled (A.1)
       * counterBonus              // 1.25 if attacker stance beats defender stance, else 1.0
       * (crit ? 3 : 1)            // CONTRACT 3×
       * (1 - Defense * DEF_K)     // DEF_K default 0.01, INFERRED, clamp final ≥ 1
dmg    = round( base / defenderCounterPenalty )   // defender takes ×1.25 when out-countered
```
`DEF_K` and `WeaponDamage` tables are INFERRED; the multiplier structure and the CONTRACT factors are fixed. Stacking order is **exactly as written above** (resolves the "how do flat −20% def and the triangle combine" ambiguity: defense enters as the `(1 - Defense*DEF_K)` term; the triangle enters as `counterBonus`/`defenderCounterPenalty`; Heavy's −20% is applied to the defender's effective Defense before this term).

### A.2 Starting state & progression (so a level-1 encounter is playable on turn one)
| Constant | Default | Tag |
|---|---|---|
| Level-up reward | **+1 Skill Point, +3 Stat Points, full HP/Chi/AP refill** | CONTRACT |
| Level-1 base stats (Atk/Def/Spd/Chi/AP) | 5 / 5 / 5 / 4 / 3 | INFERRED |
| Level-1 pools (HP/Chi/AP) | HP 60, Chi 20, AP 20 | INFERRED |
| Per-point effect: +1 Attack | +1 to (Attack+Weapon) base | INFERRED |
| Per-point effect: +1 Defense | +1 Defense (enters `DEF_K` term) | INFERRED |
| Per-point effect: +1 HP | +8 max HP | INFERRED |
| XP curve | `xpToNext(L) = round(50 * L^1.5)` | INFERRED |
| Per-kill reward (duel foe) | XP = 10×foeLevel, Coins = 8×foeLevel | INFERRED |
| First-run Skill-Point cap | **80** | CONTRACT |
| Max rank | **dan rank 5 ("kyudan")** | CONTRACT |
| Stance mastery cap | **level 9** | CONTRACT |
| Chi skills unlock | levels ending in **5** (5,15,25…) | CONTRACT |
| Ninja skills unlock | levels ending in **0** from **10** | CONTRACT |
| Elemental skills | via **Rebirth** only; max 300+ dmg | CONTRACT |
| Chi skills maxed | 100+ dmg | CONTRACT |
| Rebirth payout | rebirths 1–9: **25 gold + 10 elemental** each; 10th: **100 gold + 20 elemental**; 11th+: **25 gold, no element** | CONTRACT |
| Rebirth element bonus | **+10 Attack** to chosen element, **stacks** | CONTRACT |
| Equipment slots | 5: weapon, helmet/mask, body, **pants (Chi/Speed source)**, gloves | CONTRACT |
| Inventory | max stack **99**, weight-capped | CONTRACT |
| Merchant floor rarity / top item | **green** / up to **8,000 coins** | CONTRACT |
| Ninja stat-transfer | **10 gold**, same item type | CONTRACT |
| Ninja rare outfits / duel tokens | 15 gold each / +10·+25·+40 duels for 5·10·15 gold | CONTRACT |

### A.3 AI opponent (the entire single-player replacement — specified as numbers, not "convincing")
The AI is a pure FSM (`idle→approach→telegraph→attack→recover`, with `block`/`dodge` reactions) — the existing `core/ai.ts` already implements this; keep it and drive it via the `OpponentController` seam (§C). Tiers are numeric tuples in `config/ai.ts`:

| Param | Easy | Normal | Hard | Tag |
|---|---|---|---|---|
| Telegraph duration (ms) | 700 | 520 | 380 | INFERRED |
| Attack active (ms) | 180 | 180 | 160 | INFERRED |
| Recover (ms) | 760 | 620 | 480 | INFERRED |
| Reaction window (ms) | 420 | 320 | 220 | INFERRED |
| React-block chance | 0.15 | 0.30 | 0.45 | INFERRED |
| React-dodge (Smoke Bomb) chance | 0.05 | 0.15 | 0.25 | INFERRED |
| **Counter-stance-pick probability** | 0.20 | 0.50 | 0.80 | INFERRED |
| Aggression (approach bias 0–1) | 0.3 | 0.55 | 0.8 | INFERRED |

**Stance-selection policy:** each decision tick, with `counterStancePickProbability` the AI switches toward the stance that **counters the player's current stance** (paying Focus); otherwise holds. **Every committing AI action must show a readable telegraph pose for ≥ its telegraph-duration before it lands** (slash windup, Smoke-Bomb puff before teleport, lunge crouch, stance-change flash) — this is BOTH a feel tell (§F) and the balance lever that makes duels winnable. Target duel length at Normal: **20–60 s, genuinely winnable and losable.**

### A.4 Strategy meta-layer (War Room — DESIGN-FROM-LORE; documented numbers are CONTRACT)
Kill cap **350** (340 troops + 10 PC samurai) per run; Build donation cap **exactly 500 coins/action**; deploy mods **Field→Mountain +60, Mountain→Mountain +100, Field→Forest 75**; control-point flag **+120%** to troops; Forward Base **10,000**, Barricades **10,000**, Tunnels **5,000** (disables Fire Arrows); **3 HQs/clan**; conquest tick **~24h** (accelerate locally); **3 moves/hr** baseline scaling with rank; rank ladder **Recruit→Soldier→Captain→General→War Hero** (Build gates at Captain, HQs at General, War Hero grants ring + clan deed); six actions **Attack/Defend/Spy/Move/Deploy/Build**; troops are an undifferentiated count; battle armor escalates with kill count (light → full heavy + clan masks); allied AI samurai fight a **private kill pool**. **Rival-clan strategic AI is design-from-lore** (not documented): implement a simple greedy strategist (reinforce weakest owned border sector, attack adjacent enemy sector with troop advantage, build when at Captain+ and flush) and log it in `DIVERGENCES.md`.

---

## B. PALETTE — required swatch table (lock each to a single hex)

Produce `config/palette.ts` with **single locked hex** per key (calibration overwrites the INFERRED seeds; the existing build already eyedropped many of these from reference frames). Required keys: **outline, blood, bloodDark, skin/skinShade, blade/bladeEdge (white core), bladeChi-glow, hair, hat-straw/hatShade, kimono/kimonoShade, player-haori (navy) + shade, enemy-haori (oxblood) + shade, obi/sash, sky-top, sky-bottom, mountains-far, hills/sage-mid, forest bands (bright/mid/shadow/dark), mist/teal depth, ground/foreground, UI-panel cream/parchment**, and **each meter color** (HP green, Focus blue, Chi, AP, Critical). Confirm blood reads as **bright saturated red, high-contrast over a muted ground palette.** Record band count and any per-region shift in `CALIBRATION.md`.

---

## C. ARCHITECTURE — file/interface manifest (pin it; the prior build drifted)

```
src/
  config/        combat.ts stances.ts economy.ts palette.ts timing.ts layout.ts ai.ts audio.ts
  core/          // deterministic, render-free simulation (already exists; keep this split)
    input → DrawnStroke      // resampled+smoothed polyline + timing + start/end + classified verb
    gesture.ts               // verb classifier (slash/jump/launch/stab) — exists
    slash.ts                 // DrawnStroke → SlashResult (polyline∩limb, reach gate, damage) — exists
    stance.ts focus.ts combo.ts geometry.ts ai.ts   // exist
    OpponentController.ts    // NEW — the mandated seam (see below)
    Sim.ts                   // NEW — owns fixed-60Hz tick, applies both controllers' intents
  game/          // Phaser presentation (already exists)
    input/GestureInput.ts  fighter/*  vfx/{BladeTrail,Gore}.ts  background/*  ui/Hud.ts
    audio/sfx.ts  scenes/{DuelScene,KillBeat}.ts
    OpponentController impls: AIController.ts (exists), ScriptedController.ts (NEW, for tests)
  state/         // localStorage/IndexedDB: progression, rebirth, inventory, campaign flags
```

**The `OpponentController` seam — specified as code (the prior build skipped it because it was prose):**
```ts
// core/OpponentController.ts
export interface CombatView {       // read-only snapshot the sim hands each controller
  self: FighterState; opponent: FighterState; distance: number;
  selfStance: StanceId; opponentStance: StanceId; tFixed: number;
}
export interface OpponentIntent {    // identical shape to what the player's input produces
  stroke?: DrawnStroke;             // a slash/jump/launch/stab gesture
  switchStance?: StanceId;          // costs Focus
  useSkill?: 1 | 2 | 3;
  smokeBomb?: boolean;
}
export interface OpponentController {
  decide(view: CombatView, dtFixed: number): OpponentIntent;
}
```
`AIController` (FSM) and `ScriptedController` (fixed intent list, for tests) both implement this. **The sim consumes `OpponentIntent` and never branches on controller type** — this is the network seam. **Ship a unit test** that runs `Sim` with a `ScriptedController` and asserts deterministic combat output, proving the seam exists.

**Pipeline:** `Input → DrawnStroke → Slash engine → Sim (60Hz deterministic) → Render → UI`. The War Room is a separate module consuming the same battlefield Sim.

---

## D. PER-DIMENSION SPECS

> Canonical facts are stated **once** here and **referenced by section** elsewhere — they are not repeated in five places.

### D.1 Slash engine (the heart — get this perfect)

**Input → trajectory (corrected — a literal jagged-polyline trace is itself a tell):**
- Capture the pointer path; **resample to even spacing and smooth it** (Chaikin or Catmull-Rom) into a clean swept curve. The *smoothed* curve is both the blade trajectory and the hit polyline. **Do NOT render the raw jittery hand-path verbatim** — that reads as MS-Paint and is a giveaway.
- **Blade-trail render = two-layer tapered ribbon:** a bright **white/near-white core** plus a thinner **blade-colored edge**, **pinched to zero width at both endpoints, widest mid-stroke**, with a **leading tip the blade chases** (blade lags slightly behind the lead point). Width/fade/easing are config keys (§4.2 targets). The drawn line *becomes* the arc 1:1 in **shape**, but **smoothed and tapered**, not raw.

**Direction = verb (canonical mapping, defined once):**
- **Horizontal stroke → SLASH** across the enemy.
- **Stroke up → JUMP** (begins at the line's **start point**, ends at its **endpoint**; start the line at the samurai for a clean jump). With **Launch** learned in the current stance, an up-stroke starting *below* the enemy launches them airborne (juggle/air combos).
- **Stroke down → STAB** (gated behind the **Stab** skill, Heavy tree); the stab pose **deflects** incoming kunai/arrows if **Deflect** is learned.

**Combat model — HP-based, NOT one-hit-kill** (the key divergence from SHS1; instant-kill-on-any-cut is the **wrong game** and a hard tell). Foes have HP/Attack/Defense; a slash deals damage per the §A.1 formula. One drawn line may cross multiple foes, damaging each (not instant-killing all).

**Meters/systems:** **Critical bar** fills passively, **drains per slash scaled by weapon weight** (heavier = bigger reach AND bigger drain); full → next hit is the **3× crit**; *patch behavior:* fills slightly slower, and **changing stance also deducts from it.** **Focus bar** is spent to **change stance** (Space or click portrait). **Stance triangle** per §A.1.

**Other rules:** spawn invuln 5s/first-slash (blinking); **PvE foes move slowly on purpose** so the player charges Focus/Critical between exchanges (hyper-twitch foes feel wrong); **Smoke Bomb** = teleport-dodge (AI uses it to avoid your Stab); **Stab+Deflect** swats projectiles; **aim for the head** = emphasis target; **Shunpo** (from SHS2) = player slow-mo burst draining the power meter (verify in *Duels*; else DESIGN-FROM-LORE). Whiff vs land per the reach gate in §A.1.

### D.2 Art & game feel
Flat-color, bold clean **black-outline cartoon-vector** ("Samurai Jack") look — **not** pixel art, painterly, or heavy-gradient. Iconic silhouette = **wide low conical straw kasa + long straight katana line + flowing scarf.** Character rig = **layered, recolorable, tintable vector parts** constrained to rig height (gear are art layers, not baked sprites). Per-stance slash geometry visibly differs: **Light = long sweeping fast arcs, Heavy = short slow heavy arcs, Balanced between.** **Blood** per §B + §4.2 (directional gout along the cut vector, bright saturated red, optional persistent decals). **Backgrounds** = simple side-scroll arenas, layered (sky / distant mountains / mid silhouettes / foreground band) with gentle **parallax**; fighter readability beats background detail. **Locomotion & secondary motion** (idle breath, walk/run cadence, **hat bob + scarf trail**, heavy-weapon cadence) per §4.2. **Baseline camera:** define resting framing (centered vs lead-the-facing), track during run/jump, zoom-out when fighters separate, arena pan limits — config keys, calibrated in §4.2; impact modifiers (shake/zoom/slow-mo) are separate.

### D.3 Duel framing (the per-fight wrapper the player sees constantly — specified, not deferred)
Every duel: **VS intro splash with both portraits + opponent name banner → optional "Ready/Fight" countdown → fight → Victory/Defeat result** (tallies XP + coins; tournament placement → gold). Default structure = **single life per duel** (not best-of) unless footage shows rounds; round timer presence is a §4.2 calibration item (default: no hard timer). Entrance animation: fighters walk/leap into the arena from opposite sides.

### D.4 HUD (corners are load-bearing tells; appearance is the tell, not just position)
- **Stance portrait LEFT corner** — click or **Space** to swap stance; swap **visibly drains Focus** (later patch: also the Critical bar).
- **Skill bar** numbered slots, fired by click or **1/2/3**.
- **Coins + Gold counter TOP-LEFT**; **Minimap TOP-RIGHT** (click → world map; restyle/stub for single-player).
- **Resource bars** HP / Chi / AP (travel only) / Focus / Critical — each bar's **color, shape, fill direction, size** and the **enemy-HP presentation** are §4.2 calibration items with defaults (HP green, Focus blue) seeded in §B.
- **Typography:** display face (title/haiku/banners) + body face (HUD numbers/dialogue) per §4.2.

### D.5 Audio (per-cue brief — give the composer targets, not "equivalent")
Compose your own; **separate menu/exploring theme vs combat bed.** Per-cue brief (mood/instrumentation/tempo/length/loop are calibration-refinable from footage; defaults below):

| Cue | Mood | Instrumentation (inferred) | Tempo / length | Loop? |
|---|---|---|---|---|
| Title ambience | calm, expectant | shakuhachi + soft taiko | slow / 30–60s | loop |
| Menu / Exploring | melancholic wander | koto + shakuhachi | slow-mid / 60–90s | loop |
| Combat bed | tense drive | taiko + shamisen | mid-fast / 60–120s | loop |
| Victory sting | triumphant | taiko hit + koto flourish | — / 2–4s | one-shot |
| Defeat sting | somber | low shakuhachi | — / 2–4s | one-shot |
| Level-up chime | bright reward | koto pluck | — / 1–2s | one-shot |
| Stance-swap whoosh | snap | cloth/steel whoosh | — / <0.5s | one-shot |

**Slash SFX = four-way matrix**, each firing on the §4.2-measured frame, each a config entry: **(1) draw/unsheathe**, **(2) whiff** (no contact, steel "shhhk" whoosh), **(3) flesh-hit** (wet cut), **(4) armor/parry/deflect** (metallic "tink/clang"); **heavy vs light** have distinct tonal weight.

### D.6 Campaign (don't over-scope: SHORT, grounded — Season > Prologue/Episode)
Prequel to SHS1. Ship **Season 1: Prologue + Episode 1 + Episode 2** only (the documented content) — low-stakes rural intrigue, **not** a 20-mission epic. **Premise:** ailing Shogun **Lord Masahiro** (Clan **Shira Tancho** / White Crane) suspects **Lord Daichi** (Clan **Midori Ken** / Green Sword) of amassing troops; retainer **Shinmen Takeru** is tasked with protecting the son and rebanding the **Old Guard** (vanguard from the **Demon Wars**) to prevent civil war; prior shogunate was **Clan Aka Ryu** (Red Dragon). Player = nameless **Shugyosha** on a **Musha Shugyo**, starting in torn garments wielding **only a branch**.

**Each segment opens with a 3-line haiku title card** — reproduce the *format* and the established **themes** (alone-on-the-road / drunken-wisdom / swallows-aiding-each-other) in **your own phrasing** (do not paste original prose).

- **Prologue (= tutorial):** spawn Territory **(21,51)** / Sector **(0,3)** → find **Hiroshi** → outside hut → inside hut (gather-the-Old-Guard quest) → **Ito** in dojo (**Fighting Tutorial**) → **Takahasi** in mines (**Mining Tutorial**) → **Yuudai** → back to Hiroshi → inn, speak to **Yasuka** → rendezvous with Hiroshi → **Satoshi** in Chikada Town (→ Ep1).
- **Episode 1 (bounty):** Satoshi at inn → bounty board → defeat **Inokichi** (boss duel) → turn in his club → **Boss Tanaka** in gambling den → celebrate.
- **Episode 2 (swallows):** work at Kakuchi → Old Guard hideout → info on bounty hunters → rescue **Yasuka** → defeat **Tadao** (boss duel) → **Shinmen Takeru sacrifices himself** so the Old Guard + player escape (Hiroshi delivers the news).

Quest types: talk / fetch / escort(Guide) / Duel. Cutscene presentation: **static portrait + text box** (the series convention; default unless footage shows otherwise). Self-pacing: grind dungeons/caves, get gear, bring healing items; prioritize Attack/Defense/HP.

### D.7 PvE bestiary & strategy layer
Bestiary (de-facto classes): **Humans, Oni, Undead, Tengu, Forest Creatures, Guardian bosses (e.g. Kanji Guardian)**. **Undead:** green skin, red eyes, slow, fought in masses — counter with high Attack+HP, aim for head, exploit slowness. War Room numbers + battlefield per §A.4. **Enemy telegraphs** (§A.3) apply to all attacking AI.

---

## E. CONTRACT vs INFERRED — resolving the audit-circularity

- **CONTRACT constants** (every value tagged CONTRACT in §A and the documented numbers in §A.2/§A.4): **frozen.** Unit tests in §G assert them. **Calibration may NOT mutate them.** If footage contradicts a CONTRACT value, you keep the contract and log the contradiction in `DIVERGENCES.md`.
- **INFERRED constants:** seeded from §A, **freely tunable** by calibration. **No test asserts a specific INFERRED value** — they are checked only for internal consistency and the single-tunable requirement. They are **not** held to frame-exact acceptance.

This makes the numeric audits meaningful (they guard the documented contract) without being circular (they never assert a guessed number).

---

## F. TELLS CHECKLIST — the single binding acceptance gate

Render this as `TELLS_CHECKLIST.md`; each line is **binary PASS/FAIL**, observable in the build. **100% PASS = done.** (Items marked *(lore)* are graded by faithfulness, not footage; items marked *(measure)* pass when the build matches the value recorded in `CALIBRATION.md` — CONFIRMED values to their §4.2 tolerance, INFERRED values only to single-tunable + consistency.)

**Slash engine**
1. Drawing a stroke makes the blade trace a **smoothed swept curve of that stroke's shape** (NOT a raw jagged polyline, NOT a canned animation). PASS/FAIL
2. Blade trail is a **two-layer tapered ribbon** (white core + colored edge), pinched at both tips, widest mid-stroke, with a leading tip. PASS/FAIL
3. **Horizontal = slash, up = jump, up+Launch-skill = launch, down(Heavy)+Stab = stab.** PASS/FAIL
4. Jump **starts at the line's start point, ends at its endpoint.** PASS/FAIL
5. Damage is **HP-based, not instant-kill**; one line crossing two foes damages both, kills neither outright at full HP. PASS/FAIL
6. Per-stance arcs visibly differ: **Light long/fast, Heavy short/slow, Balanced between.** PASS/FAIL

**Combat systems**
7. **Critical bar drains per swing (more for heavier weapon)** and pays off as a visible **3× crit.** PASS/FAIL
8. **Stance swap on Space/portrait costs Focus**; triangle **Light>Heavy>Balanced>Light** holds with correct reach/speed/damage. PASS/FAIL
9. **5s spawn invuln** with a **blinking** character, ending on first slash. PASS/FAIL
10. **Smoke Bomb** teleport-dodge and **Stab+Deflect** projectile swat both function. PASS/FAIL
11. PvE foes **move slowly**, granting charge time. PASS/FAIL
12. **Chi Punch = 10 dmg at L1.** PASS/FAIL

**AI / feel**
13. Every committing AI attack shows a **readable telegraph** for ≥ its telegraph duration (slash windup, Smoke-Bomb puff, lunge crouch, stance-flash). PASS/FAIL
14. A Normal-tier duel is **winnable and losable**, ~20–60s. PASS/FAIL
15. **Kill/finisher beat** (freeze + speed-ramp on a fatal/duel-ending blow) fires and is **distinct from Shunpo.** *(measure)* PASS/FAIL
16. **Shunpo** player slow-mo drains the power meter. *(lore if unobservable)* PASS/FAIL

**Art / motion**
17. Flat-color + bold-outline **Samurai-Jack vector** look; crisp scaling; **no pixel-art.** PASS/FAIL
18. Iconic **kasa + straight katana + scarf** silhouette with correct proportions. PASS/FAIL
19. **Blood sprays directionally along the cut vector**, bright saturated red over a muted palette. *(measure)* PASS/FAIL
20. **Scarf/hat secondary motion** present in idle/move (the art looks alive, not stiff). PASS/FAIL
21. Simple **parallax** arenas; high-contrast fighters. *(measure)* PASS/FAIL
22. **Baseline camera** framing/tracking matches the recorded behavior. *(measure)* PASS/FAIL

**UI / audio / flow**
23. **Portrait LEFT, coins+gold TOP-LEFT, minimap TOP-RIGHT, numbered skill bar (1/2/3).** PASS/FAIL
24. Each HUD bar's **color/shape/fill** matches the recorded layout. *(measure)* PASS/FAIL
25. **Duel framing**: VS splash + opponent name banner + result screen. PASS/FAIL
26. **Title typography** (display face) and HUD/dialogue body face match the recorded faces. *(measure)* PASS/FAIL
27. **Menu/exploring music separate from combat bed**; **victory sting** and **defeat sting** are distinct cues. PASS/FAIL
28. **Four-way slash SFX** (draw / whiff / flesh / armor-parry) each fire on the measured frame. *(measure)* PASS/FAIL

**Progression / campaign / lore**
29. **Level-up = exactly +1 SP, +3 stat, full HP/Chi/AP refill.** PASS/FAIL
30. **Rebirth payout** schedule and **+10-Attack-per-rebirth element stacking** correct. PASS/FAIL
31. **First-run 80 SP cap**; max = **dan rank 5 (kyudan).** PASS/FAIL
32. Two-currency split: **Coins grindable, Gold earnable/cosmetic, no cash purchase.** PASS/FAIL
33. **Season > Prologue/Episode** nesting; Prologue **is** the tutorial; **3-line haiku** title cards. PASS/FAIL
34. Player **starts as ragged Shugyosha with a branch.** PASS/FAIL
35. Correct **clan/character names** (Shira Tancho, Midori Ken, Aka Ryu, Masahiro, Daichi, Takeru, Hiroshi, Ito, Takahasi, Inokichi, Tadao, Satoshi, Yasuka). *(lore)* PASS/FAIL
36. **War Room gated at level 10**, AI-clan-driven; battlefield kill cap **350.** *(lore)* PASS/FAIL

---

## G. Acceptance & verification — split into agent-verifiable and human-verifiable

**(a) Agent-verifiable (the build loop's definition of done — these MUST pass in CI):**
- **`config-purity.test.ts`** — no disallowed numeric literal in `core/`/`game/` (§3).
- **`opponent-seam.test.ts`** — `Sim` runs with a `ScriptedController` and produces deterministic output (§C).
- **Numeric audits (CONTRACT only, §E):** unit tests asserting crit ×3; level-up +1SP/+3stat/refill; Heavy −20% def; Chi Punch 10@L1; stance mults ×0.5→×0.9 / ×1.0→×1.2; rebirth 25g+10 ×9 / 100g+20 / 25g; first-run SP cap 80; kill cap 350; build cap 500; deploy mods +60/+100/75; flag +120%; spawn invuln 5s; launch unlock L3/L5.
- **Tells Checklist (§F):** every item observable PASS in the running build.

**(b) Human-verifiable (a POST-BUILD human pass — NOT an agent deliverable, NOT a blocker):**
- **Side-by-side frame-step:** record the clone running each §G scenario, place beside reference footage at matched fps, and confirm against **`CALIBRATION.md`**: slash windup/active/recovery within **±1 frame** *(CONFIRMED values only; INFERRED values are exempt)*; blade-trail width **±1px** / fade **±20ms**; palette **exact hex**; HUD positions **±4px** at native resolution; audio cue **±1 frame**.
- **Optional feel panel (north-star, non-binding):** if ≥5 people who played the original are available, run a forced-choice "which is the clone?" test across the scenario set; target = identification rate **not above chance**. This is aspirational evidence, **not** part of the build's pass/fail gate.

**Scenario set** (for both (a) and (b)): a Light slash, a Heavy slash, a jump, a stab+deflect, a 3× crit, a stance swap draining Focus, spawn-invuln blink, a finisher kill-beat, the VS intro, a Victory screen.

---

## H. Deliverables
1. Running web build (single-player, Phaser 3), 60fps, mouse+touch, deploys as a static site.
2. `src/config/` fully populated (seeded from §A, overwritten by calibration).
3. `CALIBRATION.md`, `TELLS_CHECKLIST.md`, `DIVERGENCES.md`.
4. Source per the §C manifest, **including the `OpponentController` seam + its test** and the **config-purity test.**
5. Campaign: Prologue + Ep1 + Ep2 with self-authored haiku cards, named-NPC sequence, boss duels, tutorials.
6. The AI duel system (tiers per §A.3) and the AI-clan War Room (per §A.4).

---

## I. Milestones (each with an MVP cut line — MUST / SHOULD / CUTTABLE)

- **M0 — Scaffold & config.** Seed `src/config/` from §A; write `config-purity.test.ts`, the CONTRACT numeric audits, and the `OpponentController` interface + `ScriptedController` test; create `CALIBRATION.md`/`TELLS_CHECKLIST.md`/`DIVERGENCES.md`. *(No footage gate — build proceeds on §A defaults.)*
- **M1 — Slash vertical slice.** **MUST:** draw→smoothed-trail slash, direction-as-verb, one stance, HP damage, two-layer tapered trail, directional blood, calibrated canvas. Passes tells 1–6, 17–20.
- **M2 — Full combat.** **MUST:** 3 stances + triangle, Focus/Critical/3× crit, weapon weight, 5s invuln, Smoke Bomb/Stab/Deflect, skills 1/2/3, AI via the seam with telegraphs, finisher kill-beat, duel framing. **SHOULD:** Shunpo. Passes tells 7–16, 23, 25, 28.
- **M3 — Progression & economy.** **MUST:** stats, level-up, stance tree, equipment/rarity, two currencies, shops, save. **CUTTABLE-for-v1:** Ninja + Elemental trees, rebirth, full rarity table, stat-transfer. Passes tells 29–32.
- **M4 — UI/UX & campaign.** **MUST:** full HUD (correct corners + measured appearance), screen flow, title + music separation (victory/defeat stings), Prologue + Ep1 + Ep2 with haiku + named NPCs. Passes tells 23–27, 33–35.
- **M5 — Strategy meta-layer.** **CUTTABLE / stretch** (do only after M1–M4 are shippable): AI-clan War Room + wave-survival battlefield (kill cap 350, escalating armor), gated at level 10. Passes tell 36.
- **M6 — Verification & polish.** Run §G(a) to green; run §G(b) human pass where footage/testers exist; finalize `DIVERGENCES.md`.

---

## J. Working rules
1. **Build on defaults, refine with calibration.** §A is your turn-one source of truth; footage *overwrites INFERRED values only*, never blocks.
2. **Recreate, don't copy** (§1). Match perceived dimensions/palette/timing/layout; author your own bytes and prose.
3. **Flag-and-propose, never silently diverge.** Every departure from a documented value, every resolved open question, every DESIGN-FROM-LORE system → `DIVERGENCES.md`. (The crit 1.3→3× fix and the rival-clan AI are already on that list.)
4. **One central config, enforced by CI** (§3). No gameplay literal escapes `src/config/`.
5. **CONTRACT is frozen; INFERRED is tunable** (§E). Tag every constant.
6. **The combat core never knows its opponent is AI** (§C). The seam is mandatory and tested.
7. **§F is the definition of done.** The "can't tell which is the clone" line is the intent; §F is the gate.