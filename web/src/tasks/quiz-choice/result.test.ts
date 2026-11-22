import { describe, expect, it } from "vitest";
import { en } from "../../i18n/en";
import { es } from "../../i18n/es";
import { quizChoiceResult } from "./result";

describe("quiz-choice evidence", () => {
  it("logs one receptive choice retrieval, with the options, similarity and time", () => {
    const r = quizChoiceResult([{ item: "w-hello", chosen: "w-hello", options: 4, similarity: "low", ms: 1800 }], en, "en");
    expect(r.evidence).toEqual([{ itemId: "w-hello", skill: "receptive", kind: "retrieval", correct: true, check: "choice", options: 4, similarity: "low", ms: 1800 }]);
    expect(r).toMatchObject({ success: 1, xp: 10, feedback: { correct: true, answer: "hello" } });
    expect(r.evidence[0].selfGraded).toBeUndefined();
  });

  it("records what was picked instead, and always carries the answer", () => {
    const r = quizChoiceResult([{ item: "w-black", chosen: "w-white", options: 3, similarity: "high" }], es, "es");
    expect(r.evidence[0]).toMatchObject({ correct: false, confusedWith: "w-white", options: 3, similarity: "high" });
    expect(r).toMatchObject({ success: 0, xp: 0, feedback: { correct: false, answer: "negro (BLACK)" } });
  });

  it("adds the gloss, the non-manual marker and the grammar note for a phrase", () => {
    const r = quizChoiceResult([{ item: "ph-name", chosen: "ph-name", options: 4, similarity: "low" }], en, "en");
    expect(r.xp).toBe(12);
    expect(r.feedback?.note).toContain("YOU · NAME · WHAT");
    expect(r.feedback?.note).toContain(en.content.nonManual.wh);
  });

  it("scores a probe question by question", () => {
    const r = quizChoiceResult([
      { item: "L-A", chosen: "L-A", options: 4, similarity: "low" },
      { item: "L-B", chosen: "L-D", options: 4, similarity: "low" },
      { item: "L-C", chosen: "L-C", options: 4, similarity: "low" },
    ], en, "en");
    expect(r.evidence.map((e) => [e.itemId, e.correct])).toEqual([["L-A", true], ["L-B", false], ["L-C", true]]);
    expect(r.success).toBeCloseTo(2 / 3);
    expect(r.xp).toBe(20);
    expect(r.feedback).toEqual({ correct: false, answer: "B", note: "2 of 3 right" });
  });
});
