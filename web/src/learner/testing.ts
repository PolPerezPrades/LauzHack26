/**
 * Learner queries for tests of format generators: every list is empty, every item is new, unless a
 * test overrides it. It depends only on the contract (core/types.ts), so it keeps working when
 * Part C replaces the stub in queries.ts.
 */
import type { LearnerQueries } from "../core/types";

export function fakeQueries(overrides: Partial<LearnerQueries> = {}): LearnerQueries {
  return {
    nextItems: () => [],
    frontier: () => [],
    practice: () => [],
    relearn: () => [],
    probes: () => [],
    pool: () => [],
    eligiblePhrases: () => [],
    confusions: () => [],
    status: () => "new",
    pKnown: () => 0,
    ...overrides,
  };
}
