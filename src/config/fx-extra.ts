// config/fx-extra.ts — fx-surface tunables beyond config/fx.ts, owned by the combat-FX
// agent (BladeTrail / Gore / LootPop / FinisherFlash / KillBeat). Every value is
// INFERRED (survey) against ART_DIRECTION.md §4/§7 and the cited reference frames
// unless it re-uses an existing config key. Colors reference COL (config/palette.ts).
// NOT in the config barrel (index.ts is frozen): import from 'config/fx-extra'.

import { COL } from './palette';

/** CSS hex string for a COL number — Text styles want '#rrggbb', Graphics want numbers. */
export const cssHex = (n: number): string => '#' + n.toString(16).padStart(6, '0');

/** ms→s divisor housed here so game/ physics integration stays literal-free. */
export const MS_PER_S = 1000;

// ── depth registry for the FX + kill-screen surfaces (matches the recon z-map) ──────────
export const FX_DEPTH = {
  pool: -4, // blood pools: on the ground band (-5), UNDER fighters (0) — §4 "spread under corpses"
  groundSpatter: -4, // ground spatter shares the pool plane (tell #8: persists)
  decal: 5, // sever splats (existing layer)
  loot: 39, // loot sits with the corpses, just under the blood emitter
  bloodEmitter: 40, // existing
  projectile: 44, // M2: kunai fly on the fighters' plane, under limbs/trails
  limb: 45, // existing
  smoke: 48, // M2: smoke-bomb puffs cover the vanishing fighter, under the blade trail
  bladeTrail: 50, // existing
  deflectSpark: 52, // M2: the swat flash reads over the blade trail (Tell 10)
  finisher: 150, // finisher flash covers world + HUD(100) + credits(120), below KillBeat
  killWash: 190, // existing KillBeat layers
  killGround: 191,
  killSil: 192,
  killSplat: 196, // ink splat above silhouettes, below the title
  killTitle: 200,
} as const;

// ── §4 slash-arc weapon color variants (p1 f31/f37/f62; p2 f9) ──────────────────────────
// steel default; blue katana; red sabre. Body under a lighter core (SLASH_ARC geometry).
export const ARC_VARIANTS = {
  steel: { body: COL.arcSteel, core: COL.arcSteelCore },
  blue: { body: COL.arcBlue, core: COL.arcBlueCore },
  red: { body: COL.arcRed, core: COL.arcRedCore },
} as const;
export type ArcVariant = keyof typeof ARC_VARIANTS;

// ── blood droplet particle texture (generated once, tinted at emit) ─────────────────────
export const BLOOD_DOT = {
  key: 'blood-dot',
  size: 8, // texture size, px (existing)
  r: 4, // dot radius (existing)
  white: 0xffffff, // untinted base so emitter tints read true
} as const;

// ── §4 persistent dark pools spreading under downed bodies (p1 f66; p2 f31/f48) ─────────
export const POOL_FX = {
  aspect: 0.3, // INFERRED (survey §4) — pool ellipse height/width (flat on the ground)
  startScale: 0.18, // INFERRED — pool birth size as a fraction of its full spread
  ease: 'Sine.easeOut', // INFERRED — spread decelerates as the pool settles
  reducedScale: 0.6, // reduced-gore mode: pools shrink instead of vanishing (corpse marker stays)
} as const;

// ── ground line fallback for FX placement ────────────────────────────────────────────────
// Mirrors DuelScene's GROUND_Y = GAME_H - 96 so pools/spatter land on the arena floor even
// before an integrator calls gore.bindGround(). bindGround() always overrides this.
export const FX_GROUND_OFFSET = 96;

// ── tell #8 ground spatter that sticks for the whole fight ───────────────────────────────
export const GROUND_SPATTER = {
  dotCount: 4, // INFERRED (survey §4) — persistent dots painted per burst
  spreadX: 42, // INFERRED — horizontal scatter around the impact, px
  dirBias: 22, // INFERRED — extra scatter shifted along the cut direction, px
  spreadY: 5, // INFERRED — vertical jitter so the ground line isn't a razor edge
  rMin: 1.5, // INFERRED — dot radius range, px
  rMax: 3.5,
  alpha: 0.8, // INFERRED — spatter opacity
} as const;

// ── sever splat + droplets (existing behavior, values moved out of Gore.ts) ─────────────
export const SEVER_DECAL = {
  coreRMin: 5,
  coreRMax: 9,
  coreAlpha: 0.85,
  dropletCount: 6,
  spreadX: 16,
  spreadYUp: 8, // droplets land within [-up, +down] of the splat
  spreadYDown: 16,
  dropletRMin: 2,
  dropletRMax: 4,
  dropletAlpha: 0.8,
} as const;

