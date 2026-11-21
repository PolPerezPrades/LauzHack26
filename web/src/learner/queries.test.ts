import { describe, expect, it } from "vitest";
import { PHRASES } from "../content/curriculum";
import type { EvidenceDraft } from "../core/types";
import { makeEvent, type LearningEvent } from "../data/events";
import { createLearnerQueries, walk, withContent } from "./queries";

// Part 0 stub tests: the contract's shape and the stub's rough rules. Part C replaces these with
// tests of the real learner model (SPEC §7), keeping the ones about the contract.

const order = ["L-A", "L-B", "L-C", "L-D", "num-1", "w-hello"];
let n = 0;
const card = (items: string[]) => ({ sessionId: "s", cardId: `c${++n}`, format: "quiz-choice", items });

function answered(itemId: string, correct: boolean, extra: Partial<EvidenceDraft> = {}): LearningEvent[] {
  const c = card([itemId]);
  const on = { sessionId: c.sessionId, cardId: c.cardId, format: c.format };
  return [
    makeEvent({ ...on, type: "card.shown", items: c.items, params: {}, reasons: [], source: "picker" }),
    makeEvent({ ...on, type: "evidence", itemId, skill: "receptive", kind: "retrieval", correct, check: "choice", options: 4, ...extra }),
    makeEvent({ ...on, type: "card.exit", exit: "next", completed: true, msVisible: 1000 }),
  ];
}
function swipedTooEasy(itemId: string): LearningEvent[] {
  const c = card([itemId]);
  const on = { sessionId: c.sessionId, cardId: c.cardId, format: c.format };
  return [
    makeEvent({ ...on, type: "card.shown", items: c.items, params: {}, reasons: [], source: "picker" }),
    makeEvent({ ...on, type: "card.exit", exit: "too_easy", completed: false, msVisible: 500 }),
  ];
}

describe("learner queries (Part 0 stub)", () => {
  it("starts with everything new, the frontier in curriculum order and nothing to practise", () => {
    const q = createLearnerQueries([], { order });
    expect(q.status("L-A", "receptive")).toBe("new");
    expect(q.pKnown("L-A", "receptive")).toBe(0);
    expect(q.frontier(["letter"], 2)).toEqual(["L-A", "L-B"]);
    expect(q.practice("receptive", ["letter"], 5)).toEqual([]);
    expect(q.pool("receptive", ["letter"], 5)).toEqual([]);
    expect(q.nextItems(["letter", "number"], 2)).toEqual(["L-A", "L-B"]);
  });

  it("moves answered items out of the frontier and puts the last mistakes first", () => {
    const q = createLearnerQueries([...answered("L-A", true), ...answered("L-B", false, { confusedWith: "L-A" })], { order });
    expect(q.frontier(["letter"], 2)).toEqual(["L-C", "L-D"]);
    expect(q.status("L-A", "receptive")).toBe("learning");
    expect(q.status("L-A", "productive")).toBe("new");
    expect(q.practice("receptive", ["letter"], 5)).toEqual(["L-B", "L-A"]);
    expect(q.relearn(["letter"], 5)).toEqual(["L-B"]);
    expect(q.confusions("L-B")).toEqual(["L-A"]);
    expect(q.pool("receptive", ["letter"], 5)).toEqual(["L-B", "L-A"]);
    expect(q.pool("receptive", ["letter"], 5, 0.6)).toEqual([]);
  });

  it("treats a 'too easy' exit as a claim that waits for a probe", () => {
    const q = createLearnerQueries(swipedTooEasy("L-A"), { order });
    expect(q.status("L-A", "receptive")).toBe("known");
    expect(q.probes(["letter"], 3)).toEqual(["L-A"]);
    expect(q.frontier(["letter"], 1)).toEqual(["L-B"]);
  });

  it("never returns the items to avoid", () => {
    const q = createLearnerQueries(answered("L-B", false), { order, avoid: ["L-A", "L-B"] });
    expect(q.frontier(["letter"], 1)).toEqual(["L-C"]);
    expect(q.practice("receptive", ["letter"], 5)).toEqual([]);
  });

  it("offers a phrase once all its signs have been met", () => {
    const phrase = [...PHRASES.values()][0];
    const all = [...phrase.signs, phrase.id];
    expect(createLearnerQueries([], { order: all }).eligiblePhrases(3)).toEqual([]);
    const met = phrase.signs.flatMap((s) => answered(s, true));
    expect(createLearnerQueries(met, { order: all }).eligiblePhrases(3)).toEqual([phrase.id]);
  });

  it("walks chosen content for dev forced mode, keeping the log's statuses", () => {
    expect(walk(order, 4, ["letter"], 3)).toEqual(["L-A", "L-B", "L-C"]);
    const forced = withContent(createLearnerQueries(answered("L-C", true), { order }), ["L-C", "w-hello"], 1);
    expect(forced.frontier(["letter", "word"], 1)).toEqual(["w-hello"]);
    expect(forced.practice("productive", ["letter"], 1)).toEqual(["L-C"]);
    expect(forced.pool("receptive", ["letter", "word"], 5)).toEqual(["w-hello", "L-C"]);
    expect(forced.status("L-C", "receptive")).toBe("learning");
    expect(forced.eligiblePhrases(2)).toEqual([]);
  });
});
