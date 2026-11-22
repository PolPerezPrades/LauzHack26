/**
 * game-wordsearch (SPEC §4.7, built by the integrator on 2026-11-22 for the demo): up to three words
 * in letters, a 5×5 board of letter SIGNS; tap the signs that spell each word. Each word lies on one
 * line (row, column or diagonal, read forwards), words never share a cell, and the other cells hold
 * letters that are in none of the words, so every word can only be found in one place. A found word
 * adds time, a wrong tap takes it, as in game-rain; when every word is found, a new board appears.
 *
 * Words come from the spelling bank (lib/engine.ts) and use only letters the learner has met. The
 * board shows cached still pictures of the signs (viewer/SignStill.tsx), so 25 tiles stay cheap.
 * Pure, so the board builder is unit-tested.
 */
import { itemKindOf } from "../../content/curriculum";
import type { CandidateDraft, LearnerQueries, Rng, TaskSpec } from "../../core/types";
import { SPELL_WORDS } from "../../lib/engine";
import { TOP_UP_LETTERS, gameLetters } from "../gameItems";

export const GAME_WORDSEARCH_ID = "game-wordsearch";

export const WORDSEARCH = {
  size: 5,
  wordsPerBoard: 3,
  startMs: 30_000,
  wordBonusMs: 3_000,
  wrongPenaltyMs: 2_000,
  maxMs: 45_000,
  maxWords: 12,
} as const;

export type GameWordsearchParams = { words?: string[] };

export interface PlacedWord {
  word: string;
  /** cell indexes, in reading order */
  path: number[];
}

export interface Board {
  size: number;
  /** row-major letters ("A"…"Z") */
  grid: string[];
  words: PlacedWord[];
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const pick = <T,>(xs: readonly T[], rng: Rng): T => xs[Math.floor(rng.next() * xs.length)];

/** Every straight, forward placement of a word of length n in a size×size grid. */
export function placements(n: number, size: number): number[][] {
  const dirs = [[0, 1], [1, 0], [1, 1], [-1, 1]];
  const out: number[][] = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) for (const [dr, dc] of dirs) {
    const end = [r + dr * (n - 1), c + dc * (n - 1)];
    if (end[0] < 0 || end[0] >= size || end[1] < 0 || end[1] >= size) continue;
    out.push(Array.from({ length: n }, (_, i) => (r + dr * i) * size + (c + dc * i)));
  }
  return out;
}

/** A board with the words on separate lines (a word that doesn't fit is left out). */
export function buildBoard(words: readonly string[], size: number, rng: Rng): Board {
  const used = new Set<number>();
  const placed: PlacedWord[] = [];
  for (const raw of words) {
    const word = raw.toUpperCase();
    const free = placements(word.length, size).filter((path) => path.every((c) => !used.has(c)));
    if (!free.length) continue;
    const path = pick(free, rng);
    path.forEach((c) => used.add(c));
    placed.push({ word, path });
  }
  const letters = new Set(placed.flatMap((w) => [...w.word]));
  const fill = ALPHABET.filter((l) => !letters.has(l));
  const grid = Array.from({ length: size * size }, () => pick(fill, rng));
  for (const w of placed) w.path.forEach((cell, i) => { grid[cell] = w.word[i]; });
  return { size, grid, words: placed };
}

export const letterId = (l: string) => `L-${l.toUpperCase()}`;

/** Words of the bank made only of met letters that fit the board. */
export function wordsFor(met: readonly string[]): string[] {
  const known = new Set(met.map((id) => id.replace(/^L-/, "")));
  return SPELL_WORDS.filter((w) => w.length >= 2 && w.length <= WORDSEARCH.size && [...w].every((l) => known.has(l)));
}

export const gameWordsearch: TaskSpec<GameWordsearchParams> = {
  id: GAME_WORDSEARCH_ID,
  family: "game",
  icon: "🔎",
  i18nKey: GAME_WORDSEARCH_ID,
  requires: { camera: "none", itemKinds: ["letter"] },
  trains: ["receptive"],
  seconds: 30,
  params: () => ({}),
  generate(q: LearnerQueries, ctx): CandidateDraft<GameWordsearchParams>[] {
    const met = q.pool("receptive", ["letter"], 26).filter((id) => itemKindOf(id) === "letter");
    // met letters first; with too few words, the first unit's letters top them up (gameItems.ts)
    const words = wordsFor(met).length >= WORDSEARCH.wordsPerBoard ? wordsFor(met) : wordsFor(gameLetters(q, met.length + TOP_UP_LETTERS));
    if (!words.length) return [];
    const deck = [...words].sort(() => ctx.rng.next() - 0.5).slice(0, WORDSEARCH.maxWords);
    const items = [...new Set(deck.flatMap((w) => [...w].map(letterId)))];
    return [{ format: GAME_WORDSEARCH_ID, items, params: { words: deck }, reasons: [{ code: "game_pool", n: deck.length }] }];
  },
  preview: (plan) => (plan.params.words ?? []).slice(0, WORDSEARCH.wordsPerBoard).join(" · "),
};
