/**
 * quiz-choice (SPEC §4.5): a sign (letter, number, word) or a phrase is shown, and the learner picks
 * its meaning among n options. Ported from the old Recognition / Quiz activities. The options are
 * built here, at plan time, so `card.shown` logs exactly what the learner saw.
 *
 * Items: verification probes first (one card asks about up to 3 claimed items, SPEC §7.7), then
 * met items to practise for the receptive skill, most urgent first — only through the learner
 * queries (D-042).
 */
import { itemKindOf } from "../../content/curriculum";
import type { CandidateDraft, ItemKind, LearnerQueries, Rng, TaskSpec } from "../../core/types";
import type { Messages } from "../../i18n/en";
import { QUIZ_CHOICE, clampOptions, optionsFor } from "../learningConfig";
import { buildOptions } from "./choices";

export { optionsFor } from "../learningConfig";

export const QUIZ_CHOICE_ID = "quiz-choice";

export type QuizChoiceParams = {
  /** number of options, 2–4 */
  options: number;
  /** 1 = high-similarity distractors (the learner's confusions and look-alikes first) */
  similar: number;
  /** 1 = the sign loops; 0 = it plays once, with no replay */
  replay: number;
  /** 1 = the viewer controls (replay, slow motion, real video) are shown */
  slow: number;
  /** dev: 0 = auto (a probe card first when claimed items wait), 1 = practice only, 2 = probes only */
  probe: number;
  /** a single question: its options in display order, target included (as in Part A); built by generate() */
  choices?: string[];
  /** a verification probe: one option list per target item; built by generate() */
  sets?: string[][];
  /** per target item: "high" when a confusion or look-alike made it into its options */
  similarity?: ("low" | "high")[];
};

const KINDS: ItemKind[] = ["letter", "number", "word", "phrase"];

/** XP for a correct answer (per item). */
export const QUIZ_XP = QUIZ_CHOICE.xp;

export function quizPrompt(id: string, t: Messages): string {
  switch (itemKindOf(id)) {
    case "letter": return t.quiz.letter;
    case "number": return t.quiz.number;
    case "phrase": return t.quiz.phrase;
    case "word": return t.quiz.word;
    default: return t.quiz.sign;
  }
}

const flag = (x: number | undefined, fallback: number) => (x === undefined || !Number.isFinite(x) ? fallback : x >= 1 ? 1 : 0);

function normalize(p: Partial<QuizChoiceParams>, ce: number): QuizChoiceParams {
  const auto = quizChoiceParams(ce);
  return {
    options: clampOptions(p.options ?? auto.options),
    similar: flag(p.similar, auto.similar),
    replay: flag(p.replay, auto.replay),
    slow: flag(p.slow, auto.slow),
    probe: Math.max(0, Math.min(2, Math.round(p.probe ?? auto.probe))),
  };
}

export function quizChoiceParams(ce: number): QuizChoiceParams {
  return {
    options: optionsFor(ce),
    similar: ce >= QUIZ_CHOICE.similarFrom ? 1 : 0,
    replay: ce >= QUIZ_CHOICE.noReplayFrom ? 0 : 1,
    slow: ce >= QUIZ_CHOICE.noSlowFrom ? 0 : 1,
    probe: 0,
  };
}

function draft(items: string[], code: string, p: QuizChoiceParams, q: LearnerQueries, rng: Rng): CandidateDraft<QuizChoiceParams> {
  const built = items.map((id) => buildOptions(id, p.options, rng, { similar: p.similar === 1, confusions: q.confusions(id), maxConfusions: QUIZ_CHOICE.maxConfusions }));
  const options = items.length === 1 ? { choices: built[0].choices } : { sets: built.map((b) => b.choices) };
  return {
    format: QUIZ_CHOICE_ID,
    items,
    params: { ...p, ...options, similarity: built.map((b) => b.similarity) },
    reasons: items.map((item) => ({ code, item })),
  };
}

export const quizChoice: TaskSpec<QuizChoiceParams> = {
  id: QUIZ_CHOICE_ID,
  family: "quiz",
  icon: "👀",
  i18nKey: QUIZ_CHOICE_ID,
  requires: { camera: "none", itemKinds: KINDS },
  trains: ["receptive"],
  seconds: 15,
  devParams: [
    { key: "options", kind: "int", min: 2, max: 4 },
    { key: "similar", kind: "int", min: 0, max: 1 },
    { key: "replay", kind: "int", min: 0, max: 1 },
    { key: "slow", kind: "int", min: 0, max: 1 },
    { key: "probe", kind: "int", min: 0, max: 2 },
  ],
  params: (ce) => quizChoiceParams(ce),
  generate(q, ctx, params) {
    const p = normalize(params ?? {}, ctx.ce);
    const known = (id: string) => itemKindOf(id) !== undefined;
    const drafts: CandidateDraft<QuizChoiceParams>[] = [];
    const probes = p.probe === 1 ? [] : q.probes(KINDS, QUIZ_CHOICE.probeItems).filter(known);
    if (probes.length) drafts.push(draft(probes, "verification_probe", p, q, ctx.rng));
    if (p.probe !== 2) {
      for (const id of q.practice("receptive", KINDS, QUIZ_CHOICE.practice).filter(known)) {
        if (!probes.includes(id)) drafts.push(draft([id], "practice", p, q, ctx.rng));
      }
    }
    return drafts;
  },
  preview: (plan, t) => quizPrompt(plan.items[0] ?? "", t),
};
