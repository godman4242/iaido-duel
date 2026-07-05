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
  resultDelayMs: 1600, // KillBeat anatomy reveal (~980ms) + a beat, then the DuelResult tally mounts (M2 §3.13 — integrate glue, INFERRED)
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

// ————————————————————————————————————————————————————————————————————————————
// M2 §3.13 duel framing (Tell 25) — owned by the s-framing workstream.
// VS splash → opponent name banner → READY/FIGHT! → Victory/Defeat tally.
// All values INFERRED (blueprint §3.13 + ART_DIRECTION §3/§5/§7 chrome recipes;
// pacing eye-matched to the longplays' pre-fight beats). Colors reference COL;
// faces live in config/typography.ts.
// ————————————————————————————————————————————————————————————————————————————

/** DuelIntro beats: VS card (mottled §7 field, busts + names + brush VS), then the
 *  opponent name banner over the live arena (§5 location-banner recipe), then the
 *  READY / FIGHT! beat. `readyFightMs` is the hold for EACH of READY and FIGHT!. */
export const DUEL_INTRO = {
  depth: 204, // above the kill-screen layers (fx-extra FX_DEPTH.killTitle 200), below letterbox bars (210)
  vsSplashMs: 1500, // hold on the full VS card before it releases to the arena
  splashFadeMs: 300, // VS card fade-out duration
  // Portrait boxes on the VS card (player LEFT, opponent RIGHT) — §7 inset-box recipe.
  portraitBox: {
    w: 176, // box size, px
    h: 200,
    cxFracL: 0.26, // player box center x as a fraction of GAME_W
    cxFracR: 0.74, // opponent box center x
    cyFrac: 0.42, // both box centers' y as a fraction of GAME_H
    radius: 10, // corner rounding
    bustInset: 12, // bust glyph inset from the box edge
    popMs: 240, // scale-pop entrance duration
    popFromScale: 0.85, // pop grows from this scale
  },
  nameGapY: 26, // fighter-name baseline gap below each portrait box
  nameSize: 20, // name caps size (§3 label roles: gold player / red hostile)
  // Big brush "VS" between the boxes (per-letter jitter like the YOU WIN title, §8).
  vs: {
    size: 96, // display caps size
    jitterDeg: 3, // ± per-letter rotation jitter
    jitterY: 5, // ± per-letter baseline jitter, px
    letterGap: 8, // extra tracking, px
    outlineW: 6, // outline width (§7 red display caps carry a white outline)
    outlineColor: 0xffffff, // the white outline (shared by VS and FIGHT!)
    popMs: 180, // VS slams down from oversized
    popFromScale: 1.6,
  },
  // Opponent bust glyph (bare head + topknot + headband — ronin archetype, §3).
  // Fractions of the portrait inner box (x,y in 0..1, y down); the player side
  // reuses chrome-extra's BUST_GLYPH (kasa bust).
  enemyBust: {
    hair: { cx: 0.5, cy: 0.46, w: 0.38, h: 0.26 }, // dark hair cap ellipse
    knot: { cx: 0.5, cy: 0.31, r: 0.05 }, // topknot circle
    band: { x1: 0.32, x2: 0.68, y: 0.5, h: 0.05 }, // headband strip across the forehead
  },
  // Opponent name banner over the live arena: black rounded bar, double gold
  // outline, cream brush caps — the §5 location-banner recipe re-aimed.
  banner: {
    yFrac: 0.13, // bar center y as a fraction of GAME_H
    h: 38, // bar height, px
    padX: 30, // bar width = text width + 2·padX
    radius: 8, // corner rounding
    textSize: 20, // cream caps size (typography FONT_SIZE.banner role)
    fadeMs: 240, // banner fade in/out duration
  },
  bannerHoldMs: 950, // full-alpha hold on the name banner
  readyFightMs: 620, // hold for EACH of READY and FIGHT!
  readyFight: {
    cyFrac: 0.4, // word center y as a fraction of GAME_H
    readySize: 52, // READY display caps size (cream, black outline)
    fightSize: 92, // FIGHT! display caps size (red, white outline)
    popMs: 150, // per-word pop duration
    readyPopFromScale: 0.6, // READY grows in
    fightPopFromScale: 1.55, // FIGHT! slams down
    fadeMs: 220, // FIGHT! fade-out ending the intro
  },
} as const;

/** DuelResult tally: dim wash + centered §7 mottled panel (gold frame, corner
 *  flourishes, silhouette accent), VICTORY/DEFEAT brush title, YOU RECEIVED
 *  count-up rows (XP + coins — values computed by the caller; economy math is M3),
 *  red CONTINUE action button. */
export const DUEL_RESULT = {
  depth: 204, // above the kill-screen layers (200), below letterbox bars (210)
  dimAlpha: 0.62, // full-screen ink dim behind the panel (swallows stray clicks)
  panel: {
    w: 470, // centered panel size, px
    h: 320,
    popMs: 170, // scale-pop entrance
    popFromScale: 0.92,
  },
  // Kasa-figure silhouette accent inside the panel (fractions of the panel box).
  silhouette: { xFrac: 0.62, yFrac: 0.06, wFrac: 0.36, hFrac: 0.88, alpha: 0.4 },
  titleOffsetY: 78, // VICTORY/DEFEAT center below the panel top
  title: {
    size: 62, // display caps size
    jitterDeg: 3, // ± per-letter rotation jitter (§8 irregular baseline)
    jitterY: 4, // ± per-letter baseline jitter, px
    letterGap: 4, // extra tracking, px
    outlineW: 5, // outline width
    winFill: COL.winRed, // §7: red fill + white outline on victory
    winStroke: 0xffffff,
    loseFill: COL.chromeCream, // defeat: cream on black (KillBeat lose treatment)
    loseStroke: COL.vignetteBlack,
  },
  headerOffsetY: 128, // small YOU RECEIVED caps center below the panel top
  headerSize: 14,
  rowsOffsetY: 168, // first tally-row center below the panel top
  tallyRowGap: 44, // vertical gap between tally rows
  row: {
    w: 320, // row content width (icon+label left, value right), px
    labelSize: 16, // cream caps label size
    valueSize: 24, // gold count-up value size
    iconR: 9, // icon radius (coin disc / XP diamond), px
    iconGapX: 16, // gap between icon center and label left edge
    fadeMs: 220, // per-row fade-in
    staggerMs: 260, // per-row entrance stagger
  },
  countMs: 700, // 0 → value count-up duration per row
  holdMs: 600, // beat after the rows land before CONTINUE arms
  btn: { w: 156, h: 40, marginBottom: 34 }, // CONTINUE geometry; bottom margin from the panel's lower edge
} as const;
