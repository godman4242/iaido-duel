# iaido-duel — Story Campaign design (Episode 1: Engine + Kasuta)

**Date:** 2026-06-29
**Branch:** `feat/first-playable-duel` (story work continues here or a `feat/story-campaign` branch)
**Goal:** Grow the finished combat core into the **full story campaign** of *Straw Hat Samurai:
Duels*, **indistinguishable from the source playthrough videos** — same structure, same screens,
same areas, same NPCs, same quests, same narrative beats — to the point you cannot tell ours from
the original. Quality over speed; however long it takes.

This spec covers the **whole campaign architecture** plus the **first buildable unit — Episode 1
(the reusable engine + the Kasuta opening)**. Later episodes get their own spec → plan → build on
the same engine.

---

## 1. The bar

A person watching our build beside the original videos — title screen, town, dialogue, menus
(stats / skills / inventory / shop), world map, combat stages, bosses, loot, level-ups, the story
itself — **cannot tell which is which**. Not "same genre" or "same vibe": the same game.

We already hit this bar for the **combat duel** (Session 2: animation, blade-trail, kill-beat, HIT
COMBO, gore — verified in-browser, 43+ tests green). The campaign wraps that core in the RPG/story
shell the source has.

## 2. IP & distribution boundary (load-bearing — read before building)

One hard line, set by Kheshav at the project's start and unchanged:

- **Recreate, never rip.** Every asset and every line ships from **our own files**: our own
  vector/cel-shaded art, our own synth audio, our own code, and narrative/UI text **re-typed by
  studying the videos**. We **never decompile, extract, or ship the original's binary art, audio,
  logo, or `.swf`/code** — that's both infringing and lower-craft.
- **Study material stays out of the build.** `reference/` (the full videos + stills) is gitignored,
  used only to read structure/timings/text, **never shipped**.
- **Distribution:** the GitHub repo is set **PRIVATE** before deeper fidelity work (Kheshav's
  decision, to address copyright). Treat this as a **personal, non-commercial fan homage** — not for
  public redistribution. On-screen + README homage credit stays: "Fan homage of *Straw Hat Samurai:
  Duels* by Explosive Barrel — unaffiliated, non-commercial."

Mirroring the source's **plot, names, dialogue, and screens** is in-scope for this private homage
(Kheshav's explicit instruction). The boundary is the *method* (recreate, don't extract) and the
*distribution* (private, non-commercial), not the fidelity.

## 3. Source structure — what the videos show (the facts to mirror)

From frame-study of both full playthrough videos (`reference/full/`, ~1h each). This is the map the
campaign must reproduce. **Exact text, names, item stats, and layouts are re-read frame-by-frame at
build time** — the list below is the structural skeleton, not the final content.

**Framing & loop.** A 2D side-view action-RPG "quest mode" story campaign. Opening haiku/epigraph →
you arrive as a wandering straw-hat ronin → hub towns with NPCs/dialogue/quests → side-scroll combat
areas (the duel core, extended to multiple enemies) → world map with territory sectors connecting
areas → persistent RPG progression → an over-arching "rescue the Shogun" plot. Zen-poem interstitials
appear between chapters.

**Hub towns.** Kasuta (tutorial town) and later castle towns: a **dojo** (shihan/sensei NPC, a
**training dummy**, stance/skill tutorials, a **tournament/challenge hall**), townsfolk NPCs with
dialogue + quests, shops.

**Quest types.** Story duels; **multi-enemy** combat stages (HIT COMBO counter during chains);
**gathering** (mine cores on the mountain path, "rake/harvest" the vegetable patch); **delivery**
("special barrels"); **training** (attack the dummy); **find-info**; **spar** invitations from
roaming duelists; **defeat-boss**.

**Combat areas (themed).** Bamboo forest, mountain path, dojo interiors, castle town, stone dungeon,
misty pampas field, beach. Stage start = orange **"FIGHT!"** banner; clear = red **"YOU WIN"**; then
a **"YOU RECEIVED"** loot dialog.

**Enemies & bosses.** Lone duelists, groups (the HIT COMBO chains), and named bosses (e.g. a Ronin
Leader; later, larger named bosses). Roaming NPCs offer spars.

**RPG systems (all have on-screen menus to reproduce):**
- **Stats:** HP / CHI / AP, ATK / DEF / SPD, plus elemental/mind stats (e.g. MND ATK, EARTH DEF) and
  crit; HP/CHI regen; **stat points** to allocate on level-up.
- **Skills:** active skills (e.g. a dash/burst), a **skill tree** with categories, equip-skill slots,
  per-skill **level + cooldown**, **skill points**; "stance mastery" passives.
- **Inventory / equipment:** a paper-doll with weapon/armor/kimono slots, item **rarity by border
  colour** (blue = rare), a **weight limit**, EQUIP / DROP / SCRAP actions.
