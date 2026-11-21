/** Lesson engine: placement test, adaptive session building, mastery, XP and streaks. */
import { CAMERA_LETTERS, PHRASES, SIGNS, UNITS, letterId, unitIndex, type Unit } from "../content/curriculum";
import type { Difficulty, Profile, Progress } from "./storage";

export type Exercise =
  | { kind: "intro"; signId: string }
  | { kind: "recognize"; signId: string; options: string[] }
  | { kind: "phrase"; phraseId: string; options: string[] }
  | { kind: "camera"; letter: string }
  | { kind: "match"; signIds: string[]; seconds: number }
  | { kind: "spell"; word: string; msPerLetter: number };

export interface Answer {
  correct: boolean;
  items: { id: string; correct: boolean }[];
  xp?: number; // override the default XP for this exercise
}

export const EXERCISES_PER_GOAL: Record<number, number> = { 5: 8, 10: 12, 15: 16 };
const NEW_PER_LESSON: Record<Difficulty, number> = { easier: 2, same: 3, harder: 4 };
const MASTERED = 2; // strength needed for an item to count as learned

// ---- small utils --------------------------------------------------------------------------
export function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
const pick = <T,>(a: T[], n: number) => shuffle(a).slice(0, n);
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---- unit status ----------------------------------------------------------------------------
export function unitProgress(u: Unit, p: Progress) {
  if (!u.items.length) return 0;
  return u.items.filter((id) => (p.items[id]?.strength ?? 0) >= MASTERED).length / u.items.length;
}
export function currentUnitIndex(profile: Profile, p: Progress) {
  for (let i = profile.startUnit; i < UNITS.length; i++) {
    if (UNITS[i].items.length && unitProgress(UNITS[i], p) < 0.8) return i;
  }
  return UNITS.length - 1;
}
export type UnitStatus = "skipped" | "done" | "current" | "locked";
export function unitStatus(i: number, profile: Profile, p: Progress): UnitStatus {
  const cur = currentUnitIndex(profile, p);
  if (i === cur) return "current";
  if (i > cur) return "locked";
  return i < profile.startUnit && unitProgress(UNITS[i], p) < 0.8 ? "skipped" : "done";
}

// ---- recording answers ----------------------------------------------------------------------
export function recordItems(p: Progress, items: Answer["items"]): Progress {
  const next = { ...p.items };
  for (const { id, correct } of items) {
    const s = next[id] ?? { strength: 0, seen: 0, correct: 0, last: 0 };
    next[id] = {
      strength: Math.max(0, Math.min(5, s.strength + (correct ? 1 : -1))),
      seen: s.seen + 1,
      correct: s.correct + (correct ? 1 : 0),
      last: Date.now(),
    };
  }
  return { ...p, items: next };
}

/** Adds XP / time and updates the daily streak (consecutive days with at least one session). */
export function finishSession(p: Progress, xp: number, seconds: number): Progress {
  const today = dayKey();
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  let streak = p.streak;
  if (p.lastActiveDay !== today) streak = p.lastActiveDay === yesterday ? streak + 1 : 1;
  const sameDay = p.today.day === today;
  return {
    ...p,
    xp: p.xp + xp,
    streak,
    bestStreak: Math.max(p.bestStreak, streak),
    lastActiveDay: today,
    sessions: p.sessions + 1,
    today: { day: today, seconds: (sameDay ? p.today.seconds : 0) + seconds, xp: (sameDay ? p.today.xp : 0) + xp },
  };
}
export function todaySeconds(p: Progress) {
  return p.today.day === dayKey() ? p.today.seconds : 0;
}

export function xpFor(ex: Exercise, a: Answer) {
  if (a.xp !== undefined) return a.xp;
  if (!a.correct || ex.kind === "intro") return 0;
  return ex.kind === "camera" ? 15 : ex.kind === "phrase" ? 12 : 10;
}

