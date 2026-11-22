import { describe, expect, it } from "vitest";
import { itemKindOf } from "../content/curriculum";
import type { CardPlan, ItemKind, LearnerQueries } from "../core/types";
import { en } from "../i18n/en";
import { es } from "../i18n/es";
import { LEARNING_FORMATS } from "./learningFormats";
import { FORMATS, getFormat, needsCamera } from "./registry";
import { genContext, strictQueries } from "./testing";

/** Learner lists that always have something of the asked kinds (letters spell "CAB…"). */
const POOL: Record<ItemKind, string[]> = {
  letter: ["L-C", "L-A", "L-B", "L-D", "L-E"],
  number: ["num-3"],
  word: ["w-hello"],
  phrase: ["ph-deaf"],
};
const lists = (kinds: readonly ItemKind[], n: number) => kinds.flatMap((k) => POOL[k]).slice(0, n);
const full: Partial<LearnerQueries> = {
  frontier: lists,
  practice: (_skill, kinds, n) => lists(kinds, n),
  relearn: lists,
  probes: lists,
  pool: (_skill, kinds, n) => lists(kinds, n),
  eligiblePhrases: (n) => lists(["phrase"], n),
};

describe("learning formats", () => {
  it("registers lesson, quiz-choice, question and quiz-build for the feed's card sources", () => {
    expect(LEARNING_FORMATS.map((f) => f.id)).toEqual(["lesson", "quiz-choice", "question", "quiz-build"]);
    for (const f of LEARNING_FORMATS) {
      expect(getFormat(f.id)).toBe(f);
      // the simple picker takes every non-dev, non-system format from the registry
      expect(f.devOnly).toBeFalsy();
      expect(f.family).not.toBe("system");
      expect(FORMATS).toContain(f);
    }
  });

  it("all work without a camera (camera-optional formats switch to self-grading)", () => {
    for (const f of LEARNING_FORMATS) {
      expect(needsCamera(f)).toBe(false);
      expect(f.generate(strictQueries(full), genContext(1, 0, false)).length, f.id).toBeGreaterThan(0);
    }
  });

  it("propose items of the kinds they declare, only through the learner lists", () => {
    for (const f of LEARNING_FORMATS) {
      for (const seed of [1, 2, 3]) {
        const drafts = f.generate(strictQueries(full), genContext(seed));
        expect(drafts.length, f.id).toBeGreaterThan(0);
        for (const d of drafts) {
          expect(d.format).toBe(f.id);
          // quiz-build also targets the phrase's signs (SPEC §7.5), which aren't content to pick
          const picked = f.id === "quiz-build" ? d.items.slice(0, 1) : d.items;
          for (const id of picked) expect(f.requires.itemKinds, `${f.id} ${id}`).toContain(itemKindOf(id));
          expect(d.reasons?.length, f.id).toBeGreaterThan(0);
        }
      }
    }
  });

  it("propose nothing when the learner lists are empty (e.g. dev content of another kind)", () => {
    for (const f of LEARNING_FORMATS) expect(f.generate(strictQueries(), genContext()), f.id).toEqual([]);
  });

  it("preview every card they propose, in English and Spanish", () => {
    for (const f of LEARNING_FORMATS) {
      for (const d of f.generate(strictQueries(full), genContext())) {
        const plan: CardPlan = { cardId: "c", format: d.format, items: d.items, params: d.params, reasons: d.reasons ?? [] };
        for (const t of [en, es]) expect(f.preview(plan, t).trim(), f.id).not.toBe("");
      }
    }
  });

  it("expose dev params whose defaults stay within their bounds", () => {
    for (const f of LEARNING_FORMATS) {
      const params = f.params(0, genContext()) as Record<string, unknown>;
      for (const d of f.devParams ?? []) {
        const v = params[d.key];
        expect(typeof v, `${f.id}.${d.key}`).toBe("number");
        expect(v as number).toBeGreaterThanOrEqual(d.min);
        expect(v as number).toBeLessThanOrEqual(d.max);
      }
    }
  });
});
