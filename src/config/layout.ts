// config/layout.ts — stage / canvas + (later) HUD layout constants.
// Central-config rule (spec §3): tunable gameplay/layout numbers live here, never as
// literals in core/ or game/. Provenance: CONTRACT = frozen, asserted by a test;
// INFERRED = calibration-tunable seed (spec §A / §E).

// Stage size is a CALIBRATION item (measure the native Flash stage, letterbox to it).
// 1024×576 / 16:9 is an INFERRED seed — the original was likely nearer 4:3/~640–800w.
export const GAME_W = 1024; // INFERRED — calibration target: exact native Flash stage width
export const GAME_H = 576; // INFERRED — calibration target: exact native Flash stage height
export const ASPECT = GAME_W / GAME_H; // INFERRED — derived from the above