// ---- distractors ----------------------------------------------------------------------------
function signOptions(id: string, n = 4): string[] {
  const s = SIGNS.get(id)!;
  const sameUnit = [...SIGNS.values()].filter((o) => o.id !== id && o.unit === s.unit).map((o) => o.id);
  const sameKind = [...SIGNS.values()].filter((o) => o.id !== id && o.kind === s.kind && o.unit !== s.unit).map((o) => o.id);
  const distract = [...pick(sameUnit, n - 1), ...pick(sameKind, n)].slice(0, n - 1);
  return shuffle([id, ...distract]);
}
function phraseOptions(id: string, n = 4): string[] {
  const others = [...PHRASES.keys()].filter((o) => o !== id);
  return shuffle([id, ...pick(others, n - 1)]);
}

// ---- fingerspelling words -------------------------------------------------------------------
const SPELL_BANK = ["BAD", "BAG", "BED", "BIG", "CAB", "DEAF", "FACE", "HI", "ICE", "AGE", "CAFE", "HIDE", "FIG",
  "DOG", "CAT", "MOM", "DAD", "SUN", "RED", "BOX", "JOB", "KIND", "LION", "MILK", "PARK", "QUIZ", "ZOO", "YES",
  "WIND", "VAN", "TOWN", "STAR", "BLUE", "PINK", "LOVE", "WORK", "PIZZA", "WATER", "HAPPY", "FRIEND", "SCHOOL"];
function spellWord(letters: Set<string>, level: number) {
  const ok = SPELL_BANK.filter((w) => [...w].every((c) => letters.has(c)));
  const byLen = ok.filter((w) => (level <= 1 ? w.length <= 4 : w.length >= 4));
  return pick(byLen.length ? byLen : ok, 1)[0] ?? "HI";
}

// ---- lesson builder -------------------------------------------------------------------------
export function buildLesson(profile: Profile, p: Progress, unitIdx = currentUnitIndex(profile, p)): Exercise[] {
  const unit = UNITS[unitIdx];
  const total = EXERCISES_PER_GOAL[profile.goalMin] ?? 8;
  const diff = p.difficulty;
  const seen = (id: string) => (p.items[id]?.seen ?? 0) > 0;
  const strength = (id: string) => p.items[id]?.strength ?? 0;

  const earlier = UNITS.slice(Math.max(0, unitIdx - 3), unitIdx).filter((u) => u.id !== "phrases").flatMap((u) => u.items);
  const learnedEarlier = earlier.filter(seen);
  const weakFirst = (ids: string[]) => [...ids].sort((a, b) => {
    const fa = p.focus.includes(a) ? -10 : 0;
    const fb = p.focus.includes(b) ? -10 : 0;
    return fa + strength(a) - (fb + strength(b)) || Math.random() - 0.5;
  });

  const ex: Exercise[] = [];

  if (unit.id === "phrases") {
    const phrases = weakFirst(unit.items).slice(0, Math.max(4, total - 3));
    for (const id of phrases) ex.push({ kind: "phrase", phraseId: id, options: phraseOptions(id) });
    const vocab = [...new Set(phrases.flatMap((id) => PHRASES.get(id)!.signs))];
    if (vocab.length >= 4) ex.splice(2, 0, { kind: "match", signIds: pick(vocab, 4), seconds: matchSeconds(diff) });
    for (const id of pick(vocab, 2)) ex.push({ kind: "recognize", signId: id, options: signOptions(id) });
    return ex.slice(0, total);
  }

  const fresh = unit.items.filter((id) => !seen(id)).slice(0, NEW_PER_LESSON[diff]);
  for (const id of fresh) {
    ex.push({ kind: "intro", signId: id });
    ex.push({ kind: "recognize", signId: id, options: signOptions(id) });
  }

  const pool = weakFirst([...unit.items.filter((id) => seen(id) && !fresh.includes(id)), ...learnedEarlier]);
  const practice = [...fresh, ...pool];
  const extra: Exercise[] = [];

  const isLetters = unit.id.startsWith("abc");
  const knownLetters = new Set(
    UNITS.filter((u, i) => u.id.startsWith("abc") && i <= unitIdx).flatMap((u) => u.items).map((id) => id.slice(2)),
  );
  if (profile.camera && (isLetters || knownLetters.size >= 9)) {
    const camPool = (isLetters ? practice : [...knownLetters].map(letterId))
      .map((id) => id.slice(2)).filter((L) => CAMERA_LETTERS.includes(L));
    for (const L of pick([...new Set(camPool)], isLetters ? 2 : 1)) extra.push({ kind: "camera", letter: L });
  }
  const matchPool = [...new Set([...unit.items.filter((id) => seen(id) || fresh.includes(id)), ...learnedEarlier])];
  if (matchPool.length >= 4) extra.push({ kind: "match", signIds: pick(matchPool, 4), seconds: matchSeconds(diff) });
  if (knownLetters.size >= 6 && (!isLetters || unitIdx > 0 || seen(letterId("I")))) {
    const allLetters = new Set([...SIGNS.values()].filter((s) => s.kind === "letter").map((s) => s.en));
    const letters = isLetters ? knownLetters : allLetters;
    extra.push({ kind: "spell", word: spellWord(letters, unit.level), msPerLetter: spellSpeed(diff, unit.level) });
  }

  const reviews: Exercise[] = [];
  for (const id of pool) reviews.push({ kind: "recognize", signId: id, options: signOptions(id) });

  // fill: new items first (intro → recognize), then a shuffled mix of special activities + reviews.
  // Intro cards don't count towards the goal-sized number of exercises.
  const scored = ex.length - fresh.length;
  let rest = shuffle([...extra, ...reviews.slice(0, Math.max(0, total - scored - extra.length))]);
  if (scored + rest.length < total && practice.length) {
    // small pool (e.g. first lesson): repeat recognitions of the new items in a different order
    const again = shuffle([...practice, ...practice]).map((id): Exercise => ({ kind: "recognize", signId: id, options: signOptions(id) }));
    rest = [...rest, ...again].slice(0, total - scored);
  }
  return [...ex, ...rest].slice(0, total + fresh.length);
}

