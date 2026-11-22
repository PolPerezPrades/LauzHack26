import { describe, expect, it } from "vitest";
import type { EvidenceDraft, TaskResult } from "../core/types";
import { wrongChoice } from "./feedback";

const choice = (p: Partial<EvidenceDraft> = {}): EvidenceDraft => ({ itemId: "L-M", skill: "receptive", kind: "retrieval", correct: false, check: "choice", options: 4, confusedWith: "L-N", ...p });
const result = (evidence: EvidenceDraft[], p: Partial<TaskResult> = {}): TaskResult => ({ success: 0, evidence, xp: 0, feedback: { correct: false, answer: "M" }, ...p });

describe("wrongChoice", () => {
  it("names the option picked instead of the answer", () => {
    expect(wrongChoice(result([choice()]))).toBe("L-N");
  });

  it("says nothing after a correct answer, or without feedback", () => {
    expect(wrongChoice(result([choice({ correct: true, confusedWith: undefined })], { success: 1, feedback: { correct: true } }))).toBeUndefined();
    expect(wrongChoice(result([choice()], { feedback: undefined }))).toBeUndefined();
  });

  it("says nothing for checks other than a choice (the camera saw something else, a self-check)", () => {
    expect(wrongChoice(result([choice({ check: "camera" })]))).toBeUndefined();
    expect(wrongChoice(result([choice({ check: "self", selfGraded: true, confusedWith: undefined })]))).toBeUndefined();
  });

  it("says nothing when the choice isn't known, or there are several mistakes, or it's a game", () => {
    expect(wrongChoice(result([choice({ confusedWith: undefined })]))).toBeUndefined();
    expect(wrongChoice(result([choice(), choice({ itemId: "L-A", confusedWith: "L-S" })]))).toBeUndefined();
    expect(wrongChoice(result([choice()], { score: 3 }))).toBeUndefined();
  });

  it("ignores exposures and correct retrievals next to the one mistake", () => {
    const exposure: EvidenceDraft = { itemId: "w-hello", skill: "receptive", kind: "exposure", check: "none" };
    expect(wrongChoice(result([exposure, choice({ itemId: "L-A", correct: true, confusedWith: undefined }), choice()]))).toBe("L-N");
  });
});
