import { describe, expect, it } from "vitest";
import { createRng } from "../../core/rng";
import { fakeQueries } from "../../learner/testing";
import { genContext } from "../testing";
import { buildBoard, gameWordsearch, placements, wordsFor } from "./spec";

describe("game-wordsearch", () => {
  it("lists every straight forward line of a 3×3 grid", () => {
    expect(placements(3, 3)).toHaveLength(8); // 3 rows, 3 columns, 2 diagonals
    expect(placements(3, 3)).toContainEqual([0, 4, 8]);
    expect(placements(3, 3)).toContainEqual([6, 4, 2]);
  });

  it("places every word on its own cells, and no other cell uses the words' letters", () => {
    for (let seed = 1; seed < 40; seed++) {
      const b = buildBoard(["BAD", "CAB", "DAD"], 5, createRng(seed));
      expect(b.words.map((w) => w.word)).toEqual(["BAD", "CAB", "DAD"]);
      const cells = b.words.flatMap((w) => w.path);
      expect(new Set(cells).size).toBe(cells.length);
      for (const w of b.words) expect(w.path.map((c) => b.grid[c]).join("")).toBe(w.word);
      b.grid.forEach((l, cell) => { if (!cells.includes(cell)) expect("BADC").not.toContain(l); });
    }
  });

  it("uses only words made of met letters", () => {
    expect(wordsFor(["L-A", "L-B", "L-C", "L-D"]).sort()).toEqual(["BAD", "CAB", "DAD"]);
  });

  it("tops up with the first unit's letters when the met letters spell too few words", () => {
    const [topped] = gameWordsearch.generate(fakeQueries({ pool: () => ["L-A", "L-B"] }), genContext());
    expect(topped.params.words!.length).toBeGreaterThanOrEqual(3);
    expect(topped.params.words!.every((w) => [...w].every((l) => "ABCDEFGHI".includes(l)))).toBe(true);
    const [draft] = gameWordsearch.generate(fakeQueries({ pool: () => ["L-A", "L-B", "L-C", "L-D"] }), genContext());
    expect(draft.params.words!.sort()).toEqual(["BAD", "CAB", "DAD"]);
  });
});
