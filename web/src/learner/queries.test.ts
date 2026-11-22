import { describe, expect, it } from "vitest";
import { unitOrder } from "../content/curriculum";
import type { LearnerQueries } from "../core/types";
import { createLearnerQueries, queriesFor, walk, withContent } from "./queries";
import { foldLearnerState } from "./state";
import { fakeQueries } from "./testing";
import { DAY, createLog, type TestLog } from "./testLog";

// Every LearnerQueries list (SPEC §8.3) answered from the real learner state (Part C).

const q = (log: TestLog, opts = {}) => createLearnerQueries(log.events, opts);
const abc1 = unitOrder("abc1");
const greetings = unitOrder("greetings");
const LIST_METHODS: (keyof LearnerQueries)[] = ["nextItems", "frontier", "practice", "relearn", "probes", "pool", "eligiblePhrases", "confusions", "status", "pKnown"];

describe("learner queries: the contract", () => {
  it("implements every method of the contract, like fakeQueries", () => {
    const real = createLearnerQueries([]);
    expect(Object.keys(real).sort()).toEqual([...LIST_METHODS].sort());
    expect(Object.keys(fakeQueries()).sort()).toEqual([...LIST_METHODS].sort());
  });

  it("starts with everything new, the frontier open, and nothing to practise", () => {
    const empty = createLearnerQueries([]);
    expect(empty.status("L-A", "receptive")).toBe("new");
    expect(empty.pKnown("L-A", "receptive")).toBe(0);
    expect(empty.frontier(["letter"], 2)).toEqual(abc1.slice(0, 2));
    expect(empty.practice("receptive", ["letter"], 5)).toEqual([]);
    expect(empty.relearn(["letter"], 5)).toEqual([]);
    expect(empty.probes(["letter"], 5)).toEqual([]);
    expect(empty.pool("receptive", ["letter"], 5)).toEqual([]);
    expect(empty.eligiblePhrases(5)).toEqual([]);
    expect(empty.confusions("L-A")).toEqual([]);
    expect(empty.nextItems(["letter", "number"], 2)).toEqual(abc1.slice(0, 2));
  });

  it("caps every list at n and returns only the kinds asked for", () => {
    const log = createLog();
    for (const id of [...abc1.slice(0, 4), ...greetings.slice(0, 4)]) log.answer(id, false);
    const all = q(log);
    expect(all.practice("receptive", ["letter"], 3)).toHaveLength(3);
    expect(all.practice("receptive", ["word"], 10).every((id) => id.startsWith("w-"))).toBe(true);
    expect(all.relearn(["letter", "word"], 5)).toHaveLength(5);
    expect(all.pool("receptive", ["letter"], 2)).toHaveLength(2);
  });

  it("never returns the items to avoid", () => {
    const log = createLog();
    log.answer("L-B", false);
    log.swipe(["L-D"], "too_easy", "quiz-choice");
    const avoid = q(log, { avoid: ["L-A", "L-B", "L-D"] });
    expect(avoid.frontier(["letter"], 1)).toEqual(["L-C"]);
    expect(avoid.practice("receptive", ["letter"], 5)).toEqual([]);
    expect(avoid.relearn(["letter"], 5)).toEqual([]);
    expect(avoid.probes(["letter"], 5)).toEqual([]);
    expect(avoid.pool("receptive", ["letter"], 5)).toEqual([]);
    expect(avoid.status("L-B", "receptive")).toBe("learning"); // statuses are unaffected
  });

  it("restricts the lists to a custom order when given one", () => {
    const order = ["L-C", "L-A", "w-hello"];
    const custom = createLearnerQueries([], { order });
    // still one item per open unit first: abc1 in the given order, then greetings
    expect(custom.frontier(["letter", "word"], 5)).toEqual(["L-C", "w-hello", "L-A"]);
    expect(custom.frontier(["letter"], 5)).toEqual(["L-C", "L-A"]);
  });
});

