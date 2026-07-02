// config/palette.ts — single locked hex per key for OUR re-created art (spec §B).
// All values are eyedropped INFERRED seeds calibrated to reference frames; calibration
// may overwrite them. They describe colors WE author — no original asset bytes are shipped.
export const COL = {
  skyTop: 0xd8dbf1,
  skyLow: 0xeceffe,
  forestBright: 0x49a431,
  forestMid: 0x2e922e,
  forestMid2: 0x31a030,
  forestShadow: 0x1d7330,
  forestDark: 0x173012,
  sage: 0x62905e,
  sage2: 0x78a760,
  kimono: 0xf4f3ec, // brighter off-white
  kimono2: 0xe9eddb,
  kimonoShade: 0xccd0c6, // cool grey fold shadow (cel second tone)
  haori: 0x2b3b5e, // navy hooded jacket
  haoriShade: 0x1a2742,
  haoriTrim: 0xb5392f, // red inner lining accent
  obi: 0xd9a93a, // gold sash
  obiShade: 0xa97c22,
  hair: 0x241f1b,
  hatStraw: 0xbb9450, // tan woven kasa
  hatShade: 0x7c5c28,
  wood: 0x794702,
  outline: 0x040304,
  blood: 0xa50103,
  bloodDark: 0x950202,
  cream: 0xefedc2,
  gold: 0xe8a83a,
  healthGreen: 0x5bbf2e,
  focusBlue: 0x3a7fd5,
  skin: 0xe6c2a0,
  skinShade: 0xc79b76,
  blade: 0xcfd6da,
  bladeEdge: 0xeef3f6,
  bladeChi: 0x6fc3e8, // blue chi glow on the katana (from the videos)
  // forest depth eyedropped from the real gameplay frame (teal mist + yellow-green canopy)
  mistTeal: 0x4ba1a4,
  mistTealDeep: 0x337077,
  mistTealDark: 0x143a40,
  canopy: 0x7da443,
  canopyBright: 0x9bc24a,
  trunk: 0x0a2228,
  winRed: 0xc01f29,
  winRedDeep: 0x7e1018,
  haoriEnemy: 0x6b2030, // oxblood haori — the RONIN, distinct from the player's navy
  haoriEnemyShade: 0x47131f,
  // flowing scarf (iconic SHS silhouette element) — warm vermilion, distinct from blood crimson
  scarf: 0xc8472f,
  scarfShade: 0x8f2a1a,

  // ——— ART_DIRECTION.md overhaul palette (2026-07-02 survey). Every key below is
  // INFERRED (survey) — eyedropped from compressed frames, ±JPEG error; hex sources cited
  // per §. All colors describe art WE author. Existing keys above are untouched. ———

  // §2.1 Sage field (p1 f18/f19/f24/f35; p2 f20/f79)
  fieldSkyTop: 0xcfe0c4, // INFERRED (survey §2.1) — pale sage sky gradient, top stop
  fieldSkyLow: 0xe8f0dd, // INFERRED (survey §2.1) — sky gradient, low stop
  fieldCloud: 0xf4f6ea, // INFERRED (survey §2.1) — wavy cream cloud streaks (signature)
  fieldMountain: 0x7d9c82, // INFERRED (survey §2.1) — far muted blue-green ridge
  fieldHill: 0x5c7d54, // INFERRED (survey §2.1) — mid olive hills / tree silhouettes
  fieldDeadTree: 0x121710, // INFERRED (survey §2.1) — near-black dead-tree silhouettes
  fieldGround: 0x2f4a2a, // INFERRED (survey §2.1) — dark green ground band
  fieldGrass: 0x233d20, // INFERRED (survey §2.1) — tall-grass blade clumps
  fieldPost: 0x3d2a16, // INFERRED (survey §2.1) — signposts / fence posts

  // §2.2 Bamboo forest (p1 f02/f06/f15/f17)
  bambooBackdrop: 0x4d7f3a, // INFERRED (survey §2.2) — flat mid-green wash
  bambooCulmFar: 0x5e8f46, // INFERRED (survey §2.2) — far desaturated culms
  bambooCulmNear: 0x77b04a, // INFERRED (survey §2.2) — near brighter culms
  bambooNode: 0x31541f, // INFERRED (survey §2.2) — darker node rings
  bambooLeafTop: 0x1f3b16, // INFERRED (survey §2.2) — leaf-cluster top vignette
  bambooMoss: 0x3f6b2e, // INFERRED (survey §2.2) — ground moss mounds

  // §2.3 Teal misty forest (p1 f46/f48/f55/f62/f76; p2 f14/f39/f74)
  tealFog: 0x4d8f8b, // INFERRED (survey §2.3) — flat teal fog backdrop
  tealTrunkFar: 0x3f6f6d, // INFERRED (survey §2.3) — bare trunks, far depth
  tealTrunkMid: 0x2f5150, // INFERRED (survey §2.3) — trunks, mid depth
  tealTrunkNear: 0x1d3230, // INFERRED (survey §2.3) — trunks, near depth (full frame height)
  tealUndergrowth: 0x122019, // INFERRED (survey §2.3) — near-black green undergrowth band
  tealOccluder: 0x0e1a17, // INFERRED (survey §2.3) — foreground occluder trunk, IN FRONT of fighters
  paleRock: 0x9aa79b, // INFERRED (survey §2.3) — pale rocks in the undergrowth
  mossyRuin: 0x6f7f6a, // INFERRED (survey §2.3) — desaturated ruin stone blocks

  // §2.4 Mountain path / mine (p1 f12/f23; p2 f3/f18/f38/f76)
  stoneKhaki: 0x8f8f63, // INFERRED (survey §2.4) — hand-drawn rounded wall stones
  stoneKhakiShade: 0x6b6b47, // INFERRED (survey §2.4) — stone cel-shadow tone
  stoneGrassTuft: 0xa3a534, // INFERRED (survey §2.4) — grass tufts between stones
  mineStoneDark: 0x5f5f40, // INFERRED (survey §2.4) — mine-interior darkened stones
  minePost: 0x4a3418, // INFERRED (survey §2.4) — wooden posts / timber frames
  mineProp: 0x6d4a24, // INFERRED (survey §2.4) — sepia prop woods (barrels/crates/chests)
  mineVerge: 0x2c421f, // INFERRED (survey §2.4) — dark green ground verge

  // §2.5 Dungeon (p1 f27–29/f63; p2 f40–42/f50/f68)
  dungeonBrick: 0x3c434c, // INFERRED (survey §2.5) — blue-grey bricks (cellar variant)
  dungeonBrickNavy: 0x2b3038, // INFERRED (survey §2.5) — dark navy brick variant
  dungeonFloor: 0x23262b, // INFERRED (survey §2.5) — dark stone floor

  // §2.6 Town exterior (p1 f22/f33/f34/f70/f72; p2 f27)
  townSkyHaze: 0xc9d2bf, // INFERRED (survey §2.6) — pale grey-green haze sky
  townRoofline: 0x93a191, // INFERRED (survey §2.6) — distant flat rooftops
  townPlaster: 0xece7da, // INFERRED (survey §2.6) — white/cream building plaster
  townPlasterBlush: 0xe8d9d2, // INFERRED (survey §2.6) — blush-tinted plaster variant
  townRoof: 0x2e2f33, // INFERRED (survey §2.6) — charcoal tile roofs
  townTimber: 0x3a2c1c, // INFERRED (survey §2.6) — dark timber frames / lattices
  townPaperWindow: 0xe8dfb8, // INFERRED (survey §2.6) — warm paper windows
  townStreet: 0x4c5443, // INFERRED (survey §2.6) — grey-green street
  gateGold: 0xc9a53e, // INFERRED (survey §2.6) — gold-capped gate columns (p2 f12/f13)
  castleWallRed: 0x7c2a20, // INFERRED (survey §2.6) — red-tiled castle wall band (p2 f29–31)

  // §2.7 Interiors (p1 f05/f10/f21/f43–45; p2 f19/f25/f34/f36/f37)
  interiorMustard: 0xc2a13c, // INFERRED (survey §2.7) — inn/den mustard walls
  muralWash: 0xb9c4c4, // INFERRED (survey §2.7) — pale grey-blue ink-wash mural panels
  muralBlossom: 0xd9a8a8, // INFERRED (survey §2.7) — pink blossom panels
  interiorBeam: 0x2c2318, // INFERRED (survey §2.7) — dark beams
  interiorFloor: 0x1f1a12, // INFERRED (survey §2.7) — interior floor
  shojiCream: 0xefe8d2, // INFERRED (survey §2.7) — shoji grid cells (dojo)
  lanternGlow: 0xe8c76a, // INFERRED (survey §2.7) — warm hanging-lantern glow

  // §2.8 Beach + dusk (p1 f37/f38, f39/f52; p2 f22)
  beachSky: 0x9fc7e8, // INFERRED (survey §2.8) — blue beach sky
  beachSea: 0xb9d6d8, // INFERRED (survey §2.8) — pale sea
  beachRock: 0xc8bd9a, // INFERRED (survey §2.8) — grass-capped rock stacks
  duskSkyTop: 0xf2d9b0, // INFERRED (survey §2.8) — peach-cream dusk sky, top stop
  duskSkyLow: 0xe8b98a, // INFERRED (survey §2.8) — dusk sky, low stop
  duskMountainFar: 0x7a86a0, // INFERRED (survey §2.8) — blue-purple mountains, far
  duskMountainNear: 0x5b6784, // INFERRED (survey §2.8) — blue-purple mountains, near

  // §4 Combat FX colors (p1 f31/f37/f56/f62/f66; p2 f9/f31/f34/f35/f48)
  arcSteel: 0xd8dee2, // INFERRED (survey §4) — default steel slash-arc body
  arcSteelCore: 0xf3f7f9, // INFERRED (survey §4) — lighter core of the steel arc
  arcBlue: 0x3fa8e8, // INFERRED (survey §4) — blue-katana arc body
  arcBlueCore: 0xc4e8fb, // INFERRED (survey §4) — lighter core of the blue arc
  arcRed: 0xc03030, // INFERRED (survey §4) — sabre arc body
  arcRedCore: 0xf0b0a8, // INFERRED (survey §4) — lighter core of the red arc
  bloodBright: 0xc81a10, // INFERRED (survey §4) — bright directional burst red
  bloodPool: 0x5f0d08, // INFERRED (survey §4) — dark pools spreading under corpses (persist)
  coinGold: 0xe8b93c, // INFERRED (survey §4) — loot coin discs
  lootPaper: 0xf4f2e8, // INFERRED (survey §4) — loot item-paper rects
  finisherRed: 0xb01510, // INFERRED (survey §4/§7) — finisher-flash + YOU WIN flat red field

  // §3/§5 name labels + §7 shared panel chrome
  nameGold: 0xe0b84e, // INFERRED (survey §3) — player floating name label
  nameBlue: 0x6fb4e8, // INFERRED (survey §3) — NPC name label
  nameRed: 0xd8362a, // INFERRED (survey §3) — hostile name label `NAME (LVL)`
  panelMaroon: 0x3a1710, // INFERRED (survey §7) — mottled panel backdrop base
  panelMaroonSwirl: 0x57291b, // INFERRED (survey §7) — lighter smoke-swirl tone on the backdrop
  panelInk: 0x120a08, // INFERRED (survey §7) — near-black panel interior
  goldTrim: 0xc7a44e, // INFERRED (survey §7) — thin gold/tan borders + corner flourishes
  buttonRed: 0x8f1f10, // INFERRED (survey §7) — deep red rounded buttons (OK/BUY/…)
  chromeCream: 0xefe4c8, // INFERRED (survey §7/§8) — cream caps text on dark chrome
  rarityGrey: 0x8f9497, // INFERRED (survey §7) — item rarity border, common
  rarityGreen: 0x3fae4a, // INFERRED (survey §7) — rarity, uncommon
  rarityBlue: 0x3f7fd8, // INFERRED (survey §7) — rarity, rare
  rarityPurple: 0x8f4fd8, // INFERRED (survey §7) — rarity, epic
  choiceHoverRed: 0xa01812, // INFERRED (survey §7) — dialogue choice row fill on hover
  vignetteBlack: 0x000000, // INFERRED (survey §1/tell 2) — top-edge vignette / letterbox bars
} as const;
