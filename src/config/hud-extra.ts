// config/hud-extra.ts — HUD-surface style keys (ART_DIRECTION.md §5/§6), owned by the
// HUD rebuild. Extends the phase-seeded HUD_EXPLORE / HUD_COMBAT / NAME_LABEL geometry
// in config/layout.ts with the fine-grain knobs (radii, borders, alphas, glyph geometry,
// stub data) the redrawn chrome needs. Every value is INFERRED (survey) — read off the
// §5/§6 reference frames at 1024×576, ±JPEG error — unless marked otherwise.
// NOT in the config barrel (index.ts is frozen): import from '../../config/hud-extra'.

/** Int color → CSS hex string for Phaser Text styles (config-side so game/ stays literal-free). */
export const hexCss = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

// The existing build's HUD depths (graphics under text), kept as named keys.
export const HUD_DEPTH = { gfx: 100, text: 101 } as const;

// Colors the HUD needs that COL (config/palette.ts — another surface's file) does not carry.
export const HUD_COL = {
  white: 0xffffff, // INFERRED (survey §5) — bar numerals / HIT COMBO caps
  slotFill: 0x1d1a14, // INFERRED (survey §5/§6) — hotbar + skill slot interior
  slotRing: 0x4a443a, // INFERRED (survey §5/§6) — slot rim grey
  slotShade: 0x2a251d, // INFERRED (survey §5) — slot inner shade tone
  barBack: 0x222018, // matches the existing build's bar inset (INFERRED)
  mapField: 0x14110b, // INFERRED (survey §5) — minimap dark field
  mapGrid: 0x4a4430, // INFERRED (survey §5) — minimap sector grid lines
  bustBg: 0x241d14, // INFERRED (survey §5) — portrait painted-bust backdrop
} as const;

// Shared plate/banner chrome (§5 tell #6 — black plates, gold trim, rounded corners).
export const HUD_CHROME = {
  radius: 8, // INFERRED (survey §5) — rounded corner radius on plates/banners
  borderW: 2, // INFERRED (survey §5) — gold border width
  borderAlpha: 0.9, // INFERRED (survey §5)
  bannerInnerInset: 4, // INFERRED (survey §5) — location banner DOUBLE gold outline inset
  plateAlpha: 0.94, // INFERRED (survey §5) — dark plate fill alpha
  stripAlpha: 0.55, // INFERRED (survey §5) — translucent quest-tracker strips
  textPad: 8, // INFERRED (survey §5) — inner text padding on strips/plates
} as const;

// Top-left coins/gold plate interiors (§5: icon left, count, tiny caps label under).
export const HUD_PLATE = {
  iconCx: 24, // INFERRED (survey §5) — icon center from plate left
  valueX: 46, // INFERRED (survey §5) — count text left edge
  valueDy: 14, // INFERRED (survey §5) — count line center from plate top
  labelDy: 31, // INFERRED (survey §5) — "COINS"/"GOLD" label line center
  coinR: 8, // INFERRED (survey §5) — gold coin icon radius
  malletW: 14, // INFERRED (survey §5) — coins-plate mallet icon head width
  malletH: 9, // INFERRED (survey §5) — mallet head height
  malletHandle: 13, // INFERRED (survey §5) — mallet handle length
} as const;

// Text sizes/paddings beyond config/typography.ts FONT_SIZE (HUD micro-type).
export const HUD_TEXT = {
  small: 9, // INFERRED (survey §5) — tiny caps labels (COINS / EXPERIENCE POINTS)
  plateValue: 15, // INFERRED (survey §5) — plate count numerals
  mapLabel: 11, // INFERRED (survey §5) — TERRITORY/SECTOR plates
  compass: 11, // INFERRED (survey §5) — minimap rim N/E/S/W letters
  stance: 12, // INFERRED (survey §5) — stance caps under the bars
  status: 11, // INFERRED (survey §6) — red CANNOT CHANGE STANCE caps
  slotNumber: 13, // INFERRED (survey §6) — gold numerals over skill slots
  level: 17, // INFERRED (survey §5) — numeral on the gold level shield
  buff: 12, // INFERRED (survey §4/§6) — gold 150% DAMAGE caps
  questGap: 4, // INFERRED (survey §5) — vertical gap between quest strips
} as const;

// Bar rendering (shared HP/Chi/XP/name-label bars).
export const HUD_BARS = {
  outlineAlpha: 0.7, // matches the existing build's bar outline alpha (INFERRED)
  pad: 2, // INFERRED — dark outline pad around the fill
} as const;

// §5 XP plate top-right: gold shield level badge + long thin gold-fill bar.
export const HUD_XP = {
  fillInset: 2, // INFERRED (survey §5) — gold fill inset inside the plate
  labelDy: 6, // INFERRED (survey §5) — EXPERIENCE POINTS label gap under the bar
  // Shield silhouette as (x,y) fractions of the badge box, top-left origin.
  shieldPts: [
    [0, 0.12],
    [0.5, 0],
    [1, 0.12],
    [1, 0.6],
    [0.5, 1],
    [0, 0.6],
  ] as ReadonlyArray<readonly [number, number]>, // INFERRED (survey §5)
  shieldNumFrac: 0.42, // INFERRED (survey §5) — level numeral center, fraction of badge height
} as const;

