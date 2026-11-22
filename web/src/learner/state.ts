/**
 * The learner state as a pure fold over the event log (SPEC §7.3–§7.7, §8.4). Nothing derived is
 * stored as truth: the state is rebuilt from the log, v1 rows included (data/ upcasts them).
 *
 *   evidence     knowledge at once: BKT, evidence ladder, counters, confusions, back-off;
 *                the FSRS review waits for the card's exit (the exit refines the grade)
 *   card.exit    the exit rules (swipes.ts): FSRS grade, §7.5 swipe effects, challenge, preferences
 *   card.shown   closes cards left open (crash, closed tab) with the default column, opens the new one
 *   card.result  XP, daily counts, completion
 *
 * Folding is incremental: a fold applies events one at a time, and `learnerStateOf()` remembers the
 * folds of the last few logs, so appending one event to a log applies one event (D-C11). Snapshots
 * close the cards still open on a copy, so the live fold isn't affected.
 */
import type { EventOf, LearningEvent } from "../data/events";
import { bktExposure, bktRetrieval, checkParams } from "./bkt";
import { INITIAL_UNITS, refreshUnits } from "./curriculum";
import { dayKey } from "./days";
import {
  clamp, isMet, raise, updateFormat, updateItem, updateSkill, withP, without,
  type Draft, type ItemSkillState, type LearnerState, type OpenCard,
} from "./model";
import {
  ACCURACY_START, BACKOFF_STEP, BACKOFF_WRONGS, CHALLENGE_MAX, CHALLENGE_MIN, MAX_ERRORS_KEPT, STRONG_CHECKS,
  type BktParams,
} from "./params";
import { gradeAtExit, review } from "./schedule";
import { closeCard } from "./swipes";

type Evidence = EventOf<"evidence">;

export function newDraft(): Draft {
  const d: Draft = {
    events: 0, lastTs: 0, cards: 0, sessions: 0,
    items: new Map(), formats: new Map(),
    c: 0, accuracy: ACCURACY_START, xp: 0,
    days: new Map(), openUnits: new Set(INITIAL_UNITS), testedOut: new Set(),
    unitRuns: new Map(), trackRuns: new Map(), wrongStreak: 0,
    gameBest: new Map(), open: new Map(),
  };
  refreshUnits(d);
  return d;
}

/** Copies the containers; records are immutable and shared. */
function cloneDraft(d: Draft): Draft {
  return {
    ...d,
    items: new Map(d.items), formats: new Map(d.formats), days: new Map(d.days),
    openUnits: new Set(d.openUnits), testedOut: new Set(d.testedOut),
    unitRuns: new Map(d.unitRuns), trackRuns: new Map(d.trackRuns),
    gameBest: new Map(d.gameBest), open: new Map(d.open),
  };
}

function toState(d: Draft): LearnerState {
  return {
    events: d.events, lastTs: d.lastTs, cards: d.cards, sessions: d.sessions,
    items: d.items, formats: d.formats, c: d.c, accuracy: d.accuracy, xp: d.xp, days: d.days,
    openUnits: d.openUnits, testedOut: d.testedOut, unitRuns: d.unitRuns, trackRuns: d.trackRuns,
    wrongStreak: d.wrongStreak, ...(d.backoff ? { backoff: d.backoff } : {}), gameBest: d.gameBest,
  };
}

// ── evidence ───────────────────────────────────────────────────────────────────────────────────

const isSelfGraded = (e: Evidence) => !!e.selfGraded || e.check === "mirror" || e.check === "self";

function exposed(rec: ItemSkillState, ts: number): ItemSkillState {
  const next = withP(rec, bktExposure(rec.pKnown));
  return raise({ ...next, exposures: next.exposures + 1, lastTs: Math.max(next.lastTs, ts) }, "exposed");
}

