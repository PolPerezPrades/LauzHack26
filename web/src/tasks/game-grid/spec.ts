/**
 * game-grid (SPEC §4.7, built by the integrator on 2026-11-22 for the demo): a 3×3 grid of letter
 * signs and one letter at a time; the learner taps the tile with that letter's sign. A hit shows the
 * next letter and shuffles the grid; a wrong tap takes time. It shares game-rain's clock (10 s, a hit
 * adds, a wrong tap takes away) and its result mapping.
 *
 * Targets are only letters the learner has met (never tests unseen signs); the other tiles are
 * distractor letters. With fewer than GRID.minTargets met letters the format declines.
 */
import { curriculumOrder, itemKindOf } from "../../content/curriculum";
import type { CandidateDraft, LearnerQueries, Rng, TaskSpec } from "../../core/types";
import { gameLetters } from "../gameItems";

export const GAME_GRID_ID = "game-grid";

export const GRID = {
  tiles: 9,
  minTargets: 3,
  maxTargets: 6,
} as const;

export type GameGridParams = { tiles?: string[] };

const shuffled = <T,>(xs: readonly T[], rng: Rng): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** The grid: every target plus distractor letters, in a shuffled order. */
export function gridTiles(targets: readonly string[], letters: readonly string[], rng: Rng): string[] {
  const others = shuffled(letters.filter((id) => !targets.includes(id)), rng);
  return shuffled([...targets, ...others].slice(0, GRID.tiles), rng);
}

/** The next letter to find: a target other than the current one. */
export function nextTarget(targets: readonly string[], current: string | null, rng: Rng): string {
  const pool = targets.length > 1 ? targets.filter((t) => t !== current) : targets;
  return pool[Math.floor(rng.next() * pool.length)];
}

export { shuffled };

export const gameGrid: TaskSpec<GameGridParams> = {
  id: GAME_GRID_ID,
  family: "game",
  icon: "🔳",
  i18nKey: GAME_GRID_ID,
  requires: { camera: "none", itemKinds: ["letter"] },
  trains: ["receptive"],
  seconds: 20,
  params: () => ({}),
  generate(q: LearnerQueries, ctx): CandidateDraft<GameGridParams>[] {
    const targets = gameLetters(q, GRID.minTargets + 1, GRID.maxTargets);
    if (targets.length < GRID.minTargets) return [];
    const letters = curriculumOrder().filter((id) => itemKindOf(id) === "letter");
    return [{ format: GAME_GRID_ID, items: targets, params: { tiles: gridTiles(targets, letters, ctx.rng) }, reasons: [{ code: "game_pool", n: targets.length }] }];
  },
  preview: (plan) => plan.items.map((id) => id.replace(/^L-/, "")).join(" "),
};
