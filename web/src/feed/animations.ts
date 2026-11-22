/**
 * Card animations with the Web Animations API, transform and opacity only (compositor-friendly).
 * One style for every exit (SPEC §3.3): same duration, ease-in, off-screen; horizontal exits end
 * rotated ±15°. With prefers-reduced-motion an exit is a short fade plus a small shift instead.
 */
import { FEED } from "./config";
import type { SwipeDir } from "./swipe";

export interface Pose { dx: number; dy: number; rot: number }
export const REST: Pose = { dx: 0, dy: 0, rot: 0 };

export const poseTransform = (p: Pose) => `translate3d(${p.dx}px, ${p.dy}px, 0) rotate(${p.rot}deg)`;
const BEHIND = `translate3d(0, ${FEED.behindOffsetPx}px, 0) scale(${FEED.behindScale})`;

const canAnimate = (el: Element | null): el is HTMLElement => !!el && typeof (el as HTMLElement).animate === "function";

/** Resolves when the animation ends or is cancelled. */
export const finished = (a: Animation | null | undefined) => (a ? a.finished.then(() => undefined, () => undefined) : Promise.resolve());

export function animateExit(el: HTMLElement, dir: SwipeDir, from: Pose, reduced: boolean): Animation | null {
  if (!canAnimate(el)) return null;
  if (reduced) {
    const s = FEED.reducedShiftPx;
    const shift = { left: [-s, 0], right: [s, 0], up: [0, -s], down: [0, s] }[dir];
    const to = { dx: from.dx + shift[0], dy: from.dy + shift[1], rot: from.rot };
    return el.animate([{ transform: poseTransform(from), opacity: 1 }, { transform: poseTransform(to), opacity: 0 }], { duration: FEED.reducedExitMs, easing: "ease-in", fill: "forwards" });
  }
  const w = window.innerWidth + el.offsetWidth, h = window.innerHeight + el.offsetHeight;
  const to: Pose = dir === "left" ? { dx: -w, dy: from.dy, rot: -FEED.exitRotateDeg }
    : dir === "right" ? { dx: w, dy: from.dy, rot: FEED.exitRotateDeg }
    : dir === "up" ? { dx: from.dx, dy: -h, rot: from.rot }
    : { dx: from.dx, dy: h, rot: from.rot };
  return el.animate([{ transform: poseTransform(from) }, { transform: poseTransform(to) }], { duration: FEED.exitMs, easing: "ease-in", fill: "forwards" });
}

/** The card behind grows into place (and loses its dimming) while the current one leaves. */
export function animateBehindToFront(card: HTMLElement | null, dim: HTMLElement | null, reduced: boolean): Animation[] {
  const duration = reduced ? FEED.reducedExitMs : FEED.exitMs;
  const out: Animation[] = [];
  if (canAnimate(card)) out.push(card.animate([{ transform: BEHIND }, { transform: "translate3d(0, 0, 0) scale(1)" }], { duration, easing: "ease-out", fill: "forwards" }));
  if (canAnimate(dim)) out.push(dim.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: "ease-out", fill: "forwards" }));
  return out;
}

/** Released below the threshold: back to rest with a little overshoot. */
export function animateSpring(el: HTMLElement, from: Pose, reduced: boolean): Animation | null {
  if (!canAnimate(el)) return null;
  return el.animate([{ transform: poseTransform(from) }, { transform: poseTransform(REST) }], {
    duration: reduced ? 120 : FEED.springMs,
    easing: reduced ? "ease-out" : "cubic-bezier(0.34, 1.56, 0.64, 1)",
  });
}

/** Next asked for (↑, Enter, Space) before the task is done: a small bump up and back ("not yet"). */
export function animateNudge(el: HTMLElement, reduced: boolean): Animation | null {
  if (!canAnimate(el)) return null;
  const up = poseTransform({ dx: 0, dy: reduced ? -4 : -16, rot: 0 });
  return el.animate([{ transform: poseTransform(REST) }, { transform: up }, { transform: poseTransform(REST) }], { duration: 260, easing: "ease-out" });
}

/** A new card behind fades in instead of popping up. */
export function animateAppear(el: HTMLElement | null): Animation | null {
  if (!canAnimate(el)) return null;
  return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
}
