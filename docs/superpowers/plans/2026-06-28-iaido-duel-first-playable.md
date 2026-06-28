# iaido-duel First-Playable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-player draw-to-slash samurai duel (you vs. one AI) that is indistinguishable from the *Straw Hat Samurai: Duels* gameplay videos, using our own re-created assets.

**Architecture:** A **pure, framework-free core** (`src/core/`) holds all combat math — vector/geometry, slash resolution, stances, focus, gesture classification — and is exhaustively unit-tested (TDD). A thin **Phaser layer** (`src/game/`) renders procedural vector fighters, captures pointer gestures, and wires the core into a playable `DuelScene`. Fighters are skeletons of capsule "limbs" so an arbitrary drawn path can slice and sever them. A dev-only **CompareView** is the fidelity gate.

**Tech Stack:** Phaser 3 (v3.90), TypeScript, Vite (dev/build), Vitest (unit tests). No physics engine — combat geometry is our own pure code.

## Global Constraints

- **Original assets only.** Re-create all art/audio in the style; never decompile, extract, or ship the original's assets, logo, or trademarked name. Repo name stays `iaido-duel`.
- **Credit (verbatim), in README + an in-game About/credit line:** `Faithful fan homage of Straw Hat Samurai: Duels by Explosive Barrel — unaffiliated, non-commercial.`
- **`reference/` and `RESUME_HERE.md` stay gitignored** (already configured). Never commit reference stills.
- **Performance:** hold **60fps**; pointer-down → slash-start **< 50ms**.
- **Palette (exact targets — use these constants, defined once in `src/palette.ts`):**
  forest `#49a431 #2e922e #31a030 #1d7330 #173012 #62905e #78a760`; kimono `#e8f3ef #e9eddb #dadfc3`; hat/wood `#794702`; outline `#040304`; sky/highlight `#d8dbf1 #eceffe`; blood `#a50103 #950202`; UI cream `#efedc2`; gold `#e8a83a`; health green `#5bbf2e`; focus blue `#3a7fd5`.
- **Coordinate note:** screen-space, **+y is downward**. "Up" gestures have negative Δy.
- **Commit after every task.** Work on branch `feat/first-playable-duel`. Do **not** push to any remote.
- **TDD for `src/core/`:** failing test → run (fail) → minimal impl → run (pass) → commit. Pure modules import nothing from `phaser`.

---

## File Structure

```
index.html                     # mounts #game, loads src/main.ts
package.json tsconfig.json vite.config.ts vitest.config.ts
src/
  main.ts                      # Phaser.Game bootstrap
  config.ts                    # GAME_W/H, DEV flag, tunables
  palette.ts                   # exact hex color constants (numbers 0xRRGGBB)
  core/                        # PURE — no phaser import; 100% unit-tested
    vec.ts                     # Pt type + vector helpers
    geometry.ts                # segment/polyline/capsule overlap
    stance.ts                  # 3 stances + counter triangle
    focus.ts                   # Focus meter
    slash.ts                   # resolveSlash() — the combat core
    gesture.ts                 # classifyGesture()
    ai.ts                      # pure AI state-machine transitions
    __tests__/*.test.ts        # vitest specs
  game/
    input/GestureInput.ts      # phaser pointer capture → core path/gesture
    fighter/Skeleton.ts        # bone joints + pose → world limb capsules
    fighter/drawFighter.ts     # vector-draw a skeleton via Graphics
    fighter/Fighter.ts         # phaser container: health, hit/sever, exposes capsules
    ai/AIController.ts         # drives enemy Fighter from core/ai.ts
    vfx/BladeTrail.ts          # red slash trail along drawn path
    vfx/Gore.ts                # blood spray + sever + reduce-blood toggle
    vfx/SlowMo.ts              # killing-blow time-scale dip + flash
    ui/Hud.ts                  # portrait + health + focus + floating bars
    background/Forest.ts       # layered parallax forest (paint-swap seam)
    audio/sfx.ts               # synthesized slash/impact/chime/grunt
    scenes/DuelScene.ts        # orchestrates everything
  dev/CompareView.ts           # dev-only side-by-side vs a reference still
```

---

# PHASE 0 — Scaffold

### Task 1: Project scaffold that runs, tests, and builds

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.ts`, `src/config.ts`, `src/palette.ts`, `src/game/scenes/DuelScene.ts`, `src/core/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: `GAME_W=1024`, `GAME_H=576` and `DEV` from `src/config.ts`; `COL` palette map from `src/palette.ts`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "iaido-duel",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": { "phaser": "^3.90.0" },
  "devDependencies": { "typescript": "^5.5.0", "vite": "^5.4.0", "vitest": "^2.0.0" }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020", "module": "ESNext", "moduleResolution": "bundler",
    "strict": true, "noUnusedLocals": true, "noUnusedParameters": true,
    "esModuleInterop": true, "skipLibCheck": true, "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vite.config.ts` and `vitest.config.ts`**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
export default defineConfig({ server: { open: true } });
```
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { globals: true, environment: 'node' } });
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>iaido-duel</title>
    <style>html,body{margin:0;background:#0d0d0d;overflow:hidden}#game{display:flex;justify-content:center}</style>
  </head>
  <body><div id="game"></div><script type="module" src="/src/main.ts"></script></body>
</html>
```

- [ ] **Step 5: Create `src/config.ts` and `src/palette.ts`**

```typescript
// src/config.ts
export const GAME_W = 1024;
export const GAME_H = 576;
export const DEV = import.meta.env?.DEV ?? false;
```
```typescript
// src/palette.ts — exact eyedropped targets (0xRRGGBB)
export const COL = {
  skyTop: 0xd8dbf1, skyLow: 0xeceffe,
  forestBright: 0x49a431, forestMid: 0x2e922e, forestMid2: 0x31a030,
  forestShadow: 0x1d7330, forestDark: 0x173012, sage: 0x62905e, sage2: 0x78a760,
  kimono: 0xe8f3ef, kimono2: 0xe9eddb, kimonoShade: 0xdadfc3,
  wood: 0x794702, outline: 0x040304,
  blood: 0xa50103, bloodDark: 0x950202,
  cream: 0xefedc2, gold: 0xe8a83a, healthGreen: 0x5bbf2e, focusBlue: 0x3a7fd5,
} as const;
```

