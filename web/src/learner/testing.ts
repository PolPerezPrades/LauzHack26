/**
 * Learner queries for tests of format generators: every list is empty, every item is new, unless a
 * test overrides it. It depends only on the contract (core/types.ts), so it doesn't change with
 * the learner model behind createLearnerQueries() (Part C kept the contract as Part 0 froze it).
 * A new query method gets its default here too (SPEC §9.0.4).
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
