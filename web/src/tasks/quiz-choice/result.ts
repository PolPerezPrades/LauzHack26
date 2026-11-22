/**
 * What a quiz-choice card reports (pure, so the evidence mapping is unit-tested): one receptive
 * `choice` retrieval per question, with the options count, the distractor similarity, and what the
 * learner picked instead when wrong (`confusedWith`, fed back into distractors and minimal pairs).
 */
import { PHRASES } from "../../content/curriculum";
import type { EvidenceDraft, TaskResult } from "../../core/types";
import type { Messages } from "../../i18n/en";
import type { Lang } from "../../i18n/langs";
import { QUIZ_CHOICE } from "../learningConfig";
import { answerText, phraseNote } from "../ui/labels";

export interface QuizAnswer {
  item: string;
  chosen: string;
  options: number;
  similarity: "low" | "high";
  /** logged only (SPEC §7.10) */
  ms?: number;
}

export function quizChoiceResult(answers: readonly QuizAnswer[], t: Messages, lang: Lang): TaskResult {
  const evidence: EvidenceDraft[] = answers.map((a) => ({
    itemId: a.item,
    skill: "receptive",
    kind: "retrieval",
    correct: a.chosen === a.item,
    check: "choice",
    options: a.options,
    similarity: a.similarity,
    ...(a.ms !== undefined ? { ms: a.ms } : {}),
    ...(a.chosen === a.item ? {} : { confusedWith: a.chosen }),
  }));
  const wrong = answers.filter((a) => a.chosen !== a.item);
  const right = answers.length - wrong.length;
  const xp = answers.reduce((sum, a) => sum + (a.chosen === a.item ? (PHRASES.has(a.item) ? QUIZ_CHOICE.xp.phrase : QUIZ_CHOICE.xp.sign) : 0), 0);
  const success = answers.length ? right / answers.length : 0;

  if (answers.length === 1) {
    const a = answers[0];
    const phrase = PHRASES.get(a.item);
    return {
      success, evidence, xp,
      feedback: { correct: wrong.length === 0, answer: answerText(a.item, lang), ...(phrase ? { note: phraseNote(phrase, t, lang) } : {}) },
    };
  }
  return {
    success, evidence, xp,
    feedback: {
      correct: wrong.length === 0,
      ...(wrong.length ? { answer: wrong.map((a) => answerText(a.item, lang)).join(", ") } : {}),
      note: t.learning.quiz.summary(right, answers.length),
    },
  };
}
