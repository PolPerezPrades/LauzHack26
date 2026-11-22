/**
 * Tiles of a build-the-sentence quiz (SPEC §4.6, gloss mode): the phrase's signs plus distractor
 * signs, in seeded random order. Distractors come from the words used in other phrases first
 * (sentence vocabulary), then from the other words; no tile shares a label with another in any UI
 * language, so the logged tiles read unambiguously in either language. Pure.
 */
import { PHRASES, SIGNS, itemLabel } from "../../content/curriculum";
import { shuffle } from "../../core/rng";
import type { Rng } from "../../core/types";
import { LANGS } from "../../i18n/langs";

const labelsOf = (id: string) => LANGS.map((lang) => itemLabel(id, lang).toLocaleLowerCase(lang));

export function buildTiles(phraseId: string, distractors: number, rng: Rng): string[] {
  const own = PHRASES.get(phraseId)?.signs ?? [];
  const taken = LANGS.map(() => new Set<string>());
  for (const id of own) labelsOf(id).forEach((l, i) => taken[i].add(l));
  const ownSet = new Set(own);
  const sentenceWords = new Set([...PHRASES.values()].flatMap((p) => p.signs));
  const words = [...SIGNS.values()].filter((s) => s.kind === "word" && !ownSet.has(s.id)).map((s) => s.id);
  const candidates = [...shuffle(rng, words.filter((id) => sentenceWords.has(id))), ...shuffle(rng, words.filter((id) => !sentenceWords.has(id)))];
  const extra: string[] = [];
  for (const id of candidates) {
    if (extra.length >= distractors) break;
    const labels = labelsOf(id);
    if (labels.some((l, i) => taken[i].has(l))) continue;
    labels.forEach((l, i) => taken[i].add(l));
    extra.push(id);
  }
  return shuffle(rng, [...own, ...extra]);
}

export interface BuildCheck {
  /** the exact signs in the exact order */
  correct: boolean;
  /** the right signs, in the wrong order (SPEC §4.6: said distinctly) */
  wrongOrder: boolean;
  /** per answer slot: the sign the phrase has at that position, or not */
  marks: ("ok" | "bad")[];
}

const sorted = (xs: readonly string[]) => [...xs].sort();

export function checkBuild(signs: readonly string[], built: readonly string[]): BuildCheck {
  const correct = built.length === signs.length && built.every((id, i) => id === signs[i]);
  const want = sorted(signs);
  const sameSigns = built.length === signs.length && sorted(built).every((id, i) => id === want[i]);
  return { correct, wrongOrder: !correct && sameSigns, marks: built.map((id, i) => (id === signs[i] ? "ok" : "bad")) };
}
