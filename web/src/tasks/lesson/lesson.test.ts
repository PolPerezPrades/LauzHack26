import { describe, expect, it } from "vitest";
import { en } from "../../i18n/en";
import { es } from "../../i18n/es";
import { genContext, strictQueries } from "../testing";
import { lessonResult } from "./result";
import { LESSON_KINDS, lesson } from "./spec";

describe("lesson generator", () => {
  it("teaches the frontier's new items, never phrases", () => {
    let asked: readonly string[] = [];
    const q = strictQueries({ frontier: (kinds) => ((asked = kinds), ["L-A", "w-hello"]) });
    const drafts = lesson.generate(q, genContext());
    expect(asked).toEqual(LESSON_KINDS);
    expect(asked).not.toContain("phrase");
    expect(drafts.map((d) => [d.items, d.params.variant])).toEqual([[["L-A"], "new"], [["w-hello"], "new"]]);
    expect(drafts[0].reasons).toEqual([{ code: "frontier", item: "L-A" }]);
  });

  it("puts relearn lessons first, and doesn't teach the same item twice", () => {
    const q = strictQueries({ relearn: () => ["num-3"], frontier: () => ["num-3", "L-B"] });
    const drafts = lesson.generate(q, genContext());
    expect(drafts.map((d) => [d.items[0], d.params.variant])).toEqual([["num-3", "relearn"], ["L-B", "new"]]);
    expect(drafts[0].reasons).toEqual([{ code: "relearn", item: "num-3" }]);
  });

  it("lets dev mode choose new lessons or relearn lessons only", () => {
    const q = strictQueries({ relearn: () => ["L-C"], frontier: () => ["L-D"] });
    expect(lesson.generate(q, genContext(), { only: 1 }).map((d) => d.items[0])).toEqual(["L-D"]);
    expect(lesson.generate(q, genContext(), { only: 2 }).map((d) => d.items[0])).toEqual(["L-C"]);
  });

  it("is optional for the camera: it stays eligible without one", () => {
    expect(lesson.requires.camera).toBe("optional");
    expect(lesson.generate(strictQueries({ frontier: () => ["w-hello"] }), genContext(1, 0, false))).toHaveLength(1);
  });

  it("previews the sign it teaches, in each language", () => {
    const plan = (variant: "new" | "relearn") => ({ cardId: "c", format: "lesson", items: ["L-A"], params: { only: 0, variant }, reasons: [] });
    expect(lesson.preview(plan("new"), en)).toBe("New sign: Letter A");
    expect(lesson.preview({ ...plan("relearn"), items: ["w-black"] }, es)).toBe("Repaso: negro");
  });
});

describe("lesson evidence", () => {
  it("logs the watch as an exposure and the camera try as a strong productive retrieval", () => {
    const r = lessonResult("L-A", { mode: "camera", correct: true, ms: 2400 }, en, "en");
    expect(r.evidence).toEqual([
      { itemId: "L-A", skill: "receptive", kind: "exposure", check: "none" },
      { itemId: "L-A", skill: "productive", kind: "retrieval", correct: true, check: "camera", ms: 2400 },
    ]);
    expect(r).toMatchObject({ success: 1, xp: 10, feedback: { correct: true, answer: "Letter A" } });
  });

  it("flags mirror and self tries as self-graded, with the hints asked for", () => {
    const mirror = lessonResult("w-hello", { mode: "mirror", correct: true }, en, "en");
    expect(mirror.evidence[1]).toEqual({ itemId: "w-hello", skill: "productive", kind: "retrieval", correct: true, check: "mirror", selfGraded: true });
    const self = lessonResult("w-hello", { mode: "self", correct: true, hints: 2 }, es, "es");
    expect(self.evidence[1]).toMatchObject({ check: "self", selfGraded: true, hints: 2 });
    expect(self.feedback?.answer).toBe("hola");
  });

  it("keeps a failed try's confusion and always gives feedback", () => {
    const r = lessonResult("L-M", { mode: "camera", correct: false, confusedWith: "L-N", note: "That looks like an N" }, en, "en");
    expect(r.evidence[1]).toMatchObject({ correct: false, check: "camera", confusedWith: "L-N" });
    expect(r.evidence[1].selfGraded).toBeUndefined();
    expect(r).toMatchObject({ success: 0, xp: 5, feedback: { correct: false, answer: "Letter M", note: "That looks like an N" } });
    expect(lessonResult("L-M", { mode: "self", correct: false }, en, "en").feedback?.note).toBe(en.learning.lesson.comeBack);
  });
});