- **Shop:** buy / sell with coin pricing.
- **Progression:** XP curve, levels, coins/gold, **achievements** (e.g. "defeat 100 enemies", "win a
  challenge").

**Navigation.** A **world map / minimap** with named regions and territory sector coordinates;
area-to-area travel; "you are about to leave \<region\> territory" gates.

**Endgame meta (online layer).** At a level threshold a **Clan** system + **War Room** unlock: a map
of Japan with **territory control**, a clan message board, turn-based "moves". This is the original's
**online/MMO** layer. See §8 — it is the **last / stretch** target and needs a single-player
adaptation, not in Episode 1.

## 4. Campaign decomposition (build order)

The full game is too large for one spec. It decomposes into **episodes**, each its own
spec → plan → build, all sharing the engine built in Episode 1. "Indistinguishable for the whole
game" is reached by completing the episodes in order — not in one pass.

1. **Episode 1 — Engine + Kasuta** *(this spec; the first build)*. The reusable campaign engine
   **and** the recreated opening: title + intro haiku → Kasuta tutorial town → dojo/shihan + training
   → townsfolk NPCs + tutorial quests (mountain-path gather, vegetable-patch harvest, deliver
   barrels) → first combat stages → leave town. Bar: indistinguishable from the source's opening
   (~first 10–15 min). **Everything later reuses the systems built here.**
2. **Episode 2 — Tohibara region.** Castle-town gates → Tohibara Forest → Castle Town (shops/NPCs) →
   Tohibara Dungeon (first major boss) → Tohibara Field → Beach. The bounty-hunter subplot; the
   "rescue the Shogun" goal surfaces. Mostly **content data** on the Ep-1 engine + a few new mechanics
   (enemy waves, boss patterns, dungeon).
3. **Episode 3+ — later regions → climax.** Further regions, bosses, and the Shogun-rescue climax.
4. **Endgame — Clan & War Room** *(stretch)*. The online meta, adapted to convincing single-player
   (scripted/bot territory). Hardest fidelity question; sequenced last.

Episode 1 is itself large; it may internally phase **1a** (engine skeleton: scene flow, save,
dialogue, one combat stage, town walk) then **1b** (RPG screens + the tutorial quest chain). The plan
will decide the split.

## 5. Architecture

The existing combat core is **kept and reused**. We add an RPG/campaign shell around it, with two
principles that make a full campaign tractable:

- **Pure core, TDD'd.** Every rule with logic (stats math, inventory/weight, skills/cooldowns, xp,
  dialogue advancement, quest state, save serialization) lives in `src/core/` as Phaser-free,
  unit-tested code — matching how `anim.ts` / `combo.ts` / `slash.ts` are already done.
- **Data-driven content.** Areas, NPCs, dialogue, quests, items, enemies, and chapter manifests are
  **typed data** in `src/data/`, consumed by generic systems. A new chapter = new data files (+ the
  occasional new mechanic), **not** bespoke code per stage/NPC. This is what lets the campaign scale
  to the whole game without the codebase exploding.

### 5.1 Pure core (new, under `src/core/`)

```
core/
  gamestate.ts   # the save model: player stats, inventory, equipped, skills, quest flags,
                 #   unlocked areas, position, coins, xp/level. Plain data + pure transitions.
  save.ts        # pure serialize/deserialize + version/migrate (localStorage adapter lives in game/)
  dialogue.ts    # pure dialogue runner: node graph, branches, set/read flags, "next" advancement
  quest.ts       # pure quest engine: objectives, progress, completion, reward grant
  rpg/
    stats.ts     # derive HP/CHI/AP + ATK/DEF/SPD + elemental/crit + regen from base+level+gear
    inventory.ts # slots, weight limit, equip/unequip, rarity, drop/scrap
    skills.ts    # skill defs, tree prerequisites, equip slots, level + cooldown state
    shop.ts      # buy/sell pricing
    xp.ts        # xp curve, level-up, stat/skill-point grants
```

### 5.2 Data (new, under `src/data/`)

```
data/
  chapters/   # chapter manifest: which areas/npcs/quests are active, unlock conditions
  areas/      # area def: background, parallax, exits, NPC placements, stage/wave spec
  npcs/        # npc def: appearance params, position, dialogue ref, quest hooks
  dialogue/    # dialogue trees (text re-typed from the videos at build time)
  quests/      # quest defs (objectives, rewards, text)
  items/       # item/equipment defs (slot, stats, rarity, weight, price)
  enemies/     # enemy defs (stats, AI params, tint/appearance, boss patterns)
```

### 5.3 Phaser layer (new scenes/UI under `src/game/`)

```
game/
  scenes/
    BootScene.ts       # boot, load save (or new game)
    TitleScene.ts      # intro haiku + main menu (New Game / Continue)
    OverworldScene.ts  # world map / territory sectors → choose destination area
    TownScene.ts       # hub: walk, talk to NPCs, enter dojo/shops, accept/turn-in quests
    StageScene.ts      # combat area: wraps the existing duel core for multi-enemy/waves/boss,
                       #   FIGHT! banner, YOU WIN, loot drop, leave-area exits
    DuelScene.ts       # EXISTING — refactor its combat into a reusable CombatStage that
                       #   StageScene composes (keep the standalone duel working)
  ui/
    DialogueBox.ts     # the source's bottom text bar: portrait + name + text + next-arrow
    StatsScreen.ts  InventoryScreen.ts  SkillsScreen.ts  ShopScreen.ts  QuestLog.ts
    Hud.ts             # EXISTING (HP/CHI/AP + HIT COMBO) — reused in stages
  persistence/
    Save.ts            # localStorage adapter over core/save.ts
```

