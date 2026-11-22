import { describe, expect, it } from "vitest";
import { unitOrder } from "../content/curriculum";
import type { EvidenceDraft, ExitKind, Skill } from "../core/types";
import { bktExposure, bktRetrieval, checkParams } from "./bkt";
import { skillOf, type LearnerState } from "./model";
import { queriesFor } from "./queries";
import { Rating, review } from "./schedule";
import { foldLearnerState } from "./state";
import { createLog, type TestLog } from "./testLog";

// One test per row of SPEC §7.5, through the fold.

const choice4 = checkParams({ check: "choice", options: 4 })!;
const rec = (s: LearnerState, id: string, skill: Skill = "receptive") => skillOf(s, id, skill);
const fold = (log: TestLog) => foldLearnerState(log.events);
const answer = (itemId: string, correct: boolean): EvidenceDraft => ({ itemId, skill: "receptive", kind: "retrieval", correct, check: "choice", options: 4 });
/** a completed quiz card on L-A (right) and L-B (wrong), left with `exit`: success 0.5, so c moves by −0.09 first */
function mixedCard(exit: ExitKind) {
  const log = createLog();
  log.card({ items: ["L-A", "L-B"], evidence: [answer("L-A", true), answer("L-B", false)], exit });
  return { log, s: fold(log), at: log.events[1].ts, atWrong: log.events[2].ts };
}

describe("Next", () => {
  it("completed: FSRS per §7.4, challenge through success, alpha += 1", () => {
    const log = createLog();
    log.answer("L-A", true);
    const s = fold(log);
    expect(rec(s, "L-A")?.card?.reps).toBe(1);
    expect(s.c).toBeCloseTo(0.3 * (1 - 0.8));
    expect(s.formats.get("quiz-choice")).toMatchObject({ alpha: 2, beta: 1, cf: 0, completed: 1, shown: 1 });
  });
});

describe("Too easy", () => {
  it("completed: FSRS Easy and pKnown ≥ 0.90 for the correct items only; c += 0.10, cf += 0.10, alpha += 1", () => {
    const { s, at, atWrong } = mixedCard("too_easy");
    expect(rec(s, "L-A")?.pKnown).toBe(0.9);
    expect(rec(s, "L-A")?.card).toEqual(review(undefined, at, Rating.Easy));
    expect(rec(s, "L-B")?.pKnown).toBeCloseTo(bktRetrieval(0.1, false, choice4));
    expect(rec(s, "L-B")?.card).toEqual(review(undefined, atWrong, Rating.Again));
    expect(s.c).toBeCloseTo(-0.09 + 0.1);
    expect(s.formats.get("quiz-choice")).toMatchObject({ alpha: 2, beta: 1, cf: 0.1 });
    expect(rec(s, "L-A")?.tooEasy).toBe(1);
  });

  it("before completing, new item: a claim at pKnown 0.75 waiting for a probe; c += 0.15, cf += 0.10, no preference change", () => {
    const log = createLog();
    log.swipe(["w-hello"], "too_easy", "lesson");
    const s = fold(log);
    for (const skill of ["receptive", "productive"] as const) {
      expect(rec(s, "w-hello", skill)).toMatchObject({ evidence: "claimed", pKnown: 0.75, tooEasy: 1 });
      expect(rec(s, "w-hello", skill)?.card).toBeUndefined();
    }
    expect(s.items.get("w-hello")?.probeSince).toBe(1);
    expect(s.unitRuns.get("greetings")).toBe(1); // counts towards test-out
    expect(s.c).toBeCloseTo(0.15);
    expect(s.formats.get("lesson")).toMatchObject({ alpha: 1, beta: 1, cf: 0.1 });
    expect(queriesFor(s).status("w-hello", "receptive")).toBe("learning");
    expect(queriesFor(s).probes(["word"], 5)).toEqual(["w-hello"]);
  });

  it("claims only the skills its format trains", () => {
    const log = createLog();
    log.swipe(["L-A"], "too_easy", "quiz-choice");
    expect(rec(fold(log), "L-A", "productive")).toBeUndefined();
    const q = createLog();
    q.swipe(["L-A"], "too_easy", "question");
    expect(rec(fold(q), "L-A", "receptive")).toBeUndefined();
    expect(rec(fold(q), "L-A", "productive")?.evidence).toBe("claimed");
  });

  it("before completing, met item: a self-graded Easy review and pKnown ≥ 0.85; c += 0.15, cf += 0.10", () => {
    const log = createLog();
    log.lesson("L-A");
    log.swipe(["L-A"], "too_easy", "quiz-choice");
    const s = fold(log);
    const r = rec(s, "L-A")!;
    expect(r.pKnown).toBe(0.85);
    expect(r.card).toEqual(review(undefined, log.events[log.events.length - 1].ts, Rating.Easy));
    expect(r).toMatchObject({ evidence: "exposed", known: true, tooEasy: 1, attempts: 0 });
    expect(s.c).toBeCloseTo(0.06 + 0.15);
    expect(s.formats.get("quiz-choice")).toMatchObject({ alpha: 1, beta: 1, cf: 0.1 });
    expect(s.items.get("L-A")?.probeSince).toBeUndefined();
  });
});