- [ ] **Step 6: Create `src/game/scenes/DuelScene.ts` (placeholder render)**

```typescript
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { COL } from '../../palette';

export class DuelScene extends Phaser.Scene {
  constructor() { super('Duel'); }
  create() {
    this.cameras.main.setBackgroundColor(COL.forestShadow);
    this.add.text(GAME_W / 2, GAME_H / 2, 'iaido-duel', { fontFamily: 'serif', fontSize: '32px', color: '#efedc2' })
      .setOrigin(0.5);
  }
}
```

- [ ] **Step 7: Create `src/main.ts`**

```typescript
import Phaser from 'phaser';
import { GAME_W, GAME_H } from './config';
import { DuelScene } from './game/scenes/DuelScene';

new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: GAME_W, height: GAME_H,
  backgroundColor: '#0d0d0d', scene: [DuelScene],
  render: { antialias: true, roundPixels: false },
});
```

- [ ] **Step 8: Create `src/core/__tests__/smoke.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
describe('smoke', () => { it('runs vitest', () => { expect(1 + 1).toBe(2); }); });
```

- [ ] **Step 9: Install, then verify all three pipelines**

Run: `npm install`
Run: `npm test` → Expected: 1 passed (smoke).
Run: `npm run build` → Expected: builds with no TS errors, emits `dist/`.
Run: `npm run dev` → Expected: browser opens, canvas shows dark-green bg + "iaido-duel" text. (Manually confirm, then Ctrl-C.)

- [ ] **Step 10: Add `.gitignore` deps already cover node_modules/dist. Commit.**

```bash
git add -A && git commit -m "chore: scaffold Phaser 3 + TS + Vite + Vitest, running DuelScene"
```

---

# PHASE 1 — Pure combat core (TDD; the kickoff's testable heart)

### Task 2: Vector helpers (`core/vec.ts`)

**Files:** Create `src/core/vec.ts`, `src/core/__tests__/vec.test.ts`

**Interfaces:**
- Produces: `type Pt = {x:number;y:number}`; `sub(a,b):Pt`, `add(a,b):Pt`, `scale(a,s):Pt`, `dot(a,b):number`, `len(a):number`, `dist(a,b):number`.

- [ ] **Step 1: Write failing test `vec.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { sub, add, scale, dot, len, dist } from '../vec';
describe('vec', () => {
  it('sub/add/scale', () => {
    expect(sub({x:5,y:3},{x:2,y:1})).toEqual({x:3,y:2});
    expect(add({x:1,y:1},{x:2,y:3})).toEqual({x:3,y:4});
    expect(scale({x:2,y:-3},2)).toEqual({x:4,y:-6});
  });
  it('dot/len/dist', () => {
    expect(dot({x:1,y:0},{x:0,y:1})).toBe(0);
    expect(len({x:3,y:4})).toBe(5);
    expect(dist({x:0,y:0},{x:3,y:4})).toBe(5);
  });
});
```

- [ ] **Step 2: Run → fail** `npx vitest run src/core/__tests__/vec.test.ts` (Cannot find module '../vec').
- [ ] **Step 3: Implement `src/core/vec.ts`**

```typescript
export type Pt = { x: number; y: number };
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (a: Pt, s: number): Pt => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Pt, b: Pt): number => a.x * b.x + a.y * b.y;
export const len = (a: Pt): number => Math.hypot(a.x, a.y);
export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
```

- [ ] **Step 4: Run → pass.** `npx vitest run src/core/__tests__/vec.test.ts`
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(core): vector helpers"`

---

### Task 3: Geometry — point-to-segment distance, segment-in-capsule overlap (`core/geometry.ts`)

**Files:** Create `src/core/geometry.ts`, `src/core/__tests__/geometry.test.ts`

**Interfaces:**
- Consumes: `Pt` from `vec.ts`.
- Produces:
  - `type Capsule = { a: Pt; b: Pt; r: number }`
  - `pointSegDist(p: Pt, a: Pt, b: Pt): number`
  - `segCapsuleOverlap(p0: Pt, p1: Pt, c: Capsule, steps?: number): number` — approx length of segment p0→p1 lying within radius `r` of the capsule core (sampled).
  - `polylineCapsuleOverlap(path: Pt[], c: Capsule): number` — sum over consecutive path segments.
  - `firstPointInCapsule(path: Pt[], c: Capsule): Pt | null`

- [ ] **Step 1: Write failing test `geometry.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { pointSegDist, segCapsuleOverlap, polylineCapsuleOverlap, firstPointInCapsule } from '../geometry';

const cap = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, r: 10 }; // horizontal limb, radius 10

describe('geometry', () => {
  it('pointSegDist: perpendicular and beyond-endpoint', () => {
    expect(pointSegDist({ x: 50, y: 7 }, cap.a, cap.b)).toBeCloseTo(7, 5);
    expect(pointSegDist({ x: 120, y: 0 }, cap.a, cap.b)).toBeCloseTo(20, 5); // clamps to endpoint b
  });
  it('segCapsuleOverlap: vertical stroke clean through has overlap ~= 2r', () => {
    const ov = segCapsuleOverlap({ x: 50, y: -40 }, { x: 50, y: 40 }, cap);
    expect(ov).toBeGreaterThan(16); expect(ov).toBeLessThan(24); // ~2*r=20
  });
  it('segCapsuleOverlap: stroke that misses returns 0', () => {
    expect(segCapsuleOverlap({ x: 50, y: 40 }, { x: 50, y: 25 }, cap)).toBe(0);
  });
  it('polylineCapsuleOverlap sums segments; firstPointInCapsule finds entry', () => {
    const path = [{ x: 50, y: -40 }, { x: 50, y: 0 }, { x: 50, y: 40 }];
    expect(polylineCapsuleOverlap(path, cap)).toBeGreaterThan(16);
    expect(firstPointInCapsule(path, cap)).toEqual({ x: 50, y: 0 });
  });
});
```

