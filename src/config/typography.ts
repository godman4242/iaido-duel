// config/typography.ts — type roles for ART_DIRECTION.md §8. We RECREATE the roles
// (dry-brush display caps + hand-printed comic body caps) with system/web-safe stacks
// for now; a loaded open-licensed brush face replaces the display stack later (FIDELITY
// TODO carried from TitleScene). We never ship the original faces. All values INFERRED
// (survey) — sizes read off 1024×576 frames ±safety. Text colors live in COL
// (chromeCream, goldTrim, winRed, finisherRed…).
// NOT in the config barrel (index.ts is frozen): import from 'config/typography'.

// §8 display role — rough dry-brush caps, heavy, slightly irregular baseline
// (title, YOU WIN, combo numerals, gold panel titles, location banners).
// Heavy-condensed system stack stands in until we author/load a brush face.
export const FONT_DISPLAY = '"Arial Black", Impact, "Avenir Next Condensed", fantasy'; // INFERRED (survey §8)

// §8 body role — compact hand-printed caps w/ black outline (HUD numbers, dialogue,
// quest text); comic-lettering feel, cream on dark.
export const FONT_BODY = '"Comic Sans MS", "Chalkboard SE", "Comic Neue", cursive'; // INFERRED (survey §8)

// Long-form/narration fallback already used by Prologue (kept as a named role).
export const FONT_SERIF = 'Georgia, "Times New Roman", serif'; // INFERRED — existing build's serif

// Sizes in px at the 1024×576 stage. INFERRED (survey §4/§5/§7/§8).
export const FONT_SIZE = {
  title: 92, // INFERRED — huge red dry-brush title word (matches existing TitleScene scale)
  winTitle: 96, // INFERRED (survey §7) — YOU WIN tall condensed brush caps
  panelTitle: 28, // INFERRED (survey §7) — gold brush caps, panel top-left (PLAYER/SKILLS/…)
  banner: 20, // INFERRED (survey §5) — location-banner cream brush caps
  comboNumeral: 48, // INFERRED (survey §4: ~48px) — big red brush combo count
  comboLabel: 13, // INFERRED (survey §4) — small white `HIT COMBO` caps
  body: 15, // INFERRED (survey §8) — dialogue / quest text / HUD labels
  hudNumeral: 12, // INFERRED (survey §5) — small white outlined bar numerals
  nameLabel: 13, // INFERRED (survey §3) — floating name caps above heads
} as const;

// Outline thicknesses in px — §8: body caps carry a black outline; display words on
// red fields carry a white outline (§7). INFERRED (survey).
export const TEXT_OUTLINE = {
  body: 3, // INFERRED (survey §8) — black outline on body caps
  nameLabel: 3, // INFERRED (survey §3) — black outline on floating names
  display: 5, // INFERRED (survey §8) — heavier outline under display caps
  winTitle: 6, // INFERRED (survey §7) — white outline on the YOU WIN red caps
} as const;
