import { describe, expect, it } from "vitest";
import { HoldTracker } from "./holdTracker";

describe("HoldTracker", () => {
  it("passes after enough good frames in a row, and bad frames take more off", () => {
    const h = new HoldTracker(4, 2);
    expect(h.step(true)).toBe(false);
    expect(h.step(true)).toBe(false);
    expect(h.progress).toBe(0.5);
    h.step(false); // 2 − 2 = 0
    expect(h.progress).toBe(0);
    h.step(false); // never below 0
    expect(h.progress).toBe(0);
    for (let i = 0; i < 3; i++) expect(h.step(true)).toBe(false);
    expect(h.step(true)).toBe(true);
    expect(h.passed).toBe(true);
    expect(h.progress).toBe(1);
  });

  it("names the sign the hand matched most often, once it was seen long enough", () => {
    const h = new HoldTracker(12, 2);
    for (let i = 0; i < 5; i++) h.step(false, "L-N");
    for (let i = 0; i < 3; i++) h.step(false, "L-S");
    expect(h.confusion(4)).toBe("L-N");
    expect(h.confusion(6)).toBeUndefined();
    h.reset();
    expect(h.confusion(1)).toBeUndefined();
    expect(h.progress).toBe(0);
  });
});
