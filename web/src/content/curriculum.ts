/**
 * Curriculum: units and phrases (content/curriculum.json) over the sign registry
 * (content/signs/*.json). How a sign is DRAWN is the SignViewer's business; the learning engine
 * only needs ids, translations, kinds and units.
 */
import curriculum from "../../content/curriculum.json";
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
export interface Phrase {
  id: string;
  signs: string[];
  en: string;
  es: string;
  nonManual: NonManual | string;
  note: string;
  ai?: boolean;
}
export interface Unit {
  id: string;
  level: number;
  title: string;
  icon: string;
  items: string[]; // sign ids, or phrase ids for the "phrases" unit
}

export const LEVEL_NAMES: Record<number, string> = {
  1: "Nivel 1 · Dactilología y números",
  2: "Nivel 2 · Vocabulario básico",
  3: "Nivel 3 · Frases y gramática",
};

export const NON_MANUAL_LABEL: Record<string, string> = {
  neutral: "Expresión neutra",
  yn: "Pregunta sí/no · cejas levantadas",
  wh: "Pregunta abierta · cejas fruncidas",
  neg: "Negación · mover la cabeza de lado a lado",
  topic: "Tópico · cejas levantadas en la primera parte",
};

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
export function label(id: string) {
  const s = SIGNS.get(id);
  if (s) return s.kind === "letter" ? s.en : s.es;
  return PHRASES.get(id)?.es ?? id;
}
export function unitIndex(id: string) {
  return UNITS.findIndex((u) => u.id === id);
}
export const hasMedia = SIGNS.size > 0;
