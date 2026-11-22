/**
 * What a quiz-build card reports (pure, unit-tested; SPEC §4.6): one receptive `build` retrieval per
 * distinct sign of the phrase — right when the learner placed it at all, since recognising a sign is
 * what the receptive skill means — plus one for the phrase, right only in the exact ASL order.
 * "Right signs, wrong order" is said in the feedback, and shows in the evidence as every sign right
 * and the phrase wrong.
 */
import { PHRASES, itemLabel } from "../../content/curriculum";
import type { EvidenceDraft, TaskResult } from "../../core/types";
import type { Messages } from "../../i18n/en";
import type { Lang } from "../../i18n/langs";
import { QUIZ_BUILD } from "../learningConfig";
import { phraseNote } from "../ui/labels";
import { checkBuild } from "./tiles";

export function quizBuildResult(phraseId: string, built: readonly string[], t: Messages, lang: Lang, ms?: number): TaskResult {
  const phrase = PHRASES.get(phraseId);
  const signs = phrase?.signs ?? [];
  const check = checkBuild(signs, built);
  const placed = new Set(built);
  const retrieval = (itemId: string, correct: boolean): EvidenceDraft => ({
    itemId, skill: "receptive", kind: "retrieval", correct, check: "build", ...(ms !== undefined ? { ms } : {}),
  });
  const evidence = [...[...new Set(signs)].map((id) => retrieval(id, placed.has(id))), retrieval(phraseId, check.correct)];
  const right = evidence.filter((e) => e.correct).length;
  const note = phrase ? phraseNote(phrase, t, lang) : "";
  return {
    success: right / evidence.length,
    evidence,
    xp: check.correct ? QUIZ_BUILD.xp : check.wrongOrder ? QUIZ_BUILD.xpWrongOrder : 0,
    feedback: {
      correct: check.correct,
      answer: signs.map((id) => itemLabel(id, lang)).join(" · "),
      note: check.wrongOrder ? `${t.learning.build.wrongOrder} ${note}` : note,
    },
  };
}
