/**
 * What a question reports (pure, unit-tested). Every evidence is a productive retrieval, checked
 * by the camera, the mirror or self-grading (flagged `selfGraded` unless the camera decided):
 *   sign-term      one evidence for the item;
 *   sign-sentence  one for each distinct sign of the phrase, plus one for the phrase (SPEC §4.4, §7.3);
 *   spell-word     one per distinct letter: right only if every time it appears was right.
 */
import { PHRASES, itemLabel } from "../../content/curriculum";
import { isSelfGraded, type ProductiveCheck } from "../../camera/checkMode";
import type { EvidenceDraft, TaskResult } from "../../core/types";
import type { Messages } from "../../i18n/en";
import type { Lang } from "../../i18n/langs";
import { QUESTION } from "../learningConfig";
import { itemName, phraseNote } from "../ui/labels";
import { letterOfId } from "./spell";

export interface Attempt {
  mode: ProductiveCheck;
  correct: boolean;
  confusedWith?: string;
  hints?: number;
  /** logged only (SPEC §7.10) */
  ms?: number;
}

function retrieval(itemId: string, a: Attempt): EvidenceDraft {
  return {
    itemId,
    skill: "productive",
    kind: "retrieval",
    correct: a.correct,
    check: a.mode,
    ...(isSelfGraded(a.mode) ? { selfGraded: true } : {}),
    ...(a.hints ? { hints: a.hints } : {}),
    ...(a.confusedWith && !a.correct ? { confusedWith: a.confusedWith } : {}),
    ...(a.ms !== undefined ? { ms: a.ms } : {}),
  };
}

export function signTermResult(itemId: string, a: Attempt, t: Messages, lang: Lang, note?: string): TaskResult {
  return {
    success: a.correct ? 1 : 0,
    evidence: [retrieval(itemId, a)],
    xp: a.correct ? QUESTION.xp["sign-term"] : 0,
    feedback: { correct: a.correct, answer: itemName(itemId, t, lang), ...(note && !a.correct ? { note } : {}) },
  };
}

export function signSentenceResult(phraseId: string, a: Attempt, t: Messages, lang: Lang): TaskResult {
  const phrase = PHRASES.get(phraseId);
  const signs = [...new Set(phrase?.signs ?? [])];
  return {
    success: a.correct ? 1 : 0,
    evidence: [...signs, phraseId].map((id) => retrieval(id, { mode: a.mode, correct: a.correct })),
    xp: a.correct ? QUESTION.xp["sign-sentence"] : 0,
    feedback: { correct: a.correct, answer: phrase?.[lang] ?? itemLabel(phraseId, lang), ...(phrase ? { note: phraseNote(phrase, t, lang) } : {}) },
  };
}

export interface LetterAttempt extends Attempt {
  /** the letter as an item id ("L-C") */
  letter: string;
}

export function spellWordResult(word: string, letters: readonly LetterAttempt[], t: Messages): TaskResult {
  const byLetter = new Map<string, LetterAttempt[]>();
  for (const l of letters) byLetter.set(l.letter, [...(byLetter.get(l.letter) ?? []), l]);
  const evidence = [...byLetter].map(([id, tries]) => {
    const firstWrong = tries.find((x) => !x.correct);
    const ms = tries.reduce((sum, x) => sum + (x.ms ?? 0), 0);
    return retrieval(id, { mode: tries[0].mode, correct: !firstWrong, ...(firstWrong?.confusedWith ? { confusedWith: firstWrong.confusedWith } : {}), ...(ms ? { ms } : {}) });
  });
  const right = evidence.filter((e) => e.correct).length;
  const success = evidence.length ? right / evidence.length : 0;
  const skipped = [...new Set(letters.filter((l) => !l.correct).map((l) => letterOfId(l.letter) ?? l.letter))];
  return {
    success,
    evidence,
    xp: Math.round(QUESTION.xp["spell-word"] * success),
    feedback: { correct: skipped.length === 0, answer: word, ...(skipped.length ? { note: t.learning.question.skipped(skipped.join(", ")) } : {}) },
  };
}
