/**
 * question (SPEC §4.4): like a lesson, but without showing how first, and only for items the
 * learner has met. Variants:
 *   sign-term      "Sign: thank you" (a letter, number or word) — camera / mirror / self
 *   sign-sentence  a phrase in the UI language, signed in ASL order — mirror / self
 *   spell-word     "Fingerspell: CAB" — camera letter by letter (J, Z confirmed), or self
 *
 * Items come only from the learner queries (D-042): `practice` for the productive skill (terms and
 * the letters a word may use) and `eligiblePhrases` for sentences. With no variant forced, the
 * variants are tried in a seeded random order, so the simple picker's first draft varies.
 */
import { PHRASES, itemKindOf } from "../../content/curriculum";
import { shuffle } from "../../core/rng";
import type { CandidateDraft, ItemKind, TaskSpec } from "../../core/types";
import { QUESTION, maxSignsFor, wordLengthFor } from "../learningConfig";
import { previewName } from "../ui/labels";
import { pickWord, wordLetters } from "./spell";

export const QUESTION_ID = "question";

export type QuestionVariant = "sign-term" | "sign-sentence" | "spell-word";
export const QUESTION_VARIANTS: readonly QuestionVariant[] = ["sign-term", "sign-sentence", "spell-word"];

export type QuestionParams = {
  /** dev: 0 = any variant, 1 = sign-term, 2 = sign-sentence, 3 = spell-word */
  only: number;
  /** the longest sentence offered (signs) */
  maxSigns: number;
  /** the word length range to fingerspell (letters) */
  minLetters: number;
  maxLetters: number;
  /** set by generate() */
  variant?: QuestionVariant;
  /** spell-word: the word to fingerspell */
  word?: string;
};

export const TERM_KINDS: ItemKind[] = ["letter", "number", "word"];

const int = (x: number | undefined, fallback: number, lo: number, hi: number) =>
  x === undefined || !Number.isFinite(x) ? fallback : Math.max(lo, Math.min(hi, Math.round(x)));

export function questionParams(ce: number): QuestionParams {
  return { only: 0, maxSigns: maxSignsFor(ce), ...wordLengthFor(ce) };
}

function normalize(p: Partial<QuestionParams>, ce: number): QuestionParams {
  const auto = questionParams(ce);
  const minLetters = int(p.minLetters, auto.minLetters, 2, 6);
  return {
    only: int(p.only, 0, 0, 3),
    maxSigns: int(p.maxSigns, auto.maxSigns, 2, 4),
    minLetters,
    maxLetters: Math.max(minLetters, int(p.maxLetters, auto.maxLetters, 2, 6)),
  };
}

export const question: TaskSpec<QuestionParams> = {
  id: QUESTION_ID,
  family: "question",
  icon: "✋",
  i18nKey: QUESTION_ID,
  requires: { camera: "optional", itemKinds: ["letter", "number", "word", "phrase"] },
  trains: ["productive"],
  seconds: 30,
  devParams: [
    { key: "only", kind: "int", min: 0, max: 3 },
    { key: "maxSigns", kind: "int", min: 2, max: 4 },
    { key: "minLetters", kind: "int", min: 2, max: 6 },
    { key: "maxLetters", kind: "int", min: 2, max: 6 },
  ],
  params: (ce) => questionParams(ce),
  generate(q, ctx, params) {
    const p = normalize(params ?? {}, ctx.ce);
    const order = p.only ? [QUESTION_VARIANTS[p.only - 1]] : shuffle(ctx.rng, QUESTION_VARIANTS);
    const drafts: CandidateDraft<QuestionParams>[] = [];
    for (const variant of order) {
      if (variant === "sign-term") {
        const terms = q.practice("productive", TERM_KINDS, QUESTION.terms).filter((id) => {
          const kind = itemKindOf(id);
          return kind !== undefined && kind !== "phrase";
        });
        for (const id of terms) drafts.push({ format: QUESTION_ID, items: [id], params: { ...p, variant }, reasons: [{ code: "practice", item: id }] });
      } else if (variant === "sign-sentence") {
        const phrases = q.eligiblePhrases(QUESTION.phrases * 3).filter((id) => PHRASES.has(id));
        const short = phrases.filter((id) => PHRASES.get(id)!.signs.length <= p.maxSigns);
        for (const id of (short.length ? short : phrases).slice(0, QUESTION.phrases)) {
          drafts.push({ format: QUESTION_ID, items: [id], params: { ...p, variant }, reasons: [{ code: "eligible_phrase", item: id }] });
        }
      } else {
        const word = pickWord(q.practice("productive", ["letter"], QUESTION.letters), p, ctx.rng);
        if (word) drafts.push({ format: QUESTION_ID, items: wordLetters(word), params: { ...p, variant, word }, reasons: [{ code: "spell_word", word }] });
      }
    }
    return drafts;
  },
  preview: (plan, t) =>
    plan.params.variant === "spell-word" && plan.params.word
      ? t.learning.question.spell(plan.params.word)
      : t.learning.question.signIt(previewName(plan.items[0] ?? "", t)),
};