- [ ] **Step 2: Run → fail.** `npx vitest run src/core/__tests__/geometry.test.ts`
- [ ] **Step 3: Implement `src/core/geometry.ts`**

```typescript
import { Pt } from './vec';
export type Capsule = { a: Pt; b: Pt; r: number };

export function pointSegDist(p: Pt, a: Pt, b: Pt): number {
  const abx = b.x - a.x, aby = b.y - a.y;
  const apx = p.x - a.x, apy = p.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : (apx * abx + apy * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * abx, cy = a.y + t * aby;
  return Math.hypot(p.x - cx, p.y - cy);
}

// Sampled overlap length of segment p0->p1 within radius r of capsule core a-b.
export function segCapsuleOverlap(p0: Pt, p1: Pt, c: Capsule, steps = 64): number {
  const segLen = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  if (segLen === 0) return 0;
  let inside = 0;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    const x = p0.x + (p1.x - p0.x) * t, y = p0.y + (p1.y - p0.y) * t;
    if (pointSegDist({ x, y }, c.a, c.b) <= c.r) inside++;
  }
  return (inside / steps) * segLen;
}

export function polylineCapsuleOverlap(path: Pt[], c: Capsule): number {
  let total = 0;
  for (let i = 0; i + 1 < path.length; i++) total += segCapsuleOverlap(path[i], path[i + 1], c);
  return total;
}

export function firstPointInCapsule(path: Pt[], c: Capsule): Pt | null {
  for (const p of path) if (pointSegDist(p, c.a, c.b) <= c.r) return p;
  return null;
}
```

- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(core): capsule/polyline overlap geometry"`

---

### Task 4: Stances + counter triangle (`core/stance.ts`)

**Files:** Create `src/core/stance.ts`, `src/core/__tests__/stance.test.ts`

**Interfaces:**
- Produces:
  - `type StanceId = 'light'|'balanced'|'heavy'`
  - `type Stance = { id: StanceId; reach: number; speed: number; dmgMult: number; damageTakenMult: number }`
  - `const STANCES: Record<StanceId, Stance>`
  - `counterBonus(attacker: StanceId, defender: StanceId): number` (1.25 if attacker's stance beats defender's, else 1.0)
  - Triangle: **light beats heavy, balanced beats light, heavy beats balanced.**

- [ ] **Step 1: Write failing test `stance.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { STANCES, counterBonus } from '../stance';
describe('stance', () => {
  it('stat table', () => {
    expect(STANCES.light.dmgMult).toBe(0.9);
    expect(STANCES.balanced.dmgMult).toBe(1.2);
    expect(STANCES.heavy.dmgMult).toBe(1.4);
    expect(STANCES.heavy.damageTakenMult).toBe(1.25); // -20% def => takes 25% more
    expect(STANCES.light.reach).toBeGreaterThan(STANCES.heavy.reach);
  });
  it('counter triangle: light>heavy>balanced>light', () => {
    expect(counterBonus('light', 'heavy')).toBe(1.25);
    expect(counterBonus('heavy', 'balanced')).toBe(1.25);
    expect(counterBonus('balanced', 'light')).toBe(1.25);
    expect(counterBonus('heavy', 'light')).toBe(1.0);
    expect(counterBonus('light', 'light')).toBe(1.0);
  });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement `src/core/stance.ts`**

```typescript
export type StanceId = 'light' | 'balanced' | 'heavy';
export type Stance = { id: StanceId; reach: number; speed: number; dmgMult: number; damageTakenMult: number };

export const STANCES: Record<StanceId, Stance> = {
  light:    { id: 'light',    reach: 300, speed: 1.4, dmgMult: 0.9, damageTakenMult: 1.0 },
  balanced: { id: 'balanced', reach: 200, speed: 1.0, dmgMult: 1.2, damageTakenMult: 1.0 },
  heavy:    { id: 'heavy',    reach: 120, speed: 0.7, dmgMult: 1.4, damageTakenMult: 1.25 },
};

const BEATS: Record<StanceId, StanceId> = { light: 'heavy', heavy: 'balanced', balanced: 'light' };
export function counterBonus(attacker: StanceId, defender: StanceId): number {
  return BEATS[attacker] === defender ? 1.25 : 1.0;
}
```

- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(core): stances + counter triangle"`

---

### Task 5: Focus meter (`core/focus.ts`)

**Files:** Create `src/core/focus.ts`, `src/core/__tests__/focus.test.ts`

**Interfaces:**
- Produces: `class Focus` with `value:number` (0..FOCUS_MAX), `gain(n)`, `canSwitch():boolean`, `spendSwitch()`, `isCrit():boolean`. Constants `FOCUS_MAX=100`, `SWITCH_COST=34`, `CRIT_THRESHOLD=80`.

- [ ] **Step 1: Write failing test `focus.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { Focus, FOCUS_MAX, SWITCH_COST } from '../focus';
describe('focus', () => {
  it('gain clamps to max; crit above threshold', () => {
    const f = new Focus(); f.gain(200);
    expect(f.value).toBe(FOCUS_MAX); expect(f.isCrit()).toBe(true);
  });
  it('switch spends focus and is gated when too low', () => {
    const f = new Focus(); f.gain(SWITCH_COST);
    expect(f.canSwitch()).toBe(true); f.spendSwitch(); expect(f.value).toBe(0);
    expect(f.canSwitch()).toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement `src/core/focus.ts`**

```typescript
export const FOCUS_MAX = 100;
export const SWITCH_COST = 34;
export const CRIT_THRESHOLD = 80;

export class Focus {
  value = 0;
  gain(n: number) { this.value = Math.max(0, Math.min(FOCUS_MAX, this.value + n)); }
  canSwitch() { return this.value >= SWITCH_COST; }
  spendSwitch() { if (this.canSwitch()) this.value -= SWITCH_COST; }
  isCrit() { return this.value >= CRIT_THRESHOLD; }
}
```

- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(core): focus meter"`

---

### Task 6: `resolveSlash()` — combat resolution (`core/slash.ts`) ⭐

