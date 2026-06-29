# iaido-duel

A single-player, draw-to-slash samurai **duel** — a faithful, original-asset homage to the combat core
of the Flash game *Straw Hat Samurai: Duels* (Explosive Barrel), which died with Flash in January 2021.

> **Fan homage of Straw Hat Samurai: Duels by Explosive Barrel — unaffiliated, non-commercial.**

You draw a line and your samurai's blade sweeps along **the exact path you drew**, slicing — and
severing — your opponent. Read their telegraphs, manage your stance and Focus, and land the killing cut.

## Play

```bash
npm install
npm run dev      # opens http://localhost:5173
```

**Controls**

| Input | Action |
|---|---|
| Draw a line across the enemy | **Slash** (the blade follows your path) |
| Draw **up** | Jump |
| Quick **up-flick** | Launch |
| Draw **down** | Stab |
| `A` / `D` | Move |
| `SPACE` | Switch stance (Light / Balanced / Heavy — costs Focus) |
| `R` | Restart the duel |
| `B` | Toggle reduced blood |
| `M` | Toggle sound |

## Build & test

```bash
npm run build    # type-checks then builds (dist/)
npm test         # Vitest unit suite (the slash geometry + combat core)
```

## How it's built

- **Phaser 3 + TypeScript + Vite**, **Vitest** for the unit suite.
- A **pure, framework-free core** (`src/core/`) holds all combat math — vector/geometry, slash
  resolution, stances, Focus, gesture classification, AI state machine — and is fully unit-tested (TDD).
- Fighters are **procedural vector skeletons** of capsule "limbs", so an arbitrary drawn path can
  slice and sever them; all art is drawn in code and all SFX are synthesized (WebAudio) — **no sampled
  or ripped assets**.
- Design spec: `docs/superpowers/specs/`; build plan: `docs/superpowers/plans/`.

## Homage & originality

This is a **non-commercial fan homage**. Every asset here — character art, backgrounds, UI, and sound —
is **re-created from scratch** in the original's style. No art, audio, logo, or code from the original
game is decompiled, extracted, or shipped. The trademarked title is not used (the repo is `iaido-duel`).
Reference videos studied during development are kept **local-only and gitignored** (`reference/`), never
distributed. All credit for the original game and its inspiring style goes to **Explosive Barrel**.