// ── flying severed limb (existing behavior, values moved out of Gore.ts) ────────────────
export const LIMB_FX = {
  lenMin: 20,
  lenMax: 30,
  r: 7, // limb capsule radius, px
  outlinePad: 3, // black outline extra width
  vxMin: 120, // px/s horizontal fling range
  vxMax: 220,
  vyMin: 180, // px/s upward pop range
  vyMax: 300,
  spinDeg: 360, // ± max total spin over the flight
  flightMs: 900,
  gravity: 900, // px/s² (existing arc feel)
  fadeStartFrac: 0.6, // alpha fade begins at this fraction of the flight
} as const;

// ── §4 loot pop extras (geometry/counts beyond LOOT_FX in config/fx.ts) ─────────────────
export const LOOT_DROP = {
  coinsMin: 3, // INFERRED (survey §4, p2 f31/f48) — coins per kill
  coinsMax: 6,
  papersMin: 1, // INFERRED — item papers per kill
  papersMax: 2,
  groundFriction: 0.55, // INFERRED — vx keep-fraction per bounce
  spinDamp: 0.6, // INFERRED — spin keep-fraction per bounce
  restSpeed: 26, // px/s — vertical speed below which a grounded piece settles
  groundJitter: 6, // px — per-piece rest-line scatter so loot doesn't align on one row
  coinRimW: 1.5, // darker rim stroke width on the gold disc
  shineW: 1.5, // white shine tick stroke width
  shineLen: 4, // shine tick half-length, px
  paperOutlineW: 1.5, // ink outline on item papers
  paperFoldAlpha: 0.5, // faint fold line across the paper
  twinkleAlphaLow: 0.68, // settled-loot alpha at the bottom of the twinkle pulse
} as const;

// ── §4 finisher flash overlay (p1 f56; p2 f35) ───────────────────────────────────────────
export const FINISHER_LAYERS = {
  groundBandFrac: 0.16, // INFERRED (survey p1 f56) — black ground band height fraction
  fadeOutMs: 120, // INFERRED — quick release back to the normal render
  silScale: 1, // silhouettes duplicate fighters at world scale
} as const;

// ── KillBeat timings (existing beat, values moved out of KillBeat.ts) ───────────────────
export const KILL_TIMING = {
  washSnapMs: 140, // red wash snaps in (matches the source)
  runDelayMs: 120,
  runMs: 900, // running silhouette crossing duration
  runCycles: 4, // leg cycles across the run
  runAmp: 1.3, // walkOffsets amplitude
  runSilScale: 1.7,
  revealMs: 980, // title + anatomy reveal after the run-in
} as const;

// ── §7 YOU WIN anatomy layout (p1 f03/f07; p2 f11) ──────────────────────────────────────
export const WIN_LAYOUT = {
  titleYFrac: 0.34, // INFERRED (survey §7) — title center sits ~1/3 down the frame
  promptGapY: 84, // "press R" prompt below the title block
  promptAlpha: 0.85,
  // irregular black ground strip (top edge wobbles; grass nicks + debris mounds on it)
  groundEdgeStep: 26, // px between edge wobble samples
  groundEdgeJitter: 5, // ± px top-edge wobble
  grassNickW: 9, // grass nick triangle base, px
  grassNickHMin: 6, // nick height range, px
  grassNickHMax: 16,
  moundWMin: 70, // debris mound ellipse width range, px
  moundWMax: 150,
  moundHMin: 16, // mound height range, px
  moundHMax: 34,
  // victory-pose fighter silhouettes standing on the strip
  silScale: 1.35,
  silSpreadX: 200, // spacing between multiple silhouettes
  silYInset: 2, // feet sink slightly into the strip
  // irregular ink splat under the title
  splatBlobCount: 6, // extra ellipse blobs around the main splat body
  splatBlobRMin: 16,
  splatBlobRMax: 42,
  splatDotCount: 9, // loose spatter dots around the splat
  splatDotRMin: 2,
  splatDotRMax: 5,
  splatSpreadX: 330, // dot scatter half-width
  splatSpreadY: 60, // dot scatter half-height
  splatDripLenMin: 16, // drips hanging off the splat's lower edge
  splatDripLenMax: 54,
  splatDripW: 5,
  // per-letter brush title
  titleJitterY: 5, // ± px per-letter baseline wobble (irregular baseline, §8)
  letterPad: 2, // extra tracking between letters, px
  spaceW: 26, // advance for the word gap, px
} as const;

