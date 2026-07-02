import Phaser from 'phaser';
import { GAME_H } from '../../config';
import { BIOMES, type BiomeSpec } from '../../config/biomes';
import { BGK } from '../../config/biomes-extra';
import { BiomeKit } from './biomeKit';
import { paintBamboo } from './bamboo';
import { paintField } from './field';
import { paintMine, paintStoneWall } from './stoneMine';
import { paintTealForest } from './tealForest';

/** Biome kits implemented so far (ART_DIRECTION.md §10 gap-fix priority 1). */
export type BiomeKind = 'field' | 'bamboo' | 'tealForest' | 'stoneWall' | 'mine';

/** What a scene holds: call `update(dt, playerX)` every frame, `destroy()` on shutdown. */
export interface Biome {
  update(dt: number, cameraX: number): void;
  destroy(): void;
}

type OccluderStyle = 'trunk' | 'culm' | 'post';

const KIT: Record<BiomeKind, { paint: (kit: BiomeKit) => void; occluderStyle: OccluderStyle }> = {
  field: { paint: paintField, occluderStyle: 'trunk' },
  bamboo: { paint: paintBamboo, occluderStyle: 'culm' },
  tealForest: { paint: paintTealForest, occluderStyle: 'trunk' },
  stoneWall: { paint: paintStoneWall, occluderStyle: 'post' },
  mine: { paint: paintMine, occluderStyle: 'post' },
};

/**
 * One-call §2 biome background: layered parallax paint (§9), the tell-#2 dark top
 * vignette, and tell-#3 foreground occluders drawn ABOVE the fighters (depth
 * BGK.depth.occluder). `groundY` defaults to the scenes' GROUND_Y convention.
 *
 *   const biome = createBiome(this, 'tealForest', GROUND_Y);
 *   // in update(): biome.update(delta, this.player.x);
 *
 * Forest.ts stays untouched as the shipped DuelScene/TitleScene backdrop; this factory
 * is the drop-in for the overhaul (same layer-offset parallax model, richer kits).
 */
export function createBiome(
  scene: Phaser.Scene,
  kind: BiomeKind,
  groundY: number = GAME_H - BGK.groundDefaultOffset,
): Biome {
  const spec: BiomeSpec = BIOMES[kind];
  const kit = new BiomeKit(scene, groundY);
  KIT[kind].paint(kit);
  if (spec.occluder) kit.occluders(spec.occluder, KIT[kind].occluderStyle);
  kit.vignette(spec.vignette);
  return kit;
}