function retrieved(rec: ItemSkillState, e: Evidence, params: BktParams, cardIndex: number): ItemSkillState {
  const correct = !!e.correct;
  let next: ItemSkillState = {
    ...rec,
    attempts: rec.attempts + 1,
    correct: rec.correct + (correct ? 1 : 0),
    streak: correct ? rec.streak + 1 : 0,
    lastTs: Math.max(rec.lastTs, e.ts),
  };
  if (correct) {
    // self-grades never verify anything (D-C13): they count neither as a strong check nor as a day
    const day = dayKey(e.ts);
    const checked = !isSelfGraded(e);
    next = {
      ...next,
      correctDays: !checked || next.correctDays.includes(day) ? next.correctDays : [...next.correctDays, day],
      strongCorrect: next.strongCorrect || (checked && STRONG_CHECKS.includes(e.check)),
    };
    // a correct answer on a later card ends the relearn
    if (next.relearnSince !== undefined && cardIndex > next.relearnSince) next = without(next, "relearnSince");
  } else {
    next = {
      ...next,
      errorTs: [...next.errorTs, e.ts].slice(-MAX_ERRORS_KEPT),
      errorCards: [...next.errorCards, cardIndex].slice(-MAX_ERRORS_KEPT),
      confusions: e.confusedWith ? { ...next.confusions, [e.confusedWith]: (next.confusions[e.confusedWith] ?? 0) + 1 } : next.confusions,
      relearnSince: cardIndex,
    };
  }
  next = withP(next, bktRetrieval(next.pKnown, correct, params));
  // a correct answer is practice; a wrong one on a claim fails its verification
  if (correct) return raise(next, "practiced");
  return next.evidence === "claimed" ? { ...next, evidence: "exposed" } : raise(next, "exposed");
}

/** Knowledge from one evidence event (BKT, ladder, counters); returns the BKT params of a retrieval. */
function learn(d: Draft, e: Evidence, cardIndex: number): BktParams | null {
  const params = e.kind === "retrieval" ? checkParams(e) : null;
  updateSkill(d, e.itemId, e.skill, (rec) => (params ? retrieved(rec, e, params, cardIndex) : exposed(rec, e.ts)));
  updateItem(d, e.itemId, (item) => {
    const next = item.introducedCard === undefined ? { ...item, introducedCard: cardIndex } : item;
    // any retrieval on a later card tests a pending claim
    return params && next.probeSince !== undefined && cardIndex > next.probeSince ? without(next, "probeSince") : next;
  });
  return params;
}

function applyEvidence(d: Draft, e: Evidence) {
  const card = d.open.get(e.cardId);
  if (!card) {
    // evidence outside an open card (not written by the feed): knowledge and memory at once
    const params = learn(d, e, d.cards);
    if (params) updateSkill(d, e.itemId, e.skill, (rec) => ({ ...rec, card: review(rec.card, e.ts, gradeAtExit({ correct: !!e.correct, selfGraded: isSelfGraded(e) }, null)) }));
    refreshUnits(d);
    return;
  }
  const params = learn(d, e, card.index);
  card.lastTs = Math.max(card.lastTs, e.ts);
  const skills = card.evidenceSkills.get(e.itemId) ?? new Set();
  card.evidenceSkills.set(e.itemId, skills.add(e.skill));
  if (!params) return;
  const correct = !!e.correct;
  card.retrievals.push({ itemId: e.itemId, skill: e.skill, correct, selfGraded: isSelfGraded(e), ts: e.ts });
  if (correct) {
    d.wrongStreak = 0;
    return;
  }
  // back-off (§7.6): 3 wrong retrievals in a row lower the challenge, at most once per card
  if (++d.wrongStreak < BACKOFF_WRONGS) return;
  d.wrongStreak = 0;
  if (card.backedOff) return;
  card.backedOff = true;
  d.c = clamp(d.c + BACKOFF_STEP, CHALLENGE_MIN, CHALLENGE_MAX);
  d.backoff = { itemId: e.itemId, skill: e.skill, card: card.index };
}

// ── cards ──────────────────────────────────────────────────────────────────────────────────────

function closeOpenCards(d: Draft) {
  for (const card of [...d.open.values()]) closeCard(d, card, null, card.completed, card.lastTs);
}

