import { describe, expect, it } from "vitest";
import { fakeQueries } from "../../learner/testing";
import { genContext } from "../testing";
import { RAIN, clockAfter, fallMs, gameRain, gameRainResult } from "./spec";

describe("game-rain", () => {
  it("plays the met letters first, topped up with the first unit's letters", () => {
    const [topped] = gameRain.generate(fakeQueries({ pool: () => ["L-E", "L-B"] }), genContext());
    expect(topped.items.slice(0, 2)).toEqual(["L-E", "L-B"]);
    expect(topped.items).toHaveLength(RAIN.maxItems);
    expect(topped.items).toContain("L-A");
    const many = fakeQueries({ pool: () => ["L-A", "L-B", "w-hello", "L-C", "L-D"] });
    const [draft] = gameRain.generate(many, genContext());
    expect(draft.items.slice(0, 4)).toEqual(["L-A", "L-B", "L-C", "L-D"]);
    expect(draft.items).not.toContain("w-hello");
  });

  it("falls faster the longer the learner survives, never below the floor", () => {
    expect(fallMs(0)).toBe(RAIN.slowMs);
    expect(fallMs(10_000)).toBeLessThan(fallMs(5_000));
    expect(fallMs(600_000)).toBeGreaterThanOrEqual(RAIN.fastMs);
  });

  it("hits add time, wrong taps and landed signs take it, within [0, max]", () => {
    expect(clockAfter(5_000, "hit")).toBe(5_000 + RAIN.hitBonusMs);
    expect(clockAfter(5_000, "wrong")).toBe(5_000 - RAIN.wrongPenaltyMs);
    expect(clockAfter(500, "miss")).toBe(0);
    expect(clockAfter(RAIN.maxMs, "hit")).toBe(RAIN.maxMs);
  });

  it("reports one receptive retrieval per event and the score", () => {
    const r = gameRainResult([
      { item: "L-A", kind: "hit", ms: 900 },
      { item: "L-B", kind: "wrong", pressed: "L-C" },
      { item: "L-B", kind: "miss" },
    ], { score: 1, aliveMs: 8_000 });
    expect(r.score).toBe(1);
    expect(r.evidence.map((e) => [e.itemId, e.correct, e.check])).toEqual([["L-A", true, "game"], ["L-B", false, "game"], ["L-B", false, "game"]]);
    expect(r.evidence[1].confusedWith).toBe("L-C");
    expect(r.success).toBeCloseTo(1 / 3);
  });
});
