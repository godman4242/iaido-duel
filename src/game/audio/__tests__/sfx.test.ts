import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { StanceId } from '../../../config/stances';
import {
  SFX_SYNTH,
  SFX_FIRE_FRAMES,
  SFX_FIRE_OFFSET_MS,
  SLASH_SFX,
  HEAVY_LIGHT_TONE,
} from '../../../config/audio';

// ── fake WebAudio graph: records every node + param event so cues are assertable ─────────
type ParamEvent = { kind: 'set' | 'setAt' | 'ramp'; v: number; t: number };

class FakeParam {
  events: ParamEvent[] = [];
  private v_ = 0;
  get value(): number {
    return this.v_;
  }
  set value(v: number) {
    this.v_ = v;
    this.events.push({ kind: 'set', v, t: -1 });
  }
  setValueAtTime(v: number, t: number): void {
    this.events.push({ kind: 'setAt', v, t });
  }
  exponentialRampToValueAtTime(v: number, t: number): void {
    this.events.push({ kind: 'ramp', v, t });
  }
  /** First scheduled/set value (a node's birth frequency/gain). */
  first(): number {
    return this.events[0]?.v ?? this.v_;
  }
}

class FakeNode {
  connect<T>(n: T): T {
    return n;
  }
}
class FakeGain extends FakeNode {
  gain = new FakeParam();
}
class FakeOsc extends FakeNode {
  type = 'sine';
  frequency = new FakeParam();
  startT: number[] = [];
  stopT: number[] = [];
  start(t = 0): void {
    this.startT.push(t);
  }
  stop(t = 0): void {
    this.stopT.push(t);
  }
}
class FakeFilter extends FakeNode {
  type = 'lowpass';
  frequency = new FakeParam();
  Q = new FakeParam();
}
class FakeSource extends FakeNode {
  buffer: unknown = null;
  startT: number[] = [];
  stopT: number[] = [];
  start(t = 0): void {
    this.startT.push(t);
  }
  stop(t = 0): void {
    this.stopT.push(t);
  }
}