**Files:** Create `src/core/slash.ts`, `src/core/__tests__/slash.test.ts`

**Interfaces:**
- Consumes: `Pt`, `Capsule`, geometry overlaps, stance types.
- Produces:
  - `type Limb = { id: string; capsule: Capsule; severThreshold: number }`
  - `type SlashInput = { path: Pt[]; origin: Pt; reach: number; dmgMult: number; crit: boolean; counter: number }`
  - `type Defender = { damageTakenMult: number; atkPlusWeapon: number }` — note: `atkPlusWeapon` is the *attacker's* (ATK+weaponDmg); pass attacker's value here.
  - `type LimbHit = { limbId: string; overlap: number; severed: boolean; cutPoint: Pt }`
  - `type SlashResult = { hits: LimbHit[]; totalDamage: number }`
  - `resolveSlash(input: SlashInput, limbs: Limb[], atkPlusWeapon: number, defenderDamageTakenMult: number): SlashResult`
  - Damage: `base = atkPlusWeapon * dmgMult * (crit?1.3:1) * counter`; `totalDamage = anyHit ? round(base * defenderDamageTakenMult * (1 + 0.5*severedCount)) : 0`.
  - Reach gate: a limb only counts if its capsule midpoint is within `reach` of `origin`.

- [ ] **Step 1: Write failing test `slash.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { resolveSlash, Limb } from '../slash';

const arm: Limb = { id: 'arm', capsule: { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, r: 10 }, severThreshold: 18 };
const farLeg: Limb = { id: 'leg', capsule: { a: { x: 500, y: 0 }, b: { x: 600, y: 0 }, r: 10 }, severThreshold: 18 };
const origin = { x: 50, y: 0 };

describe('resolveSlash', () => {
  it('a stroke through the arm hits and (long stroke) severs', () => {
    const path = [{ x: 50, y: -40 }, { x: 50, y: 40 }];
    const r = resolveSlash({ path, origin, reach: 300, dmgMult: 1.0, crit: false, counter: 1 }, [arm], 10, 1.0);
    expect(r.hits.map(h => h.limbId)).toEqual(['arm']);
    // overlap ~2r=20 >= severThreshold 18
    expect(r.hits[0].severed).toBe(true);
    expect(r.totalDamage).toBe(Math.round(10 * 1.0 * 1.0 * 1.0 * (1 + 0.5))); // 15
  });
  it('reach gate: far limb out of reach is not hit', () => {
    const path = [{ x: 550, y: -40 }, { x: 550, y: 40 }];
    const r = resolveSlash({ path, origin, reach: 120, dmgMult: 1.0, crit: false, counter: 1 }, [farLeg], 10, 1.0);
    expect(r.hits).toEqual([]); expect(r.totalDamage).toBe(0);
  });
  it('crit + counter + defenseTaken multiply into damage', () => {
    const path = [{ x: 50, y: -5 }, { x: 50, y: 5 }]; // short nick: hits, no sever
    const r = resolveSlash({ path, origin, reach: 300, dmgMult: 1.4, crit: true, counter: 1.25 }, [arm], 10, 1.25);
    expect(r.hits[0].severed).toBe(false);
    // base = 10*1.4*1.3*1.25 = 22.75 ; *1.25 def ; *(1+0) = 28.4375 -> 28
    expect(r.totalDamage).toBe(28);
  });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement `src/core/slash.ts`**

```typescript
import { Pt } from './vec';
import { Capsule, polylineCapsuleOverlap, firstPointInCapsule } from './geometry';

export type Limb = { id: string; capsule: Capsule; severThreshold: number };
export type SlashInput = { path: Pt[]; origin: Pt; reach: number; dmgMult: number; crit: boolean; counter: number };
export type LimbHit = { limbId: string; overlap: number; severed: boolean; cutPoint: Pt };
export type SlashResult = { hits: LimbHit[]; totalDamage: number };

const mid = (c: Capsule): Pt => ({ x: (c.a.x + c.b.x) / 2, y: (c.a.y + c.b.y) / 2 });

export function resolveSlash(
  input: SlashInput, limbs: Limb[], atkPlusWeapon: number, defenderDamageTakenMult: number,
): SlashResult {
  const hits: LimbHit[] = [];
  for (const limb of limbs) {
    const m = mid(limb.capsule);
    if (Math.hypot(m.x - input.origin.x, m.y - input.origin.y) > input.reach) continue; // reach gate
    const overlap = polylineCapsuleOverlap(input.path, limb.capsule);
    if (overlap <= 0) continue;
    const cut = firstPointInCapsule(input.path, limb.capsule) ?? m;
    hits.push({ limbId: limb.id, overlap, severed: overlap >= limb.severThreshold, cutPoint: cut });
  }
  let totalDamage = 0;
  if (hits.length) {
    const severed = hits.filter(h => h.severed).length;
    const base = atkPlusWeapon * input.dmgMult * (input.crit ? 1.3 : 1) * input.counter;
    totalDamage = Math.round(base * defenderDamageTakenMult * (1 + 0.5 * severed));
  }
  return { hits, totalDamage };
}
```

- [ ] **Step 4: Run → pass.** (If a damage rounding assertion is off by one, re-derive the expected constant from the formula — the formula is the source of truth — and correct the test's literal.)
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(core): resolveSlash combat resolution"`

---

### Task 7: Gesture classification (`core/gesture.ts`)

**Files:** Create `src/core/gesture.ts`, `src/core/__tests__/gesture.test.ts`

**Interfaces:**
- Produces: `type Gesture='slash'|'jump'|'launch'|'stab'`; `classifyGesture(path: Pt[]): Gesture`.
- Rules (screen +y down): net `dx=last.x-first.x`, `dy=last.y-first.y`. Horizontal dominant (`|dx|>=|dy|`) → `slash`. Else vertical: `dy<0` (up): magnitude `|dy|>=LAUNCH_DY(160)` → `launch`, else `jump`. `dy>0` (down) → `stab`.

