// config/chrome-extra.ts — shared screen-chrome tunables (ART_DIRECTION.md §7/§8):
// title/loading screen, dialogue strip, modals, panel primitives, story cards and
// letterbox pans. Owned by the screens surface. Every value is INFERRED (survey §7/§8)
// — measured by eye from p1 f01/f05/f13/f20/f21/f24/f61 and p2 f07/f80 at 1024×576
// unless a comment says otherwise. Colors that already exist in COL are NOT duplicated
// here; only chrome-specific additions live in CHROME_COL.
// NOT in the config barrel (index.ts is frozen): import from 'config/chrome-extra'.

/** Convert a COL number into a CSS hex string for Phaser Text styles. Lives here so
 *  game/ code never needs the radix/pad literals (config-purity keeps game/ literal-free). */
export const cssHex = (n: number): string => '#' + n.toString(16).padStart(6, '0');

// Chrome-only color additions (everything else comes from COL — panelMaroon,
// panelMaroonSwirl, panelInk, goldTrim, buttonRed, chromeCream, choiceHoverRed,
// rarity*, winRed/winRedDeep, vignetteBlack).
export const CHROME_COL = {
  storyTan: 0xcdb98c, // INFERRED (survey §7, p1 f01) — story-card tan brush-caps paragraphs
  tileStone: 0x6e685a, // INFERRED (survey §7, p1 f13) — item-tile stone-grey face
  tileStoneShade: 0x4b463c, // INFERRED (survey §7) — tile inner shade tone
  buttonRedHover: 0xb02a18, // INFERRED (survey §7) — red buttons brighten on hover
} as const;

// Z-order for chrome surfaces. Sits above the HUD (100/101) and the homage credits
// (120); letterbox bars go above even the KillBeat overlay (190–200) since travel
// pans frame the whole screen (tell #9).
export const CHROME_DEPTH = {
  dialogue: 130,
  modal: 150,
  storyCard: 160,
  letterbox: 210,
} as const;

// §7 loading/title screen (p2 f80): black field, small white brush-caps kicker,
// huge red dry-brush title word, LOADING… line, white TIP line at the very bottom.
// Ys read off the 512×288 frame (kicker ≈0.33h, title ≈0.44h, loading ≈0.60h,
// tip ≈0.93h) and scaled to 576.
export const TITLE_SCREEN = {
  kickerY: 176, // INFERRED (survey §7) — small white caps line, centered
  kickerSize: 22, // INFERRED (survey §7)
  kickerLetterSpacing: 6, // INFERRED (survey §7) — tracked-out caps
  titleY: 250, // INFERRED (survey §7) — huge red word center line
  titleLetterSpacing: 10, // INFERRED (survey §7) — gap between hand-placed letters, px
  titleJitterDeg: 2.5, // INFERRED (survey §8) — per-letter rotation jitter (irregular brush baseline)
  titleJitterY: 4, // INFERRED (survey §8) — per-letter baseline jitter, px
  titleJitterPhase: 2.7, // deterministic per-letter jitter phase (sin(i·phase)), rotation
  titleJitterPhaseY: 4.3, // deterministic per-letter jitter phase, baseline
  menuY: 348, // INFERRED (survey §7) — where the LOADING… line sits; menu rows replace it
  menuGap: 46, // menu row vertical spacing
  menuSize: 24, // INFERRED (survey §7) — LOADING…/menu caps size
  loadingHoldMs: 850, // LOADING… beat shown before the menu fades in (authentic boot feel)
  menuFadeMs: 300, // menu rows fade-in duration
  disabledAlpha: 0.35, // dimmed CONTINUE when no save exists
  hoverScale: 1.08, // menu row scale on hover
  tipSize: 13, // INFERRED (survey §7) — white TIP caps at the very bottom
  tipMarginBottom: 16, // INFERRED (survey §7) — tip baseline offset from the bottom edge
  creditMarginBottom: 36, // homage credit sits one line above the tip, right-aligned
} as const;

