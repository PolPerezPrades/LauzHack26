/**
 * Look-alikes for high-similarity distractors (SPEC §4.5: "visually similar letters (e.g. M/N,
 * A/S/T/E)"). Pure data and helpers; nothing here is shown as a description of a sign.
 *
 * Letter groups share a handshape family, as the content itself describes them: the closed-fist
 * letters told apart by the thumb (R-003, the spec's M/N and A/S/T/E), the letters with the index
 * and middle fingers out (P "like K, but pointing down"), the index-finger letters (Q "like G, but
 * pointing down"; Z drawn with the index), the curved C and O, the pinky letters (J is "the I
 * handshape" with movement; Y adds the thumb), and the three-finger F and W. Numbers and words get
 * no table: their look-alikes come from the learner's own confusions.
 * Phrases look alike when they share signs (data-driven).
 */
import { PHRASES } from "../../content/curriculum";
import { shuffle } from "../../core/rng";
import type { Rng } from "../../core/types";

export const LETTER_GROUPS: readonly (readonly string[])[] = [
  ["A", "E", "M", "N", "S", "T"],
  ["H", "K", "P", "R", "U", "V"],
  ["D", "G", "L", "Q", "X", "Z"],
  ["C", "O"],
  ["I", "J", "Y"],
  ["F", "W"],
];

/** Letter item ids that look like this letter, shuffled (empty for anything but a letter). */
export function lookAlikes(itemId: string, rng: Rng): string[] {
  const letter = /^L-([A-Z])$/.exec(itemId)?.[1];
  if (!letter) return [];
  const similar = new Set(LETTER_GROUPS.filter((g) => g.includes(letter)).flat());
  similar.delete(letter);
  return shuffle(rng, [...similar].map((l) => `L-${l}`));
}

/** Other phrases that share at least one sign with this one: most shared first, shuffled within a tie. */
export function phrasesSharingSigns(phraseId: string, rng: Rng): string[] {
  const signs = new Set(PHRASES.get(phraseId)?.signs ?? []);
  const shared = (id: string) => (PHRASES.get(id)?.signs ?? []).filter((s) => signs.has(s)).length;
  const others = shuffle(rng, [...PHRASES.keys()].filter((id) => id !== phraseId && shared(id) > 0));
  return others.sort((a, b) => shared(b) - shared(a));
}