describe("Too hard", () => {
  it("completed: FSRS Hard for correct items, Again for wrong ones, relearn priority; c −= 0.20, cf −= 0.15, alpha += 1", () => {
    const { s, at, atWrong } = mixedCard("too_hard");
    expect(rec(s, "L-A")?.card).toEqual(review(undefined, at, Rating.Hard));
    expect(rec(s, "L-B")?.card).toEqual(review(undefined, atWrong, Rating.Again));
    expect(rec(s, "L-A")).toMatchObject({ relearnSince: 1, tooHard: 1 });
    expect(rec(s, "L-B")).toMatchObject({ relearnSince: 1, tooHard: 1 });
    expect(s.c).toBeCloseTo(-0.09 - 0.2);
    expect(s.formats.get("quiz-choice")).toMatchObject({ alpha: 2, cf: -0.15 });
    expect(queriesFor(s).relearn(["letter"], 5)).toEqual(["L-A", "L-B"]);
  });

  it("before completing, new item: not offered as new for 10 cards; c −= 0.25, cf −= 0.15", () => {
    const log = createLog();
    log.swipe(["L-A"], "too_hard", "lesson");
    const s = fold(log);
    expect(rec(s, "L-A")).toMatchObject({ evidence: "none", cooldownUntilCard: 11, tooHard: 1 });
    expect(rec(s, "L-A", "productive")?.cooldownUntilCard).toBe(11);
    expect(s.c).toBeCloseTo(-0.25);
    expect(s.formats.get("lesson")).toMatchObject({ alpha: 1, cf: -0.15 });
    expect(queriesFor(s).frontier(["letter"], 1)).toEqual(["L-B"]);
    expect(queriesFor(s).status("L-A", "receptive")).toBe("new");
    // card #11 may introduce it again
    for (let i = 0; i < 8; i++) log.card({ format: "system-tutorial", exit: "next" });
    expect(queriesFor(fold(log)).frontier(["letter"], 1)).toEqual(["L-B"]);
    log.card({ format: "system-tutorial", exit: "next" });
    expect(fold(log).cards).toBe(10);
    expect(queriesFor(fold(log)).frontier(["letter"], 1)).toEqual(["L-A"]);
  });

  it("before completing, new phrase: its unmet signs come first in the frontier", () => {
    const log = createLog();
    log.lesson("w-me");
    log.swipe(["ph-pizza"], "too_hard", "quiz-build");
    const s = fold(log);
    expect(s.items.get("w-like")?.prereqSince).toBe(2);
    expect(s.items.get("w-pizza")?.prereqSince).toBe(2);
    expect(s.items.get("w-me")?.prereqSince).toBeUndefined(); // already met
    // prerequisites first (food before core, in curriculum order), then the open units
    expect(queriesFor(s).frontier(["word"], 3)).toEqual(["w-pizza", "w-like", unitOrder("greetings")[0]]);
    expect(rec(s, "ph-pizza")?.cooldownUntilCard).toBe(12);
  });

  it("before completing, met item: FSRS Again, pKnown ×0.6, a relearn soon; c −= 0.25, cf −= 0.15", () => {
    const log = createLog();
    log.answer("L-A", true);
    log.swipe(["L-A"], "too_hard", "quiz-choice");
    const s = fold(log);
    const r = rec(s, "L-A")!;
    expect(r.pKnown).toBeCloseTo(bktRetrieval(0.1, true, choice4) * 0.6);
    expect(r.card).toEqual(review(review(undefined, log.events[1].ts, Rating.Good), log.events[log.events.length - 1].ts, Rating.Again));
    expect(r).toMatchObject({ relearnSince: 2, tooHard: 1 });
    expect(s.c).toBeCloseTo(0.06 - 0.25);
    expect(s.formats.get("quiz-choice")?.cf).toBe(-0.15);
    expect(s.formats.get("quiz-choice")?.alpha).toBeCloseTo(1 + 0.99); // decayed, and no alpha for an unfinished card
    expect(queriesFor(s).relearn(["letter"], 1)).toEqual(["L-A"]);
  });

  it("before completing, a claimed item: the claim fails (back to exposed, no probe)", () => {
    const log = createLog();
    log.swipe(["w-hello"], "too_easy", "quiz-choice");
    log.swipe(["w-hello"], "too_hard", "quiz-choice");
    const s = fold(log);
    expect(rec(s, "w-hello")).toMatchObject({ evidence: "exposed" });
    expect(rec(s, "w-hello")?.pKnown).toBeCloseTo(0.75 * 0.6);
    expect(s.items.get("w-hello")?.probeSince).toBeUndefined();
  });
});

