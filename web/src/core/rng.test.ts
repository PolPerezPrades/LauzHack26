import { describe, expect, it } from "vitest";
import { createRng, pick, randInt, seedFrom, shuffle } from "./rng";

describe("seeded rng", () => {
  it("repeats the same sequence for the same seed", () => {
    const a = createRng(42), b = createRng(42);
    const sa = Array.from({ length: 20 }, () => a.next());
    const sb = Array.from({ length: 20 }, () => b.next());
    expect(sa).toEqual(sb);
  });

  it("differs between seeds and stays in [0, 1)", () => {
    const a = createRng(1), b = createRng(2);
    const sa = Array.from({ length: 200 }, () => a.next());
    expect(sa).not.toEqual(Array.from({ length: 200 }, () => b.next()));
    expect(sa.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it("hashes text to a stable 32-bit seed", () => {
    expect(seedFrom("session-1")).toBe(seedFrom("session-1"));
    expect(seedFrom("session-1")).not.toBe(seedFrom("session-2"));
    expect(Number.isInteger(seedFrom("x")) && seedFrom("x") >= 0).toBe(true);
  });

  it("shuffles into a deterministic permutation without touching the input", () => {
    const input = ["a", "b", "c", "d", "e", "f"];
    const s1 = shuffle(createRng(7), input);
    const s2 = shuffle(createRng(7), input);
    expect(s1).toEqual(s2);
    expect([...s1].sort()).toEqual(input);
    expect(input).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("picks and draws integers inside the range", () => {
    const rng = createRng(3);
    for (let i = 0; i < 100; i++) {
      const n = randInt(rng, 5);
      expect(n >= 0 && n < 5).toBe(true);
    }
    expect(pick(rng, [])).toBeUndefined();
    expect(["x", "y"]).toContain(pick(rng, ["x", "y"]));
  });
});
