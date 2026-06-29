# Episode 1 · Plan 1 — Foundation (GameState · Save · Scene Flow · Title) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Boot the game into a faithful title screen (forest backdrop + recreated logo + New Game / Continue, adapting the source's online account panel to single-player) backed by a persistent, versioned save — the foundation every later campaign system extends. (The intro epigraph is NOT here — frame study shows it belongs to the Prologue cinematic; see the roadmap.)

**Architecture:** A pure, Phaser-free, unit-tested core (`GameState` data model + `save` serializer) sits under `src/core/`; a thin localStorage adapter (`src/game/persistence/Save.ts`) with an **injectable `StorageLike`** keeps it testable in the node test env. New Phaser scenes (`BootScene → TitleScene → TownScene`) drive the flow; the existing combat scene (`Duel`) is preserved and reachable via `?scene=duel` for the fidelity gate.

**Tech Stack:** Phaser 3.90, TypeScript 5.5 (strict, ESM), Vite 5, Vitest 2 (`environment: 'node'`, globals on).

## Global Constraints

These apply to EVERY task (copied from the campaign spec, `docs/superpowers/specs/2026-06-29-iaido-duel-story-campaign-design.md`):

- **RECREATE, NEVER RIP.** Ship only from our own files. Any source text (epigraph, dialogue, names) is **re-typed by studying `reference/full/*.mkv`** at build time — represented in code as a clearly-marked constant to fill from the video. NEVER decompile/extract/ship the original's binary art, audio, logo, or code.
- **`reference/` is gitignored, study-only, never shipped.**
- **FIDELITY = FRAME PACKS, not prose.** Before building any visual screen, ffmpeg the local `.mkv` into a per-screen pack under `reference/frames/<screen>/` (full-res stills + a contact sheet) and match the built screen pixel-for-pixel against those exact PNGs; the reviewer gates against the same frames. (Agents can read PNGs but cannot watch video.) Seeded: `reference/frames/title/`.
- **Repo must be PRIVATE before committing recreated content.** This is a personal, non-commercial homage. On-screen + README credit stays: "Fan homage of *Straw Hat Samurai: Duels* by Explosive Barrel — unaffiliated, non-commercial."
- **PUSH IS GATED — local commits are fine and expected.** Commit locally per task (TDD: red → green → commit); local commits never touch GitHub. Do NOT `git push` until the repo is private AND Kheshav says go. End every commit message with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Pure core is Phaser-free + TDD'd** (`src/core/**`), matching the existing suite (18 test files, 43+ tests). Content is **data-driven** under `src/data/` (later plans).
- **Test env is node** — no DOM/`localStorage` in tests. Anything touching storage takes an injected `StorageLike`.
- **Reuse, don't rebuild** the finished combat core (`Fighter`, `FighterAnimator`, `Skeleton`, `BladeTrail`, `Gore`, `KillBeat`, `Combo`, `Forest`, AI, `DuelScene`).

## Episode 1 plan roadmap (this doc = Plan 1 of 8)

Each is its own plan doc + working, testable deliverable, built on this foundation:

1. **Foundation** — GameState, Save, scene flow, **Title** (forest + logo + New Game/Continue). ← **this document**
2. **Prologue** — the New-Game intro cinematic: scrolling story prose over a ronin silhouette → "PROLOGUE" card → ensō + the 3-line epigraph → into the first area. (Text transcribed from frames at build time, per recreate-don't-rip.)
3. **Dialogue** — pure `core/dialogue.ts` runner + `ui/DialogueBox` (source-style bottom bar).
4. **Town + NPCs** — walkable `TownScene`, NPC walk-up-and-talk wired to dialogue + flags.
5. **Quests** — pure `core/quest.ts` engine + quest tracker/log UI, wired to NPCs.
6. **RPG core + screens** — `core/rpg/{stats,inventory,skills,shop,xp}` (TDD) + the four menu screens.
7. **StageScene** — extract `CombatStage` from `DuelScene`; multi-enemy stage, FIGHT!/YOU WIN/loot.
8. **Kasuta content** — data-driven tutorial chain tying it together to the indistinguishable bar.

---

## Task 1: GameState model + `createNewGame()` (pure core)

**Files:**
- Create: `src/core/gamestate.ts`
- Test: `src/core/__tests__/gamestate.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `interface PlayerState { name: string; level: number; xp: number; coins: number }`; `interface GameState { player: PlayerState; flags: Record<string, boolean>; area: string }`; `function createNewGame(): GameState`; `const STARTING_AREA: string`.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/__tests__/gamestate.test.ts
import { describe, it, expect } from 'vitest';
import { createNewGame, STARTING_AREA } from '../gamestate';

describe('gamestate', () => {
  it('createNewGame starts a level-1 ronin with no progress, in the starting area', () => {
    const s = createNewGame();
    expect(s.player).toEqual({ name: 'Ronin', level: 1, xp: 0, coins: 0 });
    expect(s.area).toBe(STARTING_AREA);
    expect(s.flags).toEqual({});
  });

  it('gives each new game its own flags object (no shared reference)', () => {
    const a = createNewGame();
    const b = createNewGame();
    a.flags.metShihan = true;
    expect(b.flags.metShihan).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- gamestate`
Expected: FAIL — `Cannot find module '../gamestate'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/gamestate.ts
/** The id of the area a new game starts in (Kasuta tutorial town). */
export const STARTING_AREA = 'kasuta';

export interface PlayerState {
  name: string;
  level: number;
  xp: number;
  coins: number;
}

/** The persisted campaign state — the single source of truth for a save. Extended by later systems. */
export interface GameState {
  player: PlayerState;
  flags: Record<string, boolean>; // story / quest / dialogue flags
  area: string; // current area id
}

/** A fresh save: a level-1 ronin with no progress, standing in the starting area. */
export function createNewGame(): GameState {
  return {
    player: { name: 'Ronin', level: 1, xp: 0, coins: 0 },
    flags: {},
    area: STARTING_AREA,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- gamestate`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit (local only — never push)**

```bash
git add src/core/gamestate.ts src/core/__tests__/gamestate.test.ts
git commit -m "feat(core): GameState model + createNewGame

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Save serialize / deserialize (pure core)

**Files:**
- Create: `src/core/save.ts`
- Test: `src/core/__tests__/save.test.ts`

**Interfaces:**
- Consumes: `GameState` from `./gamestate`.
- Produces: `const SAVE_VERSION: number`; `function serialize(state: GameState): string`; `function deserialize(json: string): GameState | null` (returns `null` on malformed JSON, non-envelope shape, or version mismatch).

- [ ] **Step 1: Write the failing test**

```ts
// src/core/__tests__/save.test.ts
import { describe, it, expect } from 'vitest';
import { serialize, deserialize, SAVE_VERSION } from '../save';
import { createNewGame } from '../gamestate';

describe('save', () => {
  it('round-trips a game state through serialize → deserialize', () => {
    const s = createNewGame();
    s.player.coins = 42;
    s.flags.metShihan = true;
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('returns null on malformed JSON', () => {
    expect(deserialize('not json {')).toBeNull();
  });

  it('returns null when the save version does not match', () => {
    const stale = JSON.stringify({ version: SAVE_VERSION + 1, state: createNewGame() });
    expect(deserialize(stale)).toBeNull();
  });

  it('returns null on a non-envelope payload', () => {
    expect(deserialize('null')).toBeNull();
    expect(deserialize('[]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- save`
Expected: FAIL — `Cannot find module '../save'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/save.ts
import { GameState } from './gamestate';

/** Bump when the GameState shape changes incompatibly; older saves then fail to load (return null). */
export const SAVE_VERSION = 1;

interface SaveEnvelope {
  version: number;
  state: GameState;
}

export function serialize(state: GameState): string {
  const envelope: SaveEnvelope = { version: SAVE_VERSION, state };
  return JSON.stringify(envelope);
}

export function deserialize(json: string): GameState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isEnvelope(parsed) || parsed.version !== SAVE_VERSION) return null;
  return parsed.state;
}

function isEnvelope(v: unknown): v is SaveEnvelope {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return typeof e.version === 'number' && typeof e.state === 'object' && e.state !== null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- save`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit (local only — never push)**

```bash
git add src/core/save.ts src/core/__tests__/save.test.ts
git commit -m "feat(core): versioned save serialize/deserialize

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: localStorage save adapter with injectable storage (game layer)

**Files:**
- Create: `src/game/persistence/Save.ts`
- Test: `src/game/persistence/__tests__/Save.test.ts`

**Interfaces:**
- Consumes: `serialize`, `deserialize` from `../../core/save`; `GameState`, `createNewGame` from `../../core/gamestate`.
- Produces: `const SAVE_KEY: string`; `interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }`; `function saveGame(state: GameState, storage?: StorageLike | null): void`; `function loadGame(storage?: StorageLike | null): GameState | null`; `function hasSave(storage?: StorageLike | null): boolean`; `function clearSave(storage?: StorageLike | null): void`. Default storage is `localStorage` (or `null` in the node test env).

- [ ] **Step 1: Write the failing test**

```ts
// src/game/persistence/__tests__/Save.test.ts
import { describe, it, expect } from 'vitest';
import { saveGame, loadGame, hasSave, clearSave, SAVE_KEY, StorageLike } from '../Save';
import { createNewGame } from '../../../core/gamestate';

function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('Save adapter', () => {
  it('has no save on a fresh storage', () => {
    expect(hasSave(fakeStorage())).toBe(false);
  });

  it('round-trips a saved game', () => {
    const store = fakeStorage();
    const s = createNewGame();
    s.player.coins = 7;
    saveGame(s, store);
    expect(hasSave(store)).toBe(true);
    expect(loadGame(store)).toEqual(s);
  });

  it('returns null when the stored value is corrupt', () => {
    const store = fakeStorage();
    store.setItem(SAVE_KEY, 'corrupt {');
    expect(loadGame(store)).toBeNull();
    expect(hasSave(store)).toBe(false);
  });

  it('clearSave removes the save', () => {
    const store = fakeStorage();
    saveGame(createNewGame(), store);
    clearSave(store);
    expect(hasSave(store)).toBe(false);
  });

  it('no-ops gracefully when storage is null (headless)', () => {
    expect(loadGame(null)).toBeNull();
    expect(() => saveGame(createNewGame(), null)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Save`
Expected: FAIL — `Cannot find module '../Save'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/game/persistence/Save.ts
import { GameState, createNewGame } from '../../core/gamestate';
import { serialize, deserialize } from '../../core/save';

export const SAVE_KEY = 'iaido-duel.save.v1';

/** Minimal Web-Storage subset — lets the adapter be unit-tested with an in-memory fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // no DOM (test env) or storage disabled
  }
}

export function saveGame(state: GameState, storage: StorageLike | null = defaultStorage()): void {
  storage?.setItem(SAVE_KEY, serialize(state));
}

export function loadGame(storage: StorageLike | null = defaultStorage()): GameState | null {
  const raw = storage?.getItem(SAVE_KEY) ?? null;
  return raw === null ? null : deserialize(raw);
}

export function hasSave(storage: StorageLike | null = defaultStorage()): boolean {
  return loadGame(storage) !== null;
}

export function clearSave(storage: StorageLike | null = defaultStorage()): void {
  storage?.removeItem(SAVE_KEY);
}

// re-export so callers can start a new game without reaching into core directly
export { createNewGame };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Save`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full suite — no regressions**

Run: `npm test`
Expected: PASS — previous 43+ tests plus the new gamestate/save/Save tests.

- [ ] **Step 6: Commit (local only — never push)**

```bash
git add src/game/persistence/Save.ts src/game/persistence/__tests__/Save.test.ts
git commit -m "feat(persistence): localStorage save adapter with injectable storage

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: BootScene + TownScene stub + scene wiring (boots into the world)

**Files:**
- Create: `src/game/scenes/BootScene.ts`
- Create: `src/game/scenes/TownScene.ts`
- Modify: `src/main.ts` (lines 1-13: imports + `scene` array)

**Interfaces:**
- Consumes: `loadGame`, `saveGame`, `createNewGame` from `../persistence/Save`; `GameState` from `../../core/gamestate`. Scene keys: `'Boot'`, `'Town'`, existing `'Duel'`.
- Produces: scene `'Boot'` (entry) and scene `'Town'` (receives `{ state: GameState }` via `scene.start`). `TownScene` is a placeholder replaced in Plan 3.

> No Vitest here — Phaser scenes need a canvas. Verification is `npm run build` (type-check) + in-browser observation (the fidelity-gate workflow used in Sessions 1–2).

- [ ] **Step 1: Create the TownScene placeholder**

```ts
// src/game/scenes/TownScene.ts
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { GameState } from '../../core/gamestate';

/** Placeholder hub — Plan 3 replaces this with the walkable Kasuta town. */
export class TownScene extends Phaser.Scene {
  private state!: GameState;

  constructor() {
    super('Town');
  }

  init(data: { state: GameState }): void {
    this.state = data.state;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1b1410');
    this.add
      .text(GAME_W / 2, GAME_H / 2 - 18, this.state.area.toUpperCase(), {
        fontFamily: 'serif',
        fontSize: '40px',
        color: '#e9dcc3',
      })
      .setOrigin(0.5);
    this.add
      .text(
        GAME_W / 2,
        GAME_H / 2 + 28,
        `Lv ${this.state.player.level} · ${this.state.player.coins} coin · engine foundation OK`,
        { fontFamily: 'serif', fontSize: '18px', color: '#b8a888' },
      )
      .setOrigin(0.5);
  }
}
```

- [ ] **Step 2: Create the BootScene**

```ts
// src/game/scenes/BootScene.ts
import Phaser from 'phaser';
import { loadGame, saveGame, createNewGame } from '../persistence/Save';

/** Entry point: routes to the campaign, preserving the standalone duel + fidelity gate. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const params = new URLSearchParams(location.search);
    // Preserve the finished duel and the ?compare= fidelity gate.
    if (params.get('scene') === 'duel' || params.has('compare')) {
      this.scene.start('Duel');
      return;
    }
    // Plan 1 Task 4: boot straight into the world with a loaded-or-new save.
    // (Task 5 inserts the Title screen and moves new/continue there.)
    const state = loadGame() ?? createNewGame();
    saveGame(state);
    this.scene.start('Town', { state });
  }
}
```

- [ ] **Step 3: Wire the scenes into the game** — replace `src/main.ts` lines 1-13 with:

```ts
import Phaser from 'phaser';
import { GAME_W, GAME_H, DEV } from './config';
import { BootScene } from './game/scenes/BootScene';
import { TownScene } from './game/scenes/TownScene';
import { DuelScene } from './game/scenes/DuelScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#0d0d0d',
  scene: [BootScene, TownScene, DuelScene],
  render: { antialias: true, roundPixels: false },
});
```

(Leave the `if (DEV) { … compare … }` block below unchanged.)

- [ ] **Step 4: Type-check / build**

Run: `npm run build`
Expected: PASS — `tsc --noEmit` clean, `vite build` succeeds.

- [ ] **Step 5: Verify in browser**

Run: `npm run dev`, open http://localhost:5173/
Expected: a brown TOWN screen reading **KASUTA** and `Lv 1 · 0 coin · engine foundation OK`.
Then: reload → still shows the town (save persisted). Open http://localhost:5173/?scene=duel → the **duel still runs** unchanged. (Mark this step **unverified until actually observed**.)

- [ ] **Step 6: Checkpoint** — stage, do NOT commit yet.

```bash
git add src/game/scenes/BootScene.ts src/game/scenes/TownScene.ts src/main.ts
```

---

## Task 5: TitleScene (forest + recreated logo + New Game / Continue) + reroute Boot

> **⚠ Frame-study correction (do this first).** Open `reference/frames/title/` and `reference/frames/title_sheet_0-75s.png`. The source title is **not** an epigraph screen — it's the **forest backdrop + the red brush "Straw Hat Samurai Duels" logo (top-left) + an online account panel** (username/password, Register/Login, Play as Guest). We **adapt** that panel to single-player: keep the look (forest bg + logo + a right-side panel) but the panel's actions are **New Game / Continue** — no accounts/Facebook. The **epigraph moved to Plan 2 (Prologue)**. Recreate the logo lettering in **our own brush font** (do NOT use a ripped logo image); the on-screen trademarked words are pending Kheshav's confirm (public repo identity stays `iaido-duel`). Match layout/colors to the frames; the code below is a starting skeleton — revise it to hit the frames.

**Files:**
- Create: `src/game/scenes/TitleScene.ts`
- Modify: `src/game/scenes/BootScene.ts` (the create() body — route to `'Title'`)
- Modify: `src/main.ts` (add `TitleScene` to imports + `scene` array)

**Interfaces:**
- Consumes: `createNewGame`, `loadGame`, `saveGame`, `hasSave` from `../persistence/Save`. Scene key `'Title'`; starts `'Town'` with `{ state }`.
- Produces: scene `'Title'`.

- [ ] **Step 1: Create the TitleScene**

```ts
// src/game/scenes/TitleScene.ts
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { createNewGame, loadGame, saveGame, hasSave } from '../persistence/Save';

// RECREATE, DON'T RIP: transcribe the three epigraph lines from reference/full/*.mkv (opening seconds)
// and paste them here. Placeholders below until done; tune brush font/size/fade at the fidelity gate.
const INTRO_EPIGRAPH: readonly string[] = [
  '<epigraph line 1 — transcribe from the video>',
  '<epigraph line 2 — transcribe from the video>',
  '<epigraph line 3 — transcribe from the video>',
];

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0d0d0d');

    INTRO_EPIGRAPH.forEach((line, i) => {
      this.add
        .text(GAME_W / 2, GAME_H / 2 - 90 + i * 34, line, {
          fontFamily: 'serif',
          fontSize: '24px',
          color: '#e9dcc3',
        })
        .setOrigin(0.5);
    });

    this.menuItem(GAME_H / 2 + 60, 'NEW GAME', () => {
      const state = createNewGame();
      saveGame(state);
      this.scene.start('Town', { state });
    });

    this.menuItem(
      GAME_H / 2 + 100,
      'CONTINUE',
      () => {
        const state = loadGame();
        if (state) this.scene.start('Town', { state });
      },
      hasSave(),
    );
  }

  private menuItem(y: number, label: string, onClick: () => void, enabled = true): void {
    const t = this.add
      .text(GAME_W / 2, y, label, {
        fontFamily: 'serif',
        fontSize: '22px',
        color: enabled ? '#d9c39a' : '#5a5145',
      })
      .setOrigin(0.5);
    if (!enabled) return;
    t.setInteractive({ useHandCursor: true })
      .on('pointerover', () => t.setColor('#ffffff'))
      .on('pointerout', () => t.setColor('#d9c39a'))
      .on('pointerdown', onClick);
  }
}
```

- [ ] **Step 2: Reroute BootScene to the Title** — replace the create() body of `src/game/scenes/BootScene.ts` with:

```ts
  create(): void {
    const params = new URLSearchParams(location.search);
    // Preserve the finished duel and the ?compare= fidelity gate.
    if (params.get('scene') === 'duel' || params.has('compare')) {
      this.scene.start('Duel');
      return;
    }
    // Title owns new-game / continue (Continue is enabled there when a save exists).
    this.scene.start('Title');
  }
```

(The `loadGame`/`saveGame`/`createNewGame` imports in BootScene are now unused — remove them so `tsc` stays clean; BootScene needs no imports beyond `Phaser`.)

- [ ] **Step 3: Register the Title scene** — in `src/main.ts`, add the import and slot it after Boot:

```ts
import { TitleScene } from './game/scenes/TitleScene';
```
```ts
  scene: [BootScene, TitleScene, TownScene, DuelScene],
```

- [ ] **Step 4: Type-check / build**

Run: `npm run build`
Expected: PASS — clean (no unused-import errors from BootScene).

- [ ] **Step 5: Verify in browser**

Run: `npm run dev`, open http://localhost:5173/
Expected: boots to the **TITLE** — three epigraph lines (placeholder text until transcribed) over **NEW GAME** / **CONTINUE**. With no save, CONTINUE is dimmed. Click **NEW GAME** → the KASUTA town screen. Reload → CONTINUE is now lit → click it → returns to town. http://localhost:5173/?scene=duel still runs the duel. (Mark **unverified until observed**; transcribe the epigraph words at this gate against the video.)

- [ ] **Step 6: Final checkpoint for Plan 1** — run the full suite + build, then stage. Hold the commit.

```bash
npm test && npm run build
git add src/game/scenes/TitleScene.ts src/game/scenes/BootScene.ts src/main.ts
# Plan 1 complete. Commit the whole foundation only after Kheshav's go-ahead + private repo.
```

---

## Self-review (against the spec)

- **Spec §5.1 (`core/gamestate`, `core/save`)** → Tasks 1–2. ✓ (Other `core/` modules — dialogue, quest, rpg/* — are later plans, per the roadmap.)
- **Spec §5.3 (`persistence/Save`, Boot/Title/Town scenes)** → Tasks 3–5. ✓ (Overworld/Stage/menu scenes are later plans.)
- **Spec §5.4 (flow Boot → Title → Town; GameState saved to localStorage)** → Tasks 4–5. ✓
- **Spec §6 (Title + intro epigraph)** → Task 5, with the epigraph text deferred to build-time transcription per the recreate-don't-rip constraint. ✓
- **Reuse of combat core / duel preserved** → `?scene=duel` route in Tasks 4–5. ✓
- **Placeholder scan:** the only `<…>` placeholders are the epigraph lines — intentional, gated by the recreate-don't-rip constraint, flagged in code + verify steps. No stray TODO/TBD.
- **Type consistency:** `StorageLike`, `GameState`, `createNewGame`, `serialize`/`deserialize`, scene keys `'Boot'/'Title'/'Town'/'Duel'`, and the `scene.start('Town', { state })` payload shape are used identically across all tasks. ✓
