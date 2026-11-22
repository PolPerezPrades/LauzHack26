import { describe, expect, it } from "vitest";
import { curriculumOrder, itemKindOf } from "../../content/curriculum";
import { createRng } from "../../core/rng";
import { fakeQueries } from "../../learner/testing";
import { genContext } from "../testing";
import { GRID, gameGrid, gridTiles, nextTarget } from "./spec";

const LETTERS = curriculumOrder().filter((id) => itemKindOf(id) === "letter");

describe("game-grid", () => {
  it("tops up a short list of met letters with the first unit's letters", () => {
    const [draft] = gameGrid.generate(fakeQueries({ pool: () => ["L-A", "L-B"] }), genContext());
    expect(draft.items.length).toBeGreaterThanOrEqual(GRID.minTargets);
    expect(draft.items.slice(0, 2)).toEqual(["L-A", "L-B"]);
  });

  it("fills nine distinct tiles that include every target", () => {
    const [draft] = gameGrid.generate(fakeQueries({ pool: () => ["L-A", "L-B", "L-C"] }), genContext());
    const tiles = draft.params.tiles!;
    expect(tiles).toHaveLength(GRID.tiles);
    expect(new Set(tiles).size).toBe(GRID.tiles);
    for (const id of ["L-A", "L-B", "L-C"]) expect(tiles).toContain(id);
    expect(gridTiles(["L-A"], LETTERS, createRng(2)).every((id) => itemKindOf(id) === "letter")).toBe(true);
  });

  it("never asks the same letter twice in a row", () => {
    const rng = createRng(3);
    let current: string | null = null;
    for (let i = 0; i < 20; i++) {
      const next = nextTarget(["L-A", "L-B", "L-C"], current, rng);
      expect(next).not.toBe(current);
      current = next;
    }
  });
});