// §7 mottled maroon panel treatment (p1 f20, p2 f07, story cards p1 f01):
// panelMaroon base + lighter smoke swirls + dark edge vignette. Swirl placement is
// deterministic (modular hashes, same trick as Forest.canopies) so panels never flicker.
export const MOTTLE = {
  swirlCount: 16, // INFERRED (survey §7) — soft smoke blobs per panel
  swirlAlpha: 0.3, // INFERRED (survey §7) — swirls read as faint smoke
  swirlMinR: 16, // INFERRED (survey §7) — blob radius range, px (scaled to panel size)
  swirlMaxR: 64,
  swirlStretch: 2.2, // blobs are wide ellipses (horizontal smoke drift)
  hashA: 97, // deterministic placement seeds (co-prime with typical panel sizes)
  hashB: 57,
  hashC: 31,
  hashMod: 100, // hash range → normalized 0..1 via /hashMod
  edgeVignetteAlpha: 0.4, // INFERRED (survey §7) — dark inner-edge falloff
  edgeVignetteBands: 3, // stacked translucent bands approximating the falloff
  edgeVignetteBandPx: 10, // thickness of each falloff band
} as const;

// §7 ornate gold corner flourishes on modals (p1 f20, p2 f07).
export const CORNER_FLOURISH = {
  armLen: 24, // INFERRED (survey §7) — flourish arm length along each edge, px
  armW: 4, // arm thickness
  curlR: 5, // small curl circle at each arm tip
  diamondR: 7, // filled diamond right in the corner
  inset: 3, // flourish inset from the panel corner
  lineW: 2, // stroke weight of the curls
} as const;

// §7 thin gold frame used by panels/dialogue (double line: bright outer + dim inner).
export const GOLD_FRAME = {
  outerW: 2, // INFERRED (survey §7) — outer gold line weight
  innerW: 1, // inner echo line weight
  innerGap: 3, // gap between the two lines, px
  innerAlpha: 0.55, // inner line is dimmer
} as const;

// §7 black character-silhouette accent painted on panel backdrops (p1 f01/f20):
// a kasa-wearing figure, sword angled over the shoulder. Normalized polygon
// (x,y in 0..1 of the silhouette box, y down); scaled at draw time.
export const SILHOUETTE = {
  body: [
    [0.5, 0.0], // kasa peak
    [0.86, 0.13], // kasa right brim tip
    [0.62, 0.17], // under brim, right
    [0.66, 0.29], // shoulder right
    [0.79, 0.6], // sleeve right
    [0.7, 0.64],
    [0.75, 1.0], // hakama right hem
    [0.29, 1.0], // hakama left hem
    [0.34, 0.63],
    [0.23, 0.59], // sleeve left
    [0.36, 0.29], // shoulder left
    [0.4, 0.17], // under brim, left
    [0.14, 0.13], // kasa left brim tip
  ],
  sword: { x1: 0.6, y1: 0.34, x2: 0.98, y2: 0.04, w: 0.025 }, // over-shoulder blade line (fractions of box size)
  alpha: 0.92, // INFERRED (survey §7) — near-black accent, lets swirls ghost through
} as const;

// §7 dialogue strip details beyond layout.ts DIALOGUE_STRIP (p1 f05/f21/f24).
export const DIALOGUE_CHROME = {
  bgAlpha: 0.96, // INFERRED (survey §7) — near-opaque ink box
  typeCharMs: 16, // typewriter cadence, ms per character
  textPadX: 26, // body text inset from the gold frame
  textPadY: 18,
  lineSpacing: 6, // extra px between wrapped lines
  namePlateW: 168, // INFERRED (survey §7, p1 f05 GUEST plate) — banner width
  namePlateRadius: 4, // plate corner rounding
  promptRowH: 40, // INFERRED (survey §7, p1 f24) — question row above the choices
  choicePadX: 30, // choice label inset
  arrowSize: 11, // INFERRED (survey §7) — advance ▶ triangle size
  arrowMarginX: 30, // arrow inset from bottom-right of the strip
  arrowMarginY: 24,
  arrowBlinkMs: 420, // blink cadence once the line finishes typing
  bustMarginX: 16, // bust frame inset from the right edge
  bustOverlap: 26, // INFERRED (survey §7) — bust rises this far above the strip top
  bustRadius: 8, // bust frame corner rounding
  separatorAlpha: 0.5, // thin gold separators between choice rows
} as const;

