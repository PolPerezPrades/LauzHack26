/**
 * Tuning constants of the sign viewer (Part H): avatar motion clean-up and drawing proportions.
 * One place, so changes are easy to find and to record as decisions (docs/parts/H.md).
 */

export const AVATAR = {
  /** frames per second of the precomputed playback frames (the source clips are ~15 fps) */
  fps: 60,
  /**
   * Drawn hand size relative to life, for legibility on a phone. The hand is scaled about its
   * knuckles (not the wrist), so fingertips stay close to where the real ones touch the face or
   * the body: location is part of the sign.
   */
  handScale: 1.3,
  /** seconds over which a hand that stops (or starts) being tracked blends to (from) a relaxed hand */
  fadeSeconds: 0.6,
  /** a detection whose palm differs from the clip's median by more than this fraction is dropped (motion blur) */
  palmTolerance: 0.3,
  /** gaps of up to this many source frames inside a tracked run are interpolated, not faded */
  maxGap: 3,
  /** tracked runs shorter than this many source frames are flicker, not tracking */
  minRun: 3,
  /**
   * Gaussian smoothing, sigma in SOURCE frames (~15 fps), applied before the B-spline resampling
   * (which adds a [1 4 1]/6 of its own). The extractor already applied [1 2 1] once.
   *   body: every joint, always (light: taps and contacts are fast);
   *   untracked: an arm whose hand is lost, instead of `body`;
   *   transition: added on an arm whose hand is below the signing space (rising, dropping);
   *   handShape: the bone directions of a tracked hand (MediaPipe depth noise).
   */
  sigma: { body: 0.5, untracked: 2.2, transition: 2.0, handShape: 1.0 },
  /** a bone's clip median may differ from the anatomical ratio (× palm length) by this factor at most */
  boneRatioClamp: [0.75, 1.3] as const,
  /** palm length (wrist → middle knuckle) used when no hand is tracked in a clip, metres */
  defaultPalm: 0.09,
  /** how much the elbow leans towards its natural direction (down, out, back) on top of the measured one */
  elbowBias: 0.25,
  /** seconds the last pose is held before a loop restarts, and the blend back to the first pose */
  loopHold: 0.8,
  loopBlend: 0.3,
} as const;
