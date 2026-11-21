import { describe, expect, it } from "vitest";
import { makeEvent, type LearningEvent } from "./events";
import type { V1Event } from "./eventsV1";
import { createLogStore } from "./logStore";
import { EXPORT_FORMAT, MemoryRepository, exportLog, parseExport, withoutSeq } from "./repository";

function sampleLog(): LearningEvent[] {
  let t = 1_000;
  const card = { sessionId: "s1", cardId: "c1", format: "quiz-choice" };
  return [
    makeEvent({ type: "app.open", sessionId: "s1", device: "desktop", cameraAvailable: true, appVersion: "0.1.0" }, t++),
    makeEvent({ ...card, type: "card.shown", items: ["L-A"], params: { options: 4, choices: ["L-A", "L-E", "L-S", "L-T"] }, reasons: [{ code: "picker_walk", index: 0 }], source: "picker" }, t++),
    makeEvent({ ...card, type: "evidence", itemId: "L-A", skill: "receptive", kind: "retrieval", correct: false, check: "choice", options: 4, confusedWith: "L-S" }, t++),
    makeEvent({ ...card, type: "card.result", success: 0, xp: 0, ms: 3100 }, t++),
    makeEvent({ ...card, type: "card.exit", exit: "too_hard", completed: true, msVisible: 5200 }, t++),
    makeEvent({ type: "camera.off", sessionId: "s1", reason: "user" }, t++),
    makeEvent({ type: "settings.set", soundMuted: true }, t++),
  ];
}

describe("export → import round trip", () => {
  it("returns exactly the same events (minus the local sequence)", async () => {
    const repo = new MemoryRepository();
    const log = sampleLog();
    for (const e of log) await repo.append(e);
    const bundle = await exportLog(repo, new Date("2026-11-21T10:00:00Z"));
    expect(bundle).toMatchObject({ format: EXPORT_FORMAT, schemaVersion: 2, exportedAt: "2026-11-21T10:00:00.000Z" });

    const imported = parseExport(JSON.parse(JSON.stringify(bundle)));
    expect(imported).toStrictEqual(log);

    // and importing into a fresh repository reads back the same log
    const other = new MemoryRepository();
    await other.replaceAll(imported);
    expect((await other.all()).map(withoutSeq)).toStrictEqual(log);
  });

  it("restores append order from seq even if the file is shuffled", async () => {
    const repo = new MemoryRepository();
    for (const e of sampleLog()) await repo.append(e);
    const bundle = await exportLog(repo);
    const shuffled = { ...bundle, events: [...bundle.events].reverse() };
    expect(parseExport(shuffled).map((e) => e.type)).toEqual(sampleLog().map((e) => e.type));
  });

  it("upcasts v1 bundles and v1 rows read from storage", async () => {
    const answer = { type: "answer", activity: "recognize", itemId: "L-A", modality: "receptive", correct: true, id: "a", ts: 10, v: 1 } as V1Event;
    const ignored = { type: "session.end", sessionId: "s", status: "completed", xp: 5, seconds: 30, id: "b", ts: 11, v: 1 } as V1Event;
    const fromFile = parseExport({ format: EXPORT_FORMAT, schemaVersion: 1, exportedAt: "x", events: [answer, ignored] });
    expect(fromFile.map((e) => e.type)).toEqual(["card.shown", "evidence", "card.result", "card.exit"]);

    const stored = new MemoryRepository([answer, ignored]);
    expect((await stored.all()).map((e) => e.type)).toEqual(["card.shown", "evidence", "card.result", "card.exit"]);
  });

  it("rejects foreign files and newer schemas, and drops malformed or duplicate rows", () => {
    expect(() => parseExport({ format: "other" })).toThrow();
    expect(() => parseExport({ format: EXPORT_FORMAT, schemaVersion: 3, events: [] })).toThrow();
    expect(() => parseExport({ format: EXPORT_FORMAT, schemaVersion: 2 })).toThrow();
    const ok = makeEvent({ type: "settings.set", soundMuted: false }, 1, "dup");
    const events = parseExport({ format: EXPORT_FORMAT, schemaVersion: 2, events: [ok, { ...ok }, { type: "x" }, null] });
    expect(events).toStrictEqual([ok]);
  });
});

describe("log store", () => {
  it("shows emitted events at once and persists them in emission order", async () => {
    const repo = new MemoryRepository();
    const store = createLogStore(repo, "test", false, []);
    let notified = 0;
    store.subscribe(() => notified++);
    store.emit({ type: "camera.off", sessionId: "s", reason: "user" });
    store.emit({ type: "settings.set", soundMuted: true });
    expect(store.getEvents().map((e) => e.type)).toEqual(["camera.off", "settings.set"]);
    expect(notified).toBe(2);
    await store.flush();
    expect((await repo.all()).map((e) => e.id)).toEqual(store.getEvents().map((e) => e.id));
  });

  it("replaces the whole log (sandbox reset)", async () => {
    const repo = new MemoryRepository();
    const store = createLogStore(repo, "test", false, []);
    store.emit({ type: "settings.set", soundMuted: true });
    await store.replaceAll([]);
    expect(store.getEvents()).toEqual([]);
    expect(await repo.all()).toEqual([]);
  });
});
