# ART_DIRECTION.md — visual calibration from the 2026-07-02 survey pass

> **Source:** frame surveys of Longplay PART 1 (`zFtCaTO0_1M`, 80 frames @ ~52s) and PART 2
> (`Nr4fQstqHDM`, 80 frames @ ~49s), 512px JPEG. Everything here is **survey-grade INFERRED**
> (measured by eye from compressed frames; hexes ±JPEG error, px ±8 at 1024×576). Upgrade rows
> via Ruffle frame-stepping per CALIBRATION.md.
>
> **Legal frame (spec §1):** this file records *factual observations* — layout positions, color
> families, timing behavior, screen flow. All art we ship is authored by us from these measurements.
> No original asset bytes, fonts, or prose are copied.
>
> Frame files (this session's scratchpad, re-derivable anytime via the watch skill):
> `scratchpad/watch-part1/frames/`, `scratchpad/watch-part2/frames/`. Cited below as p1/p2 fNN.

---

## 0. The ten loudest "tells" (fix these and the build reads as the same game)

1. **Muted, earthy world + one screaming accent.** Environments are low-saturation olive/sage/teal/
   sepia; the only saturated things on screen are blood red, the slash arc, and UI gold. Nothing
   else competes. (p1 f18, f46)
2. **Dark top vignette** on every exploration/combat scene — a soft black gradient band ~15% down
   from the top edge. (p1 f06, f12, f46)
3. **Foreground occluders**: a big dark tree trunk / bamboo culm / wooden post crossing the frame
   *in front of* the gameplay layer, slightly blurred-feeling (drawn darker, low detail). Fights
   happen behind them. (p1 f48, f62, p2 f14, f74)
4. **Slash arc = broad weapon-colored crescent**, not a thin line: a fat tapered sweep with a
   lighter core; bright cyan-blue with the blue katana, steel-white/grey default, red with the
   sabre. It hangs ~200ms and fades. (p1 f31, f37, f62; p2 f9, f34)
5. **The red screens.** (a) Finisher flash: the whole scene snaps to **black silhouettes over flat
   red** for a beat mid-kill (p1 f56, p2 f35 — interiors keep window bands as red/black stripes).
   (b) **YOU WIN**: flat red field, black ground strip with grass nicks, black fighter-pose
   silhouette(s), title in tall white-outlined red brush caps sitting on a black ink splat
   (p1 f03 etc. — appears after *every* battle).
6. **HUD corners exactly**: coins+gold TOP-LEFT (+ location banner + quest tracker under it),
   XP bar + level badge TOP-RIGHT with the ornate **minimap panel** under it, **portrait+bars
   BOTTOM-LEFT**, hotbar strip along the BOTTOM. Combat swaps to: AUTO SLASH toggle top-left,
   red brush **combo counter top-right**, 3 numbered skill slots + flee arrow bottom-right.
7. **Floating name labels**: gold caps for the player, blue for NPCs, red for hostiles with the
   level in parens — enemy HP is a small green bar under the name, never a top-of-screen bar.
   Quest NPCs get a bobbing **!**.
8. **Corpses, blood pools, and loot persist.** Bodies stay down for the whole fight, dark red pools
   spread under them, coins/item-papers tumble out with physics. (p1 f66, p2 f31, f48)
9. **Letterboxed travel pans**: scene transitions collapse to a thin strip between huge black bars
   while the camera pans. (p1 f16, f26; p2 f5, f21)
10. **Chunky black-outlined vector art everywhere** — thick uniform outlines, flat fills, one cel
    shade tone per surface. Characters ~1/3 screen height in combat, ~1/5 in exploration.

---

## 1. Global render style

- Flat fills + **one darker cel tone** per surface; black outlines ~2px at 1024w on characters
  and props; background layers lose their outlines with distance (far layers are outline-free
  color shapes).
- Background detail is LOW; fighter readability is the priority. Mid layers are near-silhouettes.
- Light source implied top-left; no gradients except sky bands and lantern glows.
- Scene grade: exploration scenes sit slightly desaturated; interiors warm (mustard/sepia);
  dungeon/mine cool-dark. A **soft dark vignette** hugs the top edge (and bottom corners lightly).

## 2. Biome kits (layer stacks, back→front; hexes INFERRED)

### 2.1 Sage field (p1 f18, f19, f24, f35; p2 f20, f79)
1. Sky: pale sage gradient `#cfe0c4 → #e8f0dd`, huge **wavy cream cloud streaks** (`#f4f6ea`,
   soft edges, 2–3 horizontal sweeps — the signature).
2. Far mountains: muted blue-green `#7d9c82` flat ridge.
3. Mid hills / tree silhouettes: olive `#5c7d54`, dead trees near-black.
4. Ground band: dark green `#2f4a2a` with tall-grass blade clumps `#233d20`, wooden signposts,
   fence posts `#3d2a16`.

### 2.2 Bamboo forest (p1 f02, f06, f15, f17)
1. Backdrop: mid-green wash `#4d7f3a`.
2. Bamboo layers: repeated culms — far layer desaturated `#5e8f46`, near layer brighter `#77b04a`
   with node rings darker `#31541f`; leaf clusters top vignette `#1f3b16`.
3. Ground: moss mounds `#3f6b2e` + stone lanterns/rocks pale grey.
4. Foreground: occasional dark culm occluder.

### 2.3 Teal misty forest (p1 f46, f48, f55, f62, f76; p2 f14, f39, f74)
1. Fog backdrop: flat teal `#4d8f8b`.
2. Bare trunks, 3 depths: far `#3f6f6d`, mid `#2f5150`, near `#1d3230` (near ones thick, cross
   the full frame height).
3. Undergrowth band: near-black green `#122019` with bush blobs + pale rocks `#9aa79b`.
4. Foreground occluder trunk: near-black `#0e1a17`, passes IN FRONT of fighters.
5. Optional mossy ruins: desaturated stone `#6f7f6a` blocks with vine drapes.

### 2.4 Mountain path / mine wall (p1 f12, f23; p2 f3, f18, f38, f76)
1. Wall of huge hand-drawn rounded stones filling the frame: khaki `#8f8f63`, shadow `#6b6b47`,
   black seams; occasional grass tufts `#a3a534` sprouting between stones.
2. Wooden posts `#4a3418` + rope fences, signposts.
3. Ground: dark green verge `#2c421f` with grass blades.
4. **Mine interior** variant: same stones darkened `#5f5f40`, timber frames + crossbeams,
   props: barrels, crates, chests, jars, tables (sepia woods `#6d4a24`).

### 2.5 Dungeon (p1 f27–29, f63; p2 f40–42, f50, f68)
1. Brick wall: blue-grey bricks `#3c434c` (cellar variant) or dark navy `#2b3038`, black mortar.
2. Timber posts with iron bands, wall lanterns (warm dot glows).
3. Floor: dark stone `#23262b`; props: barrels, chests.

### 2.6 Town exterior (p1 f22, f33, f34, f70, f72; p2 f27)
1. Sky: pale grey-green haze `#c9d2bf`; distant rooftops flat `#93a191`.
2. Buildings: white/cream plaster `#ece7da` (some blush-tinted `#e8d9d2`), charcoal tile roofs
   `#2e2f33` with ridge caps, dark timber frames/lattices `#3a2c1c`, noren curtains, kanji-board
   signs (our own marks), paper windows warm `#e8dfb8`.
3. Street: grey-green `#4c5443`; stone bases, crates.
4. Castle-town gates: gold-capped columns `#c9a53e` + white walls (p2 f12, f13);
   castle outer walls: long **red-tiled wall band** `#7c2a20` w/ white body (p2 f29–31).

### 2.7 Interiors (p1 f05, f10, f21, f43–45; p2 f19, f25, f34, f36, f37)
- Inn/den: mustard walls `#c2a13c`, ink-wash mural panels (pale grey-blue `#b9c4c4` landscape
  strokes) and blossom panels (pink `#d9a8a8`), dark beams `#2c2318`, floor `#1f1a12`,
  hanging lanterns warm `#e8c76a`.
- Dojo/training hall: shoji grids (cream `#efe8d2` cells + dark lattice), timber columns,
  vertical kanji scrolls, weapon racks; long corridor variant for indoor fights.
- Night variant: same but darkened w/ lantern pools of light (p2 f36).

### 2.8 Others
- **Beach duel** (p1 f37, f38): blue sky `#9fc7e8`, white cumulus, pale sea `#b9d6d8`,
  grass-capped rock stacks `#c8bd9a`, dark green shore band.
- **Dusk** (p1 f39, f52; p2 f22): peach-cream sky gradient `#f2d9b0 → #e8b98a`, blue-purple
  mountain layers `#7a86a0 / #5b6784`, dark tree silhouettes.
- **Trap hall** (p2 f6): dojo corridor + kunai/shuriken volleys.

## 3. Characters (recreated rigs — same archetypes, our own drawings)

- **Player**: wide conical straw kasa (tan `#bb9450`, dark underside), kimono layers (start:
  ragged cream; later navy haori over white hakama), sword sheathed at hip / carried over
  shoulder when idle in town; runs with forward lean, hat bobs, garment/scarf trails.
  ~110px tall in exploration, ~170px in combat (at 1024×576).
- **Bandits**: ragged grey/white gi, bare heads or headbands.
- **Soldiers**: tan/gold lamellar armor, conical jingasa, some with shields; **elites** in full
  plate + masks (armor escalates, p2 f37).
- **Ninja**: black garb (p2 f48).
- **NPCs**: townsfolk in muted kimonos; unique large **dialogue portraits** (waist-up, anime-flat,
  bold outlines) for named characters.
- **Animals**: deer, dogs (p2 f50).
- Name label above head: small caps + black outline; gold=player, blue=NPC, red=hostile
  `NAME (LVL)`; enemy HP = 60×6px green bar under the label.

## 4. Combat FX

| FX | Behavior (observed) |
|---|---|
| Slash arc | Fat tapered crescent along the drawn stroke; lighter core + weapon-colored body (steel `#d8dee2`, blue `#3fa8e8`, red `#c03030`); hangs ~200ms, fades. Doubles as the drawn-line render. |
| Blood | Bright red `#c81a10` directional burst along cut vector; droplets arc with gravity; **dark pools `#5f0d08` spread under corpses and persist**; spatter sticks to ground. |
| Loot | Coins (gold discs) + item papers (white rects) pop out with tumble physics, settle, twinkle. |
| Finisher flash | Whole scene → black silhouettes over flat red `#b01510` for a beat; interiors keep window shapes as red bands (p2 f35). Distinct from YOU WIN. |
| Combo counter | Top-right: big red brush numeral (~48px) + "HIT COMBO" small white caps; pause icon beside. |
| Damage boost | "150% DAMAGE MM:SS" gold caps, bottom-right above hotbar (timed buff). |
| Telegraphs | Enemy attacks show windup poses; spear thrust draws a thin red line (p2 f68). |

## 5. HUD — exploration mode (positions at 1024×576, ±8px)

- **Coins plate** (16,10 → ~180,52): dark plate, mallet icon, count, "COINS" label; beside it
  **gold plate** (coin icon, count, "GOLD"), then a small red `GET GOLD`-slot (we repurpose:
  gold is earn-only).
- **Location banner** (16,~62): black rounded bar, double gold outline, cream brush caps
  ("W KASUTA FOREST"); below: quest tracker lines — gold `STORY QUEST:` + cream text on
  translucent dark strips; side-quests listed under.
- **XP top-right**: gold shield **level badge** + long thin bar plate `12756 / 16350` +
  "EXPERIENCE POINTS" label (fill = gold).
- **Minimap** (~790,60 → 1008,268): ornate gold frame, dark field, compass letters N/E/S/W on the
  rim, grid of sector cells w/ icons (rooms/buildings/arrows/X), gold highlight on current cell;
  beneath: cream plates `TERRITORY (21,51)` / `SECTOR (2,3)` (or `INSIDE SECTOR (3,0)`).
- **Portrait bottom-left** (10,~468 → 120,568): painted bust in dark gold-trimmed rounded frame;
  right of it stacked bars (~150×12 each): HP green `x/y`, Chi blue `x/y` (+AP teal when present),
  small white outlined numerals centered; **stance label** small caps under bars
  ("HEAVY STANCE"); red star button beside when stat points available.
- **Hotbar** along bottom (~350 → 1010, y≈536): ~9 round dark slots — chat `…`, food, yin-yang,
  rack, scroll, stones, ninja mask, red envelope, **gear** (settings, far corner).
- Interaction prompts: floating gold arrow + label over exits ("KASUTA FIELD (E)"), `SEARCH BUSH
  2 AP` plates, signposts w/ direction letters.

## 6. HUD — combat mode

- Top-left: `AUTO SLASH OFF` pill + chat bubble button. Top-right: pause + combo counter (§4).
- Bottom-left: portrait + bars as above; third bar appears; red caps status text under bars:
  `CANNOT CHANGE STANCE` when locked; `150% DAMAGE` gold below-right.
- Bottom-right: **3 square skill slots** (dark, gold-numbered 1/2/3, item icons) + gold
  **up-arrow flee** button.
- No hotbar strip; exploration top-left plates (coins/quests) hidden during duels-only arenas
  (retained in open-world scraps).

## 7. Screens & panels (shared chrome)

- **Panel chrome**: near-black interior on a **maroon-brown mottled backdrop** (`#3a1710` base,
  lighter smoke swirls, black character-silhouette overlay right side); thin gold/tan borders;
  ornate gold corner flourishes on modals; title top-left in gold brush caps (`PLAYER`, `SKILLS`,
  `QUESTS`, `BUY`, `SELL`, `TOURNAMENTS`); red X close button top-right.
- **Buttons**: deep red rounded rects `#8f1f10` w/ thin gold border + cream caps (`OK`, `YES`,
  `EQUIP`, `DROP`, `BUY`, `SELL`, `TAKE ME THERE`, `FINISH QUEST`, `ABANDON QUEST`, `JOIN CLAN`).
- **Item tiles**: rounded-square stone-grey tiles, **rarity border** (grey/green/blue/purple),
  price tag (count + coin icon) bottom-right of tile; selected = brighter frame.
- **Player screen**: left paper-doll with 12 equipment slots around the standing figure; right:
  item detail (name in rarity color, `DMG: 1 - 3 (EQ: …)` lines — bonuses green, minus red,
  `LEVEL n` badge, `CONDITION:` line) over inventory grid + `WEIGHT: 99 / 100` (red when over).
  STATS tab: HP/CHI/AP bars w/ red `+` buttons; ATK/DEF/SPD numbers w/ green `+n` gear bonuses.
- **Skills screen**: left detail (icon, name, effect, CURRENT/NEXT LEVEL, `CHI COST`, `COOLDOWN`,
  red `REQUIRED SKILL POINTS: n`), right icon grid + `CATEGORIES`; bottom `SKILLS EQUIPPED` row +
  `EQUIP SKILL`.
- **Quest log**: left column of quest name buttons; right OBJECTIVE/LOCATION/REWARD +
  `TAKE ME THERE` (costs gold); expiry note lines; bottom NOTE strip.
- **Modals**: `YOU RECEIVED` (icon + XP/coin lines), `GLOBAL EFFECT` (`TOWN PROSPERITY: +5`,
  red faction-influence line), plain-message boxes — all on the mottled panel w/ gold corners +
  red OK.
- **World map**: parchment tan; grid of rounded-square territory tiles (brown), building icons,
  colored clan flags, black splat = destroyed; bottom legend strip; **vertical indigo cloth
  scroll** on the right edge w/ white vertical letters (`WORLD MAP`) + seigaiha wave trim;
  `ZOOM OUT` button.
- **War Room clan select**: same parchment + crest roundels; red-framed clan card + `JOIN CLAN`.
- **Dialogue**: bottom strip (full width, ~136px tall) — dark box, thin gold frame, name plate
  banner overlapping top-left; cream all-caps text; **choice rows** = stacked strips, hovered one
  filled blood-red; player bust portrait in a rounded frame at bottom-right; large speaker
  portrait rises from mid-screen for named NPCs; advance arrow ▶ bottom-right.
- **Story cards**: mottled maroon bg + tan brush caps paragraphs, centered; silhouette right.
- **Loading/title**: black field; small white brush caps kicker ("…SAMURAI"), huge red dry-brush
  title word, "LOADING…", white TIP line at the very bottom. (Our title: **IAIDO DUEL** in the
  same typographic role — we do not ship the original title/logo.)
- **YOU WIN anatomy**: flat red `#b01510`; bottom 12% = black ground silhouette with grass nicks
  and debris mounds; 1–3 black fighter-pose silhouettes (victory poses vary); title = tall
  condensed brush caps, red fill + white outline, sitting on an irregular black ink splat with
  drips; slight letter rotation jitter.

## 8. Typography (recreate matching faces — never ship the originals)

- **Display**: rough dry-brush caps, heavy, slightly irregular baseline — used for the title,
  YOU WIN, combo numerals, panel titles (gold), location banners.
- **Body**: compact hand-printed caps w/ black outline (HUD numbers, dialogue, quest text) —
  reads like a comic-lettering face; cream `#efe4c8` on dark.
- Candidates to *recreate the role* (own-render, open-licensed): a dry-brush display face +
  a comic-caps body face, tuned until the §F typography tell passes.

## 9. Camera & motion notes

- Exploration: camera leads the player slightly; parallax ratios ≈ sky 0 / far 0.1–0.2 /
  mid 0.4–0.6 / ground 1.0 / foreground occluder 1.15–1.3.
- Combat: mostly locked while in exchange range; zooms out a touch when separated; screen-shake
  on heavy hits; slow-mo + red flash on finisher.
- Travel pans: letterbox bars in, camera pans across the strip, bars out.
- Secondary motion everywhere: hat bob, garment/scarf trail, grass sway, cloud streak drift,
  lantern flicker.

## 10. Gap-fix priority (visual-impact order for the overhaul)

1. Biome kits §2 (field + teal forest + bamboo first) with vignette, parallax, occluders.
2. Combat FX §4 (weapon-colored crescents, blood pools/corpse persistence, loot physics,
   finisher flash + YOU WIN anatomy).
3. HUD §5/§6 exactly (corners are load-bearing tells).
4. Panel chrome §7 (player/skills/quests/shop + dialogue framing).
5. Character rig upgrades §3 (armor tiers, NPC variety, portraits).
6. Typography §8 + screens polish (loading, story cards, letterbox pans).
