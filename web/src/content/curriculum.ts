/**
 * Curriculum: units, signs and phrases. Every sign shown to the learner has real media:
 *   - words / numbers: WLASL dictionary clips (see scripts/fetch-media.mjs and media.json)
 *   - letters: public-domain ASL alphabet illustrations (Wikimedia Commons)
 * Signs whose media could not be downloaded are silently left out.
 */
import content from "../../content/signs.json";
import mediaJson from "./media.json";

export type Kind = "letter" | "number" | "word";
export type NonManual = "neutral" | "yn" | "wh" | "neg" | "topic";

export interface MediaRef {
  type: "video" | "image";
  src: string;
  credit: string;
  sourceUrl: string;
}
export interface Sign {
  id: string;
  en: string;
  es: string;
  kind: Kind;
  unit: string;
  level: number;
  media: MediaRef;
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

interface MediaManifest {
  signs: Record<string, { src: string; source: string; sourceUrl: string; dataset: string }>;
  letters: Record<string, { src: string; sourceUrl: string; license: string }>;
}
const media = mediaJson as unknown as MediaManifest;

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

const LETTER_UNITS: [string, string][] = [["abc1", "ABCDEFGHI"], ["abc2", "JKLMNOPQR"], ["abc3", "STUVWXYZ"]];
/** Letters with movement (J, Z) can't be checked from a single hand pose. */
export const CAMERA_LETTERS = "ABCDEFGHIKLMNOPQRSTUVWXY".split("");

export const SIGNS = new Map<string, Sign>();

for (const [unit, letters] of LETTER_UNITS) {
  for (const L of letters) {
    const m = media.letters[L];
    if (!m) continue;
    SIGNS.set(letterId(L), {
      id: letterId(L), en: L, es: L, kind: "letter", unit, level: 1,
      media: { type: "image", src: m.src, credit: `Wikimedia Commons · ${m.license}`, sourceUrl: m.sourceUrl },
    });
  }
}
const unitLevel = new Map(content.units.map((u) => [u.id, u.level]));
for (const s of content.signs) {
  const m = media.signs[s.id];
  if (!m) continue;
  SIGNS.set(s.id, {
    id: s.id, en: s.en, es: s.es, kind: s.id.startsWith("num-") ? "number" : "word", unit: s.unit,
    level: unitLevel.get(s.unit) ?? 2,
    media: { type: "video", src: m.src, credit: `${m.dataset} · ${m.source}`, sourceUrl: m.sourceUrl },
  });
}

export const PHRASES = new Map<string, Phrase>();
const phraseOk = (p: Phrase) => p.signs.length > 0 && p.signs.every((id) => SIGNS.has(id));
for (const p of content.phrases as Phrase[]) if (phraseOk(p)) PHRASES.set(p.id, p);

export const UNITS: Unit[] = content.units.map((u) => ({
  ...u,
  items: u.id === "phrases" ? [...PHRASES.keys()] : [...SIGNS.values()].filter((s) => s.unit === u.id).map((s) => s.id),
}));

/** Adds AI-generated phrases (already validated server-side) to the phrases unit. */
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
