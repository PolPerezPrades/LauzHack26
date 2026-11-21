import { describe, expect, it } from "vitest";
import { EVENT_SCHEMA_VERSION, makeEvent, upcastEvents, type LearningEvent, type StoredEvent } from "./events";
import type { V1Event } from "./eventsV1";

const v1 = (body: Partial<V1Event> & Pick<V1Event, "type">, id: string, ts = 1000): V1Event =>
  ({ ...body, id, ts, v: 1 }) as V1Event;

describe("makeEvent", () => {
  it("stamps id, timestamp and the current schema version", () => {
    const e = makeEvent({ type: "camera.off", sessionId: "s1", reason: "user" }, 1234, "id-1");
    expect(e).toEqual({ type: "camera.off", sessionId: "s1", reason: "user", id: "id-1", ts: 1234, v: 2 });
    expect(EVENT_SCHEMA_VERSION).toBe(2);
  });

  it("gives every event a unique id by default", () => {
    const ids = new Set(Array.from({ length: 50 }, () => makeEvent({ type: "settings.set", soundMuted: true }).id));
    expect(ids.size).toBe(50);
  });
});

describe("upcastEvents", () => {
  it("passes v2 events through unchanged", () => {
    const e = makeEvent({ type: "card.exit", sessionId: "s", cardId: "c", format: "quiz-choice", exit: "too_easy", completed: false, msVisible: 900 }, 5, "x");
    expect(upcastEvents([e])).toEqual([e]);
  });

  it("turns a v1 answer into a synthetic one-card lifecycle closed with the default exit", () => {
    const answer = v1({ type: "answer", sessionId: "old", activity: "recognize", itemId: "L-A", modality: "receptive", correct: false, ms: 4200, confusedWith: "L-S", seq: 7 } as Partial<V1Event> & Pick<V1Event, "type">, "a1", 2000);
    const out = upcastEvents([answer]);
    expect(out.map((e) => e.type)).toEqual(["card.shown", "evidence", "card.result", "card.exit"]);
    expect(out.every((e) => e.v === 2 && e.ts === 2000 && e.seq === 7)).toBe(true);
    expect(new Set(out.map((e) => e.id)).size).toBe(4);
    const [shown, evidence, result, exit] = out;
    expect(shown).toMatchObject({ cardId: "v1-a1", sessionId: "old", format: "quiz-choice", items: ["L-A"], source: "v1" });
    expect(evidence).toMatchObject({
      id: "a1", cardId: "v1-a1", itemId: "L-A", skill: "receptive", kind: "retrieval",
      correct: false, check: "choice", options: 4, ms: 4200, confusedWith: "L-S",
    });
    expect(result).toMatchObject({ success: 0, xp: 0, ms: 4200 });
    expect(exit).toMatchObject({ exit: "next", completed: true, cardId: "v1-a1" });
  });

  it("derives the check mode from the v1 activity", () => {
    const check = (activity: string, modality: "receptive" | "productive" = "receptive") => {
      const out = upcastEvents([v1({ type: "answer", activity, itemId: "L-B", modality, correct: true } as Partial<V1Event> & Pick<V1Event, "type">, activity)]);
      return out.find((e) => e.type === "evidence") as Extract<LearningEvent, { type: "evidence" }>;
    };
    for (const a of ["recognize", "quiz", "rain", "match", "memory"]) expect(check(a)).toMatchObject({ check: "choice", options: 4 });
    for (const a of ["imitate", "camera", "sprint"]) expect(check(a, "productive")).toMatchObject({ check: "camera", skill: "productive" });
    expect(check("spell")).toMatchObject({ check: "typed" });
    expect(check("spell").options).toBeUndefined();
    for (const a of ["conversation", "story"]) expect(check(a, "productive")).toMatchObject({ check: "build" });
    // unknown activities keep a recognisable format id and count as a 4-option choice
    expect(check("mystery")).toMatchObject({ check: "choice", format: "v1-mystery" });
  });

  it("drops every other v1 event and keeps the order of the rest", () => {
    const rows: StoredEvent[] = [
      v1({ type: "profile.set", selfLevel: 1, goalMin: 10, cameraPref: true } as Partial<V1Event> & Pick<V1Event, "type">, "p"),
      v1({ type: "session.start", sessionId: "s" } as Partial<V1Event> & Pick<V1Event, "type">, "ss"),
      v1({ type: "answer", activity: "quiz", itemId: "w-hello", modality: "receptive", correct: true } as Partial<V1Event> & Pick<V1Event, "type">, "q1"),
      makeEvent({ type: "settings.set", soundMuted: true }, 3000, "new"),
      v1({ type: "legacy.import", data: { profile: null, xp: 0, streak: 0, bestStreak: 0, lastActiveDay: null, sessions: 0, sprintBest: 0, items: {} } } as Partial<V1Event> & Pick<V1Event, "type">, "leg"),
      v1({ type: "session.end", sessionId: "s", status: "completed", xp: 10, seconds: 60 } as Partial<V1Event> & Pick<V1Event, "type">, "se"),
    ];
    const out = upcastEvents(rows);
    expect(out.map((e) => e.id)).toEqual(["q1:shown", "q1", "q1:result", "q1:exit", "new"]);
  });

  it("treats rows without a version as v1", () => {
    const row = { type: "answer", activity: "recognize", itemId: "L-C", modality: "receptive", correct: true, id: "nv", ts: 1 } as unknown as StoredEvent;
    expect(upcastEvents([row]).map((e) => e.type)).toEqual(["card.shown", "evidence", "card.result", "card.exit"]);
  });

  it("is idempotent: upcasting an upcast log changes nothing", () => {
    const once = upcastEvents([v1({ type: "answer", activity: "memory", itemId: "num-3", modality: "receptive", correct: true } as Partial<V1Event> & Pick<V1Event, "type">, "m")]);
    expect(upcastEvents(once)).toEqual(once);
  });
});