- [ ] **Step 1: Write failing test `gesture.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { classifyGesture } from '../gesture';
const P = (a:[number,number][]) => a.map(([x,y])=>({x,y}));
describe('classifyGesture', () => {
  it('horizontal => slash', () => expect(classifyGesture(P([[0,0],[200,10]]))).toBe('slash'));
  it('small up => jump', () => expect(classifyGesture(P([[0,0],[5,-80]]))).toBe('jump'));
  it('big fast up => launch', () => expect(classifyGesture(P([[0,0],[5,-220]]))).toBe('launch'));
  it('down => stab', () => expect(classifyGesture(P([[0,0],[5,200]]))).toBe('stab'));
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement `src/core/gesture.ts`**

```typescript
import { Pt } from './vec';
export type Gesture = 'slash' | 'jump' | 'launch' | 'stab';
export const LAUNCH_DY = 160;
export function classifyGesture(path: Pt[]): Gesture {
  if (path.length < 2) return 'slash';
  const a = path[0], b = path[path.length - 1];
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) return 'slash';
  if (dy < 0) return Math.abs(dy) >= LAUNCH_DY ? 'launch' : 'jump';
  return 'stab';
}
```

- [ ] **Step 4: Run → pass.** Then run the WHOLE suite: `npm test` → all green.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(core): gesture classification"`

---

# PHASE 2 — Procedural vector fighter

### Task 8: Skeleton model → world limb capsules (`game/fighter/Skeleton.ts`)

**Files:** Create `src/game/fighter/Skeleton.ts`, `src/core/__tests__/skeleton.test.ts`

**Interfaces:**
- Consumes: `Pt`, `Capsule`, `Limb`.
- Produces:
  - `type Joint = 'hat'|'head'|'neck'|'chest'|'pelvis'|'shoulderF'|'elbowF'|'handF'|'hipF'|'kneeF'|'footF'|'hipB'|'kneeB'|'footB'|'sword'` (front/back limbs; side view).
  - `type Pose = Record<Joint, Pt>` (local coords, origin at pelvis, facing +x).
  - `const IDLE_POSE: Pose`, `const SLASH_POSE: Pose` (and lerp helper `lerpPose(a,b,t):Pose`).
  - `function worldLimbs(pose: Pose, root: Pt, facing: 1 | -1, radius?: number): Limb[]` — converts the bone segments (neck→chest, chest→pelvis, shoulder→elbow→hand, hips→knees→feet, head, hat) into world-space `Limb[]` with sever thresholds (torso higher, limbs lower).

- [ ] **Step 1: Write failing test `skeleton.test.ts`** (test the pure transform, not the drawing)

```typescript
import { describe, it, expect } from 'vitest';
import { IDLE_POSE, worldLimbs } from '../../game/fighter/Skeleton';
describe('skeleton', () => {
  it('produces limb capsules in world space, mirrored by facing', () => {
    const right = worldLimbs(IDLE_POSE, { x: 100, y: 300 }, 1);
    const left = worldLimbs(IDLE_POSE, { x: 100, y: 300 }, -1);
    expect(right.length).toBeGreaterThanOrEqual(6);
    const armR = right.find(l => l.id === 'armF')!, armL = left.find(l => l.id === 'armF')!;
    // mirrored about root x=100
    expect(armR.capsule.b.x - 100).toBeCloseTo(-(armL.capsule.b.x - 100), 3);
    expect(right.every(l => l.severThreshold > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement `Skeleton.ts`** — define `IDLE_POSE`/`SLASH_POSE` as local joint coords (hand-tuned to the ~7-head slim proportions from the spec), `lerpPose`, and `worldLimbs()` that builds capsules: `armF` (shoulderF→elbowF→handF as two capsules merged or two limbs `armF`/`forearmF`), `legF`, `legB`, `torso` (chest→pelvis), `head`, `hat`, `sword` (handF→sword tip). Apply `facing` by negating local x, then translate by `root`. Sever thresholds: limbs ~16, head ~22, torso ~40 (torso "sever" = fatal). Keep IDs stable: `armF, forearmF, legF, legB, torso, head, hat, swordF`.

```typescript
import { Pt } from '../../core/vec';
import { Capsule } from '../../core/geometry';
import { Limb } from '../../core/slash';

export type Joint = 'hat'|'head'|'neck'|'chest'|'pelvis'|'shoulderF'|'elbowF'|'handF'|'sword'|'hipF'|'kneeF'|'footF'|'hipB'|'kneeB'|'footB';
export type Pose = Record<Joint, Pt>;

// local coords, +x faces forward, +y down, origin at pelvis. ~7-head slim build.
export const IDLE_POSE: Pose = {
  pelvis:{x:0,y:0}, chest:{x:2,y:-46}, neck:{x:2,y:-70}, head:{x:4,y:-86}, hat:{x:6,y:-104},
  shoulderF:{x:8,y:-58}, elbowF:{x:24,y:-40}, handF:{x:30,y:-18}, sword:{x:78,y:-24},
  hipF:{x:6,y:0}, kneeF:{x:10,y:34}, footF:{x:24,y:64},
  hipB:{x:-6,y:0}, kneeB:{x:-8,y:34}, footB:{x:-22,y:64},
};
export const SLASH_POSE: Pose = { /* arms raised/extended across; tune in fidelity gate */
  ...IDLE_POSE, shoulderF:{x:6,y:-60}, elbowF:{x:34,y:-66}, handF:{x:56,y:-46}, sword:{x:96,y:6},
};
export const lerpPose = (a: Pose, b: Pose, t: number): Pose => {
  const out = {} as Pose;
  (Object.keys(a) as Joint[]).forEach(k => out[k] = { x: a[k].x+(b[k].x-a[k].x)*t, y: a[k].y+(b[k].y-a[k].y)*t });
  return out;
};
const cap = (p: Pt, q: Pt, r: number, root: Pt, f: 1|-1): Capsule =>
  ({ a:{x:root.x+f*p.x,y:root.y+p.y}, b:{x:root.x+f*q.x,y:root.y+q.y}, r });
