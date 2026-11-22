import { describe, expect, it } from "vitest";
import { unitOrder } from "../content/curriculum";
import { checkParams } from "./bkt";
import { retrievability } from "./schedule";
import {
  bestScore, cardsToday, challenge, dislikedSince, dueReviews, effectiveChallenge, errorsSince, formatOffset,
  formatPreference, inFlight, introducedCount, isMuted, itemStatus, maxInFlight, mutedFormats, overdue, pacingAllowsNew,
  predictAll, predictMean, predictSuccess, probeWindow, relearnWindow, retrievabilityOf, streakOf, targetSuccess,
  unitProgress, xpOf,
} from "./selectors";
import { foldLearnerState } from "./state";
import { DAY, createLog, type TestLog } from "./testLog";

const fold = (log: TestLog) => foldLearnerState(log.events);
const choice4 = { check: "choice" as const, options: 4 };

describe("predicted success (SPEC §7.8.2)", () => {
  it("is g + (1 − g − s)·pKnown·R, with the prior P0 for a pair never met", () => {
    const s = foldLearnerState([]);
    expect(predictSuccess(s, "L-A", "receptive", choice4, 0)).toBeCloseTo(0.25 + 0.65 * 0.1);
    expect(predictSuccess(s, "L-A", "productive", { check: "camera" }, 0)).toBeCloseTo(0.05 + 0.8 * 0.1);
    expect(predictSuccess(s, "L-A", "receptive", { check: "none" }, 0)).toBe(1);
  });

  it("uses pKnown and the retrievability now, so it drops as memory fades", () => {
    const log = createLog();
    for (let i = 0; i < 3; i++) log.answer("L-A", true);
    const s = fold(log);
    const p = s.items.get("L-A")!.receptive!.pKnown;
    const later = log.now + 30 * DAY;
    const r = retrievability(s.items.get("L-A")!.receptive!.card, later);
    expect(retrievabilityOf(s, "L-A", "receptive", later)).toBe(r);
    expect(predictSuccess(s, "L-A", "receptive", choice4, later)).toBeCloseTo(0.25 + 0.65 * p * r);
    expect(predictSuccess(s, "L-A", "receptive", choice4, later)).toBeLessThan(predictSuccess(s, "L-A", "receptive", choice4, log.now));
    // more options, harder to guess
    expect(predictSuccess(s, "L-B", "receptive", { check: "choice", options: 2 }, 0)).toBeGreaterThan(predictSuccess(s, "L-B", "receptive", choice4, 0));
  });

  it("multiplies over a phrase's signs and averages over a game's pool", () => {
    const s = foldLearnerState([]);
    const one = predictSuccess(s, "w-me", "receptive", { check: "build" }, 0);
    expect(predictAll(s, ["w-me", "w-like", "w-pizza"], "receptive", { check: "build" }, 0)).toBeCloseTo(one ** 3);
    const build = checkParams({ check: "build" })!;
    expect(one).toBeCloseTo(build.g + (1 - build.g - build.s) * 0.1);
    expect(predictMean(s, ["L-A", "L-B"], "receptive", choice4, 0)).toBeCloseTo(predictSuccess(s, "L-A", "receptive", choice4, 0));
    expect(predictMean(s, [], "receptive", choice4, 0)).toBe(0);
  });
});

describe("reviews and pacing", () => {
  it("lists due reviews, most overdue first, by skill and kind", () => {
    const log = createLog();
    for (let i = 0; i < 3; i++) log.answer("L-A", true);
    log.advance(60 * 60_000); // an hour later: still fresh, but L-A will be the most overdue
    for (let i = 0; i < 3; i++) log.answer("w-hello", true);
    for (let i = 0; i < 2; i++) log.answer("L-B", true, { check: "camera", skill: "productive", format: "question" });
    const s = fold(log);
    expect(dueReviews(s, log.now)).toEqual([]);
    const later = log.now + 90 * DAY;
    const due = dueReviews(s, later);
    expect(due.map((d) => d.itemId)).toContain("L-A");
    expect(due[0].itemId).toBe("L-A"); // reviewed before the others
    expect(due.every((d, i) => i === 0 || due[i - 1].r <= d.r)).toBe(true);
    expect(dueReviews(s, later, { skill: "productive" }).map((d) => d.itemId)).toEqual(["L-B"]);
    expect(dueReviews(s, later, { kinds: ["word"] }).map((d) => d.itemId)).toEqual(["w-hello"]);
    expect(overdue(s, later)).toBe(due.length);
    expect(itemStatus(s, "L-A", "receptive", later)).toBe("due");
  });

  it("counts items in flight against round(4 + 2c)", () => {
    const log = createLog();
    log.lesson("L-A");
    log.lesson("L-B");
    const s = fold(log);
    expect(inFlight(s)).toBe(2);
    expect(maxInFlight(s)).toBe(Math.round(4 + 2 * s.c));
    expect(pacingAllowsNew(s, log.now)).toBe(true);
    expect(introducedCount(s)).toBe(2);
  });
});