// §5 ornate minimap panel (gold rim, compass letters, sector grid; stub data for now).
export const HUD_MINIMAP = {
  rimW: 3, // INFERRED (survey §5) — outer gold frame stroke
  rimInset: 6, // INFERRED (survey §5) — inner gold line inset (ornate double frame)
  knobR: 4, // INFERRED (survey §5) — gold corner/edge knobs
  fieldInset: 16, // INFERRED (survey §5) — dark grid field inset from the frame
  cols: 6, // INFERRED (survey §5) — sector grid columns
  rows: 5, // INFERRED (survey §5) — sector grid rows
  gridAlpha: 0.35, // INFERRED (survey §5)
  iconPad: 5, // INFERRED (survey §5) — cell icon inset
  iconSeedA: 7, // deterministic stub-icon scatter seeds (fake data for now)
  iconSeedB: 3,
  iconMod: 5,
  highlightC: 3, // INFERRED (survey §5) — current-cell gold highlight (stub position)
  highlightR: 2,
  highlightAlpha: 0.2, // INFERRED (survey §5)
  markerR: 5, // INFERRED (survey §5) — player marker in the highlight cell
  compassInset: 9, // INFERRED (survey §5) — N/E/S/W letters inset from the frame edge
} as const;

// §5 portrait painted-bust placeholder, offsets from the portrait frame center.
export const HUD_BUST = {
  inset: 6, // INFERRED (survey §5) — bust field inset inside the gold-trimmed frame
  headR: 15, // INFERRED (survey §5)
  headDy: -2,
  hatW: 64, // INFERRED (survey §5) — kasa brim width
  hatH: 16,
  hatDy: -16,
  hatRise: 20, // INFERRED (survey §5) — kasa cone apex above the brim
  shoulderW: 76, // INFERRED (survey §5)
  shoulderH: 30,
  shoulderDy: 30,
} as const;

// §5 hotbar slot glyphs (round dark slots ending in a gear) — pixel sizes at slot scale.
export const HUD_GLYPH = {
  slotRingW: 2, // INFERRED (survey §5)
  chatDots: 3, // INFERRED (survey §5) — the `…` chat slot
  chatDotR: 3,
  chatDotGap: 8,
  bunW: 24, // INFERRED (survey §5) — food bun
  bunH: 16,
  yinR: 11, // INFERRED (survey §5) — yin-yang disc
  yinDotR: 3,
  yinDotOff: 5,
  rackW: 24, // INFERRED (survey §5) — weapon rack
  rackH: 16,
  rackBarH: 3,
  scrollW: 26, // INFERRED (survey §5) — scroll
  scrollH: 12,
  scrollEndR: 4,
  stoneCount: 3, // INFERRED (survey §5) — sharpening stones
  stoneR: 5,
  stoneSpread: 7,
  maskW: 20, // INFERRED (survey §5) — ninja mask
  maskH: 16,
  maskEyeW: 6,
  maskEyeH: 3,
  envW: 24, // INFERRED (survey §5) — red envelope
  envH: 16,
  gearR: 12, // INFERRED (survey §5) — settings gear, far corner
  gearTeeth: 8,
  gearToothR: 3.5,
  gearHoleR: 4,
} as const;

// §6 combat-mode chrome details.
export const HUD_COMBAT_STYLE = {
  pauseBarW: 5, // INFERRED (survey §6) — pause icon bars
  pauseBarH: 18,
  pauseBarGap: 5,
  bubbleTail: 7, // INFERRED (survey §6) — chat bubble tail
  bubbleDotR: 2.5,
  slotRadius: 8, // INFERRED (survey §6) — square skill-slot corner radius
  slotNumDy: 4, // INFERRED (survey §6) — gold numeral gap above each slot
  arrowHeadW: 22, // INFERRED (survey §6) — gold flee up-arrow head
  arrowHeadH: 14,
  arrowStemW: 9,
  arrowStemH: 14,
  comboPulseScale: 1.35, // matches the existing build's combo pulse feel (INFERRED)
  comboPulseMs: 160,
} as const;

// Stub HUD data (fake-for-now per the §5 minimap/plates spec) — replaced by real
// game-state wiring in a later phase. Strings are our own prose.
export const HUD_FAKE = {
  coins: 244, // INFERRED (survey §5) — plausible plate count
  gold: 3,
  xpCur: 613, // INFERRED (survey §5)
  xpMax: 8350,
  level: 5,
  hpCur: 20, // INFERRED (survey §5) — explore-mode default bars
  hpMax: 20,
  chiCur: 10,
  chiMax: 10,
  territory: '21,51', // INFERRED (survey §5) — TERRITORY (21,51) plate stub
  sector: '2,3', // INFERRED (survey §5) — SECTOR (2,3) plate stub
  location: 'W KASUTA FOREST', // location banner stub
  quest: 'STORY QUEST: SPEAK TO THE RONIN AT THE DOJO', // quest tracker stub
  stance: 'HEAVY', // INFERRED (survey §5) — default stance caps
} as const;
