/**
 * Keeps the last few seconds of the camera stream in memory, for the mirror replay (SPEC §4.2).
 *
 * A WebM recording can't simply be trimmed at the front (later chunks depend on the first), so two
 * recorders run half a segment apart and each restarts every `segmentMs`, throwing its old clip
 * away. When the learner is done, the longer of the two running clips is kept: it ends now and is
 * between segmentMs/2 and segmentMs long. Nothing else is kept, nothing is written anywhere, and
 * `dispose()` drops everything (the clip lives only while its card is on screen).
 *
 * The recorder and the clock are injected, so the window logic runs in Node tests.
 */

/** The part of MediaRecorder this module uses. */
export interface RecorderLike {
  readonly state: "inactive" | "recording" | "paused";
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  start(): void;
  stop(): void;
}

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

export interface Clip {
  blob: Blob;
  /** how much of the attempt it holds, in ms */
  ms: number;
}

interface Run {
  rec: RecorderLike;
  chunks: Blob[];
  startedAt: number;
  /** false once the run is replaced: its data is dropped when it arrives */
  keep: boolean;
}

export class RollingRecorder {
  private readonly runs: (Run | null)[] = [null, null];
  private readonly timers: unknown[] = [];
  private disposed = false;
  /** the run being finalised by finish(): dispose() must be able to drop it too */
  private finishing: Run | null = null;
  private readonly make: () => RecorderLike;
  private readonly segmentMs: number;
  private readonly clock: Clock;
  private readonly type: string;

  constructor(make: () => RecorderLike, segmentMs: number, clock: Clock, type = "video/webm") {
    this.make = make;
    this.segmentMs = segmentMs;
    this.clock = clock;
    this.type = type;
  }

  start(): void {
    this.startRun(0);
    this.timers.push(this.clock.setTimeout(() => this.startRun(1), this.segmentMs / 2));
  }

  private startRun(slot: 0 | 1): void {
    if (this.disposed) return;
    const old = this.runs[slot];
    if (old) this.drop(old);
    const run: Run = { rec: this.make(), chunks: [], startedAt: this.clock.now(), keep: true };
    run.rec.ondataavailable = (e) => {
      if (run.keep && e.data.size > 0) run.chunks.push(e.data);
    };
    run.rec.start();
    this.runs[slot] = run;
    this.timers.push(this.clock.setTimeout(() => this.startRun(slot), this.segmentMs));
  }

  private drop(run: Run): void {
    run.keep = false;
    run.chunks = [];
    if (run.rec.state !== "inactive") run.rec.stop();
  }

  /** Stops recording and resolves with the last ~segment of the attempt (null if nothing was recorded). */
  finish(): Promise<Clip | null> {
    this.timers.forEach((id) => this.clock.clearTimeout(id));
    this.timers.length = 0;
    const now = this.clock.now();
    const running = this.runs.filter((r): r is Run => r !== null);
    const longest = running.reduce<Run | null>((best, r) => (!best || r.startedAt < best.startedAt ? r : best), null);
    for (const r of running) if (r !== longest) this.drop(r);
    this.runs.fill(null);
    if (!longest || longest.rec.state === "inactive") return Promise.resolve(null);
    const ms = now - longest.startedAt;
    this.finishing = longest;
    return new Promise((resolve) => {
      longest.rec.onstop = () => {
        const clip = longest.keep && longest.chunks.length ? { blob: new Blob(longest.chunks, { type: this.type }), ms } : null;
        longest.chunks = [];
        if (this.finishing === longest) this.finishing = null;
        resolve(clip);
      };
      longest.rec.stop();
    });
  }

  /** Stops everything and forgets every recorded byte. */
  dispose(): void {
    this.disposed = true;
    this.timers.forEach((id) => this.clock.clearTimeout(id));
    this.timers.length = 0;
    for (const r of this.runs) if (r) this.drop(r);
    this.runs.fill(null);
    if (this.finishing) {
      // its stop is already on the way: the clip resolves as null
      this.finishing.keep = false;
      this.finishing.chunks = [];
    }
  }
}

const TYPES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];

/** A MediaRecorder-backed rolling recorder for this stream, or null where recording isn't supported. */
export function createRollingRecorder(stream: MediaStream, segmentMs: number): RollingRecorder | null {
  if (typeof MediaRecorder === "undefined") return null;
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
  const options: MediaRecorderOptions = { videoBitsPerSecond: 1_500_000, ...(mimeType ? { mimeType } : {}) };
  try {
    void new MediaRecorder(stream, options); // throws here on unsupported options, not mid-card
  } catch {
    return null;
  }
  const clock: Clock = {
    now: () => performance.now(),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id as number),
  };
  const make = (): RecorderLike => {
    const rec = new MediaRecorder(stream, options);
    const adapter: RecorderLike = {
      get state() {
        return rec.state;
      },
      ondataavailable: null,
      onstop: null,
      start: () => rec.start(),
      stop: () => rec.stop(),
    };
    rec.ondataavailable = (e) => adapter.ondataavailable?.(e);
    rec.onstop = () => adapter.onstop?.();
    return adapter;
  };
  return new RollingRecorder(make, segmentMs, clock, mimeType?.split(";")[0] ?? "video/webm");
}
