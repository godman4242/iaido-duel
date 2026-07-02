// config/layout.ts — stage / canvas + (later) HUD layout constants.
// Central-config rule (spec §3): tunable gameplay/layout numbers live here, never as
// literals in core/ or game/. Provenance: CONTRACT = frozen, asserted by a test;
// INFERRED = calibration-tunable seed (spec §A / §E).

// Stage size is a CALIBRATION item (measure the native Flash stage, letterbox to it).
// 1024×576 / 16:9 is an INFERRED seed — the original was likely nearer 4:3/~640–800w.
export const GAME_W = 1024; // INFERRED — calibration target: exact native Flash stage width
export const GAME_H = 576; // INFERRED — calibration target: exact native Flash stage height
export const ASPECT = GAME_W / GAME_H; // INFERRED — derived from the above

// Horizontal margin keeping a fighter inside the arena (movement + jump clamps). INFERRED.
export const ARENA_MARGIN = 60;

// ————————————————————————————————————————————————————————————————————————————
// HUD geometry — ART_DIRECTION.md §5 (exploration) + §6 (combat), measured at
// 1024×576 ±8px from reference frames. ALL values below are INFERRED (survey)
// unless noted; right/bottom-anchored rects derive from GAME_W/GAME_H so a stage
// recalibration moves them automatically. Colors live in COL; fonts in
// config/typography.ts; these are positions/sizes only.
// ————————————————————————————————————————————————————————————————————————————

// §5 exploration-mode HUD ("HUD corners exactly" — tell #6).
export const HUD_EXPLORE = {
  // Top-left plates: coins → gold → (repurposed) earn-only gold slot.
  coinsPlate: { x: 16, y: 10, w: 164, h: 42 }, // INFERRED (survey §5: 16,10 → ~180,52)
  goldPlate: { x: 188, y: 10, w: 140, h: 42 }, // INFERRED (survey §5) — beside coins
  goldSlot: { x: 336, y: 10, w: 88, h: 42 }, // INFERRED (survey §5) — small red third plate
  // Location banner + quest tracker under the plates.
  locationBanner: { x: 16, y: 62, w: 252, h: 30 }, // INFERRED (survey §5: 16,~62)
  questTracker: { x: 16, y: 100, lineH: 20, w: 300 }, // INFERRED (survey §5) — translucent strips
  // Top-right: XP bar + level badge, minimap panel under them.
  xpBar: { x: GAME_W - 316, y: 14, w: 300, h: 14 }, // INFERRED (survey §5) — long thin gold-fill plate
  levelBadge: { x: GAME_W - 366, y: 6, size: 44 }, // INFERRED (survey §5) — gold shield left of the bar
  minimap: { x: 790, y: 60, w: 218, h: 208 }, // INFERRED (survey §5: ~790,60 → 1008,268)
  minimapLabels: { x: 790, y: 272, w: 218, h: 22, gap: 4 }, // INFERRED (survey §5) — TERRITORY/SECTOR plates
  // Bottom-left: portrait frame + stacked bars + stance label.
  portrait: { x: 10, y: GAME_H - 108, w: 110, h: 100 }, // INFERRED (survey §5: 10,~468 → 120,568)
  bars: {
    x: 128, // INFERRED (survey §5) — right of the portrait
    y: GAME_H - 98, // INFERRED (survey §5) — first bar top
    w: 150, // INFERRED (survey §5: ~150×12 each)
    h: 12,
    gap: 4, // INFERRED (survey §5) — vertical gap between stacked bars
    order: ['hp', 'chi', 'ap'], // INFERRED (survey §5) — HP green, Chi blue, AP teal (when present)
  },
  stanceLabel: { x: 128, y: GAME_H - 46 }, // INFERRED (survey §5) — small caps under the bars
  // Bottom hotbar strip of round slots.
  hotbar: { slotCount: 9, slotSize: 44, startX: 350, endX: 1010, y: GAME_H - 40 }, // INFERRED (survey §5: ~350→1010, y≈536)
} as const;

// §6 combat-mode HUD swaps.
export const HUD_COMBAT = {
  autoSlashPill: { x: 16, y: 12, w: 150, h: 30 }, // INFERRED (survey §6) — `AUTO SLASH OFF` top-left
  chatButton: { x: 174, y: 12, size: 30 }, // INFERRED (survey §6) — bubble beside the pill
  comboCounter: { x: GAME_W - 84, y: 24, labelGap: 6 }, // INFERRED (survey §4/§6) — numeral size in typography.ts
  pauseButton: { x: GAME_W - 40, y: 16, size: 28 }, // INFERRED (survey §6) — beside the counter
  skillSlots: {
    count: 3, // INFERRED (survey §6) — 3 numbered square slots
    size: 54, // INFERRED (survey §6)
    gap: 10,
    y: GAME_H - 70, // INFERRED (survey §6) — bottom-right row
    endX: GAME_W - 76, // INFERRED (survey §6) — row right edge, leaves room for the flee arrow
  },
  fleeArrow: { x: GAME_W - 64, y: GAME_H - 70, w: 48, h: 54 }, // INFERRED (survey §6) — gold up-arrow
  statusText: { x: 128, y: GAME_H - 30 }, // INFERRED (survey §6) — red caps `CANNOT CHANGE STANCE`
  damageBuffText: { x: GAME_W - 76, y: GAME_H - 92 }, // INFERRED (survey §4) — `150% DAMAGE MM:SS` gold caps
} as const;

// §3/§7 floating name label + enemy HP bar (never a top-of-screen bar).
export const NAME_LABEL = {
  offsetY: -128, // copies the existing build's label height above fighter.y (INFERRED)
  hpBarW: 60, // INFERRED (survey §3: 60×6px green bar under the label)
  hpBarH: 6,
  hpBarGap: 4, // INFERRED (survey §3) — gap between label baseline and bar
} as const;

// §7 dialogue strip (full-width bottom box, name plate overlapping top-left).
export const DIALOGUE_STRIP = {
  h: 136, // INFERRED (survey §7: ~136px tall)
  frameInset: 8, // INFERRED (survey §7) — thin gold frame inset from the strip edge
  namePlate: { offsetX: 24, offsetY: -14, h: 28 }, // INFERRED (survey §7) — banner overlapping top-left
  choiceRowH: 30, // INFERRED (survey §7) — stacked choice strips
  portrait: { w: 84, h: 84 }, // INFERRED (survey §7) — player bust, bottom-right rounded frame
} as const;

// §9/tell #9 letterboxed travel pans: each black bar covers this fraction of GAME_H,
// leaving a thin strip between them while the camera pans. INFERRED (survey tell #9).
export const LETTERBOX_BAR_FRAC = 0.32;
