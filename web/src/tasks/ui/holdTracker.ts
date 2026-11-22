/**
 * The "hold the pose" logic of live camera checks (from the old Imitate and SignSprint activities):
 * a good frame adds one, a bad frame takes `decay` off, and the sign passes after `need` frames.
 * While the hand matches ANOTHER sign, those frames are counted, so a give-up can say what the
 * learner was signing instead ("that looks like an N") and log it as a confusion. Pure.
 */
export class HoldTracker {
  private frames = 0;
  private readonly others = new Map<string, number>();
  private readonly need: number;
  private readonly decay: number;

  constructor(need: number, decay: number) {
    this.need = need;
    this.decay = decay;
  }

  /** One processed frame. `other` = another sign the hand matches, if any. Returns true once it passes. */
  step(ok: boolean, other: string | null = null): boolean {
    this.frames = ok ? this.frames + 1 : Math.max(0, this.frames - this.decay);
    if (other) this.others.set(other, (this.others.get(other) ?? 0) + 1);
    return this.passed;
  }

  get passed(): boolean {
    return this.frames >= this.need;
  }

  /** 0..1, for the hold bar */
  get progress(): number {
    return Math.min(1, this.frames / this.need);
  }

  /** The sign most often matched instead, if it was seen in at least `minFrames` frames. */
  confusion(minFrames: number): string | undefined {
    let best: string | undefined;
    let count = 0;
    for (const [id, n] of this.others) {
      if (n > count) {
        best = id;
        count = n;
      }
    }
    return count >= minFrames ? best : undefined;
  }

  reset(): void {
    this.frames = 0;
    this.others.clear();
  }
}
