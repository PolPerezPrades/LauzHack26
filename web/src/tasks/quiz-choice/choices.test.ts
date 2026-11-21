import { describe, expect, it } from "vitest";
import { PHRASES, getSign, itemLabel } from "../../content/curriculum";
import { createRng } from "../../core/rng";
import { fakeQueries } from "../../learner/testing";
import { LANGS } from "../../i18n/langs";
import { buildChoices } from "./choices";
import { optionsFor, quizChoice } from "./spec";

describe("quiz-choice options", () => {
  it("contains the target and n labels that are unique in every UI language, deterministic for a seed", () => {
    for (const target of ["L-A", "num-3", "w-hello", "w-me", "ph-name"]) {
      for (const n of [2, 3, 4]) {
        for (const seed of [11, 12, 13]) {
          const a = buildChoices(target, n, createRng(seed));
          expect(a).toContain(target);
          expect(a).toHaveLength(n);
          for (const lang of LANGS) expect(new Set(a.map((id) => itemLabel(id, lang).toLowerCase())).size, lang).toBe(n);
          expect(buildChoices(target, n, createRng(seed))).toEqual(a);
        }
      }
    }
  });

  it("takes distractors from the same unit first", () => {
    const options = buildChoices("L-B", 4, createRng(5));
    for (const id of options) expect(getSign(id)?.unit).toBe("abc1");
  });

  it("uses other phrases as distractors for a phrase", () => {
    const options = buildChoices("ph-name", 4, createRng(2));
    for (const id of options) expect(PHRASES.has(id)).toBe(true);
  });

  it("maps the challenge level to 2–4 options, 4 by default", () => {
    expect(optionsFor(0)).toBe(4);
    expect(optionsFor(1)).toBe(4);
    expect(optionsFor(-0.4)).toBe(3);
    expect(optionsFor(-1)).toBe(2);
  });

  it("generates a plan for the next item with its options", () => {
    const q = fakeQueries({ nextItems: () => ["w-thank-you"] });
    const [draft] = quizChoice.generate(q, { rng: createRng(1), ce: 0, cameraUsable: false });
    expect(draft.items).toEqual(["w-thank-you"]);
    expect(draft.params.options).toBe(4);
    expect(draft.params.choices).toContain("w-thank-you");
    // dev overrides of the options count are honoured (and clamped)
    const [three] = quizChoice.generate(q, { rng: createRng(1), ce: 0, cameraUsable: false }, { options: 3 });
    expect(three.params.choices).toHaveLength(3);
    const [clamped] = quizChoice.generate(q, { rng: createRng(1), ce: 0, cameraUsable: false }, { options: 9 });
    expect(clamped.params.choices).toHaveLength(4);
  });
});
