/**
 * Which word a spell-word question asks for (SPEC §7.8.1: "words made of met letters"): a word
 * from the shared bank whose every letter the learner has met, preferably one that practises their
 * most urgent letter, at a length that suits the challenge level. Pure and seeded.
 */
import { pick } from "../../core/rng";
import type { Rng } from "../../core/types";
import { SPELL_WORDS } from "../../lib/engine";

export const letterOfId = (id: string) => /^L-([A-Z])$/.exec(id)?.[1];

/**
 * @param letterIds met letters as item ids, most urgent first (LearnerQueries.practice order)
 * @returns the word, or null when no word can be made of those letters
 */
export function pickWord(letterIds: readonly string[], range: { minLetters: number; maxLetters: number }, rng: Rng, bank: readonly string[] = SPELL_WORDS): string | null {
  const urgency = new Map<string, number>();
  letterIds.forEach((id, i) => {
    const letter = letterOfId(id);
    if (letter && !urgency.has(letter)) urgency.set(letter, i);
  });
  const fits = bank.filter((w) => [...w].every((c) => urgency.has(c)));
  if (!fits.length) return null;
  const sized = fits.filter((w) => w.length >= range.minLetters && w.length <= range.maxLetters);
  const pool = sized.length ? sized : fits;
  const score = (w: string) => Math.min(...[...w].map((c) => urgency.get(c)!));
  const best = Math.min(...pool.map(score));
  return pick(rng, pool.filter((w) => score(w) === best)) ?? null;
}

/** The distinct letters of a word, as item ids, in order of first appearance (the card's target items). */
export const wordLetters = (word: string) => [...new Set(word)].map((c) => `L-${c}`);
