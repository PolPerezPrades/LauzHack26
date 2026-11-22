import { describe, expect, it } from "vitest";
import { UNITS, unitOrder } from "../content/curriculum";
import { INITIAL_UNITS, TRACKS, maxInFlight, pacing, spread, trackOf, unitOf } from "./curriculum";
import { queriesFor } from "./queries";
import { foldLearnerState } from "./state";
import { DAY, createLog, type TestLog } from "./testLog";

const fold = (log: TestLog) => foldLearnerState(log.events);
const abc1 = unitOrder("abc1");
const abc2 = unitOrder("abc2");
const abc3 = unitOrder("abc3");
const greetings = unitOrder("greetings");

describe("tracks (SPEC §7.7)", () => {
  it("cover every unit of the content once, each track in curriculum order", () => {
    const units = TRACKS.flatMap((t) => t.units);
    expect([...units].sort()).toEqual(UNITS.map((u) => u.id).sort());
    expect(new Set(units).size).toBe(units.length);
    for (const t of TRACKS) expect(t.units).toEqual(UNITS.map((u) => u.id).filter((id) => t.units.includes(id)));
    expect(TRACKS.map((t) => t.id)).toEqual(["fingerspelling", "numbers", "vocabulary", "phrases"]);
  });

  it("start with abc1 and greetings open, and know each item's unit and track", () => {
    expect(INITIAL_UNITS).toEqual(["abc1", "greetings"]);
    expect([...foldLearnerState([]).openUnits].sort()).toEqual(["abc1", "greetings"]);
    expect(unitOf("L-C")).toBe("abc1");
    expect(unitOf("ph-name")).toBe("phrases");
    expect(trackOf("food")).toBe("vocabulary");
  });
});

describe("unlocking (SPEC §7.7)", () => {
  it("opens the next unit at 60 % of the previous one with pKnown ≥ 0.5, and numbers at 60 % of abc1 met", () => {
    const log = createLog();
    for (const id of abc1.slice(0, 5)) log.lesson(id); // 5/9 < 60 %
    expect(fold(log).openUnits.has("abc2")).toBe(false);
    expect(fold(log).openUnits.has("numbers")).toBe(false);
    log.lesson(abc1[5]); // 6/9 ≥ 60 %
    expect(fold(log).openUnits.has("abc2")).toBe(true);
    expect(fold(log).openUnits.has("numbers")).toBe(true);
    expect(fold(log).openUnits.has("abc3")).toBe(false);
  });

  it("never closes a unit again", () => {
    const log = createLog();
    for (const id of abc1.slice(0, 6)) log.lesson(id);
    for (const id of abc1.slice(0, 3)) log.answer(id, false);
    const s = fold(log);
    expect(s.items.get(abc1[0])?.receptive?.pKnown).toBeLessThan(0.5);
    expect(s.openUnits.has("abc2")).toBe(true);
  });

  it("opens the phrases unit once a phrase is eligible", () => {
    const log = createLog();
    for (const id of ["w-you", "w-deaf"]) for (let i = 0; i < 3; i++) log.answer(id, true);
    const s = fold(log);
    expect(s.openUnits.has("phrases")).toBe(true);
    expect(queriesFor(s).eligiblePhrases(5)).toContain("ph-deaf");
  });
});

describe("frontier (SPEC §7.7)", () => {
  it("gives one new item per open unit first, round-robin in curriculum order", () => {
    const q = queriesFor(foldLearnerState([]));
    expect(q.frontier(["letter", "word"], 4)).toEqual([abc1[0], greetings[0], abc1[1], greetings[1]]);
    expect(q.frontier(["letter"], 3)).toEqual(abc1.slice(0, 3));
    expect(q.frontier(["number"], 3)).toEqual([]); // numbers aren't open yet
  });

  it("follows the units as they open, skipping met items", () => {
    const log = createLog();
    for (const id of abc1.slice(0, 6)) log.lesson(id);
    const q = queriesFor(fold(log));
    expect(q.frontier(["letter"], 3)).toEqual([abc1[6], abc2[0], abc1[7]]);
    expect(q.frontier(["number"], 2)).toEqual(["num-1", "num-2"]);
  });

  it("offers phrases only once they are eligible", () => {
    const log = createLog();
    expect(queriesFor(fold(log)).frontier(["phrase"], 3)).toEqual([]);
    for (const id of ["w-you", "w-deaf"]) for (let i = 0; i < 3; i++) log.answer(id, true);
    expect(queriesFor(fold(log)).frontier(["phrase"], 3)).toEqual(["ph-deaf"]);
  });
});