export function worldLimbs(pose: Pose, root: Pt, facing: 1|-1, radius = 9): Limb[] {
  const f = facing;
  return [
    { id:'torso',    capsule: cap(pose.chest, pose.pelvis, 16, root, f), severThreshold: 40 },
    { id:'head',     capsule: cap(pose.neck,  pose.head,   12, root, f), severThreshold: 22 },
    { id:'hat',      capsule: cap(pose.head,  pose.hat,    14, root, f), severThreshold: 9999 },
    { id:'armF',     capsule: cap(pose.shoulderF, pose.elbowF, radius, root, f), severThreshold: 16 },
    { id:'forearmF', capsule: cap(pose.elbowF, pose.handF, radius, root, f), severThreshold: 16 },
    { id:'legF',     capsule: cap(pose.hipF, pose.footF, radius+1, root, f), severThreshold: 18 },
    { id:'legB',     capsule: cap(pose.hipB, pose.footB, radius+1, root, f), severThreshold: 18 },
  ];
}
```

- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(fighter): skeleton model + world limb capsules"`

---

### Task 9: Draw the fighter + Fighter game object (`drawFighter.ts`, `Fighter.ts`)

**Files:** Create `src/game/fighter/drawFighter.ts`, `src/game/fighter/Fighter.ts`

**Interfaces:**
- Consumes: `Pose`, `worldLimbs`, `IDLE_POSE/SLASH_POSE/lerpPose`, `COL`, `Limb`.
- Produces:
  - `drawSkeleton(g: Phaser.GameObjects.Graphics, pose: Pose, root: Pt, facing: 1|-1, opts:{severed:Set<string>}): void` — vector-draws limbs (rounded capsules) + kimono fills + straw hat in palette, outlined `COL.outline`, skipping severed limb IDs.
  - `class Fighter extends Phaser.GameObjects.Container` with:
    - `health: number`, `maxHealth: number`, `facing: 1|-1`, `stanceId`, `pose: Pose`, `severed: Set<string>`
    - `worldLimbs(): Limb[]` (current pose+root+facing)
    - `applyHit(result: SlashResult): void` (subtract damage, add severed ids, trigger blood via injected Gore)
    - `setPose(pose: Pose)`, `redraw()`
    - `get isDead(): boolean`

- [ ] **Step 1:** Implement `drawSkeleton` drawing capsules as `fillRoundedRect`-style strokes: for each bone, draw a thick line (`lineStyle(2*r, fill)`) then a thin outline; layer order back-leg → torso → kimono body → front-leg → head → hat → arm → sword. Use `COL.kimono`, `COL.kimonoShade`, `COL.wood` (hat), `COL.outline`. Skip IDs in `severed`.
- [ ] **Step 2:** Implement `Fighter` as a Container holding one Graphics; `redraw()` clears + calls `drawSkeleton`. `applyHit` updates health/severed then `redraw()`.
- [ ] **Step 3: Manual visual check** — temporarily add two Fighters in `DuelScene.create()` (player facing +1 at x≈300, enemy facing −1 at x≈724). Run `npm run dev`. Expected: two recognizable straw-hat samurai silhouettes in the kimono palette, facing each other. Screenshot and eyeball proportions vs `reference/SPEC.md` §2.
- [ ] **Step 4:** Run `npm run build` (no TS errors).
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(fighter): vector drawing + Fighter game object"`

---

# PHASE 3 — Input, blade trail, slash wiring

### Task 10: Gesture input capture (`game/input/GestureInput.ts`)

**Files:** Create `src/game/input/GestureInput.ts`

**Interfaces:**
- Produces: `class GestureInput` constructed with a Scene; emits via callback `onSlash(path: Pt[], gesture: Gesture)` on pointerup. Captures `pointerdown`→push points on `pointermove`→on `pointerup` classify + emit. Records `performance.now()` at pointerdown and at first emit to assert latency.

- [ ] **Step 1:** Implement: on `pointerdown` start a `path=[{x,y}]`, store `t0=performance.now()`, set `drawing=true`; on `pointermove` while drawing push `{x,y}` (throttle to ≥4px apart); on `pointerup` set drawing=false, `classifyGesture(path)`, call `onSlash(path, gesture)`. Expose `lastLatencyMs`.
- [ ] **Step 2: Manual latency check** — in DuelScene log `lastLatencyMs` and the blade-trail start. Draw fast strokes; confirm trail begins **<50ms** after pointerdown (the trail is drawn live on pointermove — see Task 11). If over, reduce per-move work.
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(input): pointer gesture capture"`

### Task 11: Blade trail VFX (`game/vfx/BladeTrail.ts`)

**Files:** Create `src/game/vfx/BladeTrail.ts`

**Interfaces:**
- Produces: `class BladeTrail` with `begin()`, `push(pt: Pt)` (draw live during pointermove), `flash()`, `fade(dt)`. Renders the drawn polyline as a tapered crimson→white streak (`COL.blood` core, white inner) using `strokePoints`, fading alpha over ~250ms.

- [ ] **Step 1:** Implement using a Graphics object: each frame redraw the recent points with `lineStyle` width tapering by index, color `COL.blood`; add a thin white center line for the "edge gleam". `fade()` lowers alpha; clear when invisible.
- [ ] **Step 2:** Wire to `GestureInput`: `pointerdown→begin`, `pointermove→push`, `pointerup→flash`. Manual: strokes leave a red blade streak that follows the exact path then fades.
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(vfx): blade trail along drawn path"`

### Task 12: Wire slash → hit on a target dummy

**Files:** Modify `src/game/scenes/DuelScene.ts`

- [ ] **Step 1:** In DuelScene: instantiate player + enemy Fighters, a `GestureInput`, a `BladeTrail`. On `onSlash(path,gesture)` when `gesture==='slash'`: build `SlashInput` from player stance (`STANCES[stanceId]`), origin = player sword-hand world pos, `reach`, `dmgMult`, `crit` from Focus, `counter = counterBonus(playerStance, enemyStance)`; call `resolveSlash(input, enemy.worldLimbs(), atkPlusWeapon, STANCES[enemyStance].damageTakenMult)`; `enemy.applyHit(result)`.
- [ ] **Step 2: Manual** — `npm run dev`: drawing a horizontal line across the enemy reduces its health and, on a long stroke, severs a limb (limb disappears). Confirm out-of-reach strokes (Heavy stance, far enemy) miss.
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(duel): wire slash resolution to enemy fighter"`

