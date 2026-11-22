/**
 * Constants of the learning formats (SPEC §4.3–§4.6), and how each maps the effective challenge
 * level ce ∈ [−1, 1] to its parameters (SPEC §7.6). Tune here only; record behaviour changes as
 * decisions in docs/parts/B.md.
 */

export const LESSON = {
  /** XP when the try succeeded / when it didn't (the lesson still taught something) */
  xpCorrect: 10,
  xpTried: 5,
  /** candidates proposed per call: frontier items (new lessons) and relearn items */
  frontier: 3,
  relearn: 2,
} as const;

export const QUESTION = {
  xp: { "sign-term": 12, "sign-sentence": 15, "spell-word": 15 },
  /** candidates proposed per call */
  terms: 3,
  phrases: 2,
  /** letters asked from the queries when looking for a word to fingerspell */
  letters: 26,
} as const;

export const QUIZ_CHOICE = {
  xp: { sign: 10, phrase: 12 },
  /** a verification probe asks about up to this many claimed items in one card (SPEC §7.7) */
  probeItems: 3,
  /** single-item candidates proposed per call */
  practice: 4,
  /** learner confusions used as distractors, at most */
  maxConfusions: 2,
  /** pause on the marked answer before the next question of a multi-question card */
  nextQuestionMs: 700,
  /** ce from which distractors are high-similarity (confusions and look-alikes first) */
  similarFrom: 0.3,
  /** ce from which slow motion is off (the viewer controls are hidden; the sign still loops) */
  noSlowFrom: 0.5,
  /** ce from which the sign plays once, with no replay */
  noReplayFrom: 0.8,
} as const;

export const QUIZ_BUILD = {
  xp: 15,
  /** right signs in the wrong order */
  xpWrongOrder: 5,
  phrases: 3,
} as const;

/** Live camera checks (CameraCheck), from the old Imitate and SignSprint activities. */
export const CAMERA_CHECK = {
  /** consecutive good frames that pass a sign (~0.4 s at 30 fps) */
  holdFrames: 12,
  /** per letter while fingerspelling a word */
  spellHoldFrames: 8,
  /** a bad frame takes this many frames off the hold */
  decay: 2,
  /** frames in which the hand matched another sign before it counts as a confusion */
  confusionFrames: 10,
  /** the skip button stands out after this long without success */
  stuckMs: 15000,
  /** React updates at most this often; detection runs on every frame */
  uiMs: 120,
} as const;

export const MIRROR = {
  /**
   * The mirror keeps the last ~4 s: two recorders restart every `segmentMs`, half a segment apart,
   * and "done" keeps the longer of the two running clips, i.e. the last segmentMs/2 … segmentMs.
   */
  segmentMs: 5000,
} as const;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** quiz-choice options: 4 by default, fewer when the learner needs it easier (D-030). */
export function optionsFor(ce: number): number {
  return ce <= -0.6 ? 2 : ce <= -0.2 ? 3 : 4;
}
export const clampOptions = (n: number) => clamp(Math.round(n), 2, 4);

/** quiz-build distractor tiles: 2–4 (SPEC §4.6). */
export function distractorTilesFor(ce: number): number {
  return ce < -0.3 ? 2 : ce < 0.3 ? 3 : 4;
}

/** question sign-sentence: the longest sentence offered (signs). */
export function maxSignsFor(ce: number): number {
  return ce < -0.3 ? 2 : ce < 0.3 ? 3 : 4;
}

/** question spell-word: word length range (letters). */
export function wordLengthFor(ce: number): { minLetters: number; maxLetters: number } {
  return ce < -0.3 ? { minLetters: 2, maxLetters: 3 } : ce < 0.3 ? { minLetters: 3, maxLetters: 4 } : { minLetters: 4, maxLetters: 6 };
}