// ── M2 §3.5 Smoke Bomb puff (game/vfx/SmokePuff.ts) — burst at the vanish point + a smaller
// reappear poof at the destination (blueprint Tell 10; smokeBombUsed event carries both x).
// All INFERRED — Ruffle frame-step may overwrite counts/timing (CALIBRATION §5).
export const SMOKE_PUFF = {
  key: 'smoke-dot', // generated soft-dot particle texture
  texSize: 32, // texture size, px
  rings: 4, // concentric alpha rings in the soft dot (fake radial gradient)
  ringAlpha: 0.3, // alpha added per ring toward the center
  white: 0xffffff, // untinted base so emitter tints read true (BLOOD_DOT precedent)
  particleCount: 14, // INFERRED — burst cloud at the vanish point
  reappearCount: 8, // INFERRED — smaller poof at the destination
  maxPerBurst: 32, // hard cap per burst (hostile-count chaos guard)
  riseMs: 560, // INFERRED — particle lifespan: the cloud swells, rises, thins out
  radius: 22, // emit-zone jitter radius around the puff center, px
  speedMin: 18, // px/s drift speed range
  speedMax: 74,
  angleMin: 195, // upward fan, degrees (270 = straight up in Phaser)
  angleMax: 345,
  gravityY: -66, // px/s² — negative: smoke rises
  scaleStart: 0.5, // puffs expand as they thin
  scaleEnd: 1.5,
  alphaStart: 0.85,
  centerYOffset: 58, // puff center height above the ground line, px (body center)
  tintLight: 0xd9d9d2, // INFERRED — pale smoke
  tintDark: 0x8f9188, // INFERRED — shadow smoke
} as const;

// ── M2 §3.6 kunai render (game/vfx/ProjectileView.ts) — mirrors SimState.projectiles;
// the sim is the position authority (x), the view only paints. Shape drawn nose → +x.
export const PROJECTILE_VIEW = {
  shaftLen: 22, // kunai shaft length, px
  shaftW: 3, // shaft stroke width, px
  tipLen: 9, // blade-tip triangle length past the shaft, px
  tipHalfW: 4, // blade-tip half-width, px
  ringR: 3, // tail pommel-ring radius, px
  outlinePad: 2, // black ink outline pad (house style)
  wobbleDeg: 6, // in-flight nose wobble amplitude, ± degrees
  wobbleHz: 9, // wobble frequency, cycles/s (deterministic from sim tFixed)
  blade: COL.blade, // steel body
  outline: COL.outline, // ink outline
} as const;

// ── M2 §3.6 deflect swat spark (game/vfx/DeflectSpark.ts) — contract keys flashMs/ringR.
// White core + expanding ring + radial tick sparks where the kunai was swatted (Tell 10).
export const DEFLECT_SWAT = {
  flashMs: 170, // INFERRED — spark lifetime, ms
  ringR: 34, // expanding ring radius at death, px
  ringStartR: 8, // ring radius at birth, px
  ringW: 3, // ring stroke width, px
  sparkCount: 6, // radial tick marks
  sparkLenMin: 9, // tick length range, px
  sparkLenMax: 17,
  sparkW: 2.5, // tick stroke width, px
  sparkTravel: 14, // px a tick's base slides outward over the flash
  coreR: 7, // white core flash radius, px
  coreAlpha: 0.95,
  core: 0xffffff, // core flash — pure white pop
  color: COL.bladeEdge, // ring + ticks — bright steel
} as const;

// ── M2 §3.4 spawn-invuln blink (Tell 9) — integrate-owned glue (contract fx-extra key).
// The blink tween starts when combat starts and is STOPPED by the sim's invulnEnded event
// (timeout or first slash), so the blink ends exactly on the sim frame; `repeats: -1`
// (infinite) leans on that event rather than pre-counting cycles. All INFERRED (M1 feel:
// 150ms yoyo to 0.35 alpha, carried from the pre-port DuelScene blink).
export const SPAWN_BLINK = {
  periodMs: 150, // one alpha dip (yoyo doubles it per cycle)
  alphaLow: 0.35, // dip floor
  repeats: -1, // infinite — the invulnEnded sim event stops the tween exactly on time
} as const;

// ── M2 §3.1/§3.7 crit flash (Tell 7) — the visible 3× beat on critLanded (contract key
// CRIT_FLASH{magnitude,durationMs}). A full-screen white wash under the HUD that fades out.
// All INFERRED — Ruffle frame-step calibration may overwrite (CALIBRATION §5).
export const CRIT_FLASH = {
  magnitude: 0.45, // wash peak alpha
  durationMs: 160, // fade-out duration, ms
  color: 0xffffff, // white pop
  depth: 95, // over the arena/FX (deflectSpark 52), under the HUD (100)
} as const;

// ── title + lose-variant colors (KillBeat) ───────────────────────────────────────────────
export const KILL_COLORS = {
  winTitleFill: COL.winRed, // §7: red fill…
  winTitleOutline: 0xffffff, // …+ white outline
  loseField: 0x1d2127, // existing lose wash greys (values carried from the M1 KillBeat)
  loseGround: 0x0f1216,
  loseTitleFill: COL.chromeCream,
  loseTitleOutline: COL.vignetteBlack,
  splatInk: COL.vignetteBlack, // the ink splat + ground strip are flat black
  promptText: COL.chromeCream,
} as const;
