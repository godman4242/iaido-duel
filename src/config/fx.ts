// config/fx.ts — combat/kill FX tunables for ART_DIRECTION.md §4 (slash arcs, blood,
// loot, finisher flash) and §7 (YOU WIN anatomy). Every value is INFERRED (survey)
// unless it explicitly re-uses an existing config key. Colors live in COL
// (arcSteel/arcBlue/arcRed + cores, bloodBright, bloodPool, coinGold, lootPaper,
// finisherRed). The M1-era BLADE_*/BLOOD_* keys in config/combat.ts keep driving the
// legacy BladeTrail/Gore until those systems port to these §4-calibrated values.
// NOT in the config barrel (index.ts is frozen): import from 'config/fx'.

import { BLOOD_GRAVITY_Y } from './combat';

// §4 slash arc — "fat tapered crescent along the drawn stroke; lighter core +
// weapon-colored body … hangs ~200ms, fades" (p1 f31/f37/f62; p2 f9/f34).
export const SLASH_ARC = {
  bodyHalfWidth: 26, // INFERRED (survey §4) — max half-width of the weapon-colored body (fat, not a line)
  coreHalfWidth: 11, // INFERRED (survey §4) — lighter core half-width
  taperPow: 1.6, // INFERRED (survey §4) — width falloff exponent toward both tips
  minTaper: 0.1, // INFERRED (survey §4) — floor so the tips stay visible
  hangMs: 200, // INFERRED (survey §4: hangs ~200ms) — full-alpha hold before the fade
  fadeMs: 180, // INFERRED (survey §4) — fade-out duration after the hang
} as const;

// §4 blood — bright directional burst + persistent dark pools under corpses
// (p1 f66; p2 f31/f48). Colors: COL.bloodBright / COL.bloodPool.
export const BLOOD_FX = {
  burstCount: 12, // INFERRED (survey §4) — droplets per hit burst
  burstCountSevered: 20, // INFERRED (survey §4) — droplets on a sever/finisher
  speedMin: 90, // INFERRED (survey §4) — px/s droplet speed range
  speedMax: 280,
  gravityY: BLOOD_GRAVITY_Y, // re-uses the existing INFERRED seed (config/combat.ts, 760 px/s²)
  poolSpreadRadius: 46, // INFERRED (survey §4) — px max radius a corpse pool spreads to
  poolSpreadMs: 2600, // INFERRED (survey §4) — pool growth duration
  poolAlpha: 0.9, // INFERRED (survey §4) — pools read near-opaque dark red
  poolPersists: true, // §4/tell #8 — pools + ground spatter persist for the whole fight
  spatterPersists: true, // tell #8 — spatter sticks to the ground
} as const;

// §4 loot — coins + item papers "pop out with tumble physics, settle, twinkle".
export const LOOT_FX = {
  coinRadius: 5, // INFERRED (survey §4) — gold disc radius, px
  paperW: 10, // INFERRED (survey §4) — item-paper rect, px
  paperH: 14,
  popSpeedMin: 120, // INFERRED (survey §4) — px/s ejection speed range
  popSpeedMax: 260,
  popConeDeg: 70, // INFERRED (survey §4) — half-angle of the upward ejection cone
  gravityY: 900, // INFERRED (survey §4) — px/s² tumble gravity
  bounce: 0.35, // INFERRED (survey §4) — restitution on ground contact
  spinDegPerS: 540, // INFERRED (survey §4) — tumble spin while airborne
  settleMs: 1200, // INFERRED (survey §4) — time until a piece rests
  twinklePeriodMs: 900, // INFERRED (survey §4) — settled-loot sparkle cadence
} as const;

// §4/§0.5a finisher flash — "whole scene → black silhouettes over flat red for a beat"
// (p1 f56; p2 f35). Field color: COL.finisherRed.
export const FINISHER_FLASH = {
  durationMs: 420, // INFERRED (survey §4) — length of the red beat
  snapInMs: 60, // INFERRED (survey §4) — the flash snaps in near-instantly
  silhouetteThreshold: 0.45, // INFERRED (survey §4) — luma below this renders black, above renders red
  keepWindowBands: true, // §4 — interiors keep window shapes as red/black stripes
  slowMoScale: 0.35, // INFERRED (survey §9) — slow-mo timescale during the finisher beat
} as const;

// §7 YOU WIN anatomy — flat red field, black ground strip w/ grass nicks, fighter-pose
// silhouettes, brush title on an ink splat. Field: COL.finisherRed; title face/size in
// config/typography.ts.
export const WIN_SCREEN = {
  groundStripFrac: 0.12, // §7: bottom 12% = black ground silhouette (INFERRED survey)
  grassNickCount: 18, // INFERRED (survey §7) — grass nicks along the strip's top edge
  debrisMoundCount: 3, // INFERRED (survey §7) — debris mounds on the strip
  silhouetteCountMax: 3, // §7: 1–3 black fighter-pose silhouettes (INFERRED survey)
  splatW: 560, // INFERRED (survey §7) — irregular black ink splat under the title, px
  splatH: 150,
  splatDripCount: 5, // INFERRED (survey §7) — drips hanging off the splat
  titleLetterJitterDeg: 3, // §7: slight letter rotation jitter, ± this many degrees (INFERRED survey)
  titleOutlinePx: 6, // INFERRED (survey §7) — white outline around the red brush caps
} as const;
