# iaido-duel Session 2 — Motion & Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fighters' pose-snapping with a real per-frame animation layer (idle/walk/slash/hit/death), tune slash/blade-trail/kill-beat feel to the measured reference video, add the HIT COMBO counter + enemy tint + flying limbs + a more naturalistic forest, and balance the AI to a 20–60s winnable-and-losable duel.

**Architecture:** A pure, unit-tested animation core (`src/core/anim.ts`: easing, a segment phase-clock, procedural walk/idle offset generators) feeds a Phaser-free orchestrator (`src/game/fighter/FighterAnimator.ts`) that composes a base locomotion layer with action overlays into a `Pose` each frame. The `FighterAnimator` becomes the SOLE owner of each fighter's pose — `Fighter`, `DuelScene`, and `AIController` stop calling `setPose` directly and instead drive triggers (`setMoving`, `setGuard`, `slash`, `hitAnim`, `die`). A pure `src/core/combo.ts` powers a HUD combo counter; the kill sequence moves to `src/game/scenes/KillBeat.ts`.

**Tech Stack:** TypeScript (strict), Phaser 3.90, Vite 5, Vitest 2. Tests live in `src/core/__tests__/*.test.ts`; run with `npm test`. Build check: `npm run build` (tsc --noEmit + vite build).

## Global Constraints

- **Original assets only.** Re-created art/code/audio; never reproduce the original's art, audio, logo, or code. `reference/` stays gitignored.
- **Homage credit stays** in the README and on-screen: "Fan homage of Straw Hat Samurai: Duels by Explosive Barrel — unaffiliated, non-commercial."
- **Repo name stays `iaido-duel`** (not the trademarked title).
- **No new runtime dependencies** beyond `phaser`.
- **Pure logic in `src/core` is TDD'd** (test before implementation).
- **Branch:** `feat/first-playable-duel`. **Do NOT push** — publish only on Kheshav's explicit go after he plays.
- **Local coords (per `Skeleton.ts`):** +x faces forward, +y is down, origin at pelvis; the owning Container mirrors via `scaleX = ±1`.
- **Measured targets:** slash sweep ~85–120ms ease-out; crimson trail fades ~200ms; combo cadence ~350–500ms; blood ~200–300ms; kill → fast red wash + ~0.9s running silhouette → "YOU WIN"; pointer-down → slash-start <50ms.

---

### Task 1: Animation core — easing + phase clock

**Files:**
- Create: `src/core/anim.ts`
- Test: `src/core/__tests__/anim.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `clamp01(t: number): number`
  - `easeOutCubic(t: number): number`, `easeInOutSine(t: number): number`, `easeInQuad(t: number): number` — all map [0,1]→[0,1], clamping input.
  - `type Segment = { name: string; ms: number }`
  - `type PhaseResult = { name: string; t: number; done: boolean }`
  - `phaseAt(segments: Segment[], elapsedMs: number): PhaseResult` — finds the active segment, returns eased-input progress `t` in [0,1] within it; `done: true` (with `t: 1`, last segment name) once `elapsedMs` ≥ total.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/anim.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { clamp01, easeOutCubic, easeInOutSine, easeInQuad, phaseAt, Segment } from '../anim';

describe('anim easing', () => {
  it('clamps and anchors endpoints', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    for (const e of [easeOutCubic, easeInOutSine, easeInQuad]) {
      expect(e(0)).toBeCloseTo(0, 6);
      expect(e(1)).toBeCloseTo(1, 6);
      expect(e(-5)).toBeCloseTo(0, 6); // clamps
      expect(e(5)).toBeCloseTo(1, 6);
    }
  });
  it('is monotonic non-decreasing', () => {
    for (const e of [easeOutCubic, easeInOutSine, easeInQuad]) {
      let prev = -1;
      for (let i = 0; i <= 10; i++) {
        const v = e(i / 10);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = v;
      }
    }
  });
});

describe('anim phaseAt', () => {
  const segs: Segment[] = [
    { name: 'windup', ms: 90 },
    { name: 'strike', ms: 100 },
    { name: 'recover', ms: 150 },
  ];
  it('reports the active segment and local eased progress', () => {
    expect(phaseAt(segs, 0)).toEqual({ name: 'windup', t: 0, done: false });
    expect(phaseAt(segs, 45)).toMatchObject({ name: 'windup', done: false });
    expect(phaseAt(segs, 45).t).toBeCloseTo(0.5, 6);
    expect(phaseAt(segs, 90)).toMatchObject({ name: 'strike', done: false }); // boundary advances
    expect(phaseAt(segs, 190).t).toBeCloseTo(0, 6); // start of recover
  });
  it('marks done past the total', () => {
    const r = phaseAt(segs, 999);
    expect(r.done).toBe(true);
    expect(r.name).toBe('recover');
    expect(r.t).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/anim.test.ts`
Expected: FAIL — `Cannot find module '../anim'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/anim.ts`:

```ts
// Pure animation math: easing + a segment phase-clock. No Phaser, no side effects.

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

export const easeOutCubic = (t: number): number => {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
};
export const easeInOutSine = (t: number): number => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
export const easeInQuad = (t: number): number => {
  const x = clamp01(t);
  return x * x;
};

export type Segment = { name: string; ms: number };
export type PhaseResult = { name: string; t: number; done: boolean };

/** Locate `elapsedMs` within a sequence of timed segments. `t` is progress [0,1] in the active segment. */
export function phaseAt(segments: Segment[], elapsedMs: number): PhaseResult {
  let acc = 0;
  for (const seg of segments) {
    if (elapsedMs < acc + seg.ms) {
      return { name: seg.name, t: clamp01((elapsedMs - acc) / seg.ms), done: false };
    }
    acc += seg.ms;
  }
  const last = segments[segments.length - 1];
  return { name: last.name, t: 1, done: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/anim.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/anim.ts src/core/__tests__/anim.test.ts
git commit -m "feat(anim): pure easing + segment phase-clock (TDD)"
```

---

### Task 2: Animation core — procedural walk & idle offsets

**Files:**
- Modify: `src/core/anim.ts`
- Modify: `src/core/__tests__/anim.test.ts`

**Interfaces:**
- Consumes: `clamp01` (Task 1).
- Produces:
  - `type JointOffset = { x: number; y: number }`
  - `type Offsets = { [joint: string]: JointOffset }` (partial — only the joints that move are present)
  - `walkOffsets(phase: number, amp?: number): Offsets` — `phase` in [0,1); front/back legs in antiphase; vertical bob at 2× stride frequency; arm counter-swing.
  - `idleOffsets(phase: number, amp?: number): Offsets` — gentle breathing (chest/neck/head/hat rise, sword hand dips).

- [ ] **Step 1: Write the failing test**

Append to `src/core/__tests__/anim.test.ts`:

```ts
import { walkOffsets, idleOffsets } from '../anim';

describe('anim locomotion offsets', () => {
  it('walk: legs swing in antiphase and the cycle is periodic', () => {
    for (const p of [0, 0.13, 0.37, 0.62, 0.88]) {
      const o = walkOffsets(p);
      expect(o.footF.x).toBeCloseTo(-o.footB.x, 6); // antiphase
    }
    const a = walkOffsets(0);
    const b = walkOffsets(1); // 1 ≡ 0
    expect(a.footF.x).toBeCloseTo(b.footF.x, 6);
  });
  it('walk: vertical bob runs at 2x stride frequency', () => {
    // pelvis bob equal at phase 0 and 0.5 (two bobs per stride), differs at 0.25
    expect(walkOffsets(0).pelvis.y).toBeCloseTo(walkOffsets(0.5).pelvis.y, 6);
    expect(Math.abs(walkOffsets(0).pelvis.y - walkOffsets(0.25).pelvis.y)).toBeGreaterThan(1);
  });
  it('walk: amplitude scales offsets linearly', () => {
    expect(walkOffsets(0.25, 2).footF.x).toBeCloseTo(2 * walkOffsets(0.25, 1).footF.x, 6);
  });
  it('idle: bounded breathing, periodic, near-zero at phase 0', () => {
    expect(idleOffsets(0).chest.y).toBeCloseTo(0, 6);
    expect(Math.abs(idleOffsets(0.25).chest.y)).toBeLessThanOrEqual(2);
    expect(idleOffsets(0).head.y).toBeCloseTo(idleOffsets(1).head.y, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/anim.test.ts`
