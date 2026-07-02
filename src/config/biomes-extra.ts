// config/biomes-extra.ts — geometry/animation constants for the §2 biome painters living in
// src/game/background/** (biome-surface owned). ART_DIRECTION.md §2 kits, §9 parallax,
// tell #2 (top vignette), tell #3 (foreground occluders). NOT in the config barrel
// (index.ts is frozen) — import directly:
//   import { BGK, FIELD, ... } from '../../config/biomes-extra';
// Every value is INFERRED (survey) — measured by eye from the cited reference frames at
// 1024×576 (±8px, ±JPEG error); calibration may overwrite. Colors stay in config/palette.ts.

// ——— shared kit plumbing ———
export const BGK = {
  overscan: 120, // draw past both edges so parallax drift never exposes a seam (Forest.ts convention)
  groundDefaultOffset: 96, // default groundY = GAME_H − this (matches the scenes' GROUND_Y)
  skyPadTop: 20, // backdrops start slightly above y=0 (Forest.ts convention)
  skyPadBelowGround: 80, // …and run past groundY (Forest.ts convention)
  depth: {
    // background slots follow Forest.ts's proven −20…−3 map (fighters sit at depth 0)
    backdrop: -20,
    sky: -19,
    far: -16,
    farB: -14,
    mid: -10,
    near: -8,
    ground: -5,
    detail: -4,
    particles: -3,
    occluder: 6, // tell #3: ABOVE fighters (0) + gore decals (5); below Title chrome (10+) / trail (50)
    vignette: 85, // tell #2: above the scene + FX, below the HUD (100)
  },
  rng: { mul: 48271, mod: 2147483647 }, // Lehmer MINSTD — deterministic per-biome layout jitter
  outlinePx: 3, // §1 chunky prop outline (~2px at 1024w reads thin; matches drawFighter's ow=3)
  outlineAlpha: 0.85, // §1 — outlines soften slightly against the painted layers
  vignettePasses: 3, // stacked h/h2/h4 gradient passes → ~solid-black top edge (tell #2)
} as const;

// Ground band — Forest.ts's proven offsets (fighters read as standing on the band edge).
export const GROUND_BAND = {
  topOffset: 52, // band edge sits this far below the fighters' groundY
  edgeH: 6,
  shadeOffset: 10, // inner shade strip offset below the edge
  shadeH: 10,
  shadeAlpha: 0.5,
} as const;

// Drifting-leaf particles (bamboo + teal forest) — Forest.ts's shipped values.
export const LEAF_FX = {
  texColor: 0xffffff, // white base so emitter tints color it
  texW: 10,
  texH: 6,
  texCx: 5,
  texCy: 3,
  texRw: 10,
  texRh: 5,
  spawnY: -10,
  lifespanMs: 9000,
  freqMs: 520,
  speedYMin: 12,
  speedYMax: 30,
  speedXMin: -14,
  speedXMax: 14,
  scaleMin: 0.6,
  scaleMax: 1.2,
  alphaMin: 0.25,
  alphaMax: 0.6,
  rotMax: 360,
} as const;

// Foreground occluders — tell #3: dark trunk/culm/post crossing the frame IN FRONT of fighters.
export const OCCLUDER = {
  seed: 97,
  xFracs: [0.68, 0.14, 0.9], // screen-width anchors for the 1st/2nd/3rd occluder
  leanPx: 30, // top-edge lean so trunks aren't dead vertical (p2 f14)
  darkenAlpha: 0.42, // tell #3: occluders read darker than their layer kin (p1 f18/f62)
  rootFlareFrac: 1.4, // trunks widen at the root (p1 f62)
  ringGap: 96, // culm node-ring spacing (p1 f12 right-edge culm)
  ringJitter: 0.35,
  ringH: 7,
  ringAlpha: 0.4,
  branch: { yFrac: 0.28, len: 110, rise: 60, wFrac: 0.3 }, // one bare branch off a trunk occluder
  postBeam: { yFrac: 0.16, len: 150, h: 18 }, // mine timber: crossbeam stub near the top
} as const;

// Shared prop geometry (signposts appear in field/bamboo/stone-path frames: p1 f12/f18/f15).
export const SIGNPOST = {
  postW: 9,
  postH: 84,
  boardTopOffset: 6,
  boardW: 58,
  boardH: 17,
  boardGap: 7,
  tipPx: 12, // pointed arrow end of each board
  dashW: 12,
  dashH: 4,
  dashGap: 7,
  dashAlpha: 0.9, // gold letter-marks stand-in (we never copy the original glyphs)
} as const;

