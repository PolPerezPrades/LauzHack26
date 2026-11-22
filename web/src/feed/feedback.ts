/**
 * What the result banner adds to a task's own feedback (pure). A wrong answer's banner says what was
 * wrong (SPEC §3.4): for a card with one wrong choice, the option the learner picked instead, which
 * the task already logs as the evidence's `confusedWith`. Games and multi-item cards explain their
 * mistakes themselves.
 */
import type { TaskResult } from "../core/types";

/** The item id the learner chose instead of the answer, or undefined when there's no single wrong choice. */
export function wrongChoice(result: Pick<TaskResult, "score" | "feedback" | "evidence">): string | undefined {
  if (result.score !== undefined || result.feedback?.correct !== false) return undefined;
  const wrong = result.evidence.filter((e) => e.kind === "retrieval" && e.correct === false);
  const only = wrong.length === 1 ? wrong[0] : undefined;
  return only?.check === "choice" ? only.confusedWith : undefined;
}
