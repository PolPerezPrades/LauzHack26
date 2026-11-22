/**
 * Bayesian knowledge tracing (SPEC §7.4): how one answer moves pKnown, with guess and slip chosen by
 * how the answer was checked, so a guessable 4-option quiz counts less than a camera-checked sign.
 * Pure math, no state.
 */
import type { CheckMode, EvidenceDraft } from "../core/types";
import { BKT_CHOICE, BKT_FIXED, BKT_GAME, P_MAX, P_MIN, T_EXPOSE, type BktParams } from "./params";

export const clampP = (p: number) => Math.min(P_MAX, Math.max(P_MIN, p));

type CheckInput = Pick<EvidenceDraft, "check" | "options" | "similarity" | "selfGraded">;

const guessOf = (options: number | undefined, fallback: number) =>
  options !== undefined && Number.isFinite(options) ? 1 / Math.max(2, Math.round(options)) : fallback;

/**
 * Guess, slip and learn of one retrieval, or null when the check tested nothing (`none`).
 * A self-graded answer weighs like a `self` check whatever mode it ran in (D-C06), except `mirror`,
 * which is already a self-grade.
 */
export function checkParams(e: CheckInput): BktParams | null {
  const check: CheckMode = e.selfGraded && e.check !== "mirror" && e.check !== "none" ? "self" : e.check;
  switch (check) {
    case "none":
      return null;
    case "choice":
      return {
        g: guessOf(e.options ?? BKT_CHOICE.defaultOptions, 1 / BKT_CHOICE.defaultOptions),
        s: BKT_CHOICE.s + (e.similarity === "high" ? BKT_CHOICE.highSimilaritySlip : 0),
        T: BKT_CHOICE.T,
      };
    case "game":
      return { g: guessOf(e.options, BKT_GAME.defaultGuess), s: BKT_GAME.s, T: BKT_GAME.T };
    default:
      return BKT_FIXED[check];
  }
}

/** Posterior after one answer, then the learning step (§7.4). */
export function bktRetrieval(p: number, correct: boolean, { g, s, T }: BktParams): number {
  const post = correct ? (p * (1 - s)) / (p * (1 - s) + (1 - p) * g) : (p * s) / (p * s + (1 - p) * (1 - g));
  return clampP(post + (1 - post) * T);
}

/** A lesson watched, nothing asked. */
export function bktExposure(p: number): number {
  return clampP(p + (1 - p) * T_EXPOSE);
}