// Stone lantern (pale grey — bamboo grove prop, p1 f18).
export const LANTERN = {
  baseW: 42,
  baseH: 10,
  pillarW: 13,
  pillarH: 24,
  boxW: 30,
  boxH: 24,
  windowW: 9,
  windowH: 12,
  windowAlpha: 0.9,
  roofW: 48,
  roofH: 14,
  capR: 5,
} as const;

// Pale rocks (teal undergrowth / bamboo floor — p2 f14, p1 f18).
export const ROCK = {
  hFrac: 0.62, // height as a fraction of width
  sink: 6, // settles into the ground band
  shadeAlpha: 0.28,
  shadeWFrac: 0.85,
  shadeHFrac: 0.5,
  shadeDyFrac: 0.18,
} as const;

// ——— §2.1 sage field (p1 f18/f19/f24/f35; p2 f20/f79) ———
export const FIELD = {
  seed: 7,
  cloud: {
    parallax: 0.05,
    swayAmpPx: 16, // §9 "cloud streak drift" — slow horizontal sway
    swayRadPerMs: 0.00019,
    alpha: 0.9,
    stepX: 44,
    blobW: 130,
    blobH: 34,
    waveAmpPx: 10, // the signature WAVY baseline
    waveLen: 150,
    streaks: [
      { yFrac: 0.12, x0Frac: -0.08, wFrac: 0.68 },
      { yFrac: 0.23, x0Frac: 0.36, wFrac: 0.72 },
      { yFrac: 0.32, x0Frac: -0.02, wFrac: 0.48 },
    ],
  },
  ridge: { yFrac: 0.46, peakCount: 9, peakHMin: 22, peakHMax: 54, valleyH: 14 }, // gentle ridge, not alpine peaks (§2.1 "flat ridge")
  hills: { yFrac: 0.62, count: 3, wMin: 460, wMax: 780, h: 190, jitterX: 90 },
  trees: {
    count: 4,
    hMin: 84,
    hMax: 138,
    w: 10,
    jitterX: 110,
    footLift: 14,
    branchPx: 5,
    branchLen: 40,
    branchRise: 30,
    branchY1Frac: 0.72, // branch heights up the trunk
    branchY2Frac: 0.5,
  },
  grass: { clumps: 16, bladesMin: 3, bladesMax: 6, hMin: 12, hMax: 26, w: 5, spreadPx: 10 },
  signXFracs: [0.2, 0.78],
  fence: { x0Frac: 0.42, count: 4, gap: 52, postW: 9, postH: 38, ropeDrop: 8, ropeSag: 8, ropePx: 3, ropeSegs: 6 },
} as const;

// ——— §2.2 bamboo forest (p1 f02/f06/f15/f17/f18) ———
export const BAMBOO = {
  seed: 11,
  washTopAlpha: 0.55, // leaf mass reads darker toward the top (p1 f06)
  washTopFrac: 0.4,
  far: { count: 12, wMin: 10, wMax: 17, jitterX: 60, nodeGap: 74, nodeGapJitter: 0.3, nodeH: 4, nodeAlpha: 0.4, sheenAlpha: 0, sheenFrac: 0 },
  near: { count: 8, wMin: 20, wMax: 32, jitterX: 90, nodeGap: 92, nodeGapJitter: 0.3, nodeH: 6, nodeAlpha: 0.9, sheenAlpha: 0.16, sheenFrac: 0.3 },
  canopyParallax: 0.35,
  canopy: {
    rowY: 26,
    rowJitterY: 22,
    stepX: 56,
    rMin: 36,
    rMax: 68,
    droopCount: 5,
    droopSteps: 4,
    droopStepFrac: 0.7, // each droop blob descends by r*this
    droopShrink: 0.72, // …and shrinks by this
    leafCount: 26,
    leafBandY: 40,
    leafBandH: 130,
    leafLen: 26,
    leafW: 9,
    leafAlpha: 0.95,
  },
  moss: { count: 6, wMin: 90, wMax: 210, hFrac: 0.5, sink: 14, jitterX: 70, shadeAlpha: 0.35, shadeWFrac: 0.8, shadeHFrac: 0.55, shadeDxFrac: 0.1, shadeDyFrac: 0.2 },
  lanternXFrac: 0.3,
  rockXFracs: [0.62, 0.86],
  rockW: 36,
  grass: { clumps: 12, bladesMin: 3, bladesMax: 5, hMin: 10, hMax: 20, w: 4, spreadPx: 8 },
} as const;

