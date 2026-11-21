/**
 * Warms what the next card will need, so it is ready when it becomes current (SPEC §3.3, §8.6).
 * Avatar motion JSON goes through loadMotion's in-memory promise cache, so the viewer reuses it.
 * Letters are procedural (nothing to load). Video clips are left to the <video> element: a parallel
 * fetch would not reliably reuse the HTTP cache and could download every clip twice on mobile data.
 */
import { getSpec } from "../content/signs";
import { loadMotion } from "./AvatarScene";

export function prefetchSigns(ids: readonly string[]) {
  for (const id of ids) {
    const spec = getSpec(id);
    if (spec?.render.type === "avatar") loadMotion(spec.render.motion).catch(() => {});
  }
}
