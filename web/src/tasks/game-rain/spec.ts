/**
 * game-rain (SPEC §4.7, built by the integrator on 2026-11-22 for the demo): letter signs fall from
 * the top; the learner taps the matching letter among the buttons before the sign lands. A 10 s
 * clock is the life: a hit adds time, a wrong tap or a landed sign takes time, and the signs fall
 * faster the longer the learner survives. The game ends when the clock reaches zero.
 *
 * Items: letters the learner has met (the game never tests unseen signs), weakest first, through
 * the learner queries. With fewer than RAIN.minItems met letters the format declines. Pure, so the
 * pacing and the evidence mapping are unit-tested.
 */
import type { CandidateDraft, EvidenceDraft, LearnerQueries, TaskResult, TaskSpec } from "../../core/types";
import { gameLetters } from "../gameItems";

export const GAME_RAIN_ID = "game-rain";

export const RAIN = {
  /** the clock at the start, in ms */
  startMs: 10_000,
  /** a hit adds, a wrong tap and a landed sign take away (ms) */
  hitBonusMs: 1_000,
  wrongPenaltyMs: 2_000,
  missPenaltyMs: 1_000,
  /** the clock never goes above this */
  maxMs: 15_000,
  /** fall time of one sign: from slowMs at the start towards fastMs, faster each survived second */
  slowMs: 4_500,
  fastMs: 1_600,
  speedUpPerSecond: 0.06,
  /** a new sign every fall time × spawnFactor, at most maxDrops on screen */
  spawnFactor: 0.55,
  maxDrops: 3,
  /** letter buttons */
  minItems: 3,
  maxItems: 6,
  /** the end screen stays this long before the result is reported */
  endMs: 1_200,
} as const;

export type GameRainParams = { letters?: string[] };

/** How long a sign takes to fall after `aliveMs` of survival (never below fastMs). */
export function fallMs(aliveMs: number): number {
  const k = Math.exp(-RAIN.speedUpPerSecond * (aliveMs / 1000));
  return Math.round(RAIN.fastMs + (RAIN.slowMs - RAIN.fastMs) * k);
}

/** The clock after an event, clamped to [0, maxMs]. */
export function clockAfter(leftMs: number, event: "hit" | "wrong" | "miss"): number {
  const delta = event === "hit" ? RAIN.hitBonusMs : event === "wrong" ? -RAIN.wrongPenaltyMs : -RAIN.missPenaltyMs;
  return Math.max(0, Math.min(RAIN.maxMs, leftMs + delta));
}

export interface RainEvent {
  /** the falling sign this event is about */
  item: string;
  kind: "hit" | "wrong" | "miss";
  /** the letter tapped, on a wrong tap */
  pressed?: string;
  ms?: number;
}

export interface RainSummary {
  score: number;
  aliveMs: number;
}

/** One receptive retrieval per event; the score is the number of hits. */
export function gameRainResult(events: readonly RainEvent[], summary: RainSummary): TaskResult {
  const evidence: EvidenceDraft[] = events.map((e) => ({
    itemId: e.item,
    skill: "receptive",
    kind: "retrieval",
    correct: e.kind === "hit",
    check: "game",
    ...(e.ms !== undefined ? { ms: e.ms } : {}),
    ...(e.kind === "wrong" && e.pressed ? { confusedWith: e.pressed } : {}),
  }));
  const hits = events.filter((e) => e.kind === "hit").length;
  const success = events.length ? hits / events.length : 0;
  return { success, evidence, score: summary.score, xp: hits * 2, feedback: { correct: success >= 0.5 } };
}

export const gameRain: TaskSpec<GameRainParams> = {
  id: GAME_RAIN_ID,
  family: "game",
  icon: "🌧",
  i18nKey: GAME_RAIN_ID,
  requires: { camera: "none", itemKinds: ["letter"] },
  trains: ["receptive"],
  seconds: 20,
  params: () => ({}),
  generate(q: LearnerQueries): CandidateDraft<GameRainParams>[] {
    const letters = gameLetters(q, RAIN.maxItems - 1, RAIN.maxItems);
    if (letters.length < RAIN.minItems) return [];
    return [{ format: GAME_RAIN_ID, items: letters, params: { letters }, reasons: [{ code: "game_pool", n: letters.length }] }];
  },
  preview: (plan) => plan.items.map((id) => id.replace(/^L-/, "")).join(" "),
};
