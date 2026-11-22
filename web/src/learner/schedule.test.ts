import { describe, expect, it } from "vitest";
import type { ExitKind } from "../core/types";
import type { Retrieval } from "./model";
import { Rating, gradeAtExit, isDue, retrievability, review } from "./schedule";
import { collapse } from "./swipes";
import { DAY, T0 } from "./testLog";

const EXITS: (ExitKind | null)[] = ["next", "too_easy", "too_hard", "dislike_format", "camera_off", null];

describe("grade at exit (SPEC §7.4)", () => {
  it("is Again for a wrong item whatever the exit", () => {
    for (const exit of EXITS) {
      expect(gradeAtExit({ correct: false, selfGraded: false }, exit), String(exit)).toBe(Rating.Again);
      expect(gradeAtExit({ correct: false, selfGraded: true }, exit), String(exit)).toBe(Rating.Again);
    }
  });

  it("is Good for a correct item on Next and Not this format, Easy on Too easy, Hard on Too hard", () => {
    const correct = { correct: true, selfGraded: false };
    expect(gradeAtExit(correct, "next")).toBe(Rating.Good);
    expect(gradeAtExit(correct, "dislike_format")).toBe(Rating.Good);
    expect(gradeAtExit(correct, "too_easy")).toBe(Rating.Easy);
    expect(gradeAtExit(correct, "too_hard")).toBe(Rating.Hard);
  });

  it("uses the default column when the exit is missing (and for camera off)", () => {
    expect(gradeAtExit({ correct: true, selfGraded: false }, null)).toBe(Rating.Good);
    expect(gradeAtExit({ correct: true, selfGraded: false }, "camera_off")).toBe(Rating.Good);
  });

  it("caps a self-grade at Good, while the Too easy column still applies", () => {
    expect(gradeAtExit({ correct: true, selfGraded: true }, "next")).toBe(Rating.Good);
    expect(gradeAtExit({ correct: true, selfGraded: true }, null)).toBe(Rating.Good);
    expect(gradeAtExit({ correct: true, selfGraded: true }, "too_easy")).toBe(Rating.Easy);
    expect(gradeAtExit({ correct: true, selfGraded: true }, "too_hard")).toBe(Rating.Hard);
  });
});

describe("collapsing the retrievals of one card", () => {
  const r = (itemId: string, correct: boolean, ts: number, selfGraded = false): Retrieval => ({ itemId, skill: "receptive", correct, selfGraded, ts });

  it("gives one review per (item, skill): wrong if any was wrong, at the time of the last one", () => {
    const out = collapse([r("L-A", true, 1), r("L-B", true, 2), r("L-A", false, 3), r("L-A", true, 4)]);
    expect(out).toEqual([
      { itemId: "L-A", skill: "receptive", correct: false, selfGraded: false, ts: 4 },
      { itemId: "L-B", skill: "receptive", correct: true, selfGraded: false, ts: 2 },
    ]);
  });

  it("counts as self-graded only when every retrieval was", () => {
    expect(collapse([r("L-A", true, 1, true), r("L-A", true, 2, false)])[0].selfGraded).toBe(false);
    expect(collapse([r("L-A", true, 1, true), r("L-A", true, 2, true)])[0].selfGraded).toBe(true);
  });

  it("keeps skills apart", () => {
    expect(collapse([r("L-A", true, 1), { ...r("L-A", false, 2), skill: "productive" }])).toHaveLength(2);
  });
});

describe("FSRS reviews", () => {
  it("creates the card at the first review, as plain data", () => {
    const card = review(undefined, T0, Rating.Good);
    expect(card.reps).toBe(1);
    expect(card.last_review).toBe(T0);
    expect(card.due).toBeGreaterThan(T0);
    expect(JSON.parse(JSON.stringify(card))).toEqual(card);
  });

  it("schedules Easy later than Good, Good later than Hard, Hard later than Again", () => {
    const s = (g: Parameters<typeof review>[2]) => review(undefined, T0, g).stability;
    expect(s(Rating.Easy)).toBeGreaterThan(s(Rating.Good));
    expect(s(Rating.Good)).toBeGreaterThan(s(Rating.Hard));
    expect(s(Rating.Hard)).toBeGreaterThan(s(Rating.Again));
  });

  it("is 1 without a card and decays with time; due below the 0.90 target", () => {
    expect(retrievability(undefined, T0)).toBe(1);
    const card = review(undefined, T0, Rating.Good);
    expect(retrievability(card, T0)).toBeCloseTo(1, 6);
    expect(retrievability(card, T0 + DAY)).toBeLessThan(1);
    expect(isDue(card, T0 + DAY)).toBe(false);
    expect(isDue(card, T0 + 30 * DAY)).toBe(true);
    expect(isDue(undefined, T0 + 365 * DAY)).toBe(false);
  });

  it("never reviews in the past, even when a log's clock goes backwards", () => {
    const first = review(undefined, T0, Rating.Good);
    const second = review(first, T0 - DAY, Rating.Good);
    expect(second.last_review).toBe(T0);
    expect(second.reps).toBe(2);
  });
});
