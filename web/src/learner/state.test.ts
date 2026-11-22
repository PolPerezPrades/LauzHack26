import { describe, expect, it } from "vitest";
import { unitOrder } from "../content/curriculum";
import type { ExitKind, Skill } from "../core/types";
import { upcastEvents, type LearningEvent } from "../data/events";
import type { V1Event } from "../data/eventsV1";
import { MemoryRepository, exportLog, parseExport } from "../data/repository";
import { bktExposure, bktRetrieval, checkParams } from "./bkt";
import { emptySkill, skillOf, withP, type LearnerState } from "./model";
import { Rating, review } from "./schedule";
import { foldLearnerState, learnerStateOf } from "./state";
import { DAY, T0, createLog, type TestLog } from "./testLog";

const rec = (s: LearnerState, id: string, skill: Skill = "receptive") => skillOf(s, id, skill)!;
const choice4 = checkParams({ check: "choice", options: 4 })!;
const camera = checkParams({ check: "camera" })!;
const self = checkParams({ check: "self" })!;
const fold = (log: TestLog) => foldLearnerState(log.events);

/** A varied log: lessons, answers of every kind, swipes, a card left open, two sessions, a day apart. */
function variedLog(): TestLog {
  const log = createLog();
  log.open("a");
  log.card({ format: "system-tutorial", exit: "too_easy" });
  log.lesson("L-A");
  log.answer("L-A", true);
  log.lesson("w-hello");
  log.answer("w-hello", false, { confusedWith: "w-bye", exit: "too_hard" });
  log.swipe(["L-B"], "too_easy");
  log.swipe(["L-C"], "too_easy");
  log.answer("L-D", true, { check: "camera", skill: "productive", format: "question", exit: null });
  log.answer("L-E", true, { exit: "dislike_format" });
  log.swipe(["w-bye"], "too_hard");
  log.card({ format: "game-rain", items: [], evidence: [{ itemId: "L-A", skill: "receptive", kind: "retrieval", correct: true, check: "game", options: 4 }] });
  log.advance(DAY);
  log.open("b");
  log.answer("L-A", true, { exit: "too_easy" });
  log.emit({ type: "format.unmute", format: "quiz-choice" });
  log.emit({ type: "camera.off", sessionId: "b", reason: "user" });
  log.answer("ph-name", true, { format: "quiz-build", check: "build" });
  return log;
}

describe("learner state fold", () => {
  it("starts empty, with abc1 and greetings open", () => {
    const s = foldLearnerState([]);
    expect(s.items.size).toBe(0);
    expect(s).toMatchObject({ c: 0, accuracy: 0.82, xp: 0, cards: 0, events: 0 });
    expect([...s.openUnits].sort()).toEqual(["abc1", "greetings"]);
  });

  it("starts each (item, skill) at P0 and applies BKT to exposures and retrievals", () => {
    const log = createLog();
    log.lesson("L-A");
    const s = fold(log);
    expect(rec(s, "L-A").pKnown).toBeCloseTo(bktExposure(0.1));
    expect(rec(s, "L-A", "productive").pKnown).toBeCloseTo(bktRetrieval(0.1, true, self));
    expect(rec(s, "L-A")).toMatchObject({ evidence: "exposed", exposures: 1, attempts: 0 });
    expect(rec(s, "L-A").card).toBeUndefined(); // exposure never creates an FSRS card
    expect(rec(s, "L-A", "productive")).toMatchObject({ evidence: "practiced", attempts: 1, correct: 1 });
    expect(rec(s, "L-A", "productive").card?.reps).toBe(1);
    expect(s.items.get("L-A")?.introducedCard).toBe(1);
  });

  it("counts attempts, streaks, errors and confusions", () => {
    const log = createLog();
    log.answer("L-M", true);
    log.answer("L-M", false, { confusedWith: "L-N" });
    log.answer("L-M", false, { confusedWith: "L-N" });
    log.answer("L-M", false, { confusedWith: "L-S" });
    log.answer("L-M", true);
    const r = rec(fold(log), "L-M");
    expect(r).toMatchObject({ attempts: 5, correct: 2, streak: 1, confusions: { "L-N": 2, "L-S": 1 }, errorCards: [2, 3, 4] });
    expect(r.errorTs).toHaveLength(3);
  });
});

