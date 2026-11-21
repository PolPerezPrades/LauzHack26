import { describe, expect, it } from "vitest";
import { makeEvent, type LearningEvent } from "../data/events";
import { feedStats, soundMuted } from "./derived";

const result = (xp: number, date: string): LearningEvent =>
  makeEvent({ type: "card.result", sessionId: "s", cardId: date, format: "quiz-choice", success: 1, xp, ms: 1 }, new Date(date).getTime());

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

  it("reads the latest sound preference", () => {
    expect(soundMuted([])).toBe(false);
    const log = [makeEvent({ type: "settings.set", soundMuted: true }), makeEvent({ type: "settings.set" })];
    expect(soundMuted(log)).toBe(true);
    expect(soundMuted([...log, makeEvent({ type: "settings.set", soundMuted: false })])).toBe(false);
  });
});
