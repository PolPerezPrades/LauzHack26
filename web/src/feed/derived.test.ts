import { describe, expect, it } from "vitest";
import { makeEvent, upcastEvents, type LearningEvent } from "../data/events";
import type { V1Event } from "../data/eventsV1";
import { DAY, createLog } from "../learner/testLog";
import { dayKey, feedStats, soundMuted } from "./derived";

const result = (xp: number, date: string): LearningEvent =>
  makeEvent({ type: "card.result", sessionId: "s", cardId: date, format: "quiz-choice", success: 1, xp, ms: 1 }, new Date(date).getTime());

/** Part A's own fold of XP and streak, kept as the reference: the learner state must give the same numbers. */
function partAStats(events: readonly LearningEvent[], now: number) {
  let xp = 0;
  const days = new Set<string>();
  for (const e of events) {
    if (e.type !== "card.result") continue;
    xp += e.xp;
    days.add(dayKey(e.ts));
  }
  const day = new Date(now);
  day.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(day.getTime()))) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(day.getTime()))) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return { xp, streak };
}

describe("feed stats", () => {
  it("sums XP and counts consecutive days ending today", () => {
    const now = new Date("2026-11-21T18:00:00").getTime();
    const log = [result(10, "2026-11-18T10:00:00"), result(10, "2026-11-19T09:00:00"), result(12, "2026-11-20T21:00:00"), result(0, "2026-11-21T08:00:00")];
    expect(feedStats(log, now)).toEqual({ xp: 32, streak: 3 + 1 });
  });

  it("keeps yesterday's streak alive until today ends, and breaks on a gap", () => {
    const now = new Date("2026-11-21T07:00:00").getTime();
    expect(feedStats([result(10, "2026-11-19T10:00:00"), result(10, "2026-11-20T10:00:00")], now).streak).toBe(2);
    expect(feedStats([result(10, "2026-11-18T10:00:00")], now).streak).toBe(0);
    expect(feedStats([], now)).toEqual({ xp: 0, streak: 0 });
  });

  it("gives the same numbers as Part A's fold on any log (integration check)", () => {
    const log = createLog();
    log.card({ format: "system-tutorial" });
    for (let day = 0; day < 6; day++) {
      if (day === 3) {
        log.advance(DAY);
        continue; // a gap
      }
      log.lesson(`L-${"ABCDEF"[day]}`);
      log.answer("L-A", day % 2 === 0, { exit: day % 3 === 0 ? "too_easy" : "next" });
      log.swipe(["w-hello"], "too_hard");
      log.advance(DAY);
    }
    const v1 = upcastEvents([{ type: "answer", id: "old", ts: log.now - 30 * DAY, v: 1, activity: "quiz", itemId: "L-B", modality: "receptive", correct: true } as V1Event]);
    const events = [...v1, ...log.events, result(7, "2026-12-01T09:00:00")];
    for (const now of [log.now, log.now - DAY, log.now + DAY, log.now + 3 * DAY, new Date("2026-12-01T20:00:00").getTime()]) {
      expect(feedStats(events, now), new Date(now).toISOString()).toEqual(partAStats(events, now));
    }
  });

  it("reads the latest sound preference", () => {
    expect(soundMuted([])).toBe(false);
    const log = [makeEvent({ type: "settings.set", soundMuted: true }), makeEvent({ type: "settings.set" })];
    expect(soundMuted(log)).toBe(true);
    expect(soundMuted([...log, makeEvent({ type: "settings.set", soundMuted: false })])).toBe(false);
  });
});