describe("evidence ladder and verified (SPEC §7.3)", () => {
  it("climbs exposed → practiced and never goes down on a wrong answer", () => {
    const log = createLog();
    log.lesson("L-A");
    expect(rec(fold(log), "L-A").evidence).toBe("exposed");
    log.answer("L-A", true);
    expect(rec(fold(log), "L-A").evidence).toBe("practiced");
    log.answer("L-A", false);
    expect(rec(fold(log), "L-A").evidence).toBe("practiced");
  });

  it("verifies with one correct camera, typed or build answer once pKnown ≥ 0.85", () => {
    const log = createLog();
    log.answer("L-B", true, { check: "camera", skill: "productive", format: "question" });
    const p1 = bktRetrieval(0.1, true, camera);
    expect(p1).toBeLessThan(0.85);
    expect(rec(fold(log), "L-B", "productive")).toMatchObject({ evidence: "practiced", strongCorrect: true });
    log.answer("L-B", true, { check: "camera", skill: "productive", format: "question" });
    expect(rec(fold(log), "L-B", "productive").pKnown).toBeCloseTo(bktRetrieval(p1, true, camera));
    expect(rec(fold(log), "L-B", "productive").evidence).toBe("verified");
  });

  it("never verifies from self-grades: no strong check, no day counted", () => {
    const log = createLog();
    for (let i = 0; i < 4; i++) log.answer("L-J", true, { check: "camera", selfGraded: true, skill: "productive", format: "question" });
    log.advance(DAY);
    for (let i = 0; i < 2; i++) log.answer("L-J", true, { check: "self", skill: "productive", format: "question" });
    log.advance(DAY);
    log.answer("L-J", true, { check: "mirror", skill: "productive", format: "question" });
    const r = rec(fold(log), "L-J", "productive");
    expect(r.pKnown).toBeGreaterThan(0.85);
    expect(r).toMatchObject({ strongCorrect: false, correctDays: [], evidence: "practiced" });
  });

  it("otherwise verifies with correct answers on two distinct days", () => {
    const log = createLog();
    for (let i = 0; i < 4; i++) log.answer("L-C", true);
    const sameDay = rec(fold(log), "L-C");
    expect(sameDay.pKnown).toBeGreaterThan(0.85);
    expect(sameDay).toMatchObject({ evidence: "practiced", correctDays: ["2026-11-02"] });
    log.advance(DAY);
    log.answer("L-C", true);
    expect(rec(fold(log), "L-C")).toMatchObject({ evidence: "verified", correctDays: ["2026-11-02", "2026-11-03"] });
  });

  it("keeps verified once reached", () => {
    const log = createLog();
    log.answer("L-B", true, { check: "typed" });
    log.answer("L-B", true, { check: "typed" });
    log.answer("L-B", true, { check: "typed" });
    expect(rec(fold(log), "L-B").evidence).toBe("verified");
    for (let i = 0; i < 4; i++) log.answer("L-B", false, { check: "typed" });
    expect(rec(fold(log), "L-B")).toMatchObject({ evidence: "verified", known: false });
  });

  it("drops a claim to exposed when its verification fails, and raises it to practiced when it holds", () => {
    const log = createLog();
    log.swipe(["L-C", "L-D"], "too_easy", "quiz-choice");
    expect(rec(fold(log), "L-C")).toMatchObject({ evidence: "claimed", pKnown: 0.75 });
    log.answer("L-C", false);
    log.answer("L-D", true);
    const s = fold(log);
    expect(rec(s, "L-C").evidence).toBe("exposed");
    expect(rec(s, "L-D").evidence).toBe("practiced");
    expect(s.items.get("L-C")?.probeSince).toBeUndefined();
    expect(s.items.get("L-D")?.probeSince).toBeUndefined();
  });
});