Expected: FAIL — `walkOffsets is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/core/anim.ts`:

```ts
export type JointOffset = { x: number; y: number };
export type Offsets = { [joint: string]: JointOffset };

const TAU = Math.PI * 2;

/** Procedural side-view walk cycle. `phase` in [0,1). */
export function walkOffsets(phase: number, amp = 1): Offsets {
  const a = phase * TAU;
  const swing = Math.sin(a);
  const bob = Math.cos(2 * a); // two bobs per stride
  return {
    footF: { x: 18 * swing * amp, y: -9 * Math.max(0, swing) * amp },
    kneeF: { x: 9 * swing * amp, y: -2 * Math.max(0, swing) * amp },
    footB: { x: -18 * swing * amp, y: -9 * Math.max(0, -swing) * amp },
    kneeB: { x: -9 * swing * amp, y: -2 * Math.max(0, -swing) * amp },
    pelvis: { x: 0, y: -3 * bob * amp },
    chest: { x: 0, y: -3 * bob * amp },
    handF: { x: -7 * swing * amp, y: 0 }, // arm counter-swings the front leg
  };
}

/** Gentle idle breathing/sway. `phase` in [0,1). */
export function idleOffsets(phase: number, amp = 1): Offsets {
  const breathe = Math.sin(phase * TAU);
  return {
    chest: { x: 0, y: -1.5 * breathe * amp },
    neck: { x: 0, y: -1.3 * breathe * amp },
    head: { x: 0, y: -1.1 * breathe * amp },
    hat: { x: 0, y: -1.1 * breathe * amp },
    handF: { x: 0, y: 1.0 * breathe * amp },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/anim.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/anim.ts src/core/__tests__/anim.test.ts
git commit -m "feat(anim): procedural walk + idle offset generators (TDD)"
```

---

### Task 3: Skeleton keyframe poses + offset application

**Files:**
- Modify: `src/game/fighter/Skeleton.ts`
- Modify: `src/core/__tests__/skeleton.test.ts`

**Interfaces:**
- Consumes: `Offsets` (Task 2), existing `Pose`, `IDLE_POSE`, `lerpPose`, `Joint`.
- Produces:
  - `addOffsets(pose: Pose, offs: Offsets): Pose` — returns a new pose with offsets added (missing joints unchanged).
  - New exported poses: `SLASH_WINDUP`, `SLASH_FOLLOW`, `HIT_RECOIL`, `GUARD_POSE`, `DEAD` — all `Pose`.

- [ ] **Step 1: Write the failing test**

Append to `src/core/__tests__/skeleton.test.ts`:

```ts
import { addOffsets, SLASH_WINDUP, SLASH_FOLLOW, HIT_RECOIL, GUARD_POSE, DEAD, IDLE_POSE } from '../../game/fighter/Skeleton';

describe('skeleton keyframes + offsets', () => {
  it('every keyframe defines all joints', () => {
    const joints = Object.keys(IDLE_POSE);
    for (const pose of [SLASH_WINDUP, SLASH_FOLLOW, HIT_RECOIL, GUARD_POSE, DEAD]) {
      expect(Object.keys(pose).sort()).toEqual([...joints].sort());
    }
  });
  it('addOffsets adds deltas and leaves unlisted joints untouched', () => {
    const out = addOffsets(IDLE_POSE, { chest: { x: 0, y: -5 } });
    expect(out.chest.y).toBeCloseTo(IDLE_POSE.chest.y - 5, 6);
    expect(out.pelvis.x).toBeCloseTo(IDLE_POSE.pelvis.x, 6); // untouched
    expect(out).not.toBe(IDLE_POSE); // new object
  });
  it('DEAD collapses the body low and forward (head near ground, behind pelvis)', () => {
    expect(DEAD.head.y).toBeGreaterThan(IDLE_POSE.head.y); // head dropped toward ground (y increases downward)
    expect(DEAD.head.x).toBeLessThan(0); // head fell back behind the pelvis
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/skeleton.test.ts`
Expected: FAIL — `addOffsets` / keyframes not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/game/fighter/Skeleton.ts`, add the import at the top (after the existing imports):

```ts
import { Offsets } from '../../core/anim';
```

Then append these exports at the end of the file:

```ts
// Blade drawn up-and-back over the shoulder — the slash wind-up / enemy "tell".
export const SLASH_WINDUP: Pose = {
  ...IDLE_POSE,
  shoulderF: { x: 4, y: -62 },
  elbowF: { x: 2, y: -80 },
  handF: { x: -14, y: -70 },
  sword: { x: -48, y: -94 },
};

// Blade swept down across the front — the follow-through.
export const SLASH_FOLLOW: Pose = {
  ...IDLE_POSE,
  shoulderF: { x: 8, y: -54 },
  elbowF: { x: 34, y: -42 },
  handF: { x: 60, y: -6 },
  sword: { x: 106, y: 42 },
};

// Sword raised horizontal in front — a defensive guard (block).
export const GUARD_POSE: Pose = {
  ...IDLE_POSE,
  shoulderF: { x: 6, y: -60 },
  elbowF: { x: 24, y: -58 },
  handF: { x: 38, y: -52 },
  sword: { x: 92, y: -58 },
};

// Torso/head knocked back away from the strike.
export const HIT_RECOIL: Pose = {
  ...IDLE_POSE,
  chest: { x: -4, y: -44 },
  neck: { x: -6, y: -68 },
  head: { x: -7, y: -83 },
  hat: { x: -5, y: -101 },
  shoulderF: { x: 2, y: -56 },
  elbowF: { x: 16, y: -36 },
  handF: { x: 18, y: -14 },
  sword: { x: 60, y: -30 },
};

// Collapsed on the ground (the loser falls). Body laid back along the ground, low.
export const DEAD: Pose = {
  pelvis: { x: 0, y: 0 },
  chest: { x: -28, y: -10 },
  neck: { x: -48, y: -12 },
  head: { x: -62, y: -10 },
  hat: { x: -80, y: -6 },
  shoulderF: { x: -26, y: -16 },
  elbowF: { x: -40, y: -6 },
  handF: { x: -52, y: 2 },
  sword: { x: -90, y: 6 },
  hipF: { x: 8, y: 2 },
  kneeF: { x: 32, y: 6 },
  footF: { x: 56, y: 8 },
  hipB: { x: -6, y: 2 },
  kneeB: { x: -20, y: 8 },
  footB: { x: -42, y: 10 },
};

/** Add per-joint offsets to a pose (joints absent from `offs` are copied unchanged). */
export const addOffsets = (pose: Pose, offs: Offsets): Pose => {
  const out = {} as Pose;
  (Object.keys(pose) as Joint[]).forEach((k) => {
    const o = offs[k];
    out[k] = o ? { x: pose[k].x + o.x, y: pose[k].y + o.y } : { x: pose[k].x, y: pose[k].y };
  });
  return out;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/skeleton.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/fighter/Skeleton.ts src/core/__tests__/skeleton.test.ts
git commit -m "feat(skeleton): slash/guard/hit/dead keyframes + addOffsets (TDD)"
```

---

### Task 4: Combo counter core

**Files:**
- Create: `src/core/combo.ts`
- Test: `src/core/__tests__/combo.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `COMBO_WINDOW_MS: number` (= 1200)
  - `class Combo` with `hit(nowMs: number): number`, `value(nowMs: number): number`, `reset(): void`.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/combo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Combo, COMBO_WINDOW_MS } from '../combo';

