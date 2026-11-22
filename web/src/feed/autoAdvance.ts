/**
 * Auto-advance after a result (SPEC §3.4, Part A2): every finished card leaves on its own with the
 * Next exit. `autoAdvanceMs` decides how long a result stays on screen; `createCountdown` runs that
 * wait, frozen while the learner holds the card (to keep reading) or while the page is hidden.
 * Pure: no React, no DOM, an injected clock. The feed wires it to the pointer, the page visibility
 * and the banner's countdown bar.
 */
import type { TaskResult } from "../core/types";
import { FEED } from "./config";

export interface AutoAdvanceTiming {
  readonly autoAdvanceCorrectMs: number;
  readonly autoAdvanceWrong: { readonly baseMs: number; readonly perCharMs: number; readonly minMs: number; readonly maxMs: number };
  readonly autoAdvanceGameMs: number;
  readonly autoAdvanceNoFeedbackMs: number;
}

/** Characters as a reader sees them: code points, so an accented letter or an emoji counts once. */
const chars = (s: string | undefined) => (s ? Array.from(s).length : 0);

/**
 * How long a result stays before the card leaves:
 * - a game end screen (the result has a score): the game delay, whatever its feedback says;
 * - no feedback: the no-feedback delay (no banner, nothing to read);
 * - correct: the correct-answer delay;
 * - wrong: reading time for the correction, from the length of the answer and the note.
 */
export function autoAdvanceMs(result: Pick<TaskResult, "score" | "feedback">, cfg: AutoAdvanceTiming = FEED): number {
  if (result.score !== undefined) return cfg.autoAdvanceGameMs;
  const f = result.feedback;
  if (!f) return cfg.autoAdvanceNoFeedbackMs;
  if (f.correct) return cfg.autoAdvanceCorrectMs;
  const { baseMs, perCharMs, minMs, maxMs } = cfg.autoAdvanceWrong;
  return Math.min(maxMs, Math.max(minMs, baseMs + perCharMs * (chars(f.answer) + chars(f.note))));
}

/** Why the countdown is frozen: a pointer is down on the card, or the page is hidden. */
export type HoldReason = "pointer" | "hidden";

/** What the banner's countdown bar shows. */
export interface CountdownView {
  /** the whole wait, ms: the bar empties over this time */
  ms: number;
  /** changes whenever the wait starts again from the beginning, so the bar restarts with it */
  run: number;
  /** frozen: the bar stops where it is */
  held: boolean;
}

export interface Countdown {
  /** A result arrived: call `done` after `ms`. If something holds the card, the wait starts on release. */
  start(ms: number, done: () => void): void;
  /** Freeze the wait where it is. */
  hold(reason: HoldReason): void;
  /** That hold is over: go on with the time left, or start again from the beginning (`restart`). */
  release(reason: HoldReason, restart?: boolean): void;
  /** The card is leaving another way: forget the wait. */
  cancel(): void;
  /** null when no wait is pending */
  view(): CountdownView | null;
}

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const browserClock: Clock = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * One wait at a time (one result per card). `onChange` gets the new view after every change the
 * bar must show: start, freeze, release, restart, the end of the wait and cancel.
 */
export function createCountdown(onChange: (view: CountdownView | null) => void, clock: Clock = browserClock): Countdown {
  const holds = new Set<HoldReason>();
  let runs = 0;
  /** the pending wait: `left` ms remain, counted from `since` while it runs (null while frozen) */
  let wait: { ms: number; left: number; run: number; since: number | null; timer: unknown; done: () => void } | null = null;

  const view = (): CountdownView | null => (wait ? { ms: wait.ms, run: wait.run, held: holds.size > 0 } : null);

  const freeze = () => {
    if (!wait || wait.since === null) return;
    clock.clearTimeout(wait.timer);
    wait.left = Math.max(0, wait.left - (clock.now() - wait.since));
    wait.since = null;
  };

  const run = () => {
    if (!wait || wait.since !== null || holds.size > 0) return;
    const mine = wait;
    mine.since = clock.now();
    mine.timer = clock.setTimeout(() => {
      if (wait !== mine) return;
      wait = null;
      onChange(null);
      mine.done();
    }, mine.left);
  };

  return {
    start(ms, done) {
      freeze();
      wait = { ms, left: ms, run: ++runs, since: null, timer: undefined, done };
      run();
      onChange(view());
    },
    hold(reason) {
      if (holds.has(reason)) return;
      holds.add(reason);
      if (!wait) return;
      freeze();
      onChange(view());
    },
    release(reason, restart = false) {
      if (!holds.delete(reason) || !wait) return;
      if (restart) {
        wait.left = wait.ms;
        wait.run = ++runs;
      }
      run();
      onChange(view());
    },
    cancel() {
      if (!wait) return;
      freeze();
      wait = null;
      onChange(null);
    },
    view,
  };
}