describe("learner queries: the lists", () => {
  it("practice: met items for a skill, relearn first, then due, learning (weakest first), known", () => {
    const log = createLog();
    for (let i = 0; i < 3; i++) log.answer("L-E", true); // known now, due a month later
    log.advance(40 * DAY);
    for (let i = 0; i < 3; i++) log.answer("L-A", true); // known, fresh
    log.lesson("L-B"); // receptive 0.55
    log.answer("L-C", true); // receptive 0.39
    log.answer("L-D", false); // relearn
    const all = q(log);
    expect(all.status("L-E", "receptive")).toBe("due");
    expect(all.status("L-A", "receptive")).toBe("known");
    expect(all.practice("receptive", ["letter"], 10)).toEqual(["L-D", "L-E", "L-C", "L-B", "L-A"]);
    // productive: L-B was signed in its lesson; the others are met but new for this skill (weakest)
    expect(all.practice("productive", ["letter"], 10)).toEqual(["L-A", "L-C", "L-D", "L-E", "L-B"]);
    expect(all.practice("receptive", ["letter"], 10)).not.toContain("L-F"); // never met
  });

  it("relearn: failed or swiped too hard, not answered right since, latest first", () => {
    const log = createLog();
    log.answer("L-D", false);
    log.answer("L-C", false);
    log.lesson("L-A");
    log.swipe(["L-A"], "too_hard", "quiz-choice");
    expect(q(log).relearn(["letter"], 5)).toEqual(["L-A", "L-C", "L-D"]);
    log.answer("L-C", true);
    expect(q(log).relearn(["letter"], 5)).toEqual(["L-A", "L-D"]);
  });

  it("probes: claims waiting for their verification, oldest first, cleared by a later answer", () => {
    const log = createLog();
    log.swipe(["w-hello"], "too_easy", "quiz-choice");
    log.swipe(["L-A"], "too_easy", "quiz-choice");
    expect(q(log).probes(["letter", "word"], 5)).toEqual(["w-hello", "L-A"]);
    expect(q(log).probes(["letter"], 5)).toEqual(["L-A"]);
    log.answer("w-hello", true);
    expect(q(log).probes(["letter", "word"], 5)).toEqual(["L-A"]);
  });

  it("pool: met items with pKnown ≥ minPKnown for the skill, weakest first", () => {
    const log = createLog();
    for (let i = 0; i < 3; i++) log.answer("L-A", true); // 0.93
    log.lesson("L-B"); // 0.55
    log.answer("L-C", true); // 0.39
    log.answer("L-D", false); // 0.16
    const all = q(log);
    expect(all.pool("receptive", ["letter"], 10)).toEqual(["L-D", "L-C", "L-B", "L-A"]);
    expect(all.pool("receptive", ["letter"], 10, 0.5)).toEqual(["L-B", "L-A"]);
    expect(all.pool("productive", ["letter"], 10, 0.2)).toEqual(["L-B"]);
  });

  it("eligiblePhrases: all signs met and ≥ 70 % of them known (receptive), least known first", () => {
    const log = createLog();
    const knowIt = (id: string) => { for (let i = 0; i < 3; i++) log.answer(id, true); };
    knowIt("w-you");
    log.answer("w-deaf", true); // met, not known: 1/2 known
    expect(q(log).eligiblePhrases(5)).toEqual([]);
    knowIt("w-deaf");
    expect(q(log).eligiblePhrases(5)).toEqual(["ph-deaf"]);
    knowIt("w-name");
    log.answer("w-what", true); // ph-name: 2/3 known < 70 %
    expect(q(log).eligiblePhrases(5)).toEqual(["ph-deaf"]);
    knowIt("w-what");
    expect(q(log).eligiblePhrases(5)).toEqual(["ph-name", "ph-deaf"]);
    log.answer("ph-name", true, { format: "quiz-build", check: "build" });
    expect(q(log).eligiblePhrases(5)).toEqual(["ph-deaf", "ph-name"]);
  });

  it("confusions: most frequent first, across skills", () => {
    const log = createLog();
    log.answer("L-M", false, { confusedWith: "L-N" });
    log.answer("L-M", false, { confusedWith: "L-S" });
    log.answer("L-M", false, { confusedWith: "L-S" });
    log.answer("L-M", false, { confusedWith: "L-N", skill: "productive", check: "camera", format: "question" });
    log.answer("L-M", false, { confusedWith: "L-N", skill: "productive", check: "camera", format: "question" });
    expect(q(log).confusions("L-M")).toEqual(["L-N", "L-S"]);
    expect(q(log).confusions("L-N")).toEqual([]);
  });

  it("status and pKnown: new, learning (claims too), known, due", () => {
    const log = createLog();
    log.swipe(["L-B"], "too_easy", "quiz-choice");
    for (let i = 0; i < 3; i++) log.answer("L-A", true);
    const now = q(log);
    expect(now.status("L-B", "receptive")).toBe("learning");
    expect(now.pKnown("L-B", "receptive")).toBe(0.75);
    expect(now.status("L-A", "receptive")).toBe("known");
    expect(now.pKnown("L-A", "receptive")).toBeGreaterThan(0.85);
    expect(now.status("L-A", "productive")).toBe("new");
    expect(now.pKnown("L-A", "productive")).toBe(0);
    expect(q(log, { now: log.now + 60 * DAY }).status("L-A", "receptive")).toBe("due");
  });

  it("takes 'now' from the log's last event by default", () => {
    const log = createLog();
    for (let i = 0; i < 3; i++) log.answer("L-A", true);
    log.advance(60 * DAY);
    expect(q(log).status("L-A", "receptive")).toBe("known");
    log.open(); // app.open, two months later
    expect(q(log).status("L-A", "receptive")).toBe("due");
  });

  it("nextItems: the frontier first, then receptive practice", () => {
    const log = createLog();
    log.answer("L-A", false);
    expect(q(log).nextItems(["letter"], 3)).toEqual(["L-B", "L-C", "L-D"]);
    expect(createLearnerQueries(log.events, { order: ["L-A", "L-B"] }).nextItems(["letter"], 3)).toEqual(["L-B", "L-A"]);
  });

  it("answers from a state the caller already holds", () => {
    const log = createLog();
    log.answer("L-A", false);
    const fromState = queriesFor(foldLearnerState(log.events));
    expect(fromState.relearn(["letter"], 3)).toEqual(q(log).relearn(["letter"], 3));
  });
});

describe("dev forced mode", () => {
  const order = ["L-A", "L-B", "L-C", "L-D", "num-1", "w-hello"];

  it("walks chosen content, keeping the log's statuses", () => {
    const log = createLog();
    log.answer("L-C", true);
    expect(walk(order, 4, ["letter"], 3)).toEqual(["L-A", "L-B", "L-C"]);
    const forced = withContent(q(log), ["L-C", "w-hello"], 1);
    expect(forced.frontier(["letter", "word"], 1)).toEqual(["w-hello"]);
    expect(forced.practice("productive", ["letter"], 1)).toEqual(["L-C"]);
    expect(forced.pool("receptive", ["letter", "word"], 5)).toEqual(["w-hello", "L-C"]);
    expect(forced.probes(["letter"], 1)).toEqual(["L-C"]);
    expect(forced.status("L-C", "receptive")).toBe("learning");
    expect(forced.eligiblePhrases(2)).toEqual([]);
  });
});
