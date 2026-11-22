/** Feed constants (SPEC §3.3–§3.4 defaults). Tune here only; record behaviour changes as decisions. */
export const FEED = {
  /** every exit: same duration and easing (ease-in) */
  exitMs: 280,
  /** prefers-reduced-motion: short fade + small translate */
  reducedExitMs: 180,
  reducedShiftPx: 24,
  springMs: 220,
  /** horizontal exits end rotated by this much; drags rotate up to dragRotateDeg */
  exitRotateDeg: 15,
  dragRotateDeg: 12,
  /** under this movement a pointer is a tap, not a swipe */
  tapSlopPx: 8,
  /** pointer samples used for the release velocity */
  velocityWindowMs: 100,
  /** below this drag progress a spring-back is silent */
  springSoundProgress: 0.3,
  /**
   * Every result leaves on its own with the Next exit (SPEC §3.4, Part A2). These are the waits
   * before that exit starts; the exit animation itself is exitMs, shared by every exit.
   */
  autoAdvanceCorrectMs: 600,
  /** reading time for a correction: clamp(baseMs + perCharMs × characters of the answer and the note, minMs, maxMs) */
  autoAdvanceWrong: { baseMs: 2000, perCharMs: 30, minMs: 2500, maxMs: 5000 },
  /** game end screens (score and best) */
  autoAdvanceGameMs: 2500,
  /** a result without feedback shows no banner and leaves as fast as a correct answer */
  autoAdvanceNoFeedbackMs: 600,
  behindScale: 0.95,
  behindOffsetPx: 10,
} as const;

export interface SwipeConfig {
  /** commit by distance: share of the card width (horizontal) or height (vertical) */
  horizontalFrac: number;
  verticalFrac: number;
  /** commit by flick: at least this far, at least this fast in the same direction */
  flickMinPx: number;
  flickSpeed: number; // px/ms
}

export const SWIPE: SwipeConfig = {
  horizontalFrac: 0.28,
  verticalFrac: 0.22,
  flickMinPx: 40,
  flickSpeed: 0.6,
};