**Reuse note.** `Fighter`, `FighterAnimator`, `Skeleton`, `BladeTrail`, `Gore`, `KillBeat`, `Combo`
(HIT COMBO), `Forest`, and the AI are reused as-is. The main refactor is extracting `DuelScene`'s
per-frame combat into a `CombatStage` unit that both the standalone duel and the campaign's
`StageScene` use, so multi-enemy stages don't fork the combat code.

### 5.4 Flow

`Boot → Title (haiku) → [New/Continue] → Town/Overworld → (enter area) StageScene → (clear) loot →
back to Town/Overworld`, with menus (Stats/Inventory/Skills/Shop/QuestLog) as overlays openable from
town and the pause menu. `GameState` is the single source of truth, saved to localStorage after
meaningful changes.

## 6. Episode 1 scope — Engine + Kasuta

**Engine (reusable, the foundation for every later episode):**
- Scene flow Boot → Title → Town → Stage, with `GameState` + localStorage save/continue.
- **Dialogue system** (core runner + `DialogueBox` UI matching the source's bottom bar).
- **Quest system** (core engine + a simple on-screen tracker / quest log).
- **RPG core + screens**: Stats, Inventory/Equipment, Skills, Shop, XP/level — functional and
  laid out to match the source (at minimum: viewable + the interactions the tutorial needs).
- **StageScene**: multi-enemy combat reusing the duel core; FIGHT! banner; YOU WIN; YOU RECEIVED loot.

**Content (recreate the source opening, faithfully, by frame-study):**
- Title screen (forest backdrop + recreated logo + a panel — the source's online account panel
  **adapted** to single-player New Game / Continue, no real accounts).
- Prologue cinematic on New Game: scrolling story prose over a ronin silhouette → "PROLOGUE" card →
  ensō + the 3-line epigraph → into the first area. (Confirmed by frame study; the epigraph is in the
  prologue, not the title.)
- **Kasuta** town hub: the **dojo** (shihan NPC, **training-dummy** tutorial, stance + skill intro),
  townsfolk NPCs with their dialogue, and the tutorial quest chain — **mountain-path gather**,
  **vegetable-patch harvest**, **deliver barrels**, first **duel/combat** stage(s) — then the
  leave-town exit toward the next region.

**Done = indistinguishable from the source's opening ~10–15 minutes**, verified against the videos.

## 7. Testing & fidelity strategy

- **TDD all pure core** (`gamestate`, `save`, `dialogue`, `quest`, `rpg/*`) before wiring Phaser —
  same discipline as the existing `core/` suite (now 18 test files). Red → green → refactor.
- **Visual/feel fidelity** has no unit test: gate it the way Session 2 did — run the build, screenshot
  each screen (title/town/dialogue/menus/stage) **beside the source frame**, and tune until they
  match. These steps are explicitly **unverified until observed in-browser**.
- **Process:** Subagent-Driven Development (fresh implementer + reviewer per task; ledger in
  `.superpowers/sdd/progress.md`), as used in Session 2, to hold quality across a large build.
- **Proof for every milestone:** paste `npm test` + `npm run build`, and post screenshots/clips of
  the new screens beside the source. Name the biggest remaining gap, then fix or flag it.

## 8. Out of scope for Episode 1 (sequenced later)

- Episodes 2+ content (Tohibara and beyond) — built on this engine, own specs.
- The **Clan / War Room / Japan-territory** online metagame — the hardest "indistinguishable"
  question because the original is server-backed multiplayer; needs a single-player adaptation
  (scripted/bot territory). **Stretch, last.**
- Real-money / online / PvP / accounts — out entirely (single-player homage).

## 9. Open questions / residual unknowns (resolve during build)

1. **Content fidelity is empirical.** Every line of dialogue, NPC name, item stat, quest objective,
   and exact menu layout must be read frame-by-frame from the videos during the build — they can't be
   fully pinned in this spec. The plan must budget real video-study time per screen.
2. **Episode 1 split.** Whether to phase 1a (engine) / 1b (tutorial content) is a plan-time call.
3. **Combat-core refactor depth.** Extracting `CombatStage` from `DuelScene` cleanly (without
   regressing the verified duel) needs care; covered by keeping the duel's behaviour under test.
4. **Endgame online layer.** How faithfully a single-player build can mirror the clan/territory
   metagame is genuinely unknown until we attempt it.
5. **Balance/tuning** (enemy counts, stat curves, economy) is empirical — needs playtests, not just
   measurement.
