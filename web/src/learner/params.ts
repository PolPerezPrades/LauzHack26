/**
 * Every constant of the learner model (SPEC §7.3–§7.7, §7.11), in one module so that tuning never
 * means hunting through the fold. A change that alters behaviour is a decision (docs/parts/C.md).
 * The recommender's own scoring constants (feature weights, fit width, top-5 softmax temperature)
 * belong to recommender/config.ts (Part D, D-C02).
 */
import type { CheckMode, FormatId, Skill } from "../core/types";

// ── Knowledge: BKT (§7.3, §7.4) ────────────────────────────────────────────────────────────────

/** pKnown of an (item, skill) the first time it is touched */
export const P0 = 0.1;
/** pKnown stays inside [P_MIN, P_MAX] after every update */
export const P_MIN = 0.01;
export const P_MAX = 0.99;

/** guess g, slip s and learn T of one check mode */
export interface BktParams {
  readonly g: number;
  readonly s: number;
  readonly T: number;
}

/** check modes with fixed parameters (§7.4); choice and game depend on the evidence */
export const BKT_FIXED: Readonly<Record<"build" | "typed" | "camera" | "mirror" | "self", BktParams>> = {
  build: { g: 0.05, s: 0.1, T: 0.15 },
  typed: { g: 0.02, s: 0.1, T: 0.15 },
  camera: { g: 0.05, s: 0.15, T: 0.2 },
  mirror: { g: 0.3, s: 0.1, T: 0.2 },
  self: { g: 0.35, s: 0.1, T: 0.15 },
};
/** `choice` with n options: g = 1/n; s rises when the distractors are highly similar */
export const BKT_CHOICE = { s: 0.1, highSimilaritySlip: 0.05, T: 0.15, defaultOptions: 4 } as const;
/** `game`: g = 1/n for choice games (options logged); `defaultGuess` when a game logs no options */
export const BKT_GAME = { s: 0.2, T: 0.1, defaultGuess: 0.25 } as const;
/** exposure (a lesson watched, nothing asked): p' = p + (1 − p)·T_EXPOSE */
export const T_EXPOSE = 0.5;

/** status `known` from KNOWN_ENTER, kept until pKnown < KNOWN_LEAVE (hysteresis, §7.3) */
export const KNOWN_ENTER = 0.85;
export const KNOWN_LEAVE = 0.7;

/** `verified` = pKnown ≥ VERIFIED_P AND (a correct STRONG_CHECKS answer OR correct answers on VERIFIED_DAYS days) */
export const VERIFIED_P = 0.85;
export const VERIFIED_DAYS = 2;
export const STRONG_CHECKS: readonly CheckMode[] = ["camera", "typed", "build"];

/** last errors kept per (item, skill) */
export const MAX_ERRORS_KEPT = 10;

// ── Memory: FSRS (§7.4) ────────────────────────────────────────────────────────────────────────

/** an item is due once its retrievability drops below this (also FSRS's request_retention) */
export const TARGET_RETENTION = 0.9;

// ── Accuracy and challenge (§7.3, §7.6) ────────────────────────────────────────────────────────

/** accuracy EMA over retrievals, as in the old profile */
export const ACCURACY_START = 0.82;
export const ACCURACY_ALPHA = 0.12;

export const CHALLENGE_MIN = -1;
export const CHALLENGE_MAX = 1;
/** after each completed card with retrievals: c += SUCCESS_GAIN·(success − SUCCESS_TARGET) */
export const SUCCESS_GAIN = 0.3;
export const SUCCESS_TARGET = 0.8;
/** back-off: BACKOFF_WRONGS wrong retrievals in a row → c += BACKOFF_STEP (at most once per card) */
export const BACKOFF_WRONGS = 3;
export const BACKOFF_STEP = -0.2;
/** target success = clamp(base + perC·c, min, max) */
export const TARGET_SUCCESS = { base: 0.8, perC: -0.1, min: 0.65, max: 0.92 } as const;

// ── Swipes (§7.5) ──────────────────────────────────────────────────────────────────────────────

