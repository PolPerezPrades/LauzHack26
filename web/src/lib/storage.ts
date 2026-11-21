/** Learner profile + progress, persisted in localStorage (no account needed for the hackathon). */
import type { Phrase } from "../content/curriculum";

export type Difficulty = "easier" | "same" | "harder";

export interface Profile {
  selfLevel: 0 | 1 | 2 | 3; // 0 never signed · 1 knows alphabet · 2 basic words · 3 can form sentences
  goalMin: 5 | 10 | 15;
  camera: boolean;
  startUnit: number;        // index into UNITS chosen by the placement test
  placementDone: boolean;
  createdAt: string;
}

export interface ItemStat {
  strength: number; // 0..5, +1 per correct answer, -1 per mistake
  seen: number;
  correct: number;
  last: number;     // epoch ms
}

export interface Progress {
  xp: number;
  streak: number;
  bestStreak: number;
  lastActiveDay: string | null;
  today: { day: string; seconds: number; xp: number };
  items: Record<string, ItemStat>;
  sessions: number;
  difficulty: Difficulty;
  focus: string[];
  aiPhrases: Phrase[];
  sprintBest: number;
}

const KEY = "signa:v1";

export interface Saved {
  profile: Profile | null;
  progress: Progress;
}

export function emptyProgress(): Progress {
  return {
    xp: 0, streak: 0, bestStreak: 0, lastActiveDay: null, today: { day: "", seconds: 0, xp: 0 },
    items: {}, sessions: 0, difficulty: "same", focus: [], aiPhrases: [], sprintBest: 0,
  };
}

export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Saved;
      return { profile: s.profile ?? null, progress: { ...emptyProgress(), ...s.progress } };
    }
  } catch {
    /* storage blocked or corrupted: start fresh */
  }
  return { profile: null, progress: emptyProgress() };
}

export function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore: progress just won't persist */
  }
}

export function reset() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