function openCard(d: Draft, e: EventOf<"card.shown">) {
  // a card shown while another is still open: the other one was left without an exit (§7.4)
  closeOpenCards(d);
  d.cards++;
  const card: OpenCard = {
    cardId: e.cardId, format: e.format, items: e.items, index: d.cards,
    newItems: e.items.filter((id) => !isMet(d.items.get(id))),
    retrievals: [], evidenceSkills: new Map(), completed: false, backedOff: false, lastTs: e.ts,
  };
  d.open.set(e.cardId, card);
  updateFormat(d, e.format, (f) => ({ ...f, shown: f.shown + 1 }));
}

/** Applies one event to the draft. */
export function applyEvent(d: Draft, e: LearningEvent) {
  d.events++;
  d.lastTs = Math.max(d.lastTs, e.ts);
  switch (e.type) {
    case "app.open":
      d.sessions++;
      break;
    case "card.shown":
      openCard(d, e);
      break;
    case "evidence":
      applyEvidence(d, e);
      break;
    case "card.result": {
      d.xp += e.xp;
      const day = dayKey(e.ts);
      d.days.set(day, (d.days.get(day) ?? 0) + 1);
      const card = d.open.get(e.cardId);
      if (card) {
        card.completed = true;
        card.lastTs = Math.max(card.lastTs, e.ts);
      }
      break;
    }
    case "card.exit": {
      const card = d.open.get(e.cardId);
      if (card) closeCard(d, card, e.exit, e.completed, e.ts);
      break;
    }
    case "game.score":
      d.gameBest.set(e.format, Math.max(d.gameBest.get(e.format) ?? -Infinity, e.score));
      break;
    case "format.unmute":
      // a fresh start: old dislikes would mute it again at the next one
      updateFormat(d, e.format, (f) => ({ ...f, muted: false, dislikes: 0 }));
      break;
    // camera.off and settings.set are no learner state: the camera session and the feed read them
  }
}

// ── folds ──────────────────────────────────────────────────────────────────────────────────────

export interface LearnerFold {
  /** events applied so far */
  readonly count: number;
  apply(e: LearningEvent): void;
  /** The state now, with the cards still open closed by the default column. */
  snapshot(): LearnerState;
}

export function createFold(): LearnerFold {
  const d = newDraft();
  let cached: LearnerState | undefined;
  return {
    get count() {
      return d.events;
    },
    apply(e) {
      applyEvent(d, e);
      cached = undefined;
    },
    snapshot() {
      if (!cached) {
        const copy = cloneDraft(d);
        closeOpenCards(copy);
        cached = toState(copy);
      }
      return cached;
    },
  };
}

/** The pure fold, from scratch. */
export function foldLearnerState(events: readonly LearningEvent[]): LearnerState {
  const fold = createFold();
  for (const e of events) fold.apply(e);
  return fold.snapshot();
}

interface Memo {
  fold: LearnerFold;
  source: readonly LearningEvent[];
  first?: LearningEvent;
  last?: LearningEvent;
  state: LearnerState;
}
const memos: Memo[] = [];
const MEMO_SIZE = 4;

/**
 * The state of a log, memoised. Logs are append-only: when `events` starts with the events of a
 * log folded before (same objects), only the new tail is applied. Keeps the last few logs (the
 * real one and the dev sandbox are read on the same page).
 */
export function learnerStateOf(events: readonly LearningEvent[]): LearnerState {
  // same array and same length: nothing new (an array grown in place takes the prefix path)
  let memo = memos.find((m) => m.source === events && m.fold.count === events.length);
  if (!memo) {
    const prefix = memos.find((m) => {
      const n = m.fold.count;
      return n > 0 && n <= events.length && events[0] === m.first && events[n - 1] === m.last;
    });
    const fold = prefix?.fold ?? createFold();
    for (let i = fold.count; i < events.length; i++) fold.apply(events[i]);
    memo = prefix ?? { fold, source: events, state: fold.snapshot() };
    memo.source = events;
    memo.first = events[0];
    memo.last = events[events.length - 1];
    memo.state = fold.snapshot();
  }
  const at = memos.indexOf(memo);
  if (at >= 0) memos.splice(at, 1);
  memos.unshift(memo);
  if (memos.length > MEMO_SIZE) memos.length = MEMO_SIZE;
  return memo.state;
}