function matchSeconds(d: Difficulty) {
  return d === "harder" ? 30 : d === "easier" ? 55 : 40;
}
function spellSpeed(d: Difficulty, level: number) {
  const base = level >= 2 ? 750 : 1000;
  return Math.round(base * (d === "harder" ? 0.75 : d === "easier" ? 1.3 : 1));
}

// ---- placement test -------------------------------------------------------------------------
export interface PlacementQ {
  level: 1 | 2 | 3;
  ex: Exercise;
}
export function buildPlacement(): PlacementQ[] {
  const ofUnit = (id: string) => UNITS[unitIndex(id)]?.items ?? [];
  const letters = pick([...ofUnit("abc1"), ...ofUnit("abc2"), ...ofUnit("abc3")], 2);
  const number = pick(ofUnit("numbers"), 1);
  const words = [...pick(ofUnit("greetings"), 1), ...pick([...ofUnit("family"), ...ofUnit("colors"), ...ofUnit("food")], 1)];
  const phrase = pick(ofUnit("phrases"), 1);
  const qs: PlacementQ[] = [
    ...letters.map((id) => ({ level: 1 as const, ex: { kind: "recognize", signId: id, options: signOptions(id) } as Exercise })),
    ...number.map((id) => ({ level: 1 as const, ex: { kind: "recognize", signId: id, options: signOptions(id) } as Exercise })),
    ...words.map((id) => ({ level: 2 as const, ex: { kind: "recognize", signId: id, options: signOptions(id) } as Exercise })),
    ...phrase.map((id) => ({ level: 3 as const, ex: { kind: "phrase", phraseId: id, options: phraseOptions(id) } as Exercise })),
  ];
  return qs;
}

/** Highest level whose questions were all answered correctly (and every level below it). */
export function placementResult(qs: PlacementQ[], correct: boolean[]) {
  let demonstrated = 0;
  for (const lvl of [1, 2, 3] as const) {
    const idx = qs.map((q, i) => (q.level === lvl ? i : -1)).filter((i) => i >= 0);
    const ok = idx.filter((i) => correct[i]).length;
    if (idx.length && ok >= Math.ceil(idx.length * 0.66)) demonstrated = lvl;
    else break;
  }
  const startUnitId = ["abc1", "greetings", "core", "phrases"][demonstrated];
  return { demonstrated, startUnit: Math.max(0, unitIndex(startUnitId)) };
}
