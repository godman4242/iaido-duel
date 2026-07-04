# Episode 1 · Plan 2 — Prologue cinematic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** On New Game, play the opening cinematic — a scrolling story narration over a dark ronin silhouette → a "PROLOGUE" title card → an ensō (zen brush circle) with a 3-line epigraph → then start the first area (Town). Fully skippable/advanceable. Indistinguishable from the source's opening in **form** (sequence, layout, timing); narration words are original-by-us (swappable).

**Architecture:** One new Phaser scene `PrologueScene`, played between Title's New Game and Town. It runs a linear sequence of beats with tweened fades; a click or key advances/skips. Content (narration paragraphs, epigraph lines, card text) lives in swappable module constants so the words can be replaced with verbatim transcriptions later. No pure-core logic (it's presentation) — verified by build + in-browser, like `TitleScene`.

**Tech Stack:** Phaser 3.90, TypeScript 5.5 (strict, ESM), Vite 5.

## Global Constraints

- **RECREATE, NEVER RIP.** Recreate the cinematic in our own Phaser graphics/text. `reference/` is study-only, gitignored.
- **NARRATIVE TEXT IS ORIGINAL-BY-US.** Use the original narration/epigraph constants in this plan verbatim (they are our own writing, not the source's). They are clearly-marked swappable constants Kheshav may later replace with his own transcriptions. Do NOT copy the source's prose/poem wording from the videos.
- **ART FIDELITY IS DEFERRED to a later dedicated pass** — match the source's **layout, sequence, and timing** now (form), but do NOT chase final art (brush fonts, painted backdrops, animated ronin). A flat silhouette + a drawn ensō + bold system text is the acceptable baseline; leave `// FIDELITY TODO` notes.
- **Frame study (form only):** the prologue beats are in the already-extracted `reference/frames/title/` pack (1 fps): prose scroll ≈ `t_012`–`t_031`, "PROLOGUE" card ≈ `t_033`–`t_036`, ensō + epigraph ≈ `t_037`–`t_043`. Open these to match the **layout/sequence**, not the art.
- **PUSH IS GATED — local commits are fine.** Commit locally per task; never `git push`. End each commit message with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **No unit tests for scenes** (Phaser needs a canvas); acceptance is a clean `npm run build` + the suite staying green (54). In-browser verification is controller-run.
- **Reuse, don't rebuild** existing systems.

## Content constants (our original writing — use verbatim; swappable)

```ts
// Original placeholder narration in the source's tone — swap for a verbatim transcription later if desired.
const PROLOGUE_NARRATION: readonly string[] = [
  'After the long war, the roads filled with masterless men.',
  'Some sold their swords. Some sold their names.',
  'Most were never heard from again.',
  'One walked toward the capital with a straw hat, an old blade,',
  'and a debt he could not name.',
];

const PROLOGUE_CARD = 'PROLOGUE';

// Original epigraph (our own haiku) — swappable.
const PROLOGUE_EPIGRAPH: readonly string[] = [
  'Wind across the reeds —',
  'one sword answers to no lord,',
  'the road keeps no name.',
];
```

---

## Task 1: PrologueScene — narration beat + wiring (Title → Prologue → Town)

**Files:**
- Create: `src/game/scenes/PrologueScene.ts`
- Modify: `src/game/scenes/TitleScene.ts` (New Game now starts `'Prologue'`, not `'Town'`)
- Modify: `src/main.ts` (register `PrologueScene`)

**Interfaces:**
- Consumes: `GameState` from `../../core/gamestate`. Receives `{ state: GameState }` via `scene.start('Prologue', { state })`.
- Produces: scene `'Prologue'`; on finish/skip it calls `this.scene.start('Town', { state })`.

**Behavior:**
- Study `reference/frames/title/t_012`–`t_031` for the prose-screen layout (dark background, a ronin silhouette, centered narration revealed line-by-line, a small "▶" advance hint, bottom of screen).
- Render a dark background (e.g. `#0d0d0d` with a subtle vignette) and a simple black ronin **silhouette** (a kasa + body shape via `Graphics` — flat, `// FIDELITY TODO` for real art). Reveal `PROLOGUE_NARRATION` lines with a gentle fade (stagger ~700–1000ms per line; tune to the frames).
- A pointer click or any key **advances** to the next beat immediately; if all narration shown, advancing proceeds to the next scene phase. (Task 2 inserts the card/ensō between here and Town; for Task 1, after narration → `this.scene.start('Town', { state })`.)
- Always provide a persistent **"Skip ▶"** affordance (corner text, interactive) that jumps straight to `this.scene.start('Town', { state })`.

- [ ] **Step 1: Create `PrologueScene`** with `constructor() { super('Prologue'); }`, `init(data: { state: GameState }) { this.state = data.state; }`, and a `create()` that renders the dark bg + silhouette + staggered narration reveal (using `this.tweens`/`this.time`), wires click/any-key to advance, and a "Skip ▶" corner control. After the last narration line is shown and the player advances, call `this.scene.start('Town', { state: this.state })`. Put `PROLOGUE_NARRATION` (from the Content constants above) as a module const. Add `// FIDELITY TODO` on the silhouette + fonts.

- [ ] **Step 2: Rewire Title New Game** — in `TitleScene.ts`, the NEW GAME handler changes its final line from `this.scene.start('Town', { state })` to `this.scene.start('Prologue', { state })`. (CONTINUE still goes straight to `'Town'` — returning players skip the prologue.)

- [ ] **Step 3: Register the scene** — in `src/main.ts` add `import { PrologueScene } from './game/scenes/PrologueScene';` and insert it into the array: `scene: [BootScene, TitleScene, PrologueScene, TownScene, DuelScene]`. Keep the `if (DEV) { … compare … }` block unchanged.

- [ ] **Step 4: Build + suite green**

Run: `npm run build` → clean. Run: `npm test` → 54 passing (no core changes).

- [ ] **Step 5: Commit (local only — never push)**

```bash
git add src/game/scenes/PrologueScene.ts src/game/scenes/TitleScene.ts src/main.ts
git commit -m "feat(prologue): narration cinematic; New Game routes Title -> Prologue -> Town

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 6 (controller):** in-browser — New Game plays the narration, click/key advances, Skip jumps to Town, CONTINUE still bypasses the prologue.

---

## Task 2: PROLOGUE card + ensō + epigraph beat

**Files:**
- Modify: `src/game/scenes/PrologueScene.ts`

**Interfaces:**
- Consumes: the scene state from Task 1. Produces: the same `'Prologue'` scene, now with two extra beats between narration and starting Town.

**Behavior:**
- Study `reference/frames/title/t_033`–`t_043` for the layout: a **white** screen with a centered **"PROLOGUE"** word, then a centered **ensō** (a single brush-stroke circle, slightly open) with the 3-line epigraph centered beneath it.
- After the narration beat, transition (fade to white) to: **Beat B** = the `PROLOGUE_CARD` word centered on white (hold ~1.2s, advance-able), then **Beat C** = draw an ensō via `Graphics` (a thick near-complete circle arc — `arc()`/`strokeCircle` with a gap; `// FIDELITY TODO` for a real brush ensō) with `PROLOGUE_EPIGRAPH` centered below it (hold, advance-able). After Beat C, `this.scene.start('Town', { state: this.state })`.
- Skip and click/any-key advance must work across all beats (refactor Task 1's advance into a small beat-index state machine inside the scene: `private beat = 0; advance() { … }`).

- [ ] **Step 1: Refactor the advance flow into a beat sequence** inside `PrologueScene` (e.g. an ordered list of beat-render functions `[renderNarration, renderCard, renderEnso]`, with `advance()` clearing the current beat and rendering the next, and after the last → `start('Town')`). Keep the Skip control jumping straight to Town.

- [ ] **Step 2: Implement `renderCard()`** — fade to white, center `PROLOGUE_CARD` in large dark brush-style text. `// FIDELITY TODO` for the brush font.

- [ ] **Step 3: Implement `renderEnso()`** — on white, draw an ensō (thick stroked circle with a small gap, slight rotation) via `Graphics`, and the `PROLOGUE_EPIGRAPH` lines centered beneath. `// FIDELITY TODO` for a real brush ensō + font.

- [ ] **Step 4: Build + suite green**

Run: `npm run build` → clean. Run: `npm test` → 54 passing.

- [ ] **Step 5: Commit (local only — never push)**

```bash
git add src/game/scenes/PrologueScene.ts
git commit -m "feat(prologue): PROLOGUE card + enso + epigraph beats

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 6 (controller):** in-browser — full sequence: narration → PROLOGUE → ensō + epigraph → Town; click/key advances each beat; Skip works from any beat.

---

## Self-review (against the spec)

- Spec §6 / roadmap Plan 2: prologue = narration → PROLOGUE → ensō + epigraph → first area, on New Game. ✓ (Tasks 1–2)
- Narrative text is original-by-us, swappable. ✓ (Content constants)
- Art fidelity deferred; form matched to frames. ✓ (Global Constraints + frame refs)
- Continue bypasses the prologue. ✓ (Task 1 Step 2)
- No placeholders left except the deliberate `// FIDELITY TODO` art notes and the swappable narrative constants.
