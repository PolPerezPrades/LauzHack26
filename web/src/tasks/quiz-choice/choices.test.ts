import { describe, expect, it } from "vitest";
import { PHRASES, getSign, itemLabel } from "../../content/curriculum";
import { createRng } from "../../core/rng";
import { LANGS } from "../../i18n/langs";
import { buildChoices, buildOptions } from "./choices";
import { LETTER_GROUPS, lookAlikes, phrasesSharingSigns } from "./similar";

const uniqueInEveryLanguage = (ids: string[]) => LANGS.every((lang) => new Set(ids.map((id) => itemLabel(id, lang).toLowerCase())).size === ids.length);

describe("quiz-choice options", () => {
  it("contain the target and n labels unique in every UI language, deterministic for a seed", () => {
    for (const target of ["L-A", "L-M", "num-3", "w-hello", "w-me", "ph-name"]) {
      for (const n of [2, 3, 4]) {
        for (const similar of [false, true]) {
          for (const seed of [11, 12, 13]) {
            const a = buildOptions(target, n, createRng(seed), { similar, confusions: ["L-N", "w-bye"] });
            expect(a.choices).toContain(target);
            expect(a.choices).toHaveLength(n);
            expect(uniqueInEveryLanguage(a.choices), `${target} ${n} ${similar}`).toBe(true);
            expect(buildOptions(target, n, createRng(seed), { similar, confusions: ["L-N", "w-bye"] })).toEqual(a);
          }
        }
      }
    }
  });

  it("take distractors from the same unit first at low similarity", () => {
    const { choices, similarity } = buildOptions("L-B", 4, createRng(5));
    for (const id of choices) expect(getSign(id)?.unit).toBe("abc1");
    expect(similarity).toBe("low");
    expect(buildChoices("L-B", 4, createRng(5))).toEqual(choices);
  });

  it("use other phrases as distractors for a phrase", () => {
    for (const id of buildChoices("ph-name", 4, createRng(2))) expect(PHRASES.has(id)).toBe(true);
  });

  it("put the learner's confusions first at high similarity, keeping only the same kind", () => {
    const { choices, similarity } = buildOptions("w-hello", 3, createRng(3), { similar: true, confusions: ["L-A", "w-bye", "w-thank-you"] });
    expect(choices).toEqual(expect.arrayContaining(["w-hello", "w-bye", "w-thank-you"]));
    expect(choices).not.toContain("L-A");
    expect(similarity).toBe("high");
  });

  it("use look-alike letters at high similarity", () => {
    const fist = LETTER_GROUPS[0].map((l) => `L-${l}`);
    for (const seed of [1, 2, 3, 4]) {
      const { choices, similarity } = buildOptions("L-M", 4, createRng(seed), { similar: true });
      for (const id of choices) expect(fist).toContain(id);
      expect(similarity).toBe("high");
    }
  });

  it("report low similarity when nothing similar exists (a word with no confusions)", () => {
    expect(buildOptions("w-hello", 4, createRng(1), { similar: true }).similarity).toBe("low");
  });

  it("find look-alikes from the content only", () => {
    expect(lookAlikes("L-P", createRng(1))).toEqual(expect.arrayContaining(["L-K", "L-V"]));
    expect(lookAlikes("L-Q", createRng(1))).toContain("L-G");
    expect(lookAlikes("L-B", createRng(1))).toEqual([]);
    expect(lookAlikes("num-3", createRng(1))).toEqual([]);
    const sharing = phrasesSharingSigns("ph-water", createRng(1)); // YOU WANT WATER
    expect(sharing.length).toBeGreaterThan(0);
    for (const id of sharing) expect(PHRASES.get(id)!.signs.some((s) => ["w-you", "w-want", "w-water"].includes(s))).toBe(true);
  });
});
