/**
 * Warms what the next card will need, so it is ready when it becomes current (SPEC §3.3, §8.6).
 * Avatar motion is fetched and cleaned (motion.ts, a few milliseconds) when the browser is idle,
 * into loadPreparedMotion's cache, so the viewer reuses it and a swipe never pays for it.
 * Letters are procedural (nothing to load). Video clips are left to the <video> element: a
 * parallel fetch would not reliably reuse the HTTP cache and could download every clip twice on
 * mobile data.
 */
import { getSpec } from "../content/signs";
import { loadMotion, loadPreparedMotion } from "./AvatarScene";

const idle = (fn: () => void) => {
  const w = globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 1500 });
  else setTimeout(fn, 200); // Safari has no requestIdleCallback
};

export function prefetchSigns(ids: readonly string[]) {
  for (const id of ids) {
    const spec = getSpec(id);
    if (spec?.render.type !== "avatar") continue;
    const url = spec.render.motion;
    loadMotion(url).then(() => idle(() => { loadPreparedMotion(url).catch(() => {}); })).catch(() => {});
  }
}
