/**
 * Helpers for tests of the learning formats (not imported by app code). Generators are tested with
 * fakeQueries() only (SPEC §9.0.4 rule 8), and `strictQueries` makes Part A's curriculum walk throw:
 * new generators choose items through the learner lists, never through `nextItems` (D-042).
 */
import { createRng } from "../core/rng";
import type { GenContext, LearnerQueries } from "../core/types";
import { fakeQueries } from "../learner/testing";

export function strictQueries(overrides: Partial<LearnerQueries> = {}): LearnerQueries {
  return fakeQueries({
    nextItems: () => {
      throw new Error("learning generators must not use nextItems (D-042)");
    },
    ...overrides,
  });
}

export const genContext = (seed = 1, ce = 0, cameraUsable = true): GenContext => ({ rng: createRng(seed), ce, cameraUsable });
