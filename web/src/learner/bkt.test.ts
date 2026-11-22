import { describe, expect, it } from "vitest";
import { bktExposure, bktRetrieval, checkParams, clampP } from "./bkt";

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe("check-mode table (SPEC §7.4)", () => {
  it("gives every fixed mode its guess, slip and learn", () => {
    expect(checkParams({ check: "build" })).toEqual({ g: 0.05, s: 0.1, T: 0.15 });
    expect(checkParams({ check: "typed" })).toEqual({ g: 0.02, s: 0.1, T: 0.15 });
    expect(checkParams({ check: "camera" })).toEqual({ g: 0.05, s: 0.15, T: 0.2 });
    expect(checkParams({ check: "mirror" })).toEqual({ g: 0.3, s: 0.1, T: 0.2 });
    expect(checkParams({ check: "self" })).toEqual({ g: 0.35, s: 0.1, T: 0.15 });
  });

  it("guesses 1/n for choice, with more slip for highly similar distractors", () => {
    expect(checkParams({ check: "choice", options: 4 })).toEqual({ g: 0.25, s: 0.1, T: 0.15 });
    expect(checkParams({ check: "choice", options: 3 })!.g).toBeCloseTo(1 / 3);
    expect(checkParams({ check: "choice", options: 2 })!.g).toBe(0.5);
    expect(checkParams({ check: "choice" })!.g).toBe(0.25); // unknown option count: 4
    expect(checkParams({ check: "choice", options: 4, similarity: "high" })!.s).toBeCloseTo(0.15);
    expect(checkParams({ check: "choice", options: 4, similarity: "low" })!.s).toBe(0.1);
  });

  it("lets games define the guess (1/n for choice games) with slip 0.20 and learn 0.10", () => {
    expect(checkParams({ check: "game", options: 5 })).toEqual({ g: 0.2, s: 0.2, T: 0.1 });
    expect(checkParams({ check: "game" })).toEqual({ g: 0.25, s: 0.2, T: 0.1 });
  });

  it("tests nothing with `none`, and weighs self-graded answers as self checks (mirror stays mirror)", () => {
    expect(checkParams({ check: "none" })).toBeNull();
    expect(checkParams({ check: "camera", selfGraded: true })).toEqual(checkParams({ check: "self" }));
    expect(checkParams({ check: "choice", options: 4, selfGraded: true })).toEqual(checkParams({ check: "self" }));
    expect(checkParams({ check: "mirror", selfGraded: true })).toEqual(checkParams({ check: "mirror" }));
  });
});

describe("BKT update (SPEC §7.4)", () => {
  it("applies the posterior for a correct answer, then learning", () => {
    // p = 0.1, 4-option choice: post = 0.09 / (0.09 + 0.9·0.25) = 0.285714…; p' = post + (1 − post)·0.15
    const post = 0.09 / (0.09 + 0.225);
    close(bktRetrieval(0.1, true, checkParams({ check: "choice", options: 4 })!), post + (1 - post) * 0.15);
  });

  it("applies the posterior for a wrong answer, then learning", () => {
    // camera: g 0.05, s 0.15, T 0.20; p = 0.6: post = 0.6·0.15 / (0.09 + 0.4·0.95)
    const post = 0.09 / (0.09 + 0.38);
    close(bktRetrieval(0.6, false, checkParams({ check: "camera" })!), post + (1 - post) * 0.2);
  });

  it("moves less on a guessable check than on a strong one", () => {
    const choice = bktRetrieval(0.3, true, checkParams({ check: "choice", options: 2 })!);
    const camera = bktRetrieval(0.3, true, checkParams({ check: "camera" })!);
    const self = bktRetrieval(0.3, true, checkParams({ check: "self" })!);
    expect(camera).toBeGreaterThan(choice);
    expect(camera).toBeGreaterThan(self);
  });

  it("raises pKnown by T_expose on an exposure", () => {
    close(bktExposure(0.1), 0.55);
    close(bktExposure(0.5), 0.75);
  });

  it("keeps pKnown inside [0.01, 0.99]", () => {
    expect(bktRetrieval(0.99, true, checkParams({ check: "typed" })!)).toBe(0.99);
    expect(bktExposure(0.99)).toBe(0.99);
    expect(clampP(0)).toBe(0.01);
    expect(clampP(2)).toBe(0.99);
    expect(bktRetrieval(0.01, false, checkParams({ check: "typed" })!)).toBeGreaterThanOrEqual(0.01);
  });
});
