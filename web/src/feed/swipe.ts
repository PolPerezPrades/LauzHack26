/**
 * Pure swipe decision (SPEC §3.3): given where a drag was released, and how fast, does the card
 * leave, and in which direction? The dominant axis decides. Up (Next) only counts once the task
 * is completed; before that an upward drag is a rubber band.
 */
import type { ExitKind } from "../core/types";
import { SWIPE, type SwipeConfig } from "./config";

export type SwipeDir = "left" | "right" | "up" | "down";

export const EXIT_FOR_DIR: Record<SwipeDir, ExitKind> = {
  up: "next",
  left: "too_easy",
  right: "too_hard",
  down: "dislike_format",
};

export const DIR_FOR_EXIT: Record<ExitKind, SwipeDir> = {
  next: "up",
  too_easy: "left",
  too_hard: "right",
  dislike_format: "down",
  camera_off: "up",
};

export interface SwipeRelease {
  /** displacement since the pointer went down, px (y grows downwards) */
  dx: number;
  dy: number;
  /** release velocity, px/ms */
  vx: number;
  vy: number;
  /** card size, px */
  width: number;
  height: number;
}

export interface SwipeRules {
  /** the task is completed (or the card allows Next anytime) */
  canUp: boolean;
}

const dominant = (dx: number, dy: number) => (Math.abs(dx) >= Math.abs(dy) ? "x" : "y");

/** Commits when the drag went far enough, or was a flick in the same direction. null = spring back. */
export function decideSwipe(r: SwipeRelease, rules: SwipeRules, cfg: SwipeConfig = SWIPE): SwipeDir | null {
  const horizontal = dominant(r.dx, r.dy) === "x";
  const d = horizontal ? r.dx : r.dy;
  const v = horizontal ? r.vx : r.vy;
  if (d === 0) return null;
  const dir: SwipeDir = horizontal ? (d > 0 ? "right" : "left") : d > 0 ? "down" : "up";
  if (dir === "up" && !rules.canUp) return null;
  // compare ratios: frac × size rounds up (0.28 × 400 = 112.00000000000001) and would miss the exact threshold
  const far = Math.abs(d) / Math.max(1, horizontal ? r.width : r.height) >= (horizontal ? cfg.horizontalFrac : cfg.verticalFrac);
  const flick = Math.abs(d) >= cfg.flickMinPx && Math.sign(v) === Math.sign(d) && Math.abs(v) >= cfg.flickSpeed;
  return far || flick ? dir : null;
}

/** Progress (0..1+) towards the commit distance in the dominant direction: stamps and the threshold tick. */
export function dragProgress(dx: number, dy: number, width: number, height: number, rules: SwipeRules, cfg: SwipeConfig = SWIPE): { dir: SwipeDir | null; progress: number } {
  if (dx === 0 && dy === 0) return { dir: null, progress: 0 };
  const horizontal = dominant(dx, dy) === "x";
  const dir: SwipeDir = horizontal ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  if (dir === "up" && !rules.canUp) return { dir: null, progress: 0 };
  const share = Math.abs(horizontal ? dx : dy) / Math.max(1, horizontal ? width : height);
  return { dir, progress: share / (horizontal ? cfg.horizontalFrac : cfg.verticalFrac) };
}

export interface PointerSample { x: number; y: number; t: number }

/**
 * Release velocity (px/ms) over the last `windowMs` of movement. The lift itself usually repeats the
 * last position, so it only counts if the finger moved; and a finger that rested longer than the
 * window before lifting made no flick. Busy main threads deliver moves sparsely, so measuring
 * between moves (not up to the lift) keeps flicks reliable on slow phones.
 */
export function releaseVelocity(moves: readonly PointerSample[], lift: PointerSample, windowMs: number): { vx: number; vy: number } {
  const last = moves[moves.length - 1];
  if (!last || lift.t - last.t > windowMs) return { vx: 0, vy: 0 };
  const all = lift.x !== last.x || lift.y !== last.y ? [...moves, lift] : moves;
  const end = all[all.length - 1];
  const first = all.find((s) => s.t >= end.t - windowMs) ?? all[0];
  const dt = end.t - first.t;
  return dt < 1 ? { vx: 0, vy: 0 } : { vx: (end.x - first.x) / dt, vy: (end.y - first.y) / dt };
}

/** Damped displacement for drags that can't commit (upwards before completion). */
export function rubberBand(d: number, limit = 48): number {
  return Math.sign(d) * limit * (1 - Math.exp(-Math.abs(d) / limit / 2));
}
