/**
 * Synthesised sound effects (SPEC §3.7): oscillators and filtered noise with short envelopes.
 * No audio files, no licences, nothing to download. Each effect returns a voice that can be faded
 * out early (the engine keeps one exit sound at a time).
 */
export type SoundName = "tick" | "next" | "easy" | "hard" | "dislike" | "spring" | "settle" | "correct" | "wrong";

export interface Voice {
  stop(): void;
}

/** len scales durations, gain scales loudness (reduced motion: shorter and quieter, not silent). */
export interface Shape {
  len: number;
  gain: number;
}

type Effect = (ctx: AudioContext, out: AudioNode, s: Shape) => Voice;

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuffer(ctx: AudioContext) {
  let b = noiseBuffers.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = b.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, b);
  }
  return b;
}

/** A voice: its own output gain (for an early fade) and the sources it started. */
function voice(ctx: AudioContext, out: AudioNode) {
  const gain = ctx.createGain();
  gain.connect(out);
  const sources: AudioScheduledSourceNode[] = [];
  return {
    gain,
    add(src: AudioScheduledSourceNode) {
      sources.push(src);
    },
    handle: {
      stop() {
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0, now, 0.012);
        for (const s of sources) {
          try {
            s.stop(now + 0.06);
          } catch {
            /* already stopped */
          }
        }
      },
    } satisfies Voice,
  };
}

/** Exponential attack/decay envelope on a fresh gain node. */
function envelope(ctx: AudioContext, out: AudioNode, t0: number, peak: number, attack: number, decay: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  g.connect(out);
  return g;
}

interface ToneOpts { type: OscillatorType; f0: number; f1?: number; t0: number; dur: number; peak: number; attack: number }
function tone(ctx: AudioContext, v: ReturnType<typeof voice>, o: ToneOpts) {
  const osc = ctx.createOscillator();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.f0, o.t0);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, o.t0 + o.dur);
  osc.connect(envelope(ctx, v.gain, o.t0, o.peak, o.attack, Math.max(0.01, o.dur - o.attack)));
  osc.start(o.t0);
  osc.stop(o.t0 + o.dur + 0.05);
  v.add(osc);
  return osc;
}

interface NoiseOpts { f0: number; f1: number; q: number; t0: number; dur: number; peak: number; attack: number }
function swoosh(ctx: AudioContext, v: ReturnType<typeof voice>, o: NoiseOpts) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = o.q;
  band.frequency.setValueAtTime(o.f0, o.t0);
  band.frequency.exponentialRampToValueAtTime(o.f1, o.t0 + o.dur);
  src.connect(band).connect(envelope(ctx, v.gain, o.t0, o.peak, o.attack, Math.max(0.01, o.dur - o.attack)));
  src.start(o.t0);
  src.stop(o.t0 + o.dur + 0.05);
  v.add(src);
}

export const EFFECTS: Record<SoundName, Effect> = {
  // drag past the commit threshold: a soft tick
  tick(ctx, out, s) {
    const v = voice(ctx, out);
    tone(ctx, v, { type: "sine", f0: 1700, f1: 1450, t0: ctx.currentTime, dur: 0.045 * s.len, peak: 0.12 * s.gain, attack: 0.003 });
    return v.handle;
  },
  // completed: an upward whoosh
  next(ctx, out, s) {
    const v = voice(ctx, out);
    swoosh(ctx, v, { f0: 350, f1: 2600, q: 1.1, t0: ctx.currentTime, dur: 0.28 * s.len, peak: 0.32 * s.gain, attack: 0.07 * s.len });
    return v.handle;
  },
  // too easy (left): a sideways swish, brighter than the right one
  easy(ctx, out, s) {
    const v = voice(ctx, out);
    swoosh(ctx, v, { f0: 2300, f1: 900, q: 1.4, t0: ctx.currentTime, dur: 0.22 * s.len, peak: 0.28 * s.gain, attack: 0.05 * s.len });
    return v.handle;
  },
  // too hard (right): the same swish, pitched lower
  hard(ctx, out, s) {
    const v = voice(ctx, out);
    swoosh(ctx, v, { f0: 1400, f1: 560, q: 1.4, t0: ctx.currentTime, dur: 0.22 * s.len, peak: 0.28 * s.gain, attack: 0.05 * s.len });
    return v.handle;
  },
  // not this format (down): a thud under a falling swish
  dislike(ctx, out, s) {
    const v = voice(ctx, out);
    const t0 = ctx.currentTime;
    tone(ctx, v, { type: "sine", f0: 150, f1: 55, t0, dur: 0.2 * s.len, peak: 0.34 * s.gain, attack: 0.006 });
    swoosh(ctx, v, { f0: 900, f1: 220, q: 1, t0, dur: 0.26 * s.len, peak: 0.18 * s.gain, attack: 0.04 * s.len });
    return v.handle;
  },
  // spring-back: a subtle boing
  spring(ctx, out, s) {
    const v = voice(ctx, out);
    const t0 = ctx.currentTime;
    const osc = tone(ctx, v, { type: "sine", f0: 280, t0, dur: 0.25 * s.len, peak: 0.1 * s.gain, attack: 0.01 });
    osc.frequency.linearRampToValueAtTime(470, t0 + 0.08 * s.len);
    osc.frequency.exponentialRampToValueAtTime(320, t0 + 0.24 * s.len);
    return v.handle;
  },
  // new card settles in front: a light pop
  settle(ctx, out, s) {
    const v = voice(ctx, out);
    tone(ctx, v, { type: "sine", f0: 560, f1: 900, t0: ctx.currentTime, dur: 0.07 * s.len, peak: 0.12 * s.gain, attack: 0.004 });
    return v.handle;
  },
  // correct: a bright two-note chime
  correct(ctx, out, s) {
    const v = voice(ctx, out);
    const t0 = ctx.currentTime;
    tone(ctx, v, { type: "triangle", f0: 880, t0, dur: 0.14 * s.len, peak: 0.16 * s.gain, attack: 0.005 });
    tone(ctx, v, { type: "triangle", f0: 1318.5, t0: t0 + 0.1 * s.len, dur: 0.32 * s.len, peak: 0.16 * s.gain, attack: 0.005 });
    return v.handle;
  },
  // wrong: a soft low tone, never harsh
  wrong(ctx, out, s) {
    const v = voice(ctx, out);
    tone(ctx, v, { type: "sine", f0: 233, f1: 196, t0: ctx.currentTime, dur: 0.32 * s.len, peak: 0.13 * s.gain, attack: 0.03 });
    return v.handle;
  },
};
