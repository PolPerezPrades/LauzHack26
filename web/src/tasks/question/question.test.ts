import { describe, expect, it } from "vitest";
import { PHRASES } from "../../content/curriculum";
import { createRng } from "../../core/rng";
import { en } from "../../i18n/en";
import { es } from "../../i18n/es";
import { SPELL_WORDS } from "../../lib/engine";
import { genContext, strictQueries } from "../testing";
import { signSentenceResult, signTermResult, spellWordResult } from "./result";
import { question, type QuestionParams } from "./spec";
import { pickWord, wordLetters } from "./spell";

const base = (ce = 0): QuestionParams => question.params(ce, genContext(1, ce));
const letters = (s: string) => [...s].map((c) => `L-${c}`);

describe("question generator", () => {
  it("asks to sign met items for the productive skill (sign-term)", () => {
    const q = strictQueries({ practice: (skill, kinds) => (skill === "productive" && kinds.includes("word") ? ["w-thank-you", "num-3"] : []) });
    const drafts = question.generate(q, genContext(), { ...base(), only: 1 });
    expect(drafts.map((d) => [d.items, d.params.variant])).toEqual([[["w-thank-you"], "sign-term"], [["num-3"], "sign-term"]]);
  });

  it("asks to sign eligible phrases, preferring short ones at low challenge (sign-sentence)", () => {
    const ids = [...PHRASES.keys()];
    const q = strictQueries({ eligiblePhrases: (n) => ids.slice(0, n) });
    const low = question.generate(q, genContext(1, -1), { ...question.params(-1, genContext()), only: 2 });
    expect(low.length).toBeGreaterThan(0);
    for (const d of low) {
      expect(d.params.variant).toBe("sign-sentence");
      expect(PHRASES.get(d.items[0])!.signs.length).toBeLessThanOrEqual(2);
    }
  });

  it("asks to fingerspell a word made of met letters (spell-word)", () => {
    const q = strictQueries({ practice: (skill, kinds) => (skill === "productive" && kinds.includes("letter") ? letters("CAB") : []) });
    const [d] = question.generate(q, genContext(), { ...base(), only: 3 });
    expect(d.params).toMatchObject({ variant: "spell-word", word: "CAB" });
    expect(d.items).toEqual(["L-C", "L-A", "L-B"]);
  });

  it("offers every variant that has content, in a seeded order", () => {
    const q = strictQueries({
      practice: (_skill, kinds) => (kinds.includes("word") ? ["w-hello"] : letters("CABDEFGHI")),
      eligiblePhrases: () => ["ph-deaf"],
    });
    const variants = new Set(question.generate(q, genContext(3)).map((d) => d.params.variant));
    expect(variants).toEqual(new Set(["sign-term", "sign-sentence", "spell-word"]));
    expect(question.generate(q, genContext(3))).toEqual(question.generate(q, genContext(3)));
    // across seeds, the first draft is not always the same variant
    const firsts = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => question.generate(q, genContext(s))[0].params.variant));
    expect(firsts.size).toBeGreaterThan(1);
  });

  it("is optional for the camera and proposes nothing without met content", () => {
    expect(question.requires.camera).toBe("optional");
    expect(question.generate(strictQueries(), genContext(1, 0, false))).toEqual([]);
  });

  it("previews the prompt in each language", () => {
    const plan = (params: QuestionParams, items: string[]) => ({ cardId: "c", format: "question", items, params, reasons: [] });
    expect(question.preview(plan({ ...base(), variant: "sign-term" }, ["w-thank-you"]), en)).toBe("Sign: thank you");
    expect(question.preview(plan({ ...base(), variant: "spell-word", word: "CAB" }, letters("CAB")), es)).toBe("Deletrea: CAB");
  });
});