describe("Not this format", () => {
  it("leaves the items alone (a completed answer still counts), boosts the content, beta += 2, dislikes += 1", () => {
    const log = createLog();
    log.answer("L-A", true, { exit: "dislike_format" });
    const s = fold(log);
    expect(rec(s, "L-A")?.pKnown).toBeCloseTo(bktRetrieval(0.1, true, choice4));
    expect(rec(s, "L-A")?.card).toEqual(review(undefined, log.events[1].ts, Rating.Good));
    expect(s.items.get("L-A")?.dislikedCard).toBe(1);
    expect(s.formats.get("quiz-choice")).toMatchObject({ alpha: 1, beta: 3, dislikes: 1, completed: 1, muted: false });
    expect(s.c).toBeCloseTo(0.06);
  });

  it("mutes after 3 dislikes when they outnumber twice the completions; mutes don't decay", () => {
    const log = createLog();
    log.swipe([], "dislike_format", "game-rain");
    log.swipe([], "dislike_format", "game-rain");
    expect(fold(log).formats.get("game-rain")?.muted).toBe(false);
    log.swipe([], "dislike_format", "game-rain");
    expect(fold(log).formats.get("game-rain")).toMatchObject({ muted: true, dislikes: 3, beta: expect.any(Number) });
    for (let i = 0; i < 30; i++) log.answer("L-A", true);
    expect(fold(log).formats.get("game-rain")?.muted).toBe(true);
    expect(fold(log).formats.get("game-rain")!.beta).toBeLessThan(7);
  });

  it("needs more dislikes than twice the completions", () => {
    const log = createLog();
    const played = () => log.card({ format: "game-rain", evidence: [answer("L-A", true)] });
    played();
    played();
    for (let i = 0; i < 4; i++) log.swipe([], "dislike_format", "game-rain");
    expect(fold(log).formats.get("game-rain")).toMatchObject({ dislikes: 4, completed: 2, muted: false });
    log.swipe([], "dislike_format", "game-rain");
    expect(fold(log).formats.get("game-rain")).toMatchObject({ dislikes: 5, muted: true });
  });
});

describe("Camera off", () => {
  it("changes nothing", () => {
    const log = createLog();
    log.swipe(["L-A"], "camera_off", "lesson");
    const s = fold(log);
    expect(s.items.get("L-A")).toBeUndefined();
    expect(s.c).toBe(0);
    expect(s.formats.get("lesson")).toMatchObject({ alpha: 1, beta: 1, cf: 0, shown: 1, completed: 0 });
  });
});

describe("cards without target items", () => {
  it("games: only the challenge and format rules apply", () => {
    const log = createLog();
    log.swipe([], "too_easy", "game-rain");
    expect(fold(log).c).toBeCloseTo(0.15);
    expect(fold(log).formats.get("game-rain")?.cf).toBeCloseTo(0.1);
    log.swipe([], "too_hard", "game-rain");
    expect(fold(log).c).toBeCloseTo(-0.1);
    expect(fold(log).items.size).toBe(0);
  });

  it("the tutorial and dev cards change no learner state", () => {
    const log = createLog();
    log.swipe([], "too_hard", "system-tutorial");
    log.swipe([], "dislike_format", "dev-camera-probe");
    const s = fold(log);
    expect(s.c).toBe(0);
    expect(s.formats.get("system-tutorial")).toMatchObject({ alpha: 1, beta: 1, cf: 0, shown: 1 });
    expect(s.formats.get("dev-camera-probe")).toMatchObject({ dislikes: 0, muted: false });
  });

  it("clamps c and cf to [−1, 1]", () => {
    const log = createLog();
    for (let i = 0; i < 12; i++) log.swipe([], "too_easy", "game-rain");
    expect(fold(log).c).toBe(1);
    expect(fold(log).formats.get("game-rain")?.cf).toBe(1);
  });
});

describe("exposure and swipes together", () => {
  it("a completed lesson left too easy floors the productive answer, not the receptive exposure", () => {
    const log = createLog();
    log.lesson("L-A", { exit: "too_easy" });
    const s = fold(log);
    expect(rec(s, "L-A")?.pKnown).toBeCloseTo(bktExposure(0.1));
    expect(rec(s, "L-A", "productive")?.pKnown).toBe(0.9);
  });
});
