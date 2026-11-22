import { describe, expect, it, vi } from "vitest";
import type { TaskResult } from "../core/types";
import { autoAdvanceMs, createCountdown, type Clock, type CountdownView } from "./autoAdvance";
import { FEED } from "./config";

const wrong = (answer?: string, note?: string): Pick<TaskResult, "feedback"> => ({ feedback: { correct: false, ...(answer !== undefined ? { answer } : {}), ...(note !== undefined ? { note } : {}) } });
const text = (n: number) => "x".repeat(n);

describe("autoAdvanceMs", () => {
  it("uses the SPEC §3.4 defaults", () => {
    expect(FEED.autoAdvanceCorrectMs).toBe(600); // twice as fast as Part A's 1.2 s
    expect(FEED.autoAdvanceGameMs).toBe(2500);
    expect(FEED.autoAdvanceNoFeedbackMs).toBe(600);
    expect(FEED.autoAdvanceWrong).toEqual({ baseMs: 2000, perCharMs: 30, minMs: 2500, maxMs: 5000 });
  });

  it("moves on quickly after a correct answer", () => {
    expect(autoAdvanceMs({ feedback: { correct: true } })).toBe(600);
    // even with a note: the correct-answer delay doesn't read (Q-A201)
    expect(autoAdvanceMs({ feedback: { correct: true, answer: "hello", note: text(120) } })).toBe(600);
  });

  it("gives a wrong answer reading time from the answer and the note: clamp(2000 + 30 × characters, 2500, 5000)", () => {
    expect(autoAdvanceMs(wrong())).toBe(2500);
    expect(autoAdvanceMs(wrong("B"))).toBe(2500); // 2030, clamped up
    expect(autoAdvanceMs(wrong(text(16)))).toBe(2500); // 2480, clamped up
    expect(autoAdvanceMs(wrong(text(17)))).toBe(2510);
    expect(autoAdvanceMs(wrong(text(10), text(30)))).toBe(3200);
    expect(autoAdvanceMs(wrong(undefined, text(40)))).toBe(3200);
    expect(autoAdvanceMs(wrong(text(100)))).toBe(5000);
    expect(autoAdvanceMs(wrong(text(30), text(200)))).toBe(5000); // clamped down
  });

  it("counts characters as a reader sees them", () => {
    expect(autoAdvanceMs(wrong("👋".repeat(20)))).toBe(2600); // 20 characters, 40 UTF-16 units
    expect(autoAdvanceMs(wrong("ñ".repeat(20)))).toBe(2600);
  });

  it("waits the game delay after a game, whatever its feedback", () => {
    expect(autoAdvanceMs({ score: 7 })).toBe(2500);
    expect(autoAdvanceMs({ score: 0, feedback: { correct: false, answer: text(200) } })).toBe(2500);
    expect(autoAdvanceMs({ score: 12, feedback: { correct: true } })).toBe(2500);
  });

  it("moves on as fast as a correct answer when there is no feedback", () => {
    expect(autoAdvanceMs({})).toBe(600);
  });

  it("reads its delays from the config it is given", () => {
    const cfg = { autoAdvanceCorrectMs: 1, autoAdvanceWrong: { baseMs: 10, perCharMs: 1, minMs: 0, maxMs: 100 }, autoAdvanceGameMs: 2, autoAdvanceNoFeedbackMs: 3 };
    expect(autoAdvanceMs({ feedback: { correct: true } }, cfg)).toBe(1);
    expect(autoAdvanceMs(wrong("abc", "de"), cfg)).toBe(15);
    expect(autoAdvanceMs({ score: 1 }, cfg)).toBe(2);
    expect(autoAdvanceMs({}, cfg)).toBe(3);
  });
});

/** A manual clock: timers fire only when the test advances time. */
function fakeClock() {
  let t = 0;
  let nextId = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: Clock = {
    now: () => t,
    setTimeout(fn, ms) {
      const id = ++nextId;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id as number);
    },
  };
  const advance = (ms: number) => {
    const end = t + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      t = due[1].at;
      due[1].fn();
    }
    t = end;
  };
  return { clock, advance, pending: () => timers.size };
}

