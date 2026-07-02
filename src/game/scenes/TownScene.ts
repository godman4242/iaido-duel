// src/game/scenes/TownScene.ts
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../config';
import { ARENA_MARGIN, NAME_LABEL } from '../../config/layout';
import { HUD_FAKE } from '../../config/hud-extra';
import { SCENE_BIOMES, TOWN_SCENE } from '../../config/scenes-extra';
import { GameState } from '../../core/gamestate';
import { Biome, createBiome } from '../background/createBiome';
import { Fighter } from '../fighter/Fighter';
import { Hud } from '../ui/Hud';
import { DialogueBox } from '../chrome/DialogueBox';
import { Letterbox } from '../chrome/Letterbox';

// ── Content constants (our original writing — swappable) ─────────────────────
// ALL PROSE IS ORIGINAL-BY-US. Never replace with the source game's lines.
const ELDER_NAME = 'ELDER';
const ELDER_GREETING =
  'A ronin haunts the teal forest east of here — he cuts down every blade that passes.';
const ELDER_PROMPT = 'Will you answer his challenge?';
const CHOICE_GO = 'Draw my blade. Take me to the forest.';
const CHOICE_STAY = 'Not yet. I will walk the fields a while.';
const QUEST_LINES = ['STORY QUEST: ANSWER THE RONIN\'S CHALLENGE', 'PRESS E TO SPEAK TO THE ELDER'];

/**
 * Exploration hub (interim, pre-Plan-3 walkable town): §2.1 sage-field biome, the §5
 * exploration HUD fed from the save state, and the §7 dialogue strip routing to the duel
 * behind a letterboxed travel pan (tell #9). A/D walks the ronin to exercise the parallax.
 */
export class TownScene extends Phaser.Scene {
  private state!: GameState;
  private biome!: Biome;
  private player!: Fighter;
  private hud!: Hud;
  private dlg!: DialogueBox;
  private bars!: Letterbox;
  private keys!: Record<'left' | 'right', Phaser.Input.Keyboard.Key>;
  private travelling = false;

  constructor() {
    super('Town');
  }

  init(data: { state: GameState }): void {
    this.state = data.state;
    this.travelling = false;
  }

  create(): void {
    const groundY = GAME_H - TOWN_SCENE.groundOffset;
    this.cameras.main.setBackgroundColor(TOWN_SCENE.bgColor);
    this.biome = createBiome(this, SCENE_BIOMES.town, groundY);

    // The ronin, exploration-sized (§3: ~1/5 screen height out of combat).
    this.player = new Fighter(this, GAME_W * TOWN_SCENE.playerXFrac, groundY, 1, {
      stance: 'balanced',
    });
    this.player.setScale(TOWN_SCENE.playerScale);

    // §5 exploration HUD, fed from the save (map/gold stubs stay HUD_FAKE for now).
    this.hud = new Hud(this);
    this.hud.setMode('explore');
    this.hud.setCoins(this.state.player.coins);
    this.hud.setXp(this.state.player.xp, HUD_FAKE.xpMax, this.state.player.level);
    this.hud.setLocation(this.state.area);
    this.hud.setQuest([...QUEST_LINES]);
    this.hud.attachNameLabel(this.player, this.state.player.name, 'player', {
      level: this.state.player.level,
      // Explorer rig is scaled down — scale the label height with it so it hugs the hat.
      offsetY: NAME_LABEL.offsetY * TOWN_SCENE.playerScale,
    });

    // Arriving under the travel-pan bars (from Prologue/Title) — release them.
    this.bars = new Letterbox(this);
    this.bars.snapIn();
    this.bars.slideOut();

    // §7 dialogue strip — the elder greets, then offers the road to the duel.
    this.dlg = new DialogueBox(this, { showBust: true });
    this.time.delayedCall(TOWN_SCENE.greetDelayMs, () => {
      if (!this.travelling) this.dlg.say(ELDER_NAME, ELDER_GREETING, () => this.openChoices());
    });

    const kb = this.input.keyboard!;
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    kb.on('keydown-E', () => {
      if (!this.travelling) this.openChoices();
    });
  }

  /** The elder's choice rows: travel to the duel, or stay in the fields. */
  private openChoices(): void {
    this.dlg.ask(ELDER_NAME, ELDER_PROMPT, [
      { label: CHOICE_GO, onSelect: () => this.travelToDuel() },
      { label: CHOICE_STAY, onSelect: () => this.dlg.hide() },
    ]);
  }

  /** Letterboxed travel pan into the duel arena (tell #9). */
  private travelToDuel(): void {
    if (this.travelling) return;
    this.travelling = true;
    this.dlg.hide();
    this.bars.slideIn(() => this.scene.start('Duel', { travelIn: true }));
  }

  update(_time: number, delta: number): void {
    let dir = 0;
    if (!this.travelling) {
      if (this.keys.left.isDown) dir -= 1;
      if (this.keys.right.isDown) dir += 1;
    }
    if (dir !== 0) {
      this.player.x = Phaser.Math.Clamp(
        this.player.x + dir * TOWN_SCENE.moveSpeed * delta,
        ARENA_MARGIN,
        GAME_W - ARENA_MARGIN,
      );
      this.player.facing = dir > 0 ? 1 : -1;
      this.player.scaleX = TOWN_SCENE.playerScale * this.player.facing;
    }
    this.player.update(delta, dir !== 0);
    this.biome.update(delta, this.player.x);
    this.hud.update();
  }
}