describe("formats and challenge", () => {
  it("gives neutral preferences to formats never shown, and lists the muted ones", () => {
    const log = createLog();
    for (let i = 0; i < 3; i++) log.swipe([], "dislike_format", "game-rain");
    const s = fold(log);
    expect(formatPreference(s, "quiz-build")).toEqual({ alpha: 1, beta: 1, shown: 0, completed: 0, dislikes: 0, muted: false, cf: 0 });
    expect(formatPreference(s, "game-rain")).toMatchObject({ dislikes: 3, muted: true });
    expect(isMuted(s, "game-rain")).toBe(true);
    expect(mutedFormats(s)).toEqual(["game-rain"]);
  });

  it("combines c and cf into ce, clamped, and aims the target success at 0.80 − 0.10·c", () => {
    const log = createLog();
    for (let i = 0; i < 6; i++) log.swipe([], "too_easy", "game-rain"); // c +0.90, cf +0.60
    const s = fold(log);
    expect(challenge(s)).toBeCloseTo(0.9);
    expect(formatOffset(s, "game-rain")).toBeCloseTo(0.6);
    expect(effectiveChallenge(s, "game-rain")).toBe(1);
    expect(effectiveChallenge(s, "quiz-choice")).toBeCloseTo(0.9);
    expect(targetSuccess(s)).toBeCloseTo(0.71);
    expect(targetSuccess(foldLearnerState([]))).toBe(0.8);
    const low = createLog();
    for (let i = 0; i < 6; i++) low.swipe([], "too_hard", "game-rain");
    expect(targetSuccess(fold(low))).toBeCloseTo(0.9);
    expect(effectiveChallenge(fold(low), "game-rain")).toBe(-1);
  });
});

describe("windows, in cards", () => {
  it("measures the relearn window from the failure to the card chosen now (3–6 cards)", () => {
    const log = createLog();
    log.answer("L-A", false); // card 1
    expect(relearnWindow(fold(log), "L-A")).toEqual({ since: 1, inWindow: false });
    log.card({ format: "system-tutorial" });
    expect(relearnWindow(fold(log), "L-A")).toEqual({ since: 2, inWindow: false });
    log.card({ format: "system-tutorial" });
    expect(relearnWindow(fold(log), "L-A")).toEqual({ since: 3, inWindow: true });
    for (let i = 0; i < 4; i++) log.card({ format: "system-tutorial" });
    expect(relearnWindow(fold(log), "L-A")).toEqual({ since: 7, inWindow: false });
    expect(relearnWindow(fold(log), "L-B")).toBeNull();
  });

  it("measures the probe window from the claim (due 5–10 cards later)", () => {
    const log = createLog();
    log.swipe(["L-C"], "too_easy", "quiz-choice"); // card 1
    const at = (k: number) => {
      while (fold(log).cards < k) log.card({ format: "system-tutorial" });
      return probeWindow(fold(log), "L-C");
    };
    expect(at(4)).toEqual({ since: 4, due: false, overdue: false });
    expect(at(5)).toEqual({ since: 5, due: true, overdue: false });
    expect(at(10)).toEqual({ since: 10, due: true, overdue: false });
    expect(at(11)).toEqual({ since: 11, due: false, overdue: true });
    expect(probeWindow(fold(log), "L-A")).toBeNull();
  });

  it("counts recent errors and the cards since a 'not this format' exit", () => {
    const log = createLog();
    log.answer("L-A", false);
    log.answer("L-A", false);
    log.answer("L-A", false, { exit: "dislike_format" });
    const s = fold(log);
    expect(errorsSince(s, "L-A", "receptive", 2)).toBe(2);
    expect(errorsSince(s, "L-A", "productive", 0)).toBe(0);
    expect(dislikedSince(s, "L-A")).toBe(1);
    expect(dislikedSince(s, "L-B")).toBeNull();
  });
});

describe("progress for the settings sheet", () => {
  it("reads XP, streak and cards completed today", () => {
    const log = createLog();
    log.answer("L-A", true);
    log.advance(DAY);
    log.answer("L-B", true);
    log.answer("L-C", true);
    const s = fold(log);
    expect(xpOf(s)).toBe(30);
    expect(streakOf(s, log.now)).toBe(2);
    expect(streakOf(s, log.now + 2 * DAY)).toBe(0);
    expect(cardsToday(s, log.now)).toBe(2);
    expect(cardsToday(s, log.now + DAY)).toBe(0);
  });

  it("gives receptive and productive mastery per unit", () => {
    const log = createLog();
    const abc1 = unitOrder("abc1");
    for (const id of abc1.slice(0, 3)) for (let i = 0; i < 3; i++) log.answer(id, true);
    log.lesson(abc1[3]);
    for (let i = 0; i < 2; i++) log.answer(abc1[4], true, { check: "camera", skill: "productive", format: "question" });
    const progress = unitProgress(fold(log));
    expect(progress.map((u) => u.unit)).toEqual(["abc1", "abc2", "abc3", "numbers", "greetings", "family", "colors", "food", "core", "phrases"]);
    expect(progress[0]).toEqual({ unit: "abc1", total: 9, met: 5, receptive: 3 / 9, productive: 1 / 9, open: true, testedOut: false });
    expect(progress[1]).toMatchObject({ unit: "abc2", met: 0, receptive: 0, open: false });
    expect(progress[9].total).toBeGreaterThan(0);
  });

  it("keeps the best game score", () => {
    const log = createLog();
    log.emit({ type: "game.score", sessionId: "s1", cardId: "g", format: "game-rain", score: 7, params: {} });
    expect(bestScore(fold(log), "game-rain")).toBe(7);
    expect(bestScore(fold(log), "game-memory")).toBeUndefined();
  });
});