describe('combo', () => {
  it('counts consecutive hits inside the window', () => {
    const c = new Combo();
    expect(c.hit(0)).toBe(1);
    expect(c.hit(400)).toBe(2);
    expect(c.hit(800)).toBe(3);
  });
  it('resets to 1 when the window lapses between hits', () => {
    const c = new Combo();
    c.hit(0);
    expect(c.hit(COMBO_WINDOW_MS + 1)).toBe(1);
  });
  it('value() decays to 0 after the window with no new hit', () => {
    const c = new Combo();
    c.hit(0);
    expect(c.value(500)).toBe(1);
    expect(c.value(COMBO_WINDOW_MS + 1)).toBe(0);
  });
  it('reset() clears the count', () => {
    const c = new Combo();
    c.hit(0);
    c.reset();
    expect(c.value(0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/combo.test.ts`
Expected: FAIL — `Cannot find module '../combo'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/combo.ts`:

```ts
export const COMBO_WINDOW_MS = 1200;

/** Consecutive-hit counter: increments within COMBO_WINDOW_MS, otherwise restarts. */
export class Combo {
  private count = 0;
  private lastHitAt = -Infinity;

  hit(nowMs: number): number {
    this.count = nowMs - this.lastHitAt > COMBO_WINDOW_MS ? 1 : this.count + 1;
    this.lastHitAt = nowMs;
    return this.count;
  }

  value(nowMs: number): number {
    return nowMs - this.lastHitAt > COMBO_WINDOW_MS ? 0 : this.count;
  }

  reset(): void {
    this.count = 0;
    this.lastHitAt = -Infinity;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/combo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/combo.ts src/core/__tests__/combo.test.ts
git commit -m "feat(combo): consecutive-hit counter with timeout window (TDD)"
```

---

### Task 5: FighterAnimator orchestrator

**Files:**
- Create: `src/game/fighter/FighterAnimator.ts`
- Test: `src/core/__tests__/fighterAnimator.test.ts`

**Interfaces:**
- Consumes: `IDLE_POSE`, `SLASH_WINDUP`, `SLASH_FOLLOW`, `GUARD_POSE`, `HIT_RECOIL`, `DEAD`, `lerpPose`, `addOffsets`, `Pose` (Skeleton); `phaseAt`, `walkOffsets`, `idleOffsets`, `easeOutCubic`, `easeInOutSine`, `easeInQuad`, `Segment` (anim).
- Produces:
  - `type GuardLevel = 'none' | 'telegraph' | 'block'`
  - `class FighterAnimator` with `setMoving(b: boolean): void`, `setGuard(g: GuardLevel): void`, `startSlash(): void`, `startHit(): void`, `startDeath(): void`, `update(dtMs: number): Pose`, `get isDead(): boolean`, and test accessors `actionName(): 'none'|'slash'|'hit'|'dead'`, `guardLevel(): GuardLevel`.
- Priority each frame: **death > transient action (slash/hit) > guard hold > base locomotion (idle/walk).**

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/fighterAnimator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FighterAnimator } from '../../game/fighter/FighterAnimator';
import { IDLE_POSE } from '../../game/fighter/Skeleton';

const run = (a: FighterAnimator, ms: number, step = 16) => {
  let pose = IDLE_POSE;
  for (let t = 0; t < ms; t += step) pose = a.update(step);
  return pose;
};

describe('FighterAnimator', () => {
  it('idle breathing makes the head bob over time', () => {
    const a = new FighterAnimator();
    const p1 = a.update(16);
    const p2 = run(a, 800);
    expect(p1.head.y).not.toBeCloseTo(p2.head.y, 3);
    expect(a.actionName()).toBe('none');
  });
  it('walking moves the feet apart from the idle stance', () => {
    const a = new FighterAnimator();
    a.setMoving(true);
    const p = run(a, 200);
    expect(Math.abs(p.footF.x - IDLE_POSE.footF.x)).toBeGreaterThan(2);
  });
  it('slash drives the sword hand forward during the strike then returns', () => {
    const a = new FighterAnimator();
    a.startSlash();
    let forward = 0;
    for (let t = 0; t < 200; t += 16) {
      const p = a.update(16);
      forward = Math.max(forward, p.handF.x);
    }
    expect(forward).toBeGreaterThan(IDLE_POSE.handF.x + 10);
    run(a, 400); // let it finish
    expect(a.actionName()).toBe('none');
  });
  it('guard=telegraph blends toward the wind-up and holds', () => {
    const a = new FighterAnimator();
    a.setGuard('telegraph');
    const p = run(a, 300);
    expect(p.sword.x).toBeLessThan(0); // wind-up sword is behind (negative x)
    expect(a.guardLevel()).toBe('telegraph');
  });
  it('death collapses to the DEAD pose and is terminal', () => {
    const a = new FighterAnimator();
    a.startDeath();
    const p = run(a, 500);
    expect(p.head.y).toBeGreaterThan(IDLE_POSE.head.y); // dropped toward ground
    expect(a.isDead).toBe(true);
    a.setMoving(true); // ignored once dead
    const p2 = a.update(16);
    expect(p2.head.y).toBeGreaterThan(IDLE_POSE.head.y);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/fighterAnimator.test.ts`
Expected: FAIL — `Cannot find module '.../FighterAnimator'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/game/fighter/FighterAnimator.ts`:

```ts
import {
  IDLE_POSE,
  SLASH_WINDUP,
  SLASH_FOLLOW,
  GUARD_POSE,
  HIT_RECOIL,
  DEAD,
  lerpPose,
  addOffsets,
  Pose,
} from './Skeleton';
import {
  phaseAt,
  walkOffsets,
  idleOffsets,
  easeOutCubic,
  easeInOutSine,
  easeInQuad,
  Segment,
} from '../../core/anim';

export type GuardLevel = 'none' | 'telegraph' | 'block';
type Action = 'none' | 'slash' | 'hit' | 'dead';

const SLASH_SEGS: Segment[] = [
  { name: 'windup', ms: 90 },
  { name: 'strike', ms: 100 },
  { name: 'recover', ms: 150 },
];
const HIT_SEGS: Segment[] = [
  { name: 'recoil', ms: 90 },
  { name: 'return', ms: 120 },
];
const DEATH_MS = 320;
const WALK_PERIOD = 560; // ms / stride
const IDLE_PERIOD = 2600; // ms / breath
const GUARD_BLEND_MS = 130;

/** Owns one fighter's pose each frame: base locomotion + action overlays + guard hold. */
export class FighterAnimator {
  private moving = false;
  private guard: GuardLevel = 'none';
  private guardT = 0; // smoothed 0..1 toward the guard pose
  private action: Action = 'none';
  private actionElapsed = 0;
  private locoPhase = 0;
  private dead = false;

  setMoving(b: boolean): void {
    if (!this.dead) this.moving = b;
  }
  setGuard(g: GuardLevel): void {
    if (!this.dead) this.guard = g;
  }
  startSlash(): void {
    if (!this.dead) {
      this.action = 'slash';
      this.actionElapsed = 0;
    }
  }
  startHit(): void {
    if (!this.dead && this.action !== 'slash') {
      this.action = 'hit';
      this.actionElapsed = 0;
    }
  }
  startDeath(): void {
    this.dead = true;
    this.action = 'dead';
    this.actionElapsed = 0;
  }
  get isDead(): boolean {
    return this.dead;
  }
  actionName(): Action {
    return this.action;
  }
  guardLevel(): GuardLevel {
    return this.guard;
  }

  update(dtMs: number): Pose {
    // base locomotion layer
    const period = this.moving ? WALK_PERIOD : IDLE_PERIOD;
    this.locoPhase = (this.locoPhase + dtMs / period) % 1;
    const base = this.moving
      ? addOffsets(IDLE_POSE, walkOffsets(this.locoPhase))
      : addOffsets(IDLE_POSE, idleOffsets(this.locoPhase));

    // 1) death wins
    if (this.action === 'dead') {
      this.actionElapsed += dtMs;
      return lerpPose(IDLE_POSE, DEAD, easeInQuad(Math.min(1, this.actionElapsed / DEATH_MS)));
    }

    // 2) transient action overlay
    if (this.action === 'slash') {
      this.actionElapsed += dtMs;
      const p = phaseAt(SLASH_SEGS, this.actionElapsed);
      if (p.done) {
        this.action = 'none';
      } else if (p.name === 'windup') {
        return lerpPose(base, SLASH_WINDUP, easeOutCubic(p.t));
      } else if (p.name === 'strike') {
        return lerpPose(SLASH_WINDUP, SLASH_FOLLOW, easeOutCubic(p.t));
      } else {
        return lerpPose(SLASH_FOLLOW, base, easeInOutSine(p.t));
      }
    } else if (this.action === 'hit') {
      this.actionElapsed += dtMs;
      const p = phaseAt(HIT_SEGS, this.actionElapsed);
      if (p.done) {
        this.action = 'none';
      } else if (p.name === 'recoil') {
        return lerpPose(base, HIT_RECOIL, easeOutCubic(p.t));
      } else {
        return lerpPose(HIT_RECOIL, base, easeInOutSine(p.t));
      }
    }

    // 3) guard hold (smoothed)
    const target = this.guard === 'none' ? 0 : 1;
    this.guardT += (Math.sign(target - this.guardT) * dtMs) / GUARD_BLEND_MS;
    this.guardT = Math.max(0, Math.min(1, this.guardT));
    if (this.guardT > 0.001) {
      const held = this.guard === 'block' ? GUARD_POSE : SLASH_WINDUP;
      return lerpPose(base, held, easeInOutSine(this.guardT));
    }

    // 4) plain locomotion
    return base;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/fighterAnimator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/fighter/FighterAnimator.ts src/core/__tests__/fighterAnimator.test.ts
git commit -m "feat(fighter): FighterAnimator composes base + action + guard into a Pose (TDD)"
```

---

### Task 6: Wire the animator into Fighter, AIController, and DuelScene

This removes ALL direct `setPose` snapping. After this task the fighters breathe, walk, and swing with eased motion. Integration code — verified by `npm run build`, the existing suite, and a manual dev-server check.

**Files:**
- Modify: `src/game/fighter/Fighter.ts`
- Modify: `src/game/ai/AIController.ts`
- Modify: `src/game/scenes/DuelScene.ts`

**Interfaces:**
- Consumes: `FighterAnimator`, `GuardLevel` (Task 5).
- Produces (on `Fighter`): `update(dtMs: number, moving: boolean): void`, `setGuard(g: GuardLevel): void`, `slash(): void`, `hitAnim(): void`, `die(): void`.

- [ ] **Step 1: Add the animator to `Fighter`**

In `src/game/fighter/Fighter.ts`:

Replace the import line
```ts
import { IDLE_POSE, Pose, worldLimbs } from './Skeleton';
```
with
```ts
import { IDLE_POSE, Pose, worldLimbs } from './Skeleton';
import { FighterAnimator, GuardLevel } from './FighterAnimator';
```

Add a field next to `private gfx`:
```ts
  private animator = new FighterAnimator();
```

Add these methods after `setPose`:
```ts
  /** Advance the animation one frame and render. `moving` drives the walk vs idle base layer. */
  update(dtMs: number, moving: boolean): void {
    this.animator.setMoving(moving);
    this.setPose(this.animator.update(dtMs));
  }

  setGuard(g: GuardLevel): void {
    this.animator.setGuard(g);
  }
  slash(): void {
    this.animator.startSlash();
  }
  hitAnim(): void {
    this.animator.startHit();
  }
  die(): void {
    this.animator.startDeath();
  }
```

In `applyHit`, trigger the recoil animation — change:
```ts
  applyHit(result: SlashResult): void {
    this.health = Math.max(0, this.health - result.totalDamage);
    for (const h of result.hits) if (h.severed) this.severed.add(h.limbId);
    this.redraw();
  }
```
to:
```ts
  applyHit(result: SlashResult): void {
    this.health = Math.max(0, this.health - result.totalDamage);
    for (const h of result.hits) if (h.severed) this.severed.add(h.limbId);
    this.hitAnim();
    this.redraw();
  }
```

- [ ] **Step 2: Make `AIController` drive triggers, not poses**

In `src/game/ai/AIController.ts`:

Replace the imports
```ts
import { AIState, AIParams, nextAIState } from '../../core/ai';
import { COL } from '../../palette';
import { IDLE_POSE, SLASH_POSE, lerpPose } from '../fighter/Skeleton';
import { Fighter } from '../fighter/Fighter';

const WINDUP_POSE = lerpPose(IDLE_POSE, SLASH_POSE, -0.35); // arm drawn back — the "tell"
const ENEMY_SPEED = 0.17; // px/ms
```
with
```ts
import { AIState, AIParams, nextAIState } from '../../core/ai';
import { COL } from '../../palette';
import { Fighter } from '../fighter/Fighter';

const ENEMY_SPEED = 0.17; // px/ms
```

Replace the entire `enter` method:
```ts
  private enter(state: AIState) {
    const { self } = this.opts;
    // leaving a state: clear its effects
    self.blocking = false;
    this.state = state;
    this.tInState = 0;

    switch (state) {
      case 'telegraph':
        self.setPose(WINDUP_POSE);
        break;
      case 'attack':
        self.setPose(SLASH_POSE);
        this.opts.onAttack();
        break;
      case 'recover':
      case 'idle':
      case 'approach':
        self.setPose(IDLE_POSE);
        break;
      case 'block':
        self.blocking = true;
        self.setPose(WINDUP_POSE);
        break;
      case 'dodge': {
        self.setPose(IDLE_POSE);
        const back = -self.facing * 70;
        this.scene.tweens.add({ targets: self, x: self.x + back, duration: 200, yoyo: true, ease: 'Quad.easeOut' });
        break;
      }
    }
  }
```
with:
```ts
  private enter(state: AIState) {
    const { self } = this.opts;
    // leaving a state: clear its effects
    self.blocking = false;
    self.setGuard('none');
    this.state = state;
    this.tInState = 0;

    switch (state) {
      case 'telegraph':
        self.setGuard('telegraph');
        break;
      case 'attack':
        self.slash();
        this.opts.onAttack();
        break;
      case 'block':
        self.blocking = true;
        self.setGuard('block');
        break;
      case 'dodge': {
        const back = -self.facing * 70;
        this.scene.tweens.add({ targets: self, x: self.x + back, duration: 200, yoyo: true, ease: 'Quad.easeOut' });
        break;
      }
      case 'recover':
      case 'idle':
      case 'approach':
        break;
    }
  }
```

- [ ] **Step 3: Drive both fighters from `DuelScene.update` and replace player pose-snapping**

In `src/game/scenes/DuelScene.ts`:

(a) Remove the now-unused pose import. Change:
```ts
import { IDLE_POSE, SLASH_POSE } from '../fighter/Skeleton';
import { drawSkeleton } from '../fighter/drawFighter';
```
to:
```ts
import { SLASH_FOLLOW } from '../fighter/Skeleton';
import { drawSkeleton } from '../fighter/drawFighter';
```
(`SLASH_FOLLOW` is used by the win-screen silhouette flourish in Task 7; `endDuel` currently references `SLASH_POSE` — update that reference in this step.)

(b) In `doSlash`, replace:
```ts
    if (this.time.now < this.busyUntil) return;
    this.busyUntil = this.time.now + 220;
    this.player.setPose(SLASH_POSE);
    this.time.delayedCall(150, () => this.player.setPose(IDLE_POSE));
```
with:
```ts
    if (this.time.now < this.busyUntil) return;
    this.busyUntil = this.time.now + 220;
    this.player.slash();
```

(c) In `dealSpecial`, replace:
```ts
    this.busyUntil = this.time.now + 320;
    this.player.setPose(SLASH_POSE);
    this.time.delayedCall(150, () => this.player.setPose(IDLE_POSE));
    playSlash();
```
with:
```ts
    this.busyUntil = this.time.now + 320;
    this.player.slash();
    playSlash();
```

(d) In `enemyStrike`, after the damage is applied, trigger the player's recoil. Change:
```ts
    this.player.health = Math.max(0, this.player.health - dmg);
    this.player.redraw();
    this.gore.spray({ x: this.player.x, y: this.player.y - 46 }, 9);
```
to:
```ts
    this.player.health = Math.max(0, this.player.health - dmg);
    this.player.hitAnim();
    this.player.redraw();
    this.gore.spray({ x: this.player.x, y: this.player.y - 46 }, 9);
```

(e) In `endDuel`, change the silhouette source pose:
```ts
    drawSkeleton(sil, SLASH_POSE, { severed: new Set(), silhouette: true });
```
to:
```ts
    drawSkeleton(sil, SLASH_FOLLOW, { severed: new Set(), silhouette: true });
```

(f) Replace the whole `update` method:
```ts
  update(_time: number, delta: number) {
    if (this.over) {
      this.hud.update();
      return;
    }
    if (!this.finishing && (this.enemy.isDead || this.player.isDead)) {
      return this.onKill(this.enemy.isDead);
    }

    // lateral movement to close/open distance
    let dir = 0;
    if (this.keys.left.isDown) dir -= 1;
    if (this.keys.right.isDown) dir += 1;
    this.player.x = Phaser.Math.Clamp(this.player.x + dir * MOVE_SPEED * delta, 60, GAME_W - 60);

    // always face the opponent
    this.player.facing = this.enemy.x >= this.player.x ? 1 : -1;
    this.player.scaleX = this.player.facing;

    this.forest.update(this.player.x);
    this.ai.update(delta);
    this.trail.update(delta);
    this.hud.update();
  }
```
with:
```ts
  update(_time: number, delta: number) {
    if (!this.finishing && (this.enemy.isDead || this.player.isDead)) {
      this.onKill(this.enemy.isDead);
    }

    let playerMoving = false;
    let enemyMoving = false;

    if (!this.over) {
      let dir = 0;
      if (this.keys.left.isDown) dir -= 1;
      if (this.keys.right.isDown) dir += 1;
      this.player.x = Phaser.Math.Clamp(this.player.x + dir * MOVE_SPEED * delta, 60, GAME_W - 60);
      playerMoving = dir !== 0;

      this.player.facing = this.enemy.x >= this.player.x ? 1 : -1;
      this.player.scaleX = this.player.facing;

      this.forest.update(this.player.x);
      this.ai.update(delta);
      enemyMoving = this.ai.stateName() === 'approach';
      this.trail.update(delta);
    }

    // animate both fighters every frame (incl. the death fall while finishing)
    this.player.update(delta, playerMoving);
    this.enemy.update(delta, enemyMoving);
    this.hud.update();
  }
```

- [ ] **Step 4: Build + existing tests**

Run: `npm run build`
Expected: clean (no TS errors; vite build succeeds).

Run: `npm test`
Expected: all suites green (new Tasks 1–5 + existing).

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, open http://localhost:5173. Confirm: both fighters visibly **breathe** at idle; holding **A/D** plays a **walk cycle**; drawing a slash plays a wind-up→strike→recover swing (not a snap); the enemy shows a wind-up tell on telegraph. No console errors.

- [ ] **Step 6: Commit**

```bash
git add src/game/fighter/Fighter.ts src/game/ai/AIController.ts src/game/scenes/DuelScene.ts
git commit -m "feat(motion): animator drives idle/walk/slash/hit; remove pose-snapping"
```

---

### Task 7: Death fall + retuned KillBeat (fast red wash + running silhouette)

Match the measured kill beat: a brief on-field collapse, then a fast red wash and a black running silhouette into the win/lose screen.

**Files:**
- Create: `src/game/scenes/KillBeat.ts`
- Modify: `src/game/scenes/DuelScene.ts`

**Interfaces:**
- Consumes: `drawSkeleton` (drawFighter), `IDLE_POSE`, `SLASH_FOLLOW`, `addOffsets` (Skeleton), `walkOffsets` (anim), `COL`, `GAME_W`, `GAME_H`.
- Produces: `class KillBeat` with constructor `(scene: Phaser.Scene)` and `play(playerWon: boolean): void` — runs the full end sequence (red wash → running silhouette → "YOU WIN"/"YOU LOSE" + "press R" prompt).

- [ ] **Step 1: Create the KillBeat module**

Create `src/game/scenes/KillBeat.ts`:

```ts
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { COL } from '../../palette';
import { drawSkeleton } from '../fighter/drawFighter';
import { IDLE_POSE, SLASH_FOLLOW, addOffsets } from '../fighter/Skeleton';
import { walkOffsets } from '../../core/anim';

/** The killing-blow end sequence: fast red wash, a running silhouette, then the result screen. */
export class KillBeat {
  constructor(private scene: Phaser.Scene) {}

  play(playerWon: boolean): void {
    const s = this.scene;
    const win = playerWon;

    // fast red wash (snaps in ~140ms — matches the source)
    const wash = s.add.graphics().setDepth(190);
    const paint = (a: number) => {
      wash.clear();
      wash.fillStyle(win ? COL.winRed : 0x1d2127, a).fillRect(0, 0, GAME_W, GAME_H);
      wash.fillStyle(win ? COL.winRedDeep : 0x0f1216, a).fillRect(0, GAME_H * 0.64, GAME_W, GAME_H);
    };
    paint(0);
    s.tweens.addCounter({ from: 0, to: 1, duration: 140, onUpdate: (t) => paint(t.getValue()) });

    // black running silhouette crossing left → right (legs cycle via walkOffsets)
    const sil = s.add.graphics().setDepth(192);
    const groundY = GAME_H * 0.74;
    const run = { p: 0 };
    s.tweens.add({
      targets: run,
      p: 1,
      delay: 120,
      duration: 900,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        const x = -120 + run.p * (GAME_W + 240);
        const pose = addOffsets(IDLE_POSE, walkOffsets((run.p * 4) % 1, 1.3));
        sil.clear();
        sil.setPosition(x, groundY).setScale(1.7);
        drawSkeleton(sil, pose, { severed: new Set(), silhouette: true });
      },
    });

    // result text + restart prompt after the run-in
    s.time.delayedCall(980, () => {
      const cx = GAME_W / 2;
      const heap = s.add.graphics().setDepth(191).setPosition(cx + 130, GAME_H * 0.72);
      heap.fillStyle(COL.outline, 1);
      heap.fillEllipse(0, 18, 150, 34);
      heap.fillEllipse(-60, 4, 60, 26);

      const flourish = s.add.graphics().setDepth(192).setPosition(cx - 40, GAME_H * 0.74).setScale(1.7);
      drawSkeleton(flourish, SLASH_FOLLOW, { severed: new Set(), silhouette: true });

      s.add
        .text(cx, 130, win ? 'YOU WIN' : 'YOU LOSE', {
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontStyle: 'bold italic',
          fontSize: '78px',
          color: '#f4efe2',
          stroke: '#3a0608',
          strokeThickness: 8,
        })
        .setOrigin(0.5)
        .setDepth(200);
      s.add
        .text(cx, 196, 'press R to duel again', { fontFamily: 'monospace', fontSize: '18px', color: '#f4efe2' })
        .setOrigin(0.5)
        .setAlpha(0.85)
        .setDepth(200);
    });
  }
}
```

- [ ] **Step 2: Replace `onKill`/`endDuel` in `DuelScene` with the collapse + KillBeat**

In `src/game/scenes/DuelScene.ts`:

(a) Add the import (next to the other scene imports):
```ts
import { KillBeat } from './KillBeat';
```

(b) Remove the now-unused `SLASH_FOLLOW` + `drawSkeleton` imports IF they are only used by the old `endDuel` (they move into `KillBeat`). Change:
```ts
import { SLASH_FOLLOW } from '../fighter/Skeleton';
import { drawSkeleton } from '../fighter/drawFighter';
```
to (delete both lines — they are no longer referenced in `DuelScene` after this task).

(c) Replace the entire `onKill` method:
```ts
  /** The killing-blow beat: white flash + camera punch + a held moment, then the win screen. */
  private onKill(playerWon: boolean) {
    if (this.finishing) return;
    this.finishing = true;
    this.over = true;
    const flash = this.add.graphics().setDepth(180);
    flash.fillStyle(0xffffff, 0.85).fillRect(0, 0, GAME_W, GAME_H);
    this.tweens.add({ targets: flash, alpha: 0, duration: 280, onComplete: () => flash.destroy() });
    this.cameras.main.zoomTo(1.09, 220, 'Quad.easeOut');
    this.time.delayedCall(560, () => {
      this.cameras.main.setZoom(1);
      this.endDuel(playerWon);
    });
  }
```
with:
```ts
  /** Killing-blow beat: the loser collapses, then a fast red wash + running silhouette (matches the source). */
  private onKill(playerWon: boolean) {
    if (this.finishing) return;
    this.finishing = true;
    this.over = true;
    (playerWon ? this.enemy : this.player).die();
    // brief on-field collapse glimpse, then the red wash takes over
    this.time.delayedCall(200, () => new KillBeat(this).play(playerWon));
  }
```

(d) Delete the entire `endDuel` method (its content now lives in `KillBeat`).

- [ ] **Step 3: Build + tests**

Run: `npm run build`
Expected: clean (confirm no leftover references to `endDuel`, `SLASH_FOLLOW`, or `drawSkeleton` in `DuelScene.ts`).

Run: `npm test`
Expected: all green.

- [ ] **Step 4: Manual check**

`npm run dev` → win a duel (and lose one). Confirm: the loser **collapses** to the ground, then a **fast red wash** + a **black silhouette runs across** into "YOU WIN"/"YOU LOSE"; `R` restarts. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/game/scenes/KillBeat.ts src/game/scenes/DuelScene.ts
git commit -m "feat(killbeat): death fall + fast red wash + running silhouette end sequence"
```

---

### Task 8: Blade-trail crimson fade tuning

Match the measured ~200ms fading crimson cut-streak.

**Files:**
- Modify: `src/game/vfx/BladeTrail.ts`

- [ ] **Step 1: Tune the fade rate**

In `src/game/vfx/BladeTrail.ts`, in `update`, change the fade divisor from 240 to 200 (the measured full-fade time):
```ts
    this.alpha = Math.max(0, this.alpha - deltaMs / 240);
```
to:
```ts
    this.alpha = Math.max(0, this.alpha - deltaMs / 200);
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Manual check**

`npm run dev` → slash and watch the crimson streak fade over ~0.2s (snappier than before). Compare against the video in the gate (Task 14).

- [ ] **Step 4: Commit**

```bash
git add src/game/vfx/BladeTrail.ts
git commit -m "feat(vfx): blade trail fades over ~200ms to match the reference"
```

---

### Task 9: HIT COMBO counter (HUD + wiring)

**Files:**
- Modify: `src/game/ui/Hud.ts`
- Modify: `src/game/scenes/DuelScene.ts`

**Interfaces:**
- Consumes: `Combo` (Task 4).
- Produces: `Hud.update(comboCount: number)` — the HUD renders a pulsing red "HIT COMBO" number top-right when `comboCount >= 2`.

- [ ] **Step 1: Add the combo text to the HUD**

In `src/game/ui/Hud.ts`:

(a) Add fields next to `eName`:
```ts
  private combo: Phaser.GameObjects.Text;
  private comboLabel: Phaser.GameObjects.Text;
  private lastCombo = 0;
```

(b) In the constructor, after `this.eName = ...`, add (uses `GAME_W` — extend the config import):
```ts
    this.comboLabel = scene.add
      .text(GAME_W - 20, 16, 'HIT COMBO', { fontFamily: 'monospace', fontSize: '12px', color: '#e8a83a' })
      .setOrigin(1, 0)
      .setDepth(101)
      .setVisible(false);
    this.combo = scene.add
      .text(GAME_W - 20, 30, '', { fontFamily: 'Georgia, serif', fontStyle: 'bold', fontSize: '34px', color: '#c01f29' })
      .setOrigin(1, 0)
      .setDepth(101);
```

(c) Change the config import at the top:
```ts
import { GAME_H } from '../../config';
```
to:
```ts
import { GAME_W, GAME_H } from '../../config';
```

(d) Change the `update` signature and add the combo render at the end:
```ts
  update() {
```
to:
```ts
  update(comboCount = 0) {
```
and just before the closing brace of `update`, add:
```ts
    // HIT COMBO counter (top-right), pulses when it climbs
    const show = comboCount >= 2;
    this.comboLabel.setVisible(show);
    this.combo.setText(show ? String(comboCount) : '');
    if (show && comboCount > this.lastCombo) {
      this.combo.setScale(1.4);
      (this.combo.scene as Phaser.Scene).tweens.add({ targets: this.combo, scale: 1, duration: 160, ease: 'Quad.easeOut' });
    }
    this.lastCombo = comboCount;
```

- [ ] **Step 2: Track the combo in `DuelScene` and feed the HUD**

In `src/game/scenes/DuelScene.ts`:

(a) Add the import:
```ts
import { Combo } from '../../core/combo';
```

(b) Add a field next to `playerFocus`:
```ts
  private combo = new Combo();
```

(c) Reset it on a new duel — in `create`, after `this.finishing = false;` add:
```ts
    this.combo.reset();
```

(d) In `doSlash`, register a hit or a miss on the combo. Change:
```ts
    playSlash();
    this.applyAndSpray(this.enemy, result);
    if (result.hits.length && !this.enemy.blocking && !this.inGrace()) {
      playImpact();
      const severed = result.hits.filter((h) => h.severed).length;
      this.playerFocus.gain(16 + severed * 10);
    }
```
to:
```ts
    playSlash();
    this.applyAndSpray(this.enemy, result);
    if (result.hits.length && !this.enemy.blocking && !this.inGrace()) {
      playImpact();
      const severed = result.hits.filter((h) => h.severed).length;
      this.playerFocus.gain(16 + severed * 10);
      this.combo.hit(this.time.now);
    } else {
      this.combo.reset();
    }
```

(e) Feed the HUD. In `update`, change the single `this.hud.update();` call (added in Task 6) to:
```ts
    this.hud.update(this.combo.value(this.time.now));
```

- [ ] **Step 3: Build + tests**

Run: `npm run build`
Expected: clean.

Run: `npm test`
Expected: all green.

- [ ] **Step 4: Manual check**

`npm run dev` → land 2+ quick consecutive slashes; a red combo number appears top-right and pulses; it disappears after a pause or a miss.

- [ ] **Step 5: Commit**

```bash
git add src/game/ui/Hud.ts src/game/scenes/DuelScene.ts
git commit -m "feat(hud): HIT COMBO counter on consecutive hits"
```

---

### Task 10: Distinct enemy haori tint

So "you" (navy) vs "RONIN" (oxblood) read apart.

**Files:**
- Modify: `src/palette.ts`
- Modify: `src/game/fighter/drawFighter.ts`
- Modify: `src/game/fighter/Fighter.ts`
- Modify: `src/game/scenes/DuelScene.ts`

**Interfaces:**
- Produces:
  - On `drawFighter`: `type Skin = { haori: number; haoriShade: number }`; `DrawOpts` gains `skin?: Skin`.
  - On `Fighter`: `FighterOpts` gains `skin?: Skin`; the fighter passes it through to `drawSkeleton`.

- [ ] **Step 1: Add enemy palette entries**

In `src/palette.ts`, add inside `COL` (before the closing `} as const;`):
```ts
  haoriEnemy: 0x6b2030, // oxblood haori — the RONIN, distinct from the player's navy
  haoriEnemyShade: 0x47131f,
```

- [ ] **Step 2: Make `drawSkeleton` accept a skin override**

In `src/game/fighter/drawFighter.ts`:

(a) Change the `DrawOpts` type:
```ts
export type DrawOpts = { severed: Set<string>; silhouette?: boolean };
```
to:
```ts
export type Skin = { haori: number; haoriShade: number };
export type DrawOpts = { severed: Set<string>; silhouette?: boolean; skin?: Skin };
```

(b) At the very start of `drawSkeleton` (after `const cut = opts.severed;`), add:
```ts
  const haori = opts.skin?.haori ?? COL.haori;
  const haoriShade = opts.skin?.haoriShade ?? COL.haoriShade;
```

(c) Replace the haori colour usages in the non-silhouette body with the locals. Specifically change these lines:
- `shaded(g, p.neck.x, p.neck.y + 4, p.pelvis.x + 3, p.pelvis.y + 16, 15, COL.haori, COL.haoriShade);` → use `haori, haoriShade`
- The hood: `g.fillStyle(COL.haori, 1);` → `g.fillStyle(haori, 1);` and `g.fillStyle(COL.haoriShade, 1);` → `g.fillStyle(haoriShade, 1);`
- Sleeve: `shaded(g, p.shoulderF.x, p.shoulderF.y, p.elbowF.x, p.elbowF.y, 9, COL.haori, COL.haoriShade);` → `haori, haoriShade`
- Forearm: `shaded(g, p.elbowF.x, p.elbowF.y, p.handF.x - 4, p.handF.y - 1, 8, COL.haori, COL.haoriShade);` → `haori, haoriShade`

(Leave `COL.haoriTrim` as-is — the red inner lining stays common.)

- [ ] **Step 3: Thread the skin through `Fighter`**

In `src/game/fighter/Fighter.ts`:

(a) Change the import:
```ts
import { drawSkeleton } from './drawFighter';
```
to:
```ts
import { drawSkeleton, Skin } from './drawFighter';
```

(b) Add to `FighterOpts`:
```ts
export type FighterOpts = {
  maxHealth?: number;
  stance?: StanceId;
  atkPlusWeapon?: number;
};
```
becomes:
```ts
export type FighterOpts = {
  maxHealth?: number;
  stance?: StanceId;
  atkPlusWeapon?: number;
  skin?: Skin;
};
```

(c) Add a field and store it in the constructor:
```ts
  private skin?: Skin;
```
and in the constructor body, before `this.redraw();`:
```ts
    this.skin = opts.skin;
```

(d) Pass it to `drawSkeleton` in `redraw`:
```ts
    drawSkeleton(this.gfx, this.pose, { severed: this.severed });
```
to:
```ts
    drawSkeleton(this.gfx, this.pose, { severed: this.severed, skin: this.skin });
```

- [ ] **Step 4: Give the enemy the oxblood skin**

In `src/game/scenes/DuelScene.ts`, change the enemy construction:
```ts
    this.enemy = new Fighter(this, GAME_W * 0.57, GROUND_Y, -1, { stance: 'heavy' });
```
to:
```ts
    this.enemy = new Fighter(this, GAME_W * 0.57, GROUND_Y, -1, {
      stance: 'heavy',
      skin: { haori: COL.haoriEnemy, haoriShade: COL.haoriEnemyShade },
    });
```
(`COL` is already imported in `DuelScene`.)

- [ ] **Step 5: Build + manual check**

Run: `npm run build`
Expected: clean.

`npm run dev` → the enemy's jacket is clearly oxblood-red vs the player's navy.

- [ ] **Step 6: Commit**

```bash
git add src/palette.ts src/game/fighter/drawFighter.ts src/game/fighter/Fighter.ts src/game/scenes/DuelScene.ts
git commit -m "feat(fidelity): distinct oxblood enemy haori vs player navy"
```

---

### Task 11: Flying severed limbs

When a limb severs, a piece arcs/spins off and falls, then fades.

**Files:**
- Modify: `src/game/vfx/Gore.ts`
- Modify: `src/game/scenes/DuelScene.ts`

**Interfaces:**
- Produces: `Gore.flyLimb(at: Pt, dir: 1 | -1, color: number): void` — spawns a short capsule piece that arcs outward in `dir`, spins, falls under gravity, and fades.

- [ ] **Step 1: Store the scene + add `flyLimb`**

In `src/game/vfx/Gore.ts`:

(a) Store the scene — change the constructor signature line:
```ts
  constructor(scene: Phaser.Scene) {
```
to:
```ts
  constructor(private scene: Phaser.Scene) {
```
(Phaser auto-assigns `this.scene`; the body still uses the `scene` parameter, which is fine.)

(b) Add the method after `severDecal`:
```ts
  /** A severed limb piece flung outward — arcs, spins, falls, fades. */
  flyLimb(at: Pt, dir: 1 | -1, color: number): void {
    if (Gore.reduced) return;
    const piece = this.scene.add.graphics().setDepth(45).setPosition(at.x, at.y);
    const len = Phaser.Math.Between(20, 30);
    const r = 7;
    piece.lineStyle(2 * r + 3, COL.outline, 1);
    piece.beginPath();
    piece.moveTo(-len / 2, 0);
    piece.lineTo(len / 2, 0);
    piece.strokePath();
    piece.lineStyle(2 * r, color, 1);
    piece.beginPath();
    piece.moveTo(-len / 2, 0);
    piece.lineTo(len / 2, 0);
    piece.strokePath();
    piece.fillStyle(COL.blood, 1).fillCircle(-len / 2, 0, r); // bloody stump end

    const vx = dir * Phaser.Math.Between(120, 220);
    const vy = -Phaser.Math.Between(180, 300);
    const spin = Phaser.Math.Between(-360, 360);
    const state = { t: 0 };
    this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: 900,
      onUpdate: () => {
        const dt = state.t * 0.9; // seconds-ish
        piece.x = at.x + vx * dt;
        piece.y = at.y + vy * dt + 0.5 * 900 * dt * dt; // gravity arc
        piece.angle = spin * state.t;
        piece.alpha = 1 - Math.max(0, (state.t - 0.6) / 0.4);
      },
      onComplete: () => piece.destroy(),
    });
  }
```

- [ ] **Step 2: Spawn flying limbs on sever in `DuelScene`**

In `src/game/scenes/DuelScene.ts`, add a small colour map near the top of the class (after the field declarations is fine — but place it as a module-level const above the class for clarity):
```ts
const LIMB_COLOR: Record<string, number> = {
  armF: COL.haori,
  forearmF: COL.haori,
  legF: COL.kimono,
  legB: COL.kimono,
  head: COL.skin,
};
```

Then in `applyAndSpray`, extend the sever branch. Change:
```ts
    target.applyHit(result);
    for (const h of result.hits) {
      this.gore.spray(h.cutPoint, h.severed ? 16 : 7);
      if (h.severed) this.gore.severDecal(h.cutPoint);
    }
```
to:
```ts
    target.applyHit(result);
    for (const h of result.hits) {
      this.gore.spray(h.cutPoint, h.severed ? 16 : 7);
      if (h.severed) {
        this.gore.severDecal(h.cutPoint);
        const color = LIMB_COLOR[h.limbId] ?? (target === this.enemy ? COL.haoriEnemy : COL.haori);
        this.gore.flyLimb(h.cutPoint, target.facing, color);
      }
    }
```

- [ ] **Step 3: Build + manual check**

Run: `npm run build`
Expected: clean.

`npm run dev` → land a severing slash (heavy stance, full draw across a limb); a limb piece flies off, spins, falls, and fades. (Press `B` to confirm reduced-gore mode suppresses it.)

- [ ] **Step 4: Commit**

```bash
git add src/game/vfx/Gore.ts src/game/scenes/DuelScene.ts
git commit -m "feat(gore): severed limbs fly, spin, fall, and fade"
```

---

### Task 12: More naturalistic forest

Bigger foreground trees + a sky peek.

**Files:**
- Modify: `src/game/background/Forest.ts`

- [ ] **Step 1: Add a sky band and big foreground trunks**

In `src/game/background/Forest.ts`, inside the constructor:

(a) Add a sky peek above the haze. Right after `this.add(haze, 0);`, add:
```ts
    // --- sky peek at the very top (warms the canopy gap) ---
    const sky = scene.add.graphics().setDepth(-19);
    sky.fillGradientStyle(COL.skyTop, COL.skyTop, COL.skyLow, COL.skyLow, 0.5);
    sky.fillRect(-120, 0, GAME_W + 240, 70);
    this.add(sky, 0.01);
```

(b) Add big near-foreground trunks framing the arena. Right after the `near` block (`this.add(near, 0.14);`), add:
```ts
    // --- big foreground trunks framing the arena (strong parallax) ---
    const fg = scene.add.graphics().setDepth(-6);
    fg.fillStyle(COL.trunk, 1);
    fg.fillRect(-40, -20, 46, groundY + 80);
    fg.fillRect(GAME_W - 14, -20, 52, groundY + 80);
    fg.fillStyle(COL.forestDark, 0.6);
    fg.fillRect(-40, -20, 12, groundY + 80);
    fg.fillRect(GAME_W + 22, -20, 12, groundY + 80);
    this.add(fg, 0.2);
```

- [ ] **Step 2: Build + manual check**

Run: `npm run build`
Expected: clean.

`npm run dev` → a hint of sky shows at the top; large dark trunks frame the screen edges and parallax strongly as you move. Verify against the reference in the gate (Task 14); adjust trunk width/x/parallax if it crowds the fighters.

- [ ] **Step 3: Commit**

```bash
git add src/game/background/Forest.ts
git commit -m "feat(forest): sky peek + big foreground trunks for depth"
```

---

### Task 13: AI balance — 20–60s, winnable and losable

This is tuned empirically against the running game (a unit test cannot assert "duel takes 20–60s"). Set starting constants, then verify time-to-kill at the dev server and adjust.

**Files:**
- Modify: `src/core/ai.ts`
- Modify: `src/game/ai/AIController.ts`
- Modify: `src/game/scenes/DuelScene.ts`

- [ ] **Step 1: Confirm the AI state tests still encode readable telegraphs**

Run: `npx vitest run src/core/__tests__/ai.test.ts`
Expected: PASS (these guard the telegraph→attack→recover flow; keep them green through tuning).

- [ ] **Step 2: Set starting balance constants**

In `src/core/ai.ts`, widen the telegraph (more reaction time) and lengthen recovery (less relentless). Change:
```ts
export const TELEGRAPH_MS = 420;
export const ATTACK_MS = 180;
export const RECOVER_MS = 460;
export const REACT_MS = 320;
```
to:
```ts
export const TELEGRAPH_MS = 520;
export const ATTACK_MS = 180;
export const RECOVER_MS = 620;
export const REACT_MS = 320;
```

In `src/game/ai/AIController.ts`, soften reactions and tighten ranges so the enemy commits readably. Change:
```ts
    this.params = {
      approachRange: 620,
      strikeRange: 132,
      reactBlockChance: 0.33,
      reactDodgeChance: 0.22,
      ...opts.params,
    };
```
to:
```ts
    this.params = {
      approachRange: 620,
      strikeRange: 132,
      reactBlockChance: 0.22,
      reactDodgeChance: 0.16,
      ...opts.params,
    };
```

In `src/game/scenes/DuelScene.ts`, lower the enemy's damage so the player has time to read and trade. Change the enemy construction (from Task 10) to add `atkPlusWeapon`:
```ts
    this.enemy = new Fighter(this, GAME_W * 0.57, GROUND_Y, -1, {
      stance: 'heavy',
      skin: { haori: COL.haoriEnemy, haoriShade: COL.haoriEnemyShade },
      atkPlusWeapon: 7,
    });
```

- [ ] **Step 3: Measure time-to-kill at the dev server**

Run: `npm run dev`. Play 3 duels as an ACTIVE player (move, slash, switch stance). Open the console and read `__duel.debugState()` to watch HP/dist if needed.

Verify ALL of:
- A competent active player **wins** in **~20–60s**.
- The player can also **lose** if passive/careless (stand still and take hits — HP should run out).
- Telegraphs are **readable** (the red caret + wind-up give time to react/retreat).

If a win is faster than ~20s: lower `player` damage by setting the player's `atkPlusWeapon` (currently default 10) down to 8, or raise both fighters' `maxHealth` to 120. If slower than ~60s or unwinnable: raise `player` `atkPlusWeapon` or lower enemy `maxHealth`. Re-measure until the window holds. Record the final numbers in the commit message.

- [ ] **Step 4: Build + full test suite**

Run: `npm run build` → clean.
Run: `npm test` → all green.

- [ ] **Step 5: Commit**

```bash
git add src/core/ai.ts src/game/ai/AIController.ts src/game/scenes/DuelScene.ts
git commit -m "balance(ai): readable telegraphs + tuned damage for a 20-60s winnable/losable duel"
```

---

### Task 14: Fidelity gate + proof capture

Measure against the source, not memory; then assemble the evidence package.

**Files:** none (verification + assets to `docs/` if desired).

- [ ] **Step 1: Full green test + clean build**

Run: `npm test`
Expected: all suites pass (anim, combo, fighterAnimator, skeleton, ai, slash, stance, focus, gesture, smoke, vec). Capture the summary line.

Run: `npm run build`
Expected: clean. Capture the final lines.

- [ ] **Step 2: Compare-view fidelity pass**

Run: `npm run dev`, open http://localhost:5173/?compare=forest_fight.png. With the opacity slider, compare: silhouette/proportions, palette, slash arc, blade trail, enemy tint, forest depth. Note any mismatch and adjust the relevant task's constants (slash segment ms in `FighterAnimator`, trail fade in `BladeTrail`, trunk params in `Forest`). Re-check until the overlay reads as one image.

- [ ] **Step 3: Capture before/after + a duel clip**

Capture a compare-view screenshot. Then record a short duel clip that shows the new **walk, slash, and death** (drive the live build in Chrome via the browser automation tools / `gif_creator`, or screen-record the dev server). Save artifacts under the scratchpad (not committed) and surface them to Kheshav.

- [ ] **Step 4: Name the biggest remaining gap**

Write one sentence naming the single biggest remaining motion/feel gap after this pass, and either fix it (loop back to the relevant task) or flag it for Kheshav.

- [ ] **Step 5: Hand off for play-test**

Present the evidence (test + build output, compare shot, clip) and ask Kheshav to play the build. **Do not push.** Publish only on his explicit go (and ask public vs private first).

---

## Self-Review

**1. Spec coverage:**
- Animation spine (anim core, animator, keyframes, Fighter/DuelScene wiring) → Tasks 1,2,3,5,6. ✓
- Idle/walk/slash/hit → Tasks 2,5,6. ✓  Death/fall → Tasks 3,5,7. ✓
- Feel tuning: slash easing (Task 5 segments), blade trail ~200ms (Task 8), kill beat retune (Task 7). ✓
- Combo counter (core + HUD) → Tasks 4,9. ✓
- Enemy tint → Task 10. ✓  Flying limbs → Task 11. ✓  Forest → Task 12. ✓
- AI balance 20–60s, no toggle → Task 13. ✓
- TDD'd pure logic (anim, combo; ai stays green) → Tasks 1,2,4,13. ✓
- Proof (tests/build/compare/clip/biggest-gap) → Task 14. ✓
- Pointer-down→slash-start <50ms: unchanged — `GestureInput` fires `onStart` synchronously on pointerdown and the wind-up begins immediately; the swing resolves on gesture end. ✓ (verify in Task 14)

**2. Placeholder scan:** No TBD/TODO; every code step shows full code. AI balance "adjust until the window holds" is an inherent empirical tuning loop with concrete starting values and explicit pass criteria, not a placeholder.

**3. Type consistency:** `Offsets` (anim) ↔ `addOffsets` (Skeleton) ↔ `FighterAnimator`. `Skin` defined in `drawFighter`, imported by `Fighter`. `Hud.update(comboCount)` matches both call sites in `DuelScene`. `KillBeat.play(playerWon)` matches `onKill`. `Combo.hit/value/reset` match Task 4. `flyLimb(at, dir, color)` matches the `DuelScene` call. `setGuard`/`slash`/`hitAnim`/`die`/`update` on `Fighter` match `AIController` + `DuelScene` usage. Removed `SLASH_POSE`/`IDLE_POSE` direct uses in `DuelScene`/`AIController` are accounted for.

**4. Ambiguity:** Slash/death/guard timings are explicit ms constants; keyframe poses are concrete coordinates; AI pass criteria are explicit.
