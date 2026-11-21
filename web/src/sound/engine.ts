/**
 * Sound engine (SPEC §3.7). The AudioContext is only created inside a real user activation (first
 * tap, click, key), so browsers never complain about autoplay; before that every effect is
 * silently skipped. Effects are fire-and-forget, at most one exit sound plays at a time (fast
 * swiping never piles up into noise), and audio is suspended while the page is hidden.
 * Haptics are separate: muting sound doesn't turn them off.
 */
import { prefersReducedMotion } from "../lib/env";
import { EFFECTS, type SoundName, type Voice } from "./effects";

export type { SoundName } from "./effects";

const EXIT_SOUNDS = new Set<SoundName>(["next", "easy", "hard", "dislike"]);
const GESTURES = ["pointerdown", "pointerup", "touchend", "keydown", "click"] as const;
const HAPTICS = { exit: 12, wrong: [20, 40, 20] } as const;

type Activation = { isActive: boolean; hasBeenActive: boolean };
const userActivation = () => (navigator as Navigator & { userActivation?: Activation }).userActivation;

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private exitVoice: Voice | null = null;
  private muted = false;
  private volume = 0.6;
  private installed = false;
  private haptics = true;

  /** Starts listening for the first user activation. Safe to call more than once. */
  install() {
    if (this.installed || typeof window === "undefined") return;
    this.installed = true;
    const onGesture = () => {
      // a touch pointerdown is not an activation yet: wait for the end of the tap
      const ua = userActivation();
      if (ua && !ua.isActive) return;
      this.unlock();
      if (!this.ctx || this.ctx.state === "running") for (const g of GESTURES) window.removeEventListener(g, onGesture, true);
    };
    for (const g of GESTURES) window.addEventListener(g, onGesture, { capture: true, passive: true });
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) {
        this.exitVoice?.stop();
        this.exitVoice = null;
        this.ctx.suspend().catch(() => {});
      } else {
        this.ctx.resume().catch(() => {});
      }
    });
  }

  private unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended" && !document.hidden) this.ctx.resume().catch(() => {});
      return;
    }
    const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : this.volume;
      master.connect(ctx.destination);
      // iOS: a silent buffer played inside the gesture opens the audio output
      const blank = ctx.createBufferSource();
      blank.buffer = ctx.createBuffer(1, 1, 22050);
      blank.connect(ctx.destination);
      blank.start(0);
      ctx.resume().catch(() => {});
      this.ctx = ctx;
      this.master = master;
    } catch {
      /* audio blocked by the host (e.g. an embedding WebView): stay silent */
    }
  }

  get isMuted() {
    return this.muted;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.exitVoice?.stop();
      this.exitVoice = null;
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.01);
  }

  play(name: SoundName) {
    const { ctx, master } = this;
    if (!ctx || !master || this.muted || ctx.state !== "running" || document.hidden) return;
    try {
      const reduced = prefersReducedMotion();
      const v = EFFECTS[name](ctx, master, { len: reduced ? 0.7 : 1, gain: reduced ? 0.6 : 1 });
      if (EXIT_SOUNDS.has(name)) {
        this.exitVoice?.stop();
        this.exitVoice = v;
      }
    } catch {
      /* a sound must never break a gesture */
    }
  }

  haptic(kind: keyof typeof HAPTICS) {
    if (!this.haptics || typeof navigator.vibrate !== "function") return;
    const ua = userActivation();
    if (ua ? !ua.hasBeenActive : !this.ctx) return; // browsers block vibration before any interaction
    try {
      navigator.vibrate(HAPTICS[kind] as number | number[]);
    } catch {
      /* not supported */
    }
  }
}
