/**
 * Hash routing: the feed is the default route; `#lab` opens the sign lab, `#dev` developer mode and
 * `#dev/play` the feed in dev forced mode. Hash routes never need server support, so the same build
 * works as a website, an installed app or an embedded page.
 */
import { useSyncExternalStore } from "react";

export type Route = "feed" | "lab" | "dev" | "dev-play";

export function routeFor(hash: string): Route {
  if (hash === "#lab") return "lab";
  if (hash === "#dev/play") return "dev-play";
  if (hash === "#dev" || hash.startsWith("#dev/")) return "dev";
  return "feed";
}

const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => routeFor(window.location.hash));
}

export function go(hash: string) {
  window.location.hash = hash;
}
