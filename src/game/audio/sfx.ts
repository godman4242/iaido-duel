// Synthesized combat SFX via the Web Audio API — no sampled assets.
let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

/** Call on the first user gesture to satisfy the browser autoplay policy. */
export function resumeAudio(): void {
  try {
    ac().resume?.();
  } catch {
    /* audio unavailable — stay silent */
  }
}

export function toggleMuted(): boolean {
  muted = !muted;
  return muted;
}

function noise(c: AudioContext, dur: number): AudioBufferSourceNode {
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

function env(c: AudioContext, peak: number, attack: number, decay: number): GainNode {
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

/** A blade whoosh: band-passed noise sweeping upward. */
export function playSlash(): void {
  if (muted) return;
  try {
    const c = ac();
    const t = c.currentTime;
    const src = noise(c, 0.2);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.3;
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.exponentialRampToValueAtTime(3600, t + 0.16);
    const g = env(c, 0.22, 0.02, 0.16);
    src.connect(bp).connect(g).connect(c.destination);
    src.start(t);
    src.stop(t + 0.22);
  } catch {
    /* ignore */
  }
}

/** A flesh/blade impact: low sine thud + a high noise crack. */
export function playImpact(): void {
  if (muted) return;
  try {
    const c = ac();
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.13);
    const g = env(c, 0.4, 0.005, 0.16);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.2);

    const src = noise(c, 0.09);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2200;
    const g2 = env(c, 0.3, 0.004, 0.08);
    src.connect(hp).connect(g2).connect(c.destination);
    src.start(t);
    src.stop(t + 0.1);
  } catch {
    /* ignore */
  }
}

/** A two-tone stance chime. */
export function playStanceSwitch(): void {
  if (muted) return;
  try {
    const c = ac();
    const t = c.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = env(c, 0.12, 0.01, 0.38);
      o.connect(g).connect(c.destination);
      o.start(t + i * 0.02);
      o.stop(t + 0.45);
    });
  } catch {
    /* ignore */
  }
}

/** A short pained grunt. */
export function playGrunt(): void {
  if (muted) return;
  try {
    const c = ac();
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(230, t);
    o.frequency.exponentialRampToValueAtTime(105, t + 0.13);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 950;
    const g = env(c, 0.2, 0.01, 0.15);
    o.connect(lp).connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.2);
  } catch {
    /* ignore */
  }
}