class FakeCtx {
  static last: FakeCtx | null = null;
  sampleRate = 8000;
  currentTime = 0;
  destination = new FakeNode();
  resumed = 0;
  oscs: FakeOsc[] = [];
  filters: FakeFilter[] = [];
  sources: FakeSource[] = [];
  gains: FakeGain[] = [];
  constructor() {
    FakeCtx.last = this;
  }
  createGain(): FakeGain {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createOscillator(): FakeOsc {
    const o = new FakeOsc();
    this.oscs.push(o);
    return o;
  }
  createBiquadFilter(): FakeFilter {
    const f = new FakeFilter();
    this.filters.push(f);
    return f;
  }
  createBuffer(_ch: number, len: number): { getChannelData: () => Float32Array } {
    return { getChannelData: () => new Float32Array(len) };
  }
  createBufferSource(): FakeSource {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  resume(): void {
    this.resumed++;
  }
  clear(): void {
    this.oscs = [];
    this.filters = [];
    this.sources = [];
    this.gains = [];
  }
}

// Install the fake BEFORE the module's lazy ac() ever runs.
(globalThis as Record<string, unknown>).window = { AudioContext: FakeCtx };

import {
  playDraw,
  playWhiff,
  playFlesh,
  playArmor,
  playSlashSfx,
  playSlash,
  playImpact,
  playStanceSwitch,
  playGrunt,
  resumeAudio,
  toggleMuted,
} from '../sfx';

/** The cached ctx (created on first play). */
function ctx(): FakeCtx {
  playStanceSwitch(); // guarantees creation
  const c = FakeCtx.last!;
  c.clear();
  return c;
}

beforeEach(() => {
  FakeCtx.last?.clear();
});

describe('four-way slash SFX matrix (Tell 28)', () => {
  it('draw fires a noise sweep + a ping partial (the unsheathe)', () => {
    const c = ctx();
    playDraw();
    expect(c.sources.length).toBe(SFX_SYNTH.draw.noise.length);
    expect(c.oscs.length).toBe(SFX_SYNTH.draw.partials[0].freqs.length);
    expect(c.filters[0].type).toBe(SFX_SYNTH.draw.noise[0].filter);
  });

  it('whiff is air only: noise, zero oscillators, sweeping DOWN (a miss, not steel)', () => {
    const c = ctx();
    playWhiff();
    expect(c.sources.length).toBe(1);
    expect(c.oscs.length).toBe(0);
    const spec = SFX_SYNTH.whiff.noise[0];
    expect(spec.freqTo).toBeLessThan(spec.freqFrom); // downward sweep is the miss signature
    expect(c.filters[0].frequency.first()).toBeCloseTo(spec.freqFrom);
  });

  it('flesh is thud + crack: one sine sweep and one noise burst at the config params', () => {
    const c = ctx();
    playFlesh();
    expect(c.oscs.length).toBe(1);
    expect(c.sources.length).toBe(1);
    expect(c.oscs[0].type).toBe(SFX_SYNTH.flesh.tones[0].wave);
    expect(c.oscs[0].frequency.first()).toBeCloseTo(SFX_SYNTH.flesh.tones[0].freqFrom);
    expect(c.filters[0].type).toBe('highpass');
  });

  it('armor is a bright tink: the partial stack + a metallic click, distinct from flesh', () => {
    const c = ctx();
    playArmor();
    expect(c.oscs.length).toBe(SFX_SYNTH.armor.partials[0].freqs.length);
    // every armor partial rings far above the flesh thud — the tink is unmistakably metal
    for (const o of c.oscs) {
      expect(o.frequency.first()).toBeGreaterThan(SFX_SYNTH.flesh.tones[0].freqFrom);
    }
  });

  it('playSlashSfx dispatches every matrix cue name', () => {
    const c = ctx();
    for (const kind of SLASH_SFX) playSlashSfx(kind);
    expect(c.sources.length + c.oscs.length).toBeGreaterThan(0);
  });

  it('CONTRACT: fire-frame map — draw on strokeStart, the rest on resolve, offsets finite', () => {
    expect(SFX_FIRE_FRAMES.draw).toBe('strokeStart');
    for (const kind of SLASH_SFX) {
      expect(['strokeStart', 'resolve']).toContain(SFX_FIRE_FRAMES[kind]);
      expect(Number.isFinite(SFX_FIRE_OFFSET_MS[kind])).toBe(true);
    }
  });
});

describe('heavy-vs-light tonal weight (HEAVY_LIGHT_TONE)', () => {
  it('heavy whiff is lower-pitched, longer, and louder than light (Tell 28 tonal weight)', () => {
    const c = ctx();
    playWhiff('light');
    const lightFreq = c.filters[0].frequency.first();
    const lightStop = c.sources[0].stopT[0];
    const lightPeak = Math.max(...c.gains[0].gain.events.map((e) => e.v));
    c.clear();
    playWhiff('heavy');
    const heavyFreq = c.filters[0].frequency.first();
    const heavyStop = c.sources[0].stopT[0];
    const heavyPeak = Math.max(...c.gains[0].gain.events.map((e) => e.v));

    expect(heavyFreq).toBeLessThan(lightFreq); // lower pitch
    expect(heavyStop).toBeGreaterThan(lightStop); // longer
    expect(heavyPeak).toBeGreaterThan(lightPeak); // weightier
    const spec = SFX_SYNTH.whiff.noise[0];
    expect(heavyFreq).toBeCloseTo(spec.freqFrom * HEAVY_LIGHT_TONE.heavy.freqScale);
    expect(lightFreq).toBeCloseTo(spec.freqFrom * HEAVY_LIGHT_TONE.light.freqScale);
  });

  it('config sanity: heavy is strictly lower/longer than light on every axis', () => {
    expect(HEAVY_LIGHT_TONE.heavy.freqScale).toBeLessThan(HEAVY_LIGHT_TONE.light.freqScale);
    expect(HEAVY_LIGHT_TONE.heavy.durScale).toBeGreaterThan(HEAVY_LIGHT_TONE.light.durScale);
    expect(HEAVY_LIGHT_TONE.balanced.freqScale).toBe(1);
  });

  it('balanced (and no stance) plays the cue at its raw config values', () => {
    const c = ctx();
    playFlesh();
    const bare = c.oscs[0].frequency.first();
    c.clear();
    playFlesh('balanced');
    expect(c.oscs[0].frequency.first()).toBeCloseTo(bare);
    expect(bare).toBeCloseTo(SFX_SYNTH.flesh.tones[0].freqFrom);
  });
});

describe('legacy M1 call sites keep their sounds (DuelScene compiles + sounds unchanged)', () => {
  it('playSlash is the config whoosh: bandpass noise sweep at SFX_SYNTH.slash params', () => {
    const c = ctx();
    playSlash();
    const spec = SFX_SYNTH.slash.noise[0];
    expect(c.sources.length).toBe(1);
    expect(c.filters[0].type).toBe(spec.filter);
    expect(c.filters[0].Q.first()).toBeCloseTo(spec.q);
    expect(c.filters[0].frequency.first()).toBeCloseTo(spec.freqFrom);
    const freqEvents = c.filters[0].frequency.events;
    expect(freqEvents[freqEvents.length - 1].v).toBeCloseTo(spec.freqTo);
  });

  it('playImpact IS the flesh cue (one name, one sound)', () => {
    const c = ctx();
    playImpact();
    const impactFreq = c.oscs[0].frequency.first();
    c.clear();
    playFlesh();
    expect(c.oscs[0].frequency.first()).toBeCloseTo(impactFreq);
  });

  it('stance chime stacks its two partials with the config stagger; grunt is a lowpassed saw', () => {
    const c = ctx();
    playStanceSwitch();
    const chime = SFX_SYNTH.stanceSwap.partials[0];
    expect(c.oscs.length).toBe(chime.freqs.length);
    expect(c.oscs[1].startT[0] - c.oscs[0].startT[0]).toBeCloseTo(chime.stepDelayS);
    c.clear();
    playGrunt();
    expect(c.oscs[0].type).toBe('sawtooth');
    expect(c.filters.length).toBe(1); // the lowpass muffle
  });
});

describe('chaos: hostile inputs and missing audio never throw or leak sound', () => {
  it('muted swallows every cue (no nodes created)', () => {
    const c = ctx();
    expect(toggleMuted()).toBe(true);
    playDraw();
    playWhiff('heavy');
    playFlesh();
    playArmor('light');
    playSlash();
    expect(c.sources.length + c.oscs.length + c.gains.length).toBe(0);
    expect(toggleMuted()).toBe(false); // restore for other tests
  });

  it('an unknown stance id falls back to neutral instead of throwing', () => {
    const c = ctx();
    expect(() => playWhiff('bogus' as StanceId)).not.toThrow();
    expect(c.filters[0].frequency.first()).toBeCloseTo(SFX_SYNTH.whiff.noise[0].freqFrom);
  });

  it('spam: 500 armor tinks in one tick survive', () => {
    const c = ctx();
    expect(() => {
      for (let i = 0; i < 500; i++) playArmor();
    }).not.toThrow();
    expect(c.oscs.length).toBe(500 * SFX_SYNTH.armor.partials[0].freqs.length);
  });

  it('resumeAudio resumes the context and never throws', () => {
    const c = ctx();
    expect(() => resumeAudio()).not.toThrow();
    expect(c.resumed).toBeGreaterThan(0);
  });

  it('no AudioContext at all (SSR/old browser): every cue is a silent no-op', async () => {
    vi.resetModules();
    const saved = (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).window;
    try {
      const fresh = await import('../sfx');
      expect(() => {
        fresh.resumeAudio();
        fresh.playDraw('heavy');
        fresh.playWhiff();
        fresh.playFlesh('light');
        fresh.playArmor();
        fresh.playSlash();
        fresh.playGrunt();
        fresh.playStanceSwitch();
      }).not.toThrow();
    } finally {
      (globalThis as Record<string, unknown>).window = saved;
      vi.resetModules();
    }
  });
});
