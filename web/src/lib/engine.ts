/** Exercise building blocks: shared answer type, distractors, spelling words and the placement test. */
import { PHRASES, SIGNS, UNITS, getSign, letterId, unitIndex } from "../content/curriculum";
import type { Modality } from "../data/eventsV1";
import type { Profile } from "../learning/profile";

export type Exercise =
  | { kind: "intro"; signId: string }
  | { kind: "recognize"; signId: string; options: string[] }
  | { kind: "phrase"; phraseId: string; options: string[] };

export interface Answer {
  correct: boolean;
  items: { id: string; correct: boolean; confusedWith?: string; modality?: Modality; ms?: number }[];
  xp?: number;
}

export function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
const pick = <T,>(a: T[], n: number) => shuffle(a).slice(0, n);

/**
 * 4 options for a sign. With higher difficulty, distractors the learner actually confused with
 * this sign come first (discrimination practice); otherwise same-unit signs.
 */
export function signOptions(id: string, profile?: Profile, n = 4): string[] {
  const s = getSign(id)!;
  const confusions = profile && profile.difficulty > -0.2
    ? Object.entries(profile.items[id]?.confusions ?? {}).sort((a, b) => b[1] - a[1]).map(([k]) => k).filter((k) => SIGNS.has(k))
    : [];
  const sameUnit = [...SIGNS.values()].filter((o) => o.id !== id && o.unit === s.unit).map((o) => o.id);
  const sameKind = [...SIGNS.values()].filter((o) => o.id !== id && o.kind === s.kind && o.unit !== s.unit).map((o) => o.id);
  const distract = [...new Set([...confusions.slice(0, 2), ...pick(sameUnit, n), ...pick(sameKind, n)])].slice(0, n - 1);
  return shuffle([id, ...distract]);
}
export function phraseOptions(id: string, n = 4): string[] {
  return shuffle([id, ...pick([...PHRASES.keys()].filter((o) => o !== id), n - 1)]);
}

const SPELL_BANK = ["BAD", "BAG", "BED", "BIG", "CAB", "DEAF", "FACE", "HI", "ICE", "AGE", "CAFE", "HIDE", "FIG",
  "DOG", "CAT", "MOM", "DAD", "SUN", "RED", "BOX", "JOB", "KIND", "LION", "MILK", "PARK", "QUIZ", "ZOO", "YES",
  "WIND", "VAN", "TOWN", "STAR", "BLUE", "PINK", "LOVE", "WORK", "PIZZA", "WATER", "HAPPY", "FRIEND", "SCHOOL"];
/** A word made only of the given letters (falls back to the whole alphabet). */
export function spellWord(letters: string[], difficulty = 0) {
  const set = new Set(letters.map((id) => (id.startsWith("L-") ? id.slice(2) : id)));
  let ok = SPELL_BANK.filter((w) => [...w].every((c) => set.has(c)));
  if (!ok.length) ok = SPELL_BANK.filter((w) => [...w].every((c) => SIGNS.has(letterId(c))));
  const long = ok.filter((w) => (difficulty > 0.2 ? w.length >= 4 : w.length <= 4));
  return pick(long.length ? long : ok, 1)[0] ?? "HI";
}

// ---- placement test -------------------------------------------------------------------------
export interface PlacementQ { level: 1 | 2 | 3; ex: Exercise }
export function buildPlacement(): PlacementQ[] {
  const ofUnit = (id: string) => UNITS[unitIndex(id)]?.items ?? [];
  const letters = pick([...ofUnit("abc1"), ...ofUnit("abc2"), ...ofUnit("abc3")], 2);
  const number = pick(ofUnit("numbers"), 1);
  const words = [...pick(ofUnit("greetings"), 1), ...pick([...ofUnit("family"), ...ofUnit("colors"), ...ofUnit("food")], 1)];
  const phrase = pick(ofUnit("phrases"), 1);
  const rec = (id: string): Exercise => ({ kind: "recognize", signId: id, options: signOptions(id) });
  return [
    ...letters.map((id) => ({ level: 1 as const, ex: rec(id) })),
    ...number.map((id) => ({ level: 1 as const, ex: rec(id) })),
    ...words.map((id) => ({ level: 2 as const, ex: rec(id) })),
    ...phrase.map((id) => ({ level: 3 as const, ex: { kind: "phrase", phraseId: id, options: phraseOptions(id) } as Exercise })),
  ];
}

/** Highest level whose questions were (mostly) answered correctly, and every level below it. */
export function placementResult(qs: PlacementQ[], correct: boolean[]) {
  let demonstrated = 0;
  for (const lvl of [1, 2, 3] as const) {
    const idx = qs.map((q, i) => (q.level === lvl ? i : -1)).filter((i) => i >= 0);
    const ok = idx.filter((i) => correct[i]).length;
    if (idx.length && ok >= Math.ceil(idx.length * 0.66)) demonstrated = lvl;
    else break;
  }
  const startUnit = ["abc1", "greetings", "core", "phrases"][demonstrated];
  return { demonstrated, startUnit };
}