describe("known status hysteresis (SPEC §7.3)", () => {
  it("enters at 0.85 and leaves below 0.70", () => {
    const base = emptySkill();
    expect(withP(base, 0.84).known).toBe(false);
    const known = withP(base, 0.86);
    expect(known.known).toBe(true);
    expect(withP(known, 0.75).known).toBe(true);
    expect(withP(known, 0.7).known).toBe(true);
    expect(withP(known, 0.69).known).toBe(false);
    expect(withP(withP(known, 0.69), 0.8).known).toBe(false);
  });

  it("holds through the fold: known after two camera hits, still known at 0.71, learning at 0.42", () => {
    const log = createLog();
    const hit = (correct: boolean) => log.answer("L-K", correct, { check: "camera", skill: "productive", format: "question" });
    hit(true);
    hit(true);
    let p = bktRetrieval(bktRetrieval(0.1, true, camera), true, camera);
    expect(rec(fold(log), "L-K", "productive").known).toBe(true);
    hit(false);
    hit(false);
    p = bktRetrieval(bktRetrieval(p, false, camera), false, camera);
    expect(p).toBeGreaterThanOrEqual(0.7);
    expect(p).toBeLessThan(0.85);
    expect(rec(fold(log), "L-K", "productive")).toMatchObject({ known: true });
    hit(false);
    expect(rec(fold(log), "L-K", "productive").known).toBe(false);
  });
});

describe("FSRS grade at exit (SPEC §7.4)", () => {
  // evidence comes 1 s after card.shown (testLog)
  const at = T0 + 1000;
  const cases: [ExitKind, boolean, Parameters<typeof review>[2]][] = [
    ["next", true, Rating.Good], ["dislike_format", true, Rating.Good], ["too_easy", true, Rating.Easy], ["too_hard", true, Rating.Hard],
    ["next", false, Rating.Again], ["dislike_format", false, Rating.Again], ["too_easy", false, Rating.Again], ["too_hard", false, Rating.Again],
  ];
  for (const [exit, correct, grade] of cases) {
    it(`reviews a ${correct ? "correct" : "wrong"} item left with ${exit} as ${Rating[grade]}`, () => {
      const log = createLog();
      log.answer("L-A", correct, { exit });
      expect(rec(fold(log), "L-A").card).toEqual(review(undefined, at, grade));
    });
  }

  it("closes a card with the default column when the log ends without its exit", () => {
    const log = createLog();
    log.answer("L-A", true, { exit: null });
    const s = fold(log);
    expect(rec(s, "L-A").card).toEqual(review(undefined, at, Rating.Good));
    expect(s.formats.get("quiz-choice")).toMatchObject({ completed: 1 });
  });

  it("closes it with the default column when the next card is shown first, and ignores a late exit", () => {
    const log = createLog();
    const first = log.answer("L-A", true, { exit: null });
    log.answer("L-B", true, { exit: "too_easy" });
    log.emit({ type: "card.exit", sessionId: "s1", cardId: first, format: "quiz-choice", exit: "too_easy", completed: true, msVisible: 1 });
    const s = fold(log);
    expect(rec(s, "L-A").card).toEqual(review(undefined, at, Rating.Good));
    expect(rec(s, "L-A").pKnown).toBeCloseTo(bktRetrieval(0.1, true, choice4)); // no "too easy" floor either
    expect(rec(s, "L-B").card?.stability).toBeCloseTo(review(undefined, at, Rating.Easy).stability);
  });

  it("collapses several retrievals of an item on one card into one review: wrong if any was wrong", () => {
    const log = createLog();
    const ev = (correct: boolean) => ({ itemId: "num-3", skill: "receptive" as const, kind: "retrieval" as const, correct, check: "game" as const, options: 4 });
    log.card({ format: "game-rain", evidence: [ev(true), ev(false), ev(true)] });
    const r = rec(fold(log), "num-3");
    expect(r.attempts).toBe(3);
    expect(r.card).toEqual(review(undefined, T0 + 3000, Rating.Again));
  });

  it("reviews evidence outside any open card at once, with the default grade", () => {
    const log = createLog();
    log.emit({ type: "evidence", sessionId: "s1", cardId: "ghost", format: "quiz-choice", itemId: "L-F", skill: "receptive", kind: "retrieval", correct: true, check: "choice", options: 4 });
    const r = rec(fold(log), "L-F");
    expect(r.card).toEqual(review(undefined, T0, Rating.Good));
    expect(r.evidence).toBe("practiced");
  });
});

