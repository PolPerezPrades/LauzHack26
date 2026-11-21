/**
 * quiz-choice (SPEC §4.5): a sign (letter, number, word) or a phrase is shown, and the learner picks
 * its meaning among n options. Ported from the old Recognition / Quiz activities. The options are
 * built here, at plan time, so `card.shown` logs exactly what the learner saw.
 */
import { itemKindOf } from "../../content/curriculum";
import type { ItemKind, TaskSpec } from "../../core/types";
import type { Messages } from "../../i18n/en";
import { buildChoices } from "./choices";

export const QUIZ_CHOICE_ID = "quiz-choice";

export type QuizChoiceParams = {
  /** number of options, 2–4 */
  options: number;
  /** the options in display order (target included); built by generate() */
  choices?: string[];
};

const KINDS: ItemKind[] = ["letter", "number", "word", "phrase"];

/** XP for a correct answer. */
export const QUIZ_XP = { sign: 10, phrase: 12 } as const;

/** Challenge → options: 4 by default, fewer when the learner needs it easier (SPEC §4.5). */
export function optionsFor(ce: number): number {
  return ce <= -0.6 ? 2 : ce <= -0.2 ? 3 : 4;
}
const clampOptions = (n: number) => Math.max(2, Math.min(4, Math.round(n)));

export function quizPrompt(id: string, t: Messages): string {
  switch (itemKindOf(id)) {
    case "letter": return t.quiz.letter;
    case "number": return t.quiz.number;
    case "phrase": return t.quiz.phrase;
    case "word": return t.quiz.word;
    default: return t.quiz.sign;
  }
}

export const quizChoice: TaskSpec<QuizChoiceParams> = {
  id: QUIZ_CHOICE_ID,
  family: "quiz",
  icon: "👀",
  i18nKey: QUIZ_CHOICE_ID,
  requires: { camera: "none", itemKinds: KINDS },
  trains: ["receptive"],
  seconds: 15,
  devParams: [{ key: "options", kind: "int", min: 2, max: 4 }],
  params: (ce) => ({ options: optionsFor(ce) }),
  generate(q, ctx, params) {
    const options = clampOptions(params?.options ?? optionsFor(ctx.ce));
    return q.nextItems(KINDS, 1)
      .filter((id) => itemKindOf(id) !== undefined)
      .map((id) => ({ format: QUIZ_CHOICE_ID, items: [id], params: { options, choices: buildChoices(id, options, ctx.rng) } }));
  },
  preview: (plan, t) => quizPrompt(plan.items[0] ?? "", t),
};