describe("test-out (SPEC §7.7)", () => {
  it("2 claims in a row in a unit: the rest of it is claimed at 0.60, the next unit opens, one probe covers 3 of them", () => {
    const log = createLog();
    log.swipe([abc1[0]], "too_easy");
    expect(fold(log).testedOut.size).toBe(0);
    log.swipe([abc1[1]], "too_easy");
    const s = fold(log);
    expect([...s.testedOut]).toEqual(["abc1"]);
    expect(s.openUnits.has("abc2")).toBe(true);
    for (const id of abc1.slice(2)) {
      for (const skill of ["receptive", "productive"] as const) expect(s.items.get(id)?.[skill], id).toMatchObject({ evidence: "claimed", pKnown: 0.6 });
    }
    const remaining = abc1.slice(2);
    const probed = [remaining[0], remaining[3], remaining[6]];
    expect(probed.map((id) => s.items.get(id)?.probeSince)).toEqual([2, 2, 2]);
    expect(remaining.filter((id) => !probed.includes(id)).every((id) => s.items.get(id)?.probeSince === undefined)).toBe(true);
    const q = queriesFor(s);
    expect(q.probes(["letter"], 10)).toEqual([abc1[0], abc1[1], ...probed]);
    expect(q.frontier(["letter"], 1)).toEqual([abc2[0]]);
    expect(s.unitRuns.size).toBe(0);
    // claims don't count as items being learned
    expect(pacing(s, log.now).inFlight).toBe(0);
  });

  it("counts claims per unit: claims on other units in between don't break the run", () => {
    const log = createLog();
    log.swipe([abc1[0]], "too_easy");
    log.swipe([greetings[0]], "too_easy");
    log.swipe([abc1[1]], "too_easy");
    const s = fold(log);
    expect([...s.testedOut]).toEqual(["abc1"]);
    expect(s.unitRuns.get("greetings")).toBe(1);
  });

  it("an ordinary exit on a new item of the unit breaks the run", () => {
    for (const exit of ["next", "too_hard"] as const) {
      const log = createLog();
      log.swipe([abc1[0]], "too_easy");
      if (exit === "next") log.lesson(abc1[1]);
      else log.swipe([abc1[1]], "too_hard");
      log.swipe([abc1[2]], "too_easy");
      expect(fold(log).testedOut.size, exit).toBe(0);
      expect(fold(log).unitRuns.get("abc1"), exit).toBe(1);
    }
  });

  it("a completed lesson left too easy neither counts nor breaks the run", () => {
    const log = createLog();
    log.swipe([abc1[0]], "too_easy");
    log.lesson(abc1[1], { exit: "too_easy" });
    expect(fold(log).unitRuns.get("abc1")).toBe(1);
    log.swipe([abc1[2]], "too_easy");
    expect([...fold(log).testedOut]).toEqual(["abc1"]);
  });

  it("3 claims in a row in a track, across its units, test out the unit of the last one", () => {
    const log = createLog();
    for (const id of abc1.slice(0, 6)) log.lesson(id);
    for (const id of abc2.slice(0, 6)) log.lesson(id);
    expect(fold(log).openUnits.has("abc3")).toBe(true);
    log.swipe([abc1[6]], "too_easy");
    log.swipe([abc2[6]], "too_easy");
    expect(fold(log).testedOut.size).toBe(0);
    log.swipe([abc3[0]], "too_easy");
    const s = fold(log);
    expect([...s.testedOut]).toEqual(["abc3"]);
    expect(abc3.every((id) => s.items.get(id)?.receptive?.evidence === "claimed")).toBe(true);
  });

  it("spreads the probe over the claimed items", () => {
    expect(spread([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([1, 4, 7]);
    expect(spread([1, 2], 3)).toEqual([1, 2]);
    expect(spread([1, 2, 3], 1)).toEqual([1]);
  });
});

describe("new-item pacing (SPEC §7.7)", () => {
  it("allows round(4 + 2c) items in flight", () => {
    expect([-1, -0.5, 0, 0.5, 1].map(maxInFlight)).toEqual([2, 3, 4, 5, 6]);
  });

  it("counts items being learned once each, and stops new lessons at the limit", () => {
    const log = createLog();
    for (const id of abc1.slice(0, 3)) log.lesson(id);
    let p = pacing(fold(log), log.now);
    expect(p).toMatchObject({ inFlight: 3, maxInFlight: 4, overdue: 0, allowsNew: true });
    log.lesson(abc1[3]);
    p = pacing(fold(log), log.now);
    expect(p).toMatchObject({ inFlight: 4, maxInFlight: 4, allowsNew: false });
  });

  it("doesn't count known items, and pauses new lessons from 8 overdue reviews", () => {
    const log = createLog();
    const known = [...abc1.slice(0, 4), ...greetings.slice(0, 4)];
    for (const id of known) for (let i = 0; i < 3; i++) log.answer(id, true);
    let p = pacing(fold(log), log.now);
    expect(p).toMatchObject({ inFlight: 0, overdue: 0, allowsNew: true });
    log.advance(120 * DAY);
    log.open();
    p = pacing(fold(log), log.now);
    expect(p.overdue).toBe(8);
    expect(p.allowsNew).toBe(false);
  });
});
