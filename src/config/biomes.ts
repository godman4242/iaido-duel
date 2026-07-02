// config/biomes.ts — per-biome background layer descriptors for ART_DIRECTION.md §2 biome
// kits, §9 parallax ratios, tell #2 (top vignette) and tell #3 (foreground occluders).
// Every number here is INFERRED (survey) — measured by eye from reference frames, ±8px at
// 1024×576; calibration may overwrite. Colors are COL keys so the palette stays the single
// hex source. NOT in the config barrel (index.ts is frozen): import from 'config/biomes'.
//
// NOTE on parallax: ratios are the §9 camera-relative values (sky 0 … occluder >1). The
// current Forest.ts uses layer-offset parallax (camera never scrolls) — in that mode multiply
// each ratio by BIOME_LAYER_OFFSET_SCALE to reproduce today's subtle drift.

import { COL } from './palette';

export type ColKey = keyof typeof COL;

export interface BiomeLayer {
  id: string; // drawing-routine hint for the scene builder
  colorKey: ColKey; // dominant fill from COL (§2 hexes)
  parallax: number; // §9 scroll ratio: sky 0 / far 0.1–0.2 / mid 0.4–0.6 / ground 1.0
  count: number; // band/element count (culms, trunks, hills, cloud streaks, …)
  outlined: boolean; // §1: far layers lose outlines; near layers keep ~2px black
}

export interface BiomeOccluder {
  colorKey: ColKey; // near-black trunk/culm/post tone (tell #3)
  count: number; // occluders per screen width
  parallax: number; // §9: foreground occluder 1.15–1.3
  widthMin: number; // px trunk/post width range at 1024w
  widthMax: number;
  alpha: number; // slightly translucent to fake the blur-feel (drawn low-detail)
}

export interface BiomeVignette {
  topAlpha: number; // tell #2: soft black band strength at the very top edge
  topHeightFrac: number; // fraction of GAME_H the top gradient descends (~15%)
  bottomAlpha: number; // §1: bottom corners, lightly
  bottomHeightFrac: number; // fraction of GAME_H the bottom corner shade rises
}

export interface BiomeSpec {
  id: BiomeId;
  layers: BiomeLayer[]; // back → front
  occluder: BiomeOccluder | null; // null = biome shows no foreground occluder
  vignette: BiomeVignette;
}

export type BiomeId =
  | 'field'
  | 'bamboo'
  | 'tealForest'
  | 'stoneWall'
  | 'mine'
  | 'dungeon'
  | 'town'
  | 'interior'
  | 'beach'
  | 'dusk';

// §9 canonical parallax ratios — INFERRED (survey §9).
export const PARALLAX = {
  sky: 0,
  far: 0.15, // §9: far 0.1–0.2
  mid: 0.5, // §9: mid 0.4–0.6
  near: 0.8, // INFERRED — between mid and ground
  ground: 1.0,
  occluder: 1.2, // §9: foreground occluder 1.15–1.3
} as const;

// Multiplier converting §9 camera ratios to today's layer-offset drift (Forest.ts uses
// 0.01–0.2 with a static camera). INFERRED — tuned so ground≈0.2 matches the current feel.
export const BIOME_LAYER_OFFSET_SCALE = 0.2;

// Shared vignette defaults — tell #2: "soft black gradient band ~15% down from the top edge".
export const VIGNETTE_DEFAULT: BiomeVignette = {
  topAlpha: 0.55, // INFERRED (survey tell #2) — strength at the very top edge
  topHeightFrac: 0.15, // INFERRED (survey tell #2) — ~15% of frame height
  bottomAlpha: 0.22, // INFERRED (survey §1) — bottom corners, lightly
  bottomHeightFrac: 0.1, // INFERRED (survey §1)
};

// Interiors/dungeons read darker overall; vignette a touch stronger. INFERRED (survey §1).
export const VIGNETTE_DARK: BiomeVignette = {
  topAlpha: 0.68,
  topHeightFrac: 0.18,
  bottomAlpha: 0.3,
  bottomHeightFrac: 0.12,
};