---

# PHASE 4 — Gore, stances/focus, HUD, gestures

### Task 13: Gore — blood + sever (`game/vfx/Gore.ts`)

**Files:** Create `src/game/vfx/Gore.ts`; modify `Fighter.applyHit` to call it.

**Interfaces:** `class Gore` with `spray(at: Pt, dir: number, amount: number)` and a `static reduced` toggle. Uses a Phaser particle emitter with crimson (`COL.blood`/`COL.bloodDark`) textures generated at runtime (small filled circles via a Graphics→`generateTexture`). On sever, also leave a dark cut decal at the cut point.

- [ ] **Step 1:** Generate a 6px blood particle texture at boot. Implement `spray()` emitting a short burst along `dir`. `reduced` halves count + disables decals.
- [ ] **Step 2:** Call `gore.spray(cutPoint, slashAngle, severed?large:small)` inside `Fighter.applyHit` per hit. Manual: cuts spray crimson against the green; severs leave a decal. Toggle `Gore.reduced` and confirm it lessens.
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(vfx): blood spray + sever decals + reduce-blood toggle"`

### Task 14: Stance switching + Focus economy in scene

**Files:** Modify `DuelScene.ts`; both Fighters carry a `Focus`.

- [ ] **Step 1:** Spacebar (`this.input.keyboard.on('keydown-SPACE')`) and clicking the HUD portrait cycle player stance light→balanced→heavy **only if `focus.canSwitch()`**, then `focus.spendSwitch()`. Landing hits `focus.gain(...)`. Player `crit = focus.isCrit()`.
- [ ] **Step 2: Manual** — switching stance drains Focus and visibly changes reach/damage; Focus refills as you land hits; at high Focus, hits crit (bigger numbers / stronger feedback).
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(duel): stance switching + focus economy"`

### Task 15: HUD (`game/ui/Hud.ts`)

**Files:** Create `src/game/ui/Hud.ts`; modify `DuelScene` to instantiate + update it.

**Interfaces:** `class Hud` drawing: bottom-left circular **stance portrait** (mini straw-hat glyph) + stacked **health** (green `COL.healthGreen`) over **Focus** (blue `COL.focusBlue`) + stance name; **floating name + small health bar** above each Fighter (follow their x). `update()` each frame from Fighter/Focus/Stance state.

- [ ] **Step 1:** Implement HUD with Graphics + Text; match layout/positions in `reference/SPEC.md` §3.
- [ ] **Step 2: Manual vs stills** — open CompareView later; for now eyeball: bottom-left portrait+bars, floating bars over fighters, gold/cream UI tones.
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(ui): HUD — portrait, health, focus, floating bars"`

### Task 16: Jump / launch / stab gestures

**Files:** Modify `DuelScene.ts`, `Fighter.ts` (add `jump()`, `launchedBy()`, stagger states).

- [ ] **Step 1:** Route `gesture` from `onSlash`: `jump` → player hop (tween y up/down); `launch` → if in range, knock enemy upward into a juggle state (enemy rises then falls, vulnerable); `stab` → forward thrust slash with a vertical path (down) doing extra damage at close range. Keep each readable.
- [ ] **Step 2: Manual** — all 4 gestures produce distinct, correct actions. Confirm pointer-down→slash start still <50ms.
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(duel): jump, launch, stab gestures"`

---

# PHASE 5 — AI opponent

### Task 17: AI state machine (`core/ai.ts` pure + `game/ai/AIController.ts`)

**Files:** Create `src/core/ai.ts`, `src/core/__tests__/ai.test.ts`, `src/game/ai/AIController.ts`; modify `DuelScene`.

**Interfaces (pure core):**
- `type AIState='idle'|'approach'|'telegraph'|'attack'|'recover'|'block'|'dodge'`
- `type AISense={ distance:number; playerAttacking:boolean; playerWindup:boolean; selfRecovering:boolean; rng:number }`
- `type AIParams={ approachRange:number; strikeRange:number; reactBlockChance:number; reactDodgeChance:number }`
- `nextAIState(state: AIState, t: number, s: AISense, p: AIParams): AIState` — pure transition (telegraph before attack; block/dodge when player winds up; recover after attack).

- [ ] **Step 1: Write failing test `ai.test.ts`** covering: idle→approach when distance>strikeRange & <approachRange; approach→telegraph at strikeRange; telegraph→attack after telegraph time; attack→recover; and player-windup → block/dodge by rng vs chances.

```typescript
import { describe, it, expect } from 'vitest';
import { nextAIState } from '../ai';
const P = { approachRange: 500, strikeRange: 140, reactBlockChance: 0.5, reactDodgeChance: 0.3 };
describe('ai', () => {
  it('approaches then telegraphs at strike range', () => {
    expect(nextAIState('idle', 0, { distance: 300, playerAttacking:false, playerWindup:false, selfRecovering:false, rng:0.9 }, P)).toBe('approach');
    expect(nextAIState('approach', 0, { distance: 130, playerAttacking:false, playerWindup:false, selfRecovering:false, rng:0.9 }, P)).toBe('telegraph');
  });
  it('reacts to player windup with block (low rng)', () => {
    expect(nextAIState('approach', 0, { distance: 130, playerAttacking:false, playerWindup:true, selfRecovering:false, rng:0.1 }, P)).toBe('block');
  });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement `core/ai.ts`** as a pure switch with the documented thresholds (telegraph timer passed via `t`).
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Implement `AIController.ts`** that each frame builds `AISense` from the live scene (distance between fighters, player gesture state), calls `nextAIState`, and drives the enemy Fighter: approach = move toward player; telegraph = wind-up pose + tell flash; attack = perform an enemy slash via `resolveSlash` against the *player's* limbs; block/dodge = brief invuln / hop; recover = pause. Tune reaction times so the duel resolves in ~20–60s and is winnable AND losable.
- [ ] **Step 6: Manual** — the enemy advances, telegraphs, strikes, can be cut down, and can kill you. Adjust `AIParams` for fairness.
- [ ] **Step 7: Commit** `git add -A && git commit -m "feat(ai): telegraphing reactive opponent"`

---

# PHASE 6 — Scene completion + background + impact

### Task 18: Win/lose/restart + spawn grace + pacing

**Files:** Modify `DuelScene.ts`.

- [ ] **Step 1:** On `isDead`: freeze input, show win/lose banner (cream/gold per palette) + "Restart" (click or `R` → `scene.restart()`). At duel start, both fighters get ~1.5s spawn invuln (blink). 
- [ ] **Step 2: Manual** — a full duel ends in a clear win or loss with a working restart; typical bout ~20–60s.
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(duel): win/lose/restart + spawn grace"`

