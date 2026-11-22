import { describe, expect, it } from "vitest";
import { en } from "../../i18n/en";
import { es } from "../../i18n/es";
import { genContext, strictQueries } from "../testing";
import { optionsFor, quizChoice } from "./spec";

const plan = (items: string[]) => ({ cardId: "c", format: "quiz-choice", items, params: quizChoice.params(0, genContext()), reasons: [] });

describe("quiz-choice generator", () => {
  it("asks about met items to practise for the receptive skill, most urgent first", () => {
    const q = strictQueries({ practice: (skill) => (skill === "receptive" ? ["w-thank-you", "L-A"] : []) });
    const drafts = quizChoice.generate(q, genContext());
    expect(drafts.map((d) => d.items)).toEqual([["w-thank-you"], ["L-A"]]);
    expect(drafts[0].params.choices).toContain("w-thank-you");
    expect(drafts[0].params.choices).toHaveLength(4);
    expect(drafts[0].params.sets).toBeUndefined();
    expect(drafts[0].reasons).toEqual([{ code: "practice", item: "w-thank-you" }]);
  });

  it("puts one verification probe over up to 3 claimed items first", () => {
    const q = strictQueries({
      probes: (_kinds, n) => ["L-A", "L-B", "L-C", "L-D"].slice(0, n),
      practice: () => ["L-B", "w-hello"],
    });
    const [probe, ...rest] = quizChoice.generate(q, genContext());
    expect(probe.items).toEqual(["L-A", "L-B", "L-C"]);
    expect(probe.params.sets).toHaveLength(3);
    expect(probe.params.choices).toBeUndefined();
    probe.params.sets!.forEach((set, i) => expect(set).toContain(probe.items[i]));
    expect(probe.reasons?.map((r) => r.code)).toEqual(["verification_probe", "verification_probe", "verification_probe"]);
    // an item already in the probe isn't asked again on its own
    expect(rest.map((d) => d.items)).toEqual([["w-hello"]]);
  });

  it("lets dev mode choose probes only or practice only", () => {
    const q = strictQueries({ probes: () => ["L-A"], practice: () => ["L-B"] });
    const base = quizChoice.params(0, genContext());
    expect(quizChoice.generate(q, genContext(), { ...base, probe: 1 }).map((d) => d.items)).toEqual([["L-B"]]);
    expect(quizChoice.generate(q, genContext(), { ...base, probe: 2 }).map((d) => d.items)).toEqual([["L-A"]]);
  });

  it("maps the challenge level to options, similarity, slow motion and replay", () => {
    expect(optionsFor(0)).toBe(4);
    expect(optionsFor(-0.4)).toBe(3);
    expect(optionsFor(-1)).toBe(2);
    const at = (ce: number) => quizChoice.params(ce, genContext(1, ce));
    expect(at(0)).toMatchObject({ options: 4, similar: 0, slow: 1, replay: 1 });
    expect(at(0.3)).toMatchObject({ similar: 1, slow: 1, replay: 1 });
    expect(at(0.6)).toMatchObject({ similar: 1, slow: 0, replay: 1 });
    expect(at(0.9)).toMatchObject({ slow: 0, replay: 0 });
    expect(at(-1)).toMatchObject({ options: 2, similar: 0 });
  });

  it("uses the learner's confusions at high similarity and logs it", () => {
    const q = strictQueries({ practice: () => ["L-M"], confusions: (id) => (id === "L-M" ? ["L-N"] : []) });
    const [d] = quizChoice.generate(q, genContext(4, 0.5));
    expect(d.params.choices).toContain("L-N");
    expect(d.params.similarity).toEqual(["high"]);
    const [low] = quizChoice.generate(q, genContext(4, 0));
    expect(low.params.similarity).toEqual(["low"]);
  });

  it("honours (and clamps) dev overrides, and is deterministic for a seed", () => {
    const q = strictQueries({ practice: () => ["w-thank-you"] });
    const base = quizChoice.params(0, genContext());
    expect(quizChoice.generate(q, genContext(), { ...base, options: 3 })[0].params.choices).toHaveLength(3);
    expect(quizChoice.generate(q, genContext(), { ...base, options: 9 })[0].params.choices).toHaveLength(4);
    expect(quizChoice.generate(q, genContext(7))).toEqual(quizChoice.generate(q, genContext(7)));
  });

  it("proposes nothing when there is nothing to practise", () => {
    expect(quizChoice.generate(strictQueries(), genContext())).toEqual([]);
  });

  it("previews the question without the answer, in each language", () => {
    expect(quizChoice.preview(plan(["L-A"]), en)).toBe(en.quiz.letter);
    expect(quizChoice.preview(plan(["ph-name"]), es)).toBe(es.quiz.phrase);
  });
});