// ——— §2.3 teal misty forest (p1 f46/f48/f55/f62/f76; p2 f14/f39/f74) ———
export const TEAL = {
  seed: 23,
  fogBandYFrac: 0.38, // lighter fog band mid-frame (p1 f46)
  fogBandH: 150,
  fogBandAlpha: 0.16,
  far: { count: 9, wMin: 8, wMax: 15, jitterX: 70, topWFrac: 0.7, leanPx: 14, stubCount: 2, stubLen: 26, stubDrop: 10, stubPx: 4, clumpChance: 0.25, clumpN: 2, clumpR: 18 },
  mid: { count: 6, wMin: 16, wMax: 28, jitterX: 100, topWFrac: 0.72, leanPx: 20, stubCount: 2, stubLen: 34, stubDrop: 14, stubPx: 6, clumpChance: 0.6, clumpN: 3, clumpR: 26 },
  near: { count: 4, wMin: 34, wMax: 56, jitterX: 150, topWFrac: 0.75, leanPx: 26, stubCount: 1, stubLen: 46, stubDrop: 18, stubPx: 9, clumpChance: 0.7, clumpN: 4, clumpR: 34 },
  clumpYMinFrac: 0.16, // foliage clusters hang in the upper-mid frame
  clumpYMaxFrac: 0.5,
  foliageAlpha: 0.92,
  under: { bushRMin: 16, bushRMax: 42, stepX: 46, topLift: 34 }, // bush blobs rise above the band edge
  rocks: { xFracs: [0.18, 0.55, 0.84], wMin: 30, wMax: 62 },
  ruin: { xFrac: 0.7, blockW: 50, blockH: 26, tiers: 2, round: 4, mossAlpha: 0.7, mossH: 6 },
} as const;

// ——— §2.4 stone-wall path + mine interior (p1 f12/f23/f80; p2 f3/f18/f38/f76) ———
export const STONE = {
  seed: 31,
  rows: 5,
  stoneWMin: 78,
  stoneWMax: 160,
  seamPx: 4, // black seams between the hand-drawn stones
  seamBgAlpha: 0.92,
  round: 16,
  shadeH: 26, // cel-shade band along each stone's bottom
  shadeAlpha: 0.45,
  wallBottomPad: 20,
  jiggleY: 5, // per-stone vertical wobble so courses read hand-drawn
  tufts: { count: 9, bladesMin: 3, bladesMax: 5, hMin: 10, hMax: 18, w: 4, spreadPx: 9 },
  signXFrac: 0.16,
  fence: { x0Frac: 0.56, count: 4, gap: 54, postW: 9, postH: 40, ropeDrop: 9, ropeSag: 7, ropePx: 3, ropeSegs: 6 },
} as const;

export const MINE = {
  seed: 41,
  rows: 6,
  stoneWMin: 58,
  stoneWMax: 116,
  shadeAlpha: 0.3, // darker interior — shade with black, not khaki
  door: { xFrac: 0.42, w: 100, h: 130, lintelH: 16, lintelOverhang: 14, postW: 12 },
  beams: { xFracs: [0.12, 0.62, 0.9], w: 15, capW: 34, capH: 12, topBeamY: 34, topBeamH: 13 },
  props: {
    xFracs: [0.08, 0.26, 0.55, 0.72, 0.95], // barrels/crates/chests/jars along the wall (p1 f80)
    barrel: { w: 38, h: 48, round: 8, bandPx: 3, bandAlpha: 0.7, lidH: 9 },
    crate: { w: 44, plankPx: 3, plankAlpha: 0.55, inset: 6 },
    chest: { w: 56, h: 24, lidH: 15, round: 6, latchW: 8, latchH: 10 },
    urn: { w: 32, h: 38, neckW: 15, neckH: 8, sheenAlpha: 0.18, sheenYFrac: 0.66 },
  },
  floor: { plankLineAlpha: 0.4, plankRowGap: 14, seamGapX: 130, seamLen: 10 },
} as const;
