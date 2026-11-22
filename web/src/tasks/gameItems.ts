/**
 * Letters for the letter games (game-rain, game-grid, game-wordsearch): the letters the learner has
 * met, weakest first, topped up with the first curriculum letters (unit abc1, the ones the feed
 * teaches first) so the games can appear early in the feed. Added by the integrator on 2026-11-22
 * at the user's request: every game must show up in the main feed for the demo.
 */
import { curriculumOrder, itemKindOf } from "../content/curriculum";
import type { LearnerQueries } from "../core/types";

/** How many of the first curriculum letters may top up a game. */
export const TOP_UP_LETTERS = 9;

export function gameLetters(q: LearnerQueries, want: number, max = 26): string[] {
  const met = q.pool("receptive", ["letter"], max).filter((id) => itemKindOf(id) === "letter");
  if (met.length >= want) return met.slice(0, max);
  const first = curriculumOrder().filter((id) => itemKindOf(id) === "letter").slice(0, TOP_UP_LETTERS);
  return [...met, ...first.filter((id) => !met.includes(id))].slice(0, Math.max(want, Math.min(max, met.length + first.length)));
}