describe("challenge, accuracy and back-off (SPEC §7.6)", () => {
  it("moves c by 0.30·(success − 0.80) after each completed card with retrievals", () => {
    const log = createLog();
    log.answer("L-A", true);
    expect(fold(log).c).toBeCloseTo(0.06);
    const ev = (correct: boolean) => ({ itemId: "L-B", skill: "receptive" as const, kind: "retrieval" as const, correct, check: "choice" as const, options: 4 });
    log.card({ items: ["L-B"], evidence: [ev(true), ev(false)] });
    expect(fold(log).c).toBeCloseTo(0.06 + 0.3 * (0.5 - 0.8));
    log.lesson("L-C"); // exposure + one correct productive retrieval: success 1
    expect(fold(log).c).toBeCloseTo(0.06 - 0.09 + 0.06);
  });

  it("keeps an accuracy EMA over the retrievals of completed cards", () => {
    const log = createLog();
    log.answer("L-A", true);
    log.answer("L-A", false);
    const after1 = 0.82 + 0.12 * (1 - 0.82);
    expect(fold(log).accuracy).toBeCloseTo(after1 + 0.12 * (0 - after1));
  });

  it("backs off after 3 wrong retrievals in a row", () => {
    const log = createLog();
    log.answer("L-A", false);
    log.answer("L-B", false);
    expect(fold(log).backoff).toBeUndefined();
    log.answer("L-C", false);
    const s = fold(log);
    expect(s.c).toBeCloseTo(-0.24 * 3 - 0.2);
    expect(s.backoff).toEqual({ itemId: "L-C", skill: "receptive", card: 3 });
    expect(s.wrongStreak).toBe(0);
  });

  it("backs off at most once per card, and a correct answer resets the run", () => {
    const log = createLog();
    const ev = (correct: boolean) => ({ itemId: "L-A", skill: "receptive" as const, kind: "retrieval" as const, correct, check: "game" as const, options: 4 });
    log.card({ format: "game-rain", evidence: [ev(false), ev(false), ev(false), ev(false), ev(false), ev(false)] });
    expect(fold(log).c).toBeCloseTo(-0.2 - 0.24);
    const other = createLog();
    other.answer("L-A", false);
    other.answer("L-B", false);
    other.answer("L-C", true);
    other.answer("L-D", false);
    expect(foldLearnerState(other.events).backoff).toBeUndefined();
  });

  it("clamps c to [−1, 1]", () => {
    const log = createLog();
    for (let i = 0; i < 12; i++) log.answer(`L-${"ABCDEFGHIKLM"[i]}`, false);
    expect(fold(log).c).toBe(-1);
  });
});

describe("XP, days and formats", () => {
  it("sums XP and counts completed cards per local day; the tutorial counts for neither", () => {
    const log = createLog();
    log.card({ format: "system-tutorial", exit: "next" });
    log.answer("L-A", true);
    log.advance(DAY);
    log.card({ items: ["L-B"], evidence: [{ itemId: "L-B", skill: "receptive", kind: "retrieval", correct: true, check: "choice", options: 4 }], xp: 12 });
    const s = fold(log);
    expect(s.xp).toBe(22);
    expect([...s.days]).toEqual([["2026-11-02", 1], ["2026-11-03", 1]]);
    expect(s.cards).toBe(3);
  });

  it("relaxes every preference towards 1 after each card", () => {
    const log = createLog();
    log.answer("L-A", true); // quiz-choice alpha 2
    expect(fold(log).formats.get("quiz-choice")?.alpha).toBe(2);
    log.lesson("L-B");
    expect(fold(log).formats.get("quiz-choice")?.alpha).toBeCloseTo(1 + 0.99);
    expect(fold(log).formats.get("lesson")?.alpha).toBe(2);
  });

  it("unmutes a format with a fresh start", () => {
    const log = createLog();
    for (let i = 0; i < 3; i++) log.swipe([], "dislike_format", "game-rain");
    expect(fold(log).formats.get("game-rain")).toMatchObject({ muted: true, dislikes: 3 });
    log.emit({ type: "format.unmute", format: "game-rain" });
    expect(fold(log).formats.get("game-rain")).toMatchObject({ muted: false, dislikes: 0 });
    log.swipe([], "dislike_format", "game-rain");
    expect(fold(log).formats.get("game-rain")?.muted).toBe(false);
  });

  it("keeps the best game score per format", () => {
    const log = createLog();
    for (const score of [12, 30, 21]) log.emit({ type: "game.score", sessionId: "s1", cardId: `g${score}`, format: "game-rain", score, params: {} });
    expect(fold(log).gameBest.get("game-rain")).toBe(30);
  });
});

