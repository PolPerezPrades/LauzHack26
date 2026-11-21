/**
 * Curriculum: units and phrases (content/curriculum.json) over the sign registry
 * (content/signs/*.json). How a sign is DRAWN is the SignViewer's business; the learning engine
 * only needs ids, translations, kinds and units.
 */
import curriculum from "../../content/curriculum.json";
import type { ItemKind } from "../core/types";
import type { Lang } from "../i18n/langs";
import { SIGN_SPECS, type SignSpec } from "./signs";

export type Kind = "letter" | "number" | "word";
export type NonManual = "neutral" | "yn" | "wh" | "neg" | "topic";

export interface Sign {
  id: string;
  en: string;
  es: string;
  kind: Kind;
  unit: string;
  level: number;
  spec: SignSpec;
}
/** A text in every UI language: content files key their translations by language code. */
export type Localized = Record<Lang, string>;

export interface Phrase {
  id: string;
  signs: string[];
  en: string;
  es: string;
  /** non-manual marker code; its label comes from i18n `content.nonManual` */
  nonManual: NonManual | string;
  /** grammar note shown with the answer */
  note: Localized;
  ai?: boolean;
}
export interface Unit {
  id: string;
  level: number;
  title: Localized;
  icon: string;
  items: string[]; // sign ids, or phrase ids for the "phrases" unit
}

/** Letters with movement (J, Z) can't be checked from a single hand pose. */
export const CAMERA_LETTERS = "ABCDEFGHIKLMNOPQRSTUVWXY".split("");

const unitLevel = new Map(curriculum.units.map((u) => [u.id, u.level]));
const ORDER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const SIGNS = new Map<string, Sign>(
  [...SIGN_SPECS.values()]
    .sort((a, b) => (a.type === "letter" && b.type === "letter" ? ORDER.indexOf(a.gloss) - ORDER.indexOf(b.gloss) : 0))
    .map((s) => [s.id, {
      id: s.id, en: s.translations.en, es: s.translations.es, kind: s.type, unit: s.unit,
      level: unitLevel.get(s.unit) ?? 2, spec: s,
    }]),
);

export const PHRASES = new Map<string, Phrase>();
const phraseOk = (p: Phrase) => p.signs.length > 0 && p.signs.every((id) => SIGNS.has(id));
for (const p of curriculum.phrases as Phrase[]) if (phraseOk(p)) PHRASES.set(p.id, p);

export const UNITS: Unit[] = curriculum.units.map((u) => ({
  ...u,
  items: u.id === "phrases" ? [...PHRASES.keys()] : [...SIGNS.values()].filter((s) => s.unit === u.id).map((s) => s.id),
}));

/** Adds generated phrases (validated: every sign must exist) to the phrases unit. */
export function registerPhrases(list: Phrase[]) {
  const unit = UNITS.find((u) => u.id === "phrases");
  for (const p of list) {
    if (PHRASES.has(p.id) || !phraseOk(p)) continue;
    PHRASES.set(p.id, { ...p, ai: true });
    unit?.items.push(p.id);
  }
}

export function letterId(L: string) {
  return `L-${L.toUpperCase()}`;
}
export function getSign(id: string) {
  return SIGNS.get(id);
}
/** What an item means in a UI language: letters read the same; numbers, words and phrases are translated. */
export function itemLabel(id: string, lang: Lang): string {
  const s = SIGNS.get(id);
  if (s) return s.kind === "letter" ? s.en : s[lang];
  return PHRASES.get(id)?.[lang] ?? id;
}
/** Spanish label, kept for the old modules (learning/, activities/). New code uses itemLabel(id, lang). */
export function label(id: string) {
  return itemLabel(id, "es");
}
export function unitIndex(id: string) {
  return UNITS.findIndex((u) => u.id === id);
}
export const hasMedia = SIGNS.size > 0;

/** Kind of a learnable item: a sign (letter, number, word) or a phrase; undefined if unknown. */
export function itemKindOf(id: string): ItemKind | undefined {
  return SIGNS.get(id)?.kind ?? (PHRASES.has(id) ? "phrase" : undefined);
}

const numberValue = (id: string) => Number(id.replace(/^num-/, ""));

/** Items of one unit in teaching order (numbers by value, not by file name). */
export function unitOrder(unitId: string): string[] {
  const items = UNITS.find((u) => u.id === unitId)?.items ?? [];
  return unitId === "numbers" ? [...items].sort((a, b) => numberValue(a) - numberValue(b)) : [...items];
}

/** Every item in curriculum order: units in order, items in unit order. */
export function curriculumOrder(): string[] {
  return UNITS.flatMap((u) => unitOrder(u.id));
}
