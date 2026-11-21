/**
 * Learner profile = pure fold over the event log (no other source of truth). Rebuilding from the
 * log after a reload, an import or a schema migration always yields the same profile.
 *
 *  - Memory per item AND modality (receptive = understanding a sign, productive = making it):
 *    FSRS cards (ts-fsrs) — stability, difficulty, next review — they evolve separately.
 *  - Errors: counts, recency and confusions ("chose N when it was M").
 *  - Behaviour: activities started / completed / abandoned, session lengths, streak, XP.
 *  - Difficulty controller: keeps recent accuracy in the 80–85 % band (zone of proximal development).
 */
import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";
import type { LearningEvent, Modality } from "../data/events";

export const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: false, enable_short_term: true });

export const TARGET_ACCURACY: [number, number] = [0.8, 0.85];
const EMA_ALPHA = 0.12;
/** typical answer time per activity (ms) — slower than ~2x means "Hard", faster than half "Easy" */
const EXPECTED_MS: Record<string, number> = {
  recognize: 5000, phrase: 9000, quiz: 4000, match: 7000, rain: 3500, memory: 6000,
  camera: 7000, imitate: 7000, spell: 9000, sprint: 6000, comprehension: 12000, conversation: 15000, story: 12000,
};

export interface Memory {
  card: Card;
  reviews: number;
  correct: number;
  streak: number;      // consecutive correct answers
  lastTs: number;
}

export interface ItemState {
  id: string;
  receptive?: Memory;
  productive?: Memory;
  introducedTs?: number;
  confusions: Record<string, number>;  // other item → times confused with it
  errorTs: number[];                   // timestamps of the last errors (max 10)
  rtMs?: number;                       // EMA of answer time
}

export interface ActivityStats { started: number; completed: number; abandoned: number; answers: number; correct: number }

export interface Profile {
  settings: { onboarded: boolean; selfLevel: 0 | 1 | 2 | 3; goalMin: number; cameraPref: boolean; startUnit: string | null; placementDone: boolean };
  items: Record<string, ItemState>;
  activities: Record<string, ActivityStats>;
  sessions: { started: number; completed: number; abandoned: number; avgSeconds: number; lastTs: number | null };
  xp: number;
  streak: number;
  bestStreak: number;
  activeDays: string[];
  today: { day: string; seconds: number; xp: number };
  accuracyEma: number;       // recent accuracy (EMA)
  answers: number;
  difficulty: number;        // -1 (easier) … +1 (harder), from accuracyEma vs target band
  gameBest: Record<string, number>;
  eventCount: number;
}

export function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const prevDay = (day: string) => dayKey(new Date(`${day}T12:00:00`).getTime() - 86_400_000);

export function emptyProfile(): Profile {
  return {
    settings: { onboarded: false, selfLevel: 0, goalMin: 10, cameraPref: true, startUnit: null, placementDone: false },
    items: {}, activities: {}, sessions: { started: 0, completed: 0, abandoned: 0, avgSeconds: 0, lastTs: null },
    xp: 0, streak: 0, bestStreak: 0, activeDays: [], today: { day: "", seconds: 0, xp: 0 },
    accuracyEma: 0.82, answers: 0, difficulty: 0, gameBest: {}, eventCount: 0,
  };
}

export function gradeFor(correct: boolean, activity: string, ms?: number): Grade {
  if (!correct) return Rating.Again;
  const exp = EXPECTED_MS[activity] ?? 5000;
  if (ms && ms > exp * 2.2) return Rating.Hard;
  if (ms && ms < exp * 0.45) return Rating.Easy;
  return Rating.Good;
}

function review(mem: Memory | undefined, ts: number, grade: Grade, correct: boolean): Memory {
  const base = mem ?? { card: createEmptyCard(new Date(ts)), reviews: 0, correct: 0, streak: 0, lastTs: ts };
  const next = scheduler.next(base.card, new Date(Math.max(ts, base.card.last_review?.getTime() ?? 0)), grade);
  return { card: next.card, reviews: base.reviews + 1, correct: base.correct + (correct ? 1 : 0), streak: correct ? base.streak + 1 : 0, lastTs: ts };
}

const item = (p: Profile, id: string): ItemState => (p.items[id] ??= { id, confusions: {}, errorTs: [] });
const act = (p: Profile, id: string): ActivityStats => (p.activities[id] ??= { started: 0, completed: 0, abandoned: 0, answers: 0, correct: 0 });

export interface ReduceOptions {
  /** unit ids in curriculum order (to read v1 progress, which stored the start unit as an index) */
  unitOrder: string[];
  now?: number;
}

