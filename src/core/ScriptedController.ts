// core/ScriptedController.ts — an OpponentController that replays a fixed list of intents,
// one per decide() call (spec §C, "for tests"). Pure and Phaser-free so the deterministic
// Sim test can live in core/ without importing the presentation layer.
// (Placement note in DIVERGENCES.md: spec listed this under game/; kept in core/ for
// Phaser-free testability — core tests must not import from game/.)
import type { CombatView, OpponentController, OpponentIntent } from './OpponentController';

export class ScriptedController implements OpponentController {
  private i = 0;

  constructor(private readonly script: OpponentIntent[]) {}

  decide(_view: CombatView, _dtFixedMs: number): OpponentIntent {
    const intent = this.script[this.i] ?? {};
    this.i += 1;
    return intent;
  }
}
