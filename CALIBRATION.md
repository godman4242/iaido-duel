# CALIBRATION.md (spec §4.2/§4.3)

Reference calibration is a **parallel refinement pass**, never a build gate. Each `INFERRED`
config value below starts at its §A seed and is overwritten as evidence arrives; record the
measured value + source + timestamp + `CONFIRMED`/`INFERRED` status here. No milestone blocks
waiting on footage.

**Reference sources studied (survey pass):**
- Longplay PART 1 — `youtube.com/watch?v=zFtCaTO0_1M` (FlashGamesArchive, ~69:45): intro card,
  Prologue/tutorial (Hiroshi, Ito dojo, Takahasi mining), town/inn, first duels.
- Longplay PART 2 — `youtube.com/watch?v=Nr4fQstqHDM` (~65:51): bounty/boss arc, "YOU WIN"
  screen, red finisher flash, War Room (Clan Aka Ryu), multi-enemy combat, title/loading screen.
- For frame-exact work: run the original under **Ruffle** and frame-step/eyedropper (pending).

> Status below is **survey-grade INFERRED** (read from compressed 512px frames, ~1 frame/70s).
> None is frame-stepped yet → none is `CONFIRMED`. The §F `(measure)` tells need CONFIRMED values.

| # | Calibration item | Target tolerance | Seed (config) | Survey observation | Status |
|---|---|---|---|---|---|
| 1 | Stage size & aspect | exact px W×H | 1024×576 16:9 `layout.ts` | widescreen letterbox; native px unconfirmed | INFERRED |
| 2 | Palette (eyedropper) | exact hex, ±0 locked | `palette.ts` COL | navy player haori vs oxblood enemy; saturated red blood over muted green/teal forest | INFERRED |
| 3 | Slash timing per stance | ±1 frame | `timing.ts` SLASH_FRAMES | not frame-stepped | INFERRED |
| 4 | Blade-trail render | width ±1px, fade ±20ms | (M1 VFX) | reads as a **blue** swept ribbon following the drawn line | INFERRED |
| 5 | Camera (baseline + impact) | mag ±10%, dur ±20ms | (M2) | side-scroll, zooms out when fighters separate | INFERRED |
| 6 | Kill/finisher beat | freeze ±1f, ramp ±20ms | (M2) | red full-screen flash on a duel-ending blow; "YOU WIN" splash | INFERRED |
| 7 | Shunpo | factor + drain | (M2) | not observed in Duels footage → candidate DESIGN-FROM-LORE | INFERRED |
| 8 | Blood FX | dir/count/decals | (M1 Gore) | red spray at hit point, along the cut | INFERRED |
| 9 | Parallax | layer count + ratios | (M1 bg) | sky / mountains / mid silhouettes / foreground band | INFERRED |
| 10 | Audio-cue timing | ±1 frame | `audio.ts` | menu vs combat music separate; no audio analysis yet | INFERRED |
| 11 | HUD layout & appearance | pos ±4px, color exact hex | (M4 Hud) | coins TOP-LEFT, EXP+minimap TOP-RIGHT, HP/Chi/AP + stance bottom-left, skill bar bottom; floating enemy HP bars | INFERRED |
| 12 | Typography | display + body faces | (M4) | display = brushy red ("DUELS" logo); body = clean caps | INFERRED |
| 13 | Locomotion & secondary motion | cadence | (M1 anim) | hat bob + garment trail; heavy weapon slows cadence | INFERRED |
| 14 | Jump | arc/gravity/apex | `combat.ts` LAUNCH_DY | parabolic; up-stroke driven | INFERRED |

**Method to upgrade a row to `CONFIRMED`:** load the SWF under Ruffle, frame-step the scenario,
read the value (frame counts / eyedropper hex / px), overwrite the `INFERRED` seed in the matching
`config/*` file, and change this row's Status to `CONFIRMED` with the exact source + timestamp.