### Task 19: Layered parallax forest (`game/background/Forest.ts`)

**Files:** Create `src/game/background/Forest.ts`; modify `DuelScene` to add it behind fighters.

**Interfaces:** `class Forest` builds layers via Graphics→`generateTexture` (or tileSprites): gradient sky (`COL.skyTop`→`COL.skyLow`), 3 tree-silhouette bands (`COL.sage2`→`COL.forestShadow`→`COL.forestDark`), ground, plus drifting-leaf + bokeh particles. A `BackgroundLayer` interface (`{ image|graphics, parallaxX }`) is the seam to swap a painted PNG per layer later.

- [ ] **Step 1:** Implement the layers + gentle parallax on subtle camera sway; drifting leaves.
- [ ] **Step 2: Manual vs stills** — backdrop reads like the video's misty green bamboo/forest. Note the biggest gap for the fidelity pass.
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(bg): layered parallax forest with paint-swap seam"`

### Task 20: Killing-blow slow-mo + impact flash (`game/vfx/SlowMo.ts`)

**Files:** Create `src/game/vfx/SlowMo.ts`; call from DuelScene on a fatal hit.

**Interfaces:** `class SlowMo` with `trigger(scene, ms=300, scale=0.25)` lowering `scene.time.timeScale` / tween timeScale back, plus a brief white screen flash + hit-stop on the fatal cut.

- [ ] **Step 1:** Implement; trigger when a hit drops a fighter to ≤0 or severs torso/head. Tune length vs video (open item).
- [ ] **Step 2: Manual** — the finishing cut has a satisfying slow-mo beat.
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(vfx): killing-blow slow-mo + impact flash"`

---

# PHASE 7 — Audio, fidelity gate, docs

### Task 21: Synthesized SFX (`game/audio/sfx.ts`)

**Files:** Create `src/game/audio/sfx.ts`; call from slash/hit/switch.

**Interfaces:** `playSlash()`, `playImpact()`, `playStanceSwitch()`, `playGrunt()` — generated with the WebAudio API (oscillator + noise burst + envelope), **no sampled assets**. A muted-by-default toggle respected.

- [ ] **Step 1:** Implement a tiny synth (whoosh = filtered noise sweep; impact = short noise + low sine thud; chime = two-osc bell; grunt = formant-ish blip). Trigger from the relevant events.
- [ ] **Step 2: Manual** — slashing/hitting/switching produce fitting, original sounds.
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(audio): synthesized slash/impact/switch/grunt"`

### Task 22: Dev compare-view = the fidelity gate (`dev/CompareView.ts`)

**Files:** Create `src/dev/CompareView.ts`; modify `main.ts`/`DuelScene` to mount it only when `DEV` and `?compare=<stillname>` is present.

**Interfaces:** `mountCompareView(stillPath: string)` renders an HTML overlay placing a gitignored reference still from `reference/stills/` beside the live canvas at matched scale, with an opacity slider to A/B overlay. (Reference image loaded from the local `reference/` dir served by Vite in dev only; never bundled.)

- [ ] **Step 1:** Implement the overlay (plain DOM next to `#game`), slider for cross-fade, and a small palette read-out (sample canvas pixel under cursor → hex) to verify palette §1 live.
- [ ] **Step 2: Fidelity gate pass** — with a duel still loaded, iterate fighter proportions, palette, HUD, and slash motion until the live build is indistinguishable. Record the single biggest remaining gap.
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(dev): side-by-side compare view (fidelity gate)"`

### Task 23: README + About credit + build/test proof

**Files:** Create `README.md`; modify `DuelScene` (small About/credit line).

- [ ] **Step 1:** README: what it is, the verbatim homage credit (Global Constraints), `npm i/dev/build/test`, and a "not affiliated / non-commercial / original assets" note. Add the credit line on the title/win screen.
- [ ] **Step 2: Proof** — run `npm test` (all green) and `npm run build` (clean); paste both outputs. Capture a short duel clip (win + lose + restart) and a CompareView side-by-side screenshot.
- [ ] **Step 3: Commit** `git add -A && git commit -m "docs: README + in-game homage credit; first-playable complete"`

---

## Self-Review (completed by plan author)

**Spec coverage:** every spec §maps to tasks — §3 architecture→Tasks 1–22; §4 mechanic/all-4 gestures→Tasks 10,12,16; §5 slash geometry TDD→Tasks 3,6,8; §6 stances/focus→Tasks 4,5,14; §7 AI→Task 17; §8 art/VFX/gore/audio→Tasks 9,11,13,19,20,21; §9 HUD/flow→Tasks 15,18; fidelity gate→Task 22; credit→Task 23; tests→Tasks 2–8,17. No uncovered requirement.

**Placeholder scan:** No "TBD/TODO/handle edge cases" left as work. Two explicit *tuning* steps (slow-mo length Task 20, AI fairness Task 17, slash-pose Task 8) are flagged as fidelity-gate tuning with concrete starting values — not missing logic.

**Type consistency:** `Pt`, `Capsule`, `Limb`, `SlashInput/SlashResult`, `STANCES/counterBonus`, `Focus`, `Gesture`, `worldLimbs()`, `Fighter.worldLimbs()/applyHit()`, `nextAIState()` names/signatures are used identically across producing and consuming tasks.