function setup() {
  const c = fakeClock();
  const views: (CountdownView | null)[] = [];
  const countdown = createCountdown((v) => views.push(v), c.clock);
  const done = vi.fn();
  return { ...c, countdown, views, done, last: () => views[views.length - 1] };
}

describe("createCountdown", () => {
  it("calls done once when the wait is over, and then shows nothing", () => {
    const { countdown, advance, done, last } = setup();
    countdown.start(600, done);
    expect(last()).toEqual({ ms: 600, run: expect.any(Number), held: false });
    advance(599);
    expect(done).not.toHaveBeenCalled();
    advance(1);
    expect(done).toHaveBeenCalledTimes(1);
    expect(last()).toBeNull();
    expect(countdown.view()).toBeNull();
    advance(10_000);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("freezes while held and goes on with the time left after a plain release", () => {
    const { countdown, advance, done, last } = setup();
    countdown.start(3000, done);
    const run = last()!.run;
    advance(1000);
    countdown.hold("pointer");
    expect(last()).toEqual({ ms: 3000, run, held: true });
    advance(60_000); // reading for a minute
    expect(done).not.toHaveBeenCalled();
    countdown.release("pointer");
    expect(last()).toEqual({ ms: 3000, run, held: false }); // same run: the bar resumes where it stopped
    advance(1999);
    expect(done).not.toHaveBeenCalled();
    advance(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("starts again from the beginning when released with restart (a spring-back)", () => {
    const { countdown, advance, done, last } = setup();
    countdown.start(600, done);
    const first = last()!.run;
    advance(500);
    countdown.hold("pointer"); // pointer down, then a drag
    advance(2000);
    countdown.release("pointer", true); // released below the threshold: the card springs back
    expect(last()!.run).not.toBe(first); // a new run: the bar starts full again
    expect(last()!.held).toBe(false);
    advance(599);
    expect(done).not.toHaveBeenCalled();
    advance(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("waits for the release when the result arrives while the card is held", () => {
    const { countdown, advance, done, last } = setup();
    countdown.hold("pointer");
    countdown.start(600, done);
    expect(last()).toMatchObject({ ms: 600, held: true });
    advance(5000);
    expect(done).not.toHaveBeenCalled();
    countdown.release("pointer");
    advance(600);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("stays frozen until every hold is over", () => {
    const { countdown, advance, done } = setup();
    countdown.start(1000, done);
    countdown.hold("hidden");
    countdown.hold("pointer");
    countdown.release("pointer");
    advance(5000);
    expect(done).not.toHaveBeenCalled();
    countdown.release("hidden", true);
    advance(1000);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("ignores repeated holds and releases of something it doesn't hold", () => {
    const { countdown, advance, done, views } = setup();
    countdown.release("pointer", true); // nothing pending, nothing held
    countdown.hold("pointer"); // nothing pending: only remembered
    expect(views).toHaveLength(0);
    countdown.release("pointer");
    countdown.start(1000, done);
    advance(400);
    countdown.hold("pointer");
    countdown.hold("pointer");
    advance(100);
    countdown.release("pointer");
    countdown.release("pointer", true); // no longer held: no restart
    advance(599);
    expect(done).not.toHaveBeenCalled();
    advance(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("forgets the wait when cancelled (the card left another way)", () => {
    const { countdown, advance, done, last, pending } = setup();
    countdown.start(600, done);
    countdown.cancel();
    expect(last()).toBeNull();
    expect(pending()).toBe(0);
    advance(10_000);
    expect(done).not.toHaveBeenCalled();
    countdown.hold("pointer");
    countdown.release("pointer");
    countdown.cancel(); // nothing pending: no change to report
    expect(last()).toBeNull();
  });

  it("replaces a pending wait when a new one starts", () => {
    const { countdown, advance, done } = setup();
    const other = vi.fn();
    countdown.start(600, other);
    advance(300);
    countdown.start(1000, done);
    advance(700);
    expect(other).not.toHaveBeenCalled();
    advance(300);
    expect(done).toHaveBeenCalledTimes(1);
  });
});