// §7 player-bust glyph drawn inside the dialogue portrait slot — normalized to the
// portrait box (x,y in 0..1, y down). Kasa + face + shoulders, flat cel fills.
export const BUST_GLYPH = {
  kasa: [
    [0.5, 0.08],
    [0.97, 0.46],
    [0.03, 0.46],
  ],
  brim: { x1: 0.03, y1: 0.46, x2: 0.97, y2: 0.46, w: 0.05 }, // dark under-brim band
  face: { x: 0.5, y: 0.6, r: 0.15 },
  body: [
    [0.2, 1.0],
    [0.3, 0.76],
    [0.42, 0.7],
    [0.58, 0.7],
    [0.7, 0.76],
    [0.8, 1.0],
  ],
} as const;

// §7 modals (p1 f20, p2 f07): centered mottled panel, gold corners, cream caps,
// red OK/YES/NO buttons with gold borders.
export const MODAL = {
  w: 400, // INFERRED (survey §7, p1 f20 ≈ 0.39·1024)
  h: 250, // INFERRED (survey §7)
  dimAlpha: 0.55, // INFERRED (survey §7) — scene dims behind the modal
  titleOffsetY: 30, // title baseline below the panel top
  bodyOffsetY: 66, // body block top below the panel top
  bodyWrapPad: 44, // body wrap width = panel w − 2·pad
  btnW: 118, // INFERRED (survey §7, OK button)
  btnH: 34,
  btnGap: 26, // gap between YES/NO
  btnMarginBottom: 22, // buttons row offset from the panel bottom
  btnRadius: 6,
  popMs: 140, // scale-in pop duration
  popFromScale: 0.9,
  silhouetteXFrac: 0.63, // silhouette accent box position within the panel (fraction of w; keeps the sword tip, box x≈0.98, inside the gold frame)
  silhouetteWFrac: 0.34, // silhouette box size (fractions of panel w/h)
  silhouetteHFrac: 0.86,
  silhouetteAlpha: 0.55, // dimmer than story-card silhouettes — it is a backdrop accent
} as const;

// §7 panel primitives (p1 f13 PLAYER screen): full mottled backdrop, gold brush
// title top-left, red X close top-right, inset near-black boxes, item tiles.
export const PANEL = {
  titleX: 46, // INFERRED (survey §7, p1 f13 "PLAYER") — gold title top-left
  titleY: 12,
  frameInset: 10, // gold frame inset from the screen/panel edge
  closeSize: 36, // INFERRED (survey §7) — red X square
  closeMargin: 10, // X inset from the top-right corner
  closeRadius: 6,
  closeXSize: 20, // the X glyph size
  insetRadius: 6, // inset-box corner rounding
  insetBorderAlpha: 0.7, // thin tan border on inset boxes
  btnRadius: 6, // action button rounding (EQUIP/DROP/BUY…)
  btnBorderW: 2, // gold border weight on red buttons
  tileSize: 56, // INFERRED (survey §7, p1 f13 grid) — item tile side
  tileRadius: 8,
  tileBorderW: 3, // rarity border weight
  tileShadeFrac: 0.4, // bottom shade band height as a fraction of the tile
  selectedGlowW: 2, // extra bright frame on the selected tile
} as const;

// §7 story cards (p1 f01): full-screen mottled maroon, centered tan brush-caps
// paragraphs, black silhouette on the right edge, black ground band at the bottom.
export const STORY_CARD = {
  textSize: 17, // INFERRED (survey §7)
  wrapWFrac: 0.66, // paragraph wrap width as a fraction of GAME_W
  paraGap: 30, // vertical gap between paragraphs
  lineSpacing: 7,
  paraStaggerMs: 520, // per-paragraph fade-in stagger
  paraFadeMs: 600, // each paragraph's fade duration
  blockCenterYFrac: 0.44, // paragraph block centers on this fraction of GAME_H
  silhouetteXFrac: 0.84, // silhouette box left edge (fraction of GAME_W — bleeds off right)
  silhouetteYFrac: 0.12,
  silhouetteWFrac: 0.24,
  silhouetteHFrac: 0.82,
  groundBandFrac: 0.05, // black band along the bottom edge
  hintMarginBottom: 18, // "click" hint offset from the bottom
  hintAlpha: 0.6,
} as const;

// §9/tell #9 letterbox travel pans (bar height comes from layout.LETTERBOX_BAR_FRAC).
export const LETTERBOX = {
  inMs: 420, // INFERRED (survey §9) — bars slide in fast
  outMs: 460, // and release slightly slower
  ease: 'Sine.easeInOut',
} as const;