export function buildProfile(events: LearningEvent[], opts: ReduceOptions): Profile {
  const p = emptyProfile();
  const steps = new Map<string, string[]>(); // `${session}:${step}` → items
  const days = new Map<string, { seconds: number; xp: number }>();
  let sessionSeconds = 0;

  for (const e of events) {
    p.eventCount++;
    switch (e.type) {
      case "profile.set":
        p.settings = { ...p.settings, onboarded: true, selfLevel: e.selfLevel, goalMin: e.goalMin, cameraPref: e.cameraPref };
        break;
      case "settings.set":
        if (e.goalMin) p.settings.goalMin = e.goalMin;
        if (e.cameraPref !== undefined) p.settings.cameraPref = e.cameraPref;
        break;
      case "placement.done":
        p.settings.startUnit = e.startUnit;
        p.settings.placementDone = true;
        break;
      case "session.start":
        p.sessions.started++;
        break;
      case "activity.start":
        act(p, e.activity).started++;
        steps.set(`${e.sessionId}:${e.step}`, e.items);
        break;
      case "activity.end": {
        const a = act(p, e.activity);
        if (e.status === "completed") a.completed++;
        else a.abandoned++;
        if (e.activity === "intro" && e.status === "completed") {
          for (const id of steps.get(`${e.sessionId}:${e.step}`) ?? []) item(p, id).introducedTs ??= e.ts;
        }
        break;
      }
      case "answer": {
        const it = item(p, e.itemId);
        const grade = gradeFor(e.correct, e.activity, e.ms);
        it[e.modality] = review(it[e.modality], e.ts, grade, e.correct);
        it.introducedTs ??= e.ts;
        if (!e.correct) {
          it.errorTs = [...it.errorTs.slice(-9), e.ts];
          if (e.confusedWith) it.confusions[e.confusedWith] = (it.confusions[e.confusedWith] ?? 0) + 1;
        }
        if (e.ms) it.rtMs = it.rtMs ? it.rtMs * 0.7 + e.ms * 0.3 : e.ms;
        const a = act(p, e.activity);
        a.answers++;
        if (e.correct) a.correct++;
        p.answers++;
        p.accuracyEma = p.accuracyEma * (1 - EMA_ALPHA) + (e.correct ? 1 : 0) * EMA_ALPHA;
        break;
      }
      case "session.end": {
        if (e.status === "completed") p.sessions.completed++;
        else p.sessions.abandoned++;
        p.sessions.lastTs = e.ts;
        sessionSeconds += e.seconds;
        p.xp += e.xp;
        const d = dayKey(e.ts);
        const cur = days.get(d) ?? { seconds: 0, xp: 0 };
        days.set(d, { seconds: cur.seconds + e.seconds, xp: cur.xp + e.xp });
        break;
      }
      case "game.score":
        p.gameBest[e.activity] = Math.max(p.gameBest[e.activity] ?? 0, e.score);
        break;
      case "legacy.import": {
        const d = e.data;
        if (d.profile) {
          p.settings = {
            ...p.settings, onboarded: true, selfLevel: d.profile.selfLevel, goalMin: d.profile.goalMin, cameraPref: d.profile.camera,
            placementDone: d.profile.placementDone, startUnit: opts.unitOrder[d.profile.startUnit] ?? null,
          };
        }
        p.xp += d.xp;
        p.sessions.completed += d.sessions;
        p.gameBest.sprint = Math.max(p.gameBest.sprint ?? 0, d.sprintBest);
        if (d.lastActiveDay) {
          let day = d.lastActiveDay;
          for (let k = 0; k < Math.max(1, d.streak); k++, day = prevDay(day)) if (!days.has(day)) days.set(day, { seconds: 0, xp: 0 });
        }
        for (const [id, s] of Object.entries(d.items)) {
          if (!s.seen) continue;
          const g: Grade = s.strength <= 0 ? Rating.Again : s.strength === 1 ? Rating.Hard : s.strength <= 3 ? Rating.Good : Rating.Easy;
          const it = item(p, id);
          const m = review(undefined, s.last || e.ts, g, s.strength > 0);
          it.receptive = { ...m, reviews: s.seen, correct: s.correct };
          it.introducedTs = s.last || e.ts;
        }
        break;
      }
    }
  }

  // derived: streak from active days, today's totals, difficulty, session averages
  const active = [...days.keys()].sort();
  p.activeDays = active;
  const now = opts.now ?? Date.now();
  const today = dayKey(now);
  let streak = 0;
  let day = days.has(today) ? today : prevDay(today);
  while (days.has(day)) { streak++; day = prevDay(day); }
  p.streak = streak;
  let best = 0, run = 0, prev = "";
  for (const d of active) { run = prev && prevDay(d) === prev ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  p.bestStreak = Math.max(best, streak);
  p.today = { day: today, ...(days.get(today) ?? { seconds: 0, xp: 0 }) };
  const ended = p.sessions.completed + p.sessions.abandoned;
  p.sessions.avgSeconds = ended ? Math.round(sessionSeconds / ended) : 0;
  const [lo, hi] = TARGET_ACCURACY;
  p.difficulty = p.answers < 5 ? 0 : Math.max(-1, Math.min(1, (p.accuracyEma - (lo + hi) / 2) * 7));
  return p;
}

// ---- queries used by the orchestrator / UI ----------------------------------------------------
export function retrievability(m: Memory | undefined, now: number): number {
  if (!m || m.card.state === State.New) return 0;
  return scheduler.get_retrievability(m.card, new Date(now), false) as number;
}
export function isDue(m: Memory | undefined, now: number) {
  return !!m && m.card.due.getTime() <= now;
}
/** 0..1 how well an item is known in a modality: recall probability × how settled the memory is. */
export function mastery(m: Memory | undefined, now: number) {
  if (!m) return 0;
  return retrievability(m, now) * Math.min(1, m.card.stability / 7);
}
export function isWeak(it: ItemState, now: number) {
  const recentErrors = it.errorTs.filter((t) => now - t < 7 * 86_400_000).length;
  const r = it.receptive;
  return recentErrors >= 2 || (!!r && r.reviews >= 3 && r.correct / r.reviews < 0.6);
}
export function topConfusion(it: ItemState): string | undefined {
  return Object.entries(it.confusions).sort((a, b) => b[1] - a[1])[0]?.[0];
}
export const MODALITIES: Modality[] = ["receptive", "productive"];
