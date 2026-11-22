/**
 * How the learning formats name content in the UI language: a sign's meaning with its ASL gloss,
 * a phrase's gloss line and grammar note, a letter's description. Pure (no React), so result
 * builders and previews use the same wording as the views.
 */
import { PHRASES, getSign, itemLabel, type Phrase } from "../../content/curriculum";
import type { Messages } from "../../i18n/en";
import type { Lang } from "../../i18n/langs";

/** A word's ASL gloss, shown with its meaning only when it adds something ("negro" · BLACK, not "black" · BLACK). */
export function glossHint(id: string, lang: Lang): string | null {
  const s = getSign(id);
  if (s?.kind !== "word") return null;
  const gloss = s.en.toUpperCase();
  return gloss.toLowerCase() === itemLabel(id, lang).toLowerCase() ? null : gloss;
}

/** Meaning, plus the gloss when it adds something: "negro (BLACK)". */
export function answerText(id: string, lang: Lang): string {
  const gloss = glossHint(id, lang);
  return gloss ? `${itemLabel(id, lang)} (${gloss})` : itemLabel(id, lang);
}

/** The ASL gloss of a sequence of signs: "YOU · NAME · WHAT". */
export function glossLine(signs: readonly string[]): string {
  return signs.map((x) => getSign(x)?.en.toUpperCase() ?? x).join(" · ");
}

/** Gloss line, non-manual marker and grammar note, shown with the answer of a phrase. */
export function phraseNote(p: Phrase, t: Messages, lang: Lang): string {
  return `${glossLine(p.signs)}. ${t.content.nonManual[p.nonManual] ?? p.nonManual}. ${p.note[lang]}`;
}

/** What a prompt calls an item: "Letter A", "three", "thank you", or the sentence itself. */
export function itemName(id: string, t: Messages, lang: Lang): string {
  const s = getSign(id);
  if (s?.kind === "letter") return t.learning.letter(s.en);
  return PHRASES.get(id)?.[lang] ?? itemLabel(id, lang);
}

export interface Description {
  text: string;
  /** the language the text is written in (it may differ from the UI language, R-020) */
  lang: Lang;
}

/** The text in the UI language, else the Spanish original (the authored language, R-020). */
export function pickDescription(d: { es: string; en?: string } | null | undefined, lang: Lang): Description | null {
  if (!d) return null;
  const text = d[lang];
  return text ? { text, lang } : { text: d.es, lang: "es" };
}

/** A sign's authored "how to" text; never invented (rule 5). */
export function signDescription(id: string, lang: Lang): Description | null {
  return pickDescription(getSign(id)?.spec.description, lang);
}

/** The same name, from the strings alone: card previews get the strings but no language code. */
export function previewName(id: string, t: Messages): string {
  const s = getSign(id);
  return s?.kind === "letter" ? t.learning.letter(s.en) : t.learning.item(id);
}
