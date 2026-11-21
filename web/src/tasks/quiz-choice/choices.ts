/**
 * Options of a choose-the-meaning quiz: the target plus distractors, in seeded random order.
 * Distractors come from the same unit first, then from the same kind (letters with letters, words
 * with words). Two options never share a label in any UI language, so the options logged in
 * `card.shown` work whichever language the learner reads them in (and switching language mid-card
 * changes nothing but the text). Part B adds similarity- and confusion-based distractors driven by
 * the challenge level.
 */
import { PHRASES, SIGNS, getSign, itemLabel } from "../../content/curriculum";
import { shuffle } from "../../core/rng";
import type { Rng } from "../../core/types";
import { LANGS } from "../../i18n/langs";

const labelsOf = (id: string) => LANGS.map((lang) => itemLabel(id, lang).toLocaleLowerCase(lang));

export function buildChoices(target: string, n: number, rng: Rng): string[] {
  const sign = getSign(target);
  const others = [...SIGNS.values()].filter((s) => s.id !== target);
  const candidates = sign
    ? [
        ...shuffle(rng, others.filter((s) => s.unit === sign.unit).map((s) => s.id)),
        ...shuffle(rng, others.filter((s) => s.unit !== sign.unit && s.kind === sign.kind).map((s) => s.id)),
      ]
    : PHRASES.has(target)
      ? shuffle(rng, [...PHRASES.keys()].filter((id) => id !== target))
      : [];
  // one set of labels already on screen per language
  const taken = labelsOf(target).map((l) => new Set([l]));
  const distractors: string[] = [];
  for (const id of candidates) {
    if (distractors.length >= n - 1) break;
    const labels = labelsOf(id);
    if (labels.some((l, i) => taken[i].has(l))) continue;
    labels.forEach((l, i) => taken[i].add(l));
    distractors.push(id);
  }
  return shuffle(rng, [target, ...distractors]);
}