describe("spell-word words", () => {
  it("only uses met letters, practises the most urgent letter, and fits the length range", () => {
    const met = letters("ABCDEFGHI");
    for (const seed of [1, 2, 3]) {
      const word = pickWord(met, { minLetters: 3, maxLetters: 4 }, createRng(seed))!;
      expect([...word].every((c) => "ABCDEFGHI".includes(c))).toBe(true);
      expect(word.length).toBeGreaterThanOrEqual(3);
      expect(word.length).toBeLessThanOrEqual(4);
      expect(word).toContain("A"); // A is the most urgent letter
    }
    expect(pickWord(letters("FIG"), { minLetters: 4, maxLetters: 6 }, createRng(1))).toBe("FIG"); // falls back to any length
    expect(pickWord(letters("XQ"), { minLetters: 2, maxLetters: 6 }, createRng(1))).toBeNull();
  });

  it("keeps the bank free of doubled letters, which the camera can't check", () => {
    for (const w of SPELL_WORDS) expect(w, w).not.toMatch(/(.)\1/);
    expect(wordLetters("MOM")).toEqual(["L-M", "L-O"]);
  });
});

describe("question evidence", () => {
  it("logs sign-term as one productive retrieval, self-graded unless the camera decided", () => {
    const cam = signTermResult("L-B", { mode: "camera", correct: true, ms: 900 }, en, "en");
    expect(cam.evidence).toEqual([{ itemId: "L-B", skill: "productive", kind: "retrieval", correct: true, check: "camera", ms: 900 }]);
    expect(cam).toMatchObject({ success: 1, xp: 12, feedback: { correct: true, answer: "Letter B" } });
    const self = signTermResult("w-hello", { mode: "self", correct: false }, es, "es");
    expect(self.evidence[0]).toMatchObject({ check: "self", selfGraded: true, correct: false });
    expect(self).toMatchObject({ success: 0, xp: 0, feedback: { correct: false, answer: "hola" } });
    const confused = signTermResult("L-M", { mode: "camera", correct: false, confusedWith: "L-N" }, en, "en", "That looks like an N");
    expect(confused.evidence[0]).toMatchObject({ confusedWith: "L-N" });
    expect(confused.feedback?.note).toBe("That looks like an N");
  });

  it("logs sign-sentence on every sign and on the phrase, with the grammar in the feedback", () => {
    const r = signSentenceResult("ph-name", { mode: "mirror", correct: true }, en, "en");
    expect(r.evidence.map((e) => e.itemId)).toEqual(["w-you", "w-name", "w-what", "ph-name"]);
    for (const e of r.evidence) expect(e).toMatchObject({ skill: "productive", kind: "retrieval", correct: true, check: "mirror", selfGraded: true });
    expect(r.feedback).toMatchObject({ correct: true, answer: "What is your name?" });
    expect(r.feedback?.note).toContain("YOU · NAME · WHAT");
  });

  it("logs spell-word once per distinct letter, wrong if any occurrence was skipped", () => {
    const r = spellWordResult("MOM", [
      { letter: "L-M", mode: "camera", correct: true, ms: 500 },
      { letter: "L-O", mode: "camera", correct: false, confusedWith: "L-C" },
      { letter: "L-M", mode: "camera", correct: false },
    ], en);
    expect(r.evidence.map((e) => [e.itemId, e.correct, e.check])).toEqual([["L-M", false, "camera"], ["L-O", false, "camera"]]);
    expect(r.evidence[1]).toMatchObject({ confusedWith: "L-C" });
    expect(r).toMatchObject({ success: 0, xp: 0, feedback: { correct: false, answer: "MOM", note: "Skipped: O, M" } });

    const jazz = spellWordResult("JOB", [
      { letter: "L-J", mode: "mirror", correct: true },
      { letter: "L-O", mode: "camera", correct: true },
      { letter: "L-B", mode: "camera", correct: true },
    ], en);
    expect(jazz.evidence.map((e) => [e.itemId, e.check, e.selfGraded ?? false])).toEqual([["L-J", "mirror", true], ["L-O", "camera", false], ["L-B", "camera", false]]);
    expect(jazz).toMatchObject({ success: 1, xp: 15, feedback: { correct: true, answer: "JOB" } });
  });
});
