// config/scenes-extra.ts — scene-WIRING tunables for the visual-overhaul integration pass
// (which biome each scene mounts, kill-sequence beats, town/prologue glue geometry).
// Owned by the wiring surface; the other config files are frozen to their agents.
// All values INFERRED (survey/integration) unless noted. NOT in the config barrel
// (index.ts is frozen): import from '../../config/scenes-extra'.
import { COL } from './palette';

/**
 * Which §2 biome kit each scene mounts — the config switch for swapping arenas.
 * Values must be kits built in createBiome.ts: 'field' | 'bamboo' | 'tealForest' |
 * 'stoneWall' | 'mine'.
 */
export const SCENE_BIOMES = {
  duel: 'tealForest', // §2.3 — the duel arena (p1 f46/f48/f62: fights sit in the teal misty forest)
  town: 'field', // §2.1 — the exploration hub reads as the open sage field for now
} as const;

/** DuelScene wiring: arena dressing + the §4 kill sequence beats. */
export const DUEL_SCENE = {
  bgColor: COL.tealFog, // camera clear color behind the biome (matches the flat fog backdrop)
  arcVariant: 'steel', // §4 default katana arc (weapon variants: steel | blue | red)
  collapseGlimpseMs: 200, // on-field collapse glimpse before the finisher flash (source beat, was inline)
  lootChestOffsetY: 46, // loot ejects from chest height above the ground line (the build's cut-height convention)
} as const;

/** TownScene wiring: field biome + §5 explore HUD + dialogue hub glue. */
export const TOWN_SCENE = {
  groundOffset: 96, // groundY = GAME_H − this (the scenes' shared GROUND_Y convention)
  bgColor: COL.fieldSkyTop, // camera clear behind the field kit's sky gradient
  playerXFrac: 0.32, // spawn x as a fraction of GAME_W (left of center, room to walk)
  playerScale: 0.65, // §3: ~110px tall in exploration vs ~170px in combat
  moveSpeed: 0.22, // px/ms walk speed (a touch slower than the duel's 0.28)
  greetDelayMs: 700, // the elder's dialogue opens shortly after arriving
} as const;

/** PrologueScene chrome glue: depths that must clear the story card (CHROME_DEPTH.storyCard=160..162). */
export const PROLOGUE_UI = {
  skipDepth: 170, // Skip button above the story card AND its full-screen hit rect
  overlayDepth: 168, // white beat-transition wash above the card, below Skip
} as const;
