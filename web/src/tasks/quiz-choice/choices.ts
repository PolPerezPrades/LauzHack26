/**
 * Options of a choose-the-meaning quiz: the target plus distractors, in seeded random order.
 *
 * Low similarity (default): distractors from the same unit first, then from the same kind (letters
 * with letters, words with words); other phrases for a phrase. High similarity (higher challenge,
 * SPEC §4.5): the learner's own confusions first, then look-alikes (similar letters, phrases that
 * share signs), then the low-similarity order. Two options never share a label in any UI language,
 * so the options logged in `card.shown` work whichever language the learner reads them in.
 */
import { PHRASES, SIGNS, getSign, itemLabel } from "../../content/curriculum";
import { shuffle } from "../../core/rng";
import type { Rng } from "../../core/types";
import { LANGS } from "../../i18n/langs";
import { lookAlikes, phrasesSharingSigns } from "./similar";

const labelsOf = (id: string) => LANGS.map((lang) => itemLabel(id, lang).toLocaleLowerCase(lang));

export interface OptionSet {
  /** the options in display order, target included */
  choices: string[];
  /** "high" when at least one distractor is a confusion or a look-alike (SPEC §7.4: more slip) */
  similarity: "low" | "high";
}

export interface SimilarityOptions {
  /** put confusions and look-alikes first */
  similar?: boolean;
  /** the learner's confusions for this item, most frequent first (LearnerQueries.confusions) */
  confusions?: readonly string[];
  maxConfusions?: number;
}

export function buildOptions(target: string, n: number, rng: Rng, opts: SimilarityOptions = {}): OptionSet {
  const sign = getSign(target);
  const isPhrase = PHRASES.has(target);
  const sameFamily = (id: string) => (sign ? getSign(id)?.kind === sign.kind : isPhrase && PHRASES.has(id));

  const high: string[] = [];
  if (opts.similar) {
    high.push(...(opts.confusions ?? []).filter((id) => id !== target && sameFamily(id)).slice(0, opts.maxConfusions ?? 2));
    high.push(...(sign ? lookAlikes(target, rng) : isPhrase ? phrasesSharingSigns(target, rng) : []));
  }
  const others = [...SIGNS.values()].filter((s) => s.id !== target);
  const low = sign
    ? [
        ...shuffle(rng, others.filter((s) => s.unit === sign.unit).map((s) => s.id)),
        ...shuffle(rng, others.filter((s) => s.unit !== sign.unit && s.kind === sign.kind).map((s) => s.id)),
      ]
    : isPhrase
      ? shuffle(rng, [...PHRASES.keys()].filter((id) => id !== target))
      : [];

  // one set of labels already on screen per language
  const taken = labelsOf(target).map((l) => new Set([l]));
  const distractors: string[] = [];
  let similarity: OptionSet["similarity"] = "low";
  const consider = (id: string, isHigh: boolean) => {
    if (distractors.length >= n - 1 || distractors.includes(id)) return;
    const labels = labelsOf(id);
    if (labels.some((l, i) => taken[i].has(l))) return;
    labels.forEach((l, i) => taken[i].add(l));
    distractors.push(id);
    if (isHigh) similarity = "high";
  };
  for (const id of high) consider(id, true);
  for (const id of low) consider(id, false);
  return { choices: shuffle(rng, [target, ...distractors]), similarity };
}

/** Low-similarity options (Part A's behaviour, kept for plans logged without options). */
export function buildChoices(target: string, n: number, rng: Rng): string[] {
  return buildOptions(target, n, rng).choices;
}