export const BIOMES: Record<BiomeId, BiomeSpec> = {
  // §2.1 Sage field — sky bands + cloud streaks / ridge / hills / ground band.
  field: {
    id: 'field',
    layers: [
      { id: 'skyGradient', colorKey: 'fieldSkyTop', parallax: PARALLAX.sky, count: 2, outlined: false },
      { id: 'cloudStreaks', colorKey: 'fieldCloud', parallax: 0.05, count: 3, outlined: false }, // 2–3 sweeps (signature)
      { id: 'mountainRidge', colorKey: 'fieldMountain', parallax: PARALLAX.far, count: 1, outlined: false },
      { id: 'hills', colorKey: 'fieldHill', parallax: 0.35, count: 2, outlined: false },
      { id: 'deadTrees', colorKey: 'fieldDeadTree', parallax: PARALLAX.mid, count: 4, outlined: false },
      { id: 'groundBand', colorKey: 'fieldGround', parallax: PARALLAX.ground, count: 1, outlined: true },
      { id: 'grassClumps', colorKey: 'fieldGrass', parallax: PARALLAX.ground, count: 14, outlined: false },
      { id: 'posts', colorKey: 'fieldPost', parallax: PARALLAX.ground, count: 3, outlined: true },
    ],
    occluder: null, // field frames read open (p1 f18/f24)
    vignette: VIGNETTE_DEFAULT,
  },

  // §2.2 Bamboo forest — wash / far+near culm ranks / leaf top vignette / moss.
  bamboo: {
    id: 'bamboo',
    layers: [
      { id: 'wash', colorKey: 'bambooBackdrop', parallax: PARALLAX.sky, count: 1, outlined: false },
      { id: 'culmsFar', colorKey: 'bambooCulmFar', parallax: PARALLAX.far, count: 12, outlined: false },
      { id: 'culmsNear', colorKey: 'bambooCulmNear', parallax: PARALLAX.mid, count: 8, outlined: true },
      { id: 'leafCanopy', colorKey: 'bambooLeafTop', parallax: 0.35, count: 6, outlined: false },
      { id: 'mossMounds', colorKey: 'bambooMoss', parallax: PARALLAX.ground, count: 6, outlined: true },
      { id: 'lanternsRocks', colorKey: 'paleRock', parallax: PARALLAX.ground, count: 2, outlined: true },
    ],
    occluder: { colorKey: 'bambooNode', count: 1, parallax: PARALLAX.occluder, widthMin: 34, widthMax: 60, alpha: 0.96 },
    vignette: VIGNETTE_DEFAULT,
  },

  // §2.3 Teal misty forest — fog / trunks at 3 depths / undergrowth / occluder trunk.
  tealForest: {
    id: 'tealForest',
    layers: [
      { id: 'fog', colorKey: 'tealFog', parallax: PARALLAX.sky, count: 1, outlined: false },
      { id: 'trunksFar', colorKey: 'tealTrunkFar', parallax: PARALLAX.far, count: 9, outlined: false },
      { id: 'trunksMid', colorKey: 'tealTrunkMid', parallax: 0.4, count: 6, outlined: false },
      { id: 'trunksNear', colorKey: 'tealTrunkNear', parallax: 0.65, count: 4, outlined: true }, // full frame height
      { id: 'undergrowth', colorKey: 'tealUndergrowth', parallax: PARALLAX.ground, count: 8, outlined: false },
      { id: 'rocks', colorKey: 'paleRock', parallax: PARALLAX.ground, count: 3, outlined: true },
      { id: 'ruins', colorKey: 'mossyRuin', parallax: PARALLAX.near, count: 2, outlined: true }, // optional variant
    ],
    occluder: { colorKey: 'tealOccluder', count: 2, parallax: PARALLAX.occluder, widthMin: 56, widthMax: 120, alpha: 0.97 },
    vignette: VIGNETTE_DEFAULT,
  },

  // §2.4 Mountain path — stone wall fills the frame; posts + verge in front.
  stoneWall: {
    id: 'stoneWall',
    layers: [
      { id: 'stoneWall', colorKey: 'stoneKhaki', parallax: PARALLAX.far, count: 24, outlined: true }, // rounded stones, black seams
      { id: 'stoneShadow', colorKey: 'stoneKhakiShade', parallax: PARALLAX.far, count: 24, outlined: false },
      { id: 'grassTufts', colorKey: 'stoneGrassTuft', parallax: PARALLAX.far, count: 8, outlined: false },
      { id: 'postsRopes', colorKey: 'minePost', parallax: PARALLAX.near, count: 4, outlined: true },
      { id: 'verge', colorKey: 'mineVerge', parallax: PARALLAX.ground, count: 1, outlined: true },
    ],
    occluder: { colorKey: 'minePost', count: 1, parallax: PARALLAX.occluder, widthMin: 30, widthMax: 52, alpha: 0.96 },
    vignette: VIGNETTE_DEFAULT,
  },

  // §2.4 Mine interior variant — darkened stones, timber frames, sepia props.
  mine: {
    id: 'mine',
    layers: [
      { id: 'stoneWallDark', colorKey: 'mineStoneDark', parallax: PARALLAX.far, count: 24, outlined: true },
      { id: 'timberFrames', colorKey: 'minePost', parallax: PARALLAX.mid, count: 5, outlined: true },
      { id: 'props', colorKey: 'mineProp', parallax: PARALLAX.ground, count: 4, outlined: true }, // barrels/crates/chests
      { id: 'floor', colorKey: 'dungeonFloor', parallax: PARALLAX.ground, count: 1, outlined: true },
    ],
    occluder: { colorKey: 'minePost', count: 1, parallax: PARALLAX.occluder, widthMin: 36, widthMax: 64, alpha: 0.96 },
    vignette: VIGNETTE_DARK,
  },

  // §2.5 Dungeon — brick wall / timber posts + lantern glows / dark floor + props.
  dungeon: {
    id: 'dungeon',
    layers: [
      { id: 'brickWall', colorKey: 'dungeonBrick', parallax: PARALLAX.far, count: 40, outlined: true }, // black mortar seams
      { id: 'timberPosts', colorKey: 'minePost', parallax: PARALLAX.mid, count: 4, outlined: true }, // iron bands
      { id: 'lanterns', colorKey: 'lanternGlow', parallax: PARALLAX.mid, count: 3, outlined: false }, // warm dot glows
      { id: 'floor', colorKey: 'dungeonFloor', parallax: PARALLAX.ground, count: 1, outlined: true },
      { id: 'props', colorKey: 'mineProp', parallax: PARALLAX.ground, count: 3, outlined: true },
    ],
    occluder: { colorKey: 'minePost', count: 1, parallax: PARALLAX.occluder, widthMin: 34, widthMax: 58, alpha: 0.96 },
    vignette: VIGNETTE_DARK,
  },

  // §2.6 Town exterior — haze / rooftops / plaster buildings / street.
  town: {
    id: 'town',
    layers: [
      { id: 'hazeSky', colorKey: 'townSkyHaze', parallax: PARALLAX.sky, count: 1, outlined: false },
      { id: 'rooflineFar', colorKey: 'townRoofline', parallax: PARALLAX.far, count: 6, outlined: false },
      { id: 'buildings', colorKey: 'townPlaster', parallax: PARALLAX.mid, count: 4, outlined: true }, // roofs/timber/windows drawn per-building
      { id: 'street', colorKey: 'townStreet', parallax: PARALLAX.ground, count: 1, outlined: true },
      { id: 'streetProps', colorKey: 'mineProp', parallax: PARALLAX.ground, count: 3, outlined: true }, // stone bases, crates
    ],
    occluder: { colorKey: 'townTimber', count: 1, parallax: PARALLAX.occluder, widthMin: 28, widthMax: 48, alpha: 0.95 },
    vignette: VIGNETTE_DEFAULT,
  },

  // §2.7 Interiors — mustard walls, mural panels, beams, floor, lanterns.
  interior: {
    id: 'interior',
    layers: [
      { id: 'walls', colorKey: 'interiorMustard', parallax: PARALLAX.sky, count: 1, outlined: false },
      { id: 'muralPanels', colorKey: 'muralWash', parallax: PARALLAX.far, count: 3, outlined: true },
      { id: 'blossomPanels', colorKey: 'muralBlossom', parallax: PARALLAX.far, count: 2, outlined: true },
      { id: 'beamsColumns', colorKey: 'interiorBeam', parallax: PARALLAX.mid, count: 5, outlined: true },
      { id: 'floor', colorKey: 'interiorFloor', parallax: PARALLAX.ground, count: 1, outlined: true },
      { id: 'lanterns', colorKey: 'lanternGlow', parallax: PARALLAX.mid, count: 3, outlined: true },
    ],
    occluder: { colorKey: 'interiorBeam', count: 1, parallax: PARALLAX.occluder, widthMin: 30, widthMax: 56, alpha: 0.96 },
    vignette: VIGNETTE_DARK,
  },

  // §2.8 Beach duel — sky / cumulus / sea / rock stacks / shore band.
  beach: {
    id: 'beach',
    layers: [
      { id: 'sky', colorKey: 'beachSky', parallax: PARALLAX.sky, count: 1, outlined: false },
      { id: 'cumulus', colorKey: 'fieldCloud', parallax: 0.05, count: 3, outlined: false },
      { id: 'sea', colorKey: 'beachSea', parallax: PARALLAX.far, count: 1, outlined: false },
      { id: 'rockStacks', colorKey: 'beachRock', parallax: PARALLAX.mid, count: 3, outlined: true }, // grass-capped
      { id: 'shoreBand', colorKey: 'fieldGround', parallax: PARALLAX.ground, count: 1, outlined: true },
    ],
    occluder: null,
    vignette: VIGNETTE_DEFAULT,
  },

  // §2.8 Dusk — peach gradient / blue-purple mountain layers / tree silhouettes.
  dusk: {
    id: 'dusk',
    layers: [
      { id: 'skyGradient', colorKey: 'duskSkyTop', parallax: PARALLAX.sky, count: 2, outlined: false },
      { id: 'mountainsFar', colorKey: 'duskMountainFar', parallax: PARALLAX.far, count: 1, outlined: false },
      { id: 'mountainsNear', colorKey: 'duskMountainNear', parallax: 0.3, count: 1, outlined: false },
      { id: 'treeSilhouettes', colorKey: 'fieldDeadTree', parallax: PARALLAX.mid, count: 5, outlined: false },
      { id: 'groundBand', colorKey: 'fieldGrass', parallax: PARALLAX.ground, count: 1, outlined: true },
    ],
    occluder: { colorKey: 'tealOccluder', count: 1, parallax: PARALLAX.occluder, widthMin: 44, widthMax: 90, alpha: 0.97 },
    vignette: VIGNETTE_DEFAULT,
  },
};