describe("determinism, incremental fold, export and v1 logs", () => {
  it("is deterministic: the same log folds to the same state", () => {
    expect(foldLearnerState(variedLog().events)).toEqual(foldLearnerState(variedLog().events));
  });

  it("gives the same state incrementally as from scratch, after every event", () => {
    const events = variedLog().events;
    for (let k = 0; k <= events.length; k++) {
      const prefix = events.slice(0, k);
      expect(learnerStateOf(prefix), `after ${k} events`).toEqual(foldLearnerState(prefix));
    }
  });

  it("never changes a snapshot it already returned", () => {
    const events = variedLog().events;
    const early = learnerStateOf(events.slice(0, 12));
    const copy = structuredClone(early);
    learnerStateOf(events);
    expect(early).toEqual(copy);
  });

  it("sees events appended in place to an array it folded before", () => {
    const log = createLog();
    log.answer("L-A", true);
    expect(learnerStateOf(log.events).cards).toBe(1);
    log.answer("L-B", true);
    expect(learnerStateOf(log.events)).toEqual(foldLearnerState(log.events));
    expect(learnerStateOf(log.events).cards).toBe(2);
  });

  it("returns the same snapshot for the same array, and refolds a replaced log", () => {
    const events = variedLog().events;
    const a = learnerStateOf(events);
    expect(learnerStateOf(events)).toBe(a);
    const replaced = events.map((e) => ({ ...e })) as LearningEvent[];
    expect(learnerStateOf(replaced)).not.toBe(a);
    expect(learnerStateOf(replaced)).toEqual(a);
  });

  it("folds a 2,000-event log fast, and appends an event in a fraction of a millisecond", () => {
    // ~6 ms and ~0.02 ms on the dev machine (2026-11-22); the bounds only catch an accidental O(n²)
    const log = createLog();
    const items = unitOrder("abc1").concat(unitOrder("greetings"), unitOrder("numbers"));
    for (let i = 0; log.events.length < 2000; i++) {
      const id = items[i % items.length];
      if (i % 7 === 0) log.lesson(id);
      else if (i % 11 === 0) log.swipe([id], "too_easy", "quiz-choice");
      else log.answer(id, i % 3 !== 0, { exit: i % 5 === 0 ? "too_hard" : "next" });
      log.advance(3 * 60_000);
    }
    const events = log.events.slice();
    const t0 = performance.now();
    foldLearnerState(events);
    expect(performance.now() - t0).toBeLessThan(250);
    learnerStateOf(events.slice(0, -50));
    const t1 = performance.now();
    for (let k = events.length - 50; k < events.length; k++) learnerStateOf(events.slice(0, k + 1));
    expect((performance.now() - t1) / 50).toBeLessThan(5);
  });

  it("folds to the same state after export → import", async () => {
    const log = variedLog();
    const repo = new MemoryRepository();
    for (const e of log.events) await repo.append(e);
    const imported = parseExport(JSON.parse(JSON.stringify(await exportLog(repo))));
    expect(foldLearnerState(imported)).toEqual(foldLearnerState(log.events));
  });

  it("folds v1 answers through the upcaster", () => {
    const v1 = (id: string, activity: string, itemId: string, modality: Skill, correct: boolean, ts: number) =>
      ({ type: "answer", id, ts, v: 1, activity, itemId, modality, correct }) as V1Event;
    const events = upcastEvents([
      v1("a", "recognize", "L-A", "receptive", true, T0),
      v1("b", "imitate", "L-B", "productive", true, T0 + 1000),
      v1("c", "quiz", "w-hello", "receptive", false, T0 + 2000),
    ]);
    const s = foldLearnerState(events);
    expect(rec(s, "L-A")).toMatchObject({ evidence: "practiced", attempts: 1 });
    expect(rec(s, "L-A").card).toEqual(review(undefined, T0, Rating.Good));
    expect(rec(s, "L-B", "productive")).toMatchObject({ evidence: "practiced", strongCorrect: true });
    expect(rec(s, "L-B", "productive").pKnown).toBeCloseTo(bktRetrieval(0.1, true, camera));
    expect(rec(s, "w-hello").card).toEqual(review(undefined, T0 + 2000, Rating.Again));
    expect(s).toMatchObject({ xp: 0, cards: 3 });
    expect(s.days.get("2026-11-02")).toBe(3);
  });
});