/** challenge steps (c: global, cf: the card's format) and pKnown floors of each row */
export const SWIPE = {
  /** too easy after completing: floor for the items answered correctly */
  tooEasyDone: { c: 0.1, cf: 0.1, pKnownFloor: 0.9 },
  /** too easy before completing, item new: a claim */
  tooEasyNew: { c: 0.15, cf: 0.1, pKnownFloor: 0.75 },
  /** too easy before completing, item met: treated as a self-graded Easy */
  tooEasyMet: { c: 0.15, cf: 0.1, pKnownFloor: 0.85 },
  tooHardDone: { c: -0.2, cf: -0.15 },
  tooHardNew: { c: -0.25, cf: -0.15 },
  /** too hard before completing, item met: pKnown ×= pKnownFactor */
  tooHardMet: { c: -0.25, cf: -0.15, pKnownFactor: 0.6 },
} as const;
/** a completed card (next, too easy, too hard): alpha += COMPLETED_ALPHA */
export const COMPLETED_ALPHA = 1;
/** "not this format": beta += DISLIKE_BETA */
export const DISLIKE_BETA = 2;
/** "too hard" on a new item: not offered as new before card #(this card + COOLDOWN_CARDS) */
export const COOLDOWN_CARDS = 10;
/** after each card, alpha and beta relax towards 1: x ← 1 + (x − 1)·PREF_DECAY (mutes don't decay) */
export const PREF_DECAY = 0.99;
/** mute when dislikes ≥ MUTE_MIN_DISLIKES and dislikes > MUTE_COMPLETIONS_FACTOR × completions */
export const MUTE_MIN_DISLIKES = 3;
export const MUTE_COMPLETIONS_FACTOR = 2;

// ── Curriculum, pacing, self-placement (§7.7) ──────────────────────────────────────────────────

/** a unit opens when UNLOCK_SHARE of the previous unit's items have pKnown ≥ UNLOCK_PKNOWN */
export const UNLOCK_SHARE = 0.6;
export const UNLOCK_PKNOWN = 0.5;
/** numbers open when this share of abc1 is met */
export const NUMBERS_UNLOCK_MET = 0.6;
/** a phrase is eligible when this share of its signs is known (receptive) and all are met */
export const PHRASE_KNOWN_SHARE = 0.7;
/** maxInFlight = round(PACING_BASE + PACING_PER_C·c); no new lessons from OVERDUE_CAP overdue reviews */
export const PACING_BASE = 4;
export const PACING_PER_C = 2;
export const OVERDUE_CAP = 8;
/** test-out: TEST_OUT_UNIT "too easy" claims in a row in one unit, or TEST_OUT_TRACK in one track */
export const TEST_OUT_UNIT = 2;
export const TEST_OUT_TRACK = 3;
/** pKnown of the items a test-out claims, and how many of them the verification probe covers */
export const TEST_OUT_P = 0.6;
export const TEST_OUT_PROBES = 3;

// ── Windows, in cards (§7.7, §7.8.3) ───────────────────────────────────────────────────────────

/** relearn window: failed (or "too hard") this many cards ago */
export const RELEARN_WINDOW = { min: 3, max: 6 } as const;
/** verification probes are due this many cards after the claim */
export const PROBE_WINDOW = { min: 5, max: 10 } as const;

// ── Formats as the fold sees them (D-C04) ──────────────────────────────────────────────────────

/**
 * Formats whose cards teach nothing (the tutorial, dev probes): their exits change no learner state.
 * learner/ doesn't read the task registry (formats and generators sit above it), so it goes by id.
 */
export const NON_LEARNING_PREFIXES: readonly string[] = ["system-", "dev-"];

/**
 * Skills a format trains, for the swipes that come before any evidence (a card left unanswered).
 * Cards with evidence use the skills of their evidence instead. Games have no target items.
 */
export function formatSkills(format: FormatId): readonly Skill[] {
  if (format === "lesson" || format.startsWith("lesson-")) return ["receptive", "productive"];
  if (format === "question" || format.startsWith("question-")) return ["productive"];
  return ["receptive"];
}

export const isLearningFormat = (format: FormatId) => !NON_LEARNING_PREFIXES.some((p) => format.startsWith(p));
