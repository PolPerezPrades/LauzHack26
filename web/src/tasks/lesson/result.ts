/**
 * What a lesson reports (pure, unit-tested): watching the sign is an `exposure` of the receptive
 * skill; the try is a productive `retrieval` checked by the camera, the mirror or self-grading
 * (SPEC §4.3). Self-graded tries are flagged, and the times the learner asked to see the sign again
 * are logged as hints.
 */
import type { EvidenceDraft, TaskResult } from "../../core/types";
import type { Messages } from "../../i18n/en";
import type { Lang } from "../../i18n/langs";
import { isSelfGraded, type ProductiveCheck } from "../../camera/checkMode";
import { LESSON } from "../learningConfig";
import { itemName } from "../ui/labels";

export interface LessonTry {
  mode: ProductiveCheck;
  correct: boolean;
  /** times the reference was shown again before "I did it" (self mode) */
  hints?: number;
  /** camera: the sign the hand kept matching instead */
  confusedWith?: string;
  /** logged only (SPEC §7.10) */
  ms?: number;
  /** what to tell the learner after a failed try (defaults to "it will come back soon") */
  note?: string;
}

export function lessonResult(itemId: string, attempt: LessonTry, t: Messages, lang: Lang): TaskResult {
  const retrieval: EvidenceDraft = {
    itemId,
    skill: "productive",
    kind: "retrieval",
    correct: attempt.correct,
    check: attempt.mode,
    ...(isSelfGraded(attempt.mode) ? { selfGraded: true } : {}),
    ...(attempt.hints ? { hints: attempt.hints } : {}),
    ...(attempt.confusedWith && !attempt.correct ? { confusedWith: attempt.confusedWith } : {}),
    ...(attempt.ms !== undefined ? { ms: attempt.ms } : {}),
  };
  return {
    success: attempt.correct ? 1 : 0,
    evidence: [{ itemId, skill: "receptive", kind: "exposure", check: "none" }, retrieval],
    xp: attempt.correct ? LESSON.xpCorrect : LESSON.xpTried,
    feedback: {
      correct: attempt.correct,
      answer: itemName(itemId, t, lang),
      ...(attempt.correct ? {} : { note: attempt.note ?? t.learning.lesson.comeBack }),
    },
  };
}
