// config/audio.ts — per-cue audio briefs (spec §D.5). We compose our OWN music/SFX that hit
// the same cue timing and tonal role; no original audio bytes are shipped. All INFERRED —
// mood/instrumentation/tempo/loop and the exact fire-frame refine from footage (§4.2, ±1 frame).

export interface MusicCue {
  mood: string;
  instrumentation: string;
  loop: boolean;
}

export const MUSIC_CUES: Record<string, MusicCue> = {
  title: { mood: 'calm, expectant', instrumentation: 'shakuhachi + soft taiko', loop: true },
  menu: { mood: 'melancholic wander', instrumentation: 'koto + shakuhachi', loop: true },
  combat: { mood: 'tense drive', instrumentation: 'taiko + shamisen', loop: true },
  victory: { mood: 'triumphant', instrumentation: 'taiko hit + koto flourish', loop: false },
  defeat: { mood: 'somber', instrumentation: 'low shakuhachi', loop: false },
  levelUp: { mood: 'bright reward', instrumentation: 'koto pluck', loop: false },
  stanceSwap: { mood: 'snap', instrumentation: 'cloth/steel whoosh', loop: false },
};

// Four-way slash SFX matrix (spec §D.5) — each fires on a calibrated animation frame,
// heavy vs light have distinct tonal weight.
export const SLASH_SFX = ['draw', 'whiff', 'flesh', 'armor'] as const;
export type SlashSfx = (typeof SLASH_SFX)[number];
