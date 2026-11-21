/**
 * Environment detection for the three delivery targets (SPEC §1.4): feature detection decides, a
 * user-agent hint is only a fallback for "is this a phone or tablet" (the camera choice).
 */
const media = (q: string) => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(q).matches;

/** Phone or tablet: a coarse primary pointer on a touch device, else a mobile user-agent hint. */
export function isHandheld(): boolean {
  if (typeof navigator === "undefined") return false;
  if (media("(pointer: coarse)") && (navigator.maxTouchPoints ?? 0) > 0) return true;
  const hint = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (hint?.mobile) return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent ?? "");
}

export const deviceKind = (): "mobile" | "desktop" => (isHandheld() ? "mobile" : "desktop");

export const prefersReducedMotion = () => media("(prefers-reduced-motion: reduce)");
