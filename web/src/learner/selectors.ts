/**
 * Read-only views of the learner state (SPEC §7.3–§7.8) for the recommender (Part D: predicted
 * success, reviews, pacing, preferences, challenge, windows) and the settings sheet (Part F1: XP,
 * streak, cards today, per-unit progress, muted formats). Pure: answers that depend on the clock
 * take `now` (epoch ms); answers counted in cards are relative to the card being chosen next.
 */
import { UNITS, itemKindOf, unitOrder } from "../content/curriculum";
import type { CheckMode, FormatId, ItemKind, ItemStatus, Skill } from "../core/types";
import { checkParams } from "./bkt";
import { inFlightItems, isKnown, maxInFlight as maxInFlightFor, nextCardIndex, overdueCount, pacing } from "./curriculum";
import { dayKey, streakFrom } from "./days";
import { SKILLS, clamp, formatOf, isMet, skillOf, type FormatState, type ItemSkillState, type LearnerState } from "./model";
import { CHALLENGE_MAX, CHALLENGE_MIN, P0, PROBE_WINDOW, RELEARN_WINDOW, TARGET_SUCCESS } from "./params";
import { isDue, retrievability } from "./schedule";

export { pacing, type Pacing } from "./curriculum";

// ── status and estimates ───────────────────────────────────────────────────────────────────────

/** Status of one (item, skill) record (§7.3): claims count as learning; known items can be due. */
export function statusOf(rec: ItemSkillState | undefined, now: number): ItemStatus {
  if (!rec || rec.evidence === "none") return "new";
  if (!isKnown(rec)) return "learning";
  return isDue(rec.card, now) ? "due" : "known";
}

export const itemStatus = (state: LearnerState, id: string, skill: Skill, now: number): ItemStatus =>
  statusOf(skillOf(state, id, skill), now);

/** pKnown for the queries: 0 if the (item, skill) was never met. */
export function pKnownOf(state: LearnerState, id: string, skill: Skill): number {
  const rec = skillOf(state, id, skill);
  return rec && rec.evidence !== "none" ? rec.pKnown : 0;
}

/** FSRS retrievability now; 1 without an FSRS card. */
export const retrievabilityOf = (state: LearnerState, id: string, skill: Skill, now: number): number =>
  retrievability(skillOf(state, id, skill)?.card, now);

/** How a card would check an item (the evidence a format would log). */
export interface CheckSpec {
  check: CheckMode;
  options?: number;
  similarity?: "low" | "high";
  selfGraded?: boolean;
}

/**
 * Predicted success of one tested (item, skill) (§7.8.2):
 * pCorrect = g + (1 − g − s)·pKnown·R, with the prior P0 for a pair never met. 1 for `none`.
 */
export function predictSuccess(state: LearnerState, id: string, skill: Skill, check: CheckSpec, now: number): number {
  const params = checkParams(check);
  if (!params) return 1;
  const rec = skillOf(state, id, skill);
  const pKnown = rec && rec.evidence !== "none" ? rec.pKnown : P0;
  const pRecall = pKnown * retrievability(rec?.card, now);
  return params.g + (1 - params.g - params.s) * pRecall;
}

/** All must be right (quiz-build: the product over the signs). */
export const predictAll = (state: LearnerState, ids: readonly string[], skill: Skill, check: CheckSpec, now: number): number =>
  ids.reduce((p, id) => p * predictSuccess(state, id, skill, check, now), 1);

/** The mean over a game's pool. */
export const predictMean = (state: LearnerState, ids: readonly string[], skill: Skill, check: CheckSpec, now: number): number =>
  ids.length ? ids.reduce((sum, id) => sum + predictSuccess(state, id, skill, check, now), 0) / ids.length : 0;

// ── reviews and pacing ─────────────────────────────────────────────────────────────────────────

export interface DueReview {
  itemId: string;
  skill: Skill;
  /** retrievability now (below the target retention) */
  r: number;
}

/** Due (item, skill) pairs, most overdue (lowest retrievability) first. */
export function dueReviews(state: LearnerState, now: number, opts: { skill?: Skill; kinds?: readonly ItemKind[] } = {}): DueReview[] {
  const out: DueReview[] = [];
  for (const item of state.items.values()) {
    const kind = itemKindOf(item.id);
    if (opts.kinds && (!kind || !opts.kinds.includes(kind))) continue;
    for (const skill of opts.skill ? [opts.skill] : SKILLS) {
      const rec = item[skill];
      if (statusOf(rec, now) === "due") out.push({ itemId: item.id, skill, r: retrievability(rec!.card, now) });
    }
  }
  return out.sort((a, b) => a.r - b.r || a.itemId.localeCompare(b.itemId));
}

/** Items being learned (claims excluded, D-C05), counted once per item. */
export const inFlight = (state: LearnerState): number => inFlightItems(state).length;
export const maxInFlight = (state: LearnerState): number => maxInFlightFor(state.c);
/** Known (item, skill) pairs due now. */
export const overdue = (state: LearnerState, now: number): number => overdueCount(state, now);
export const pacingAllowsNew = (state: LearnerState, now: number): boolean => pacing(state, now).allowsNew;

/** Items ever introduced (watched or answered; claims are not introductions). */
export const introducedCount = (state: LearnerState): number =>
  [...state.items.values()].filter((item) => item.introducedCard !== undefined).length;

// ── formats and challenge ──────────────────────────────────────────────────────────────────────

/** Beta preference, counters, mute and challenge offset of a format (neutral if never shown). */
export const formatPreference = (state: LearnerState, format: FormatId): FormatState => formatOf(state, format);

export const isMuted = (state: LearnerState, format: FormatId): boolean => formatOf(state, format).muted;

export const mutedFormats = (state: LearnerState): FormatId[] =>
  [...state.formats].filter(([, f]) => f.muted).map(([id]) => id).sort();

/** Global challenge c ∈ [−1, 1]. */
export const challenge = (state: LearnerState): number => state.c;
/** Challenge offset cf of a format. */
export const formatOffset = (state: LearnerState, format: FormatId): number => formatOf(state, format).cf;
/** ce = clamp(c + cf, −1, 1): what a format maps to its parameters (§7.6). */
export const effectiveChallenge = (state: LearnerState, format: FormatId): number =>
  clamp(state.c + formatOf(state, format).cf, CHALLENGE_MIN, CHALLENGE_MAX);

/** target = clamp(0.80 − 0.10·c, 0.65, 0.92) (§7.6). */
export const targetSuccess = (state: LearnerState): number =>
  clamp(TARGET_SUCCESS.base + TARGET_SUCCESS.perC * state.c, TARGET_SUCCESS.min, TARGET_SUCCESS.max);

// ── windows, in cards ──────────────────────────────────────────────────────────────────────────

export interface RelearnWindow {
  /** cards between the failure (or "too hard") and the card chosen now */
  since: number;
  /** 3–6 cards ago (§7.8.3) */
  inWindow: boolean;
}

/** The latest relearn mark of an item (either skill), or null if it needs no relearn. */
export function relearnWindow(state: LearnerState, id: string): RelearnWindow | null {
  const marks = SKILLS.map((s) => skillOf(state, id, s)?.relearnSince).filter((m): m is number => m !== undefined);
  if (!marks.length) return null;
  const since = nextCardIndex(state) - Math.max(...marks);
  return { since, inWindow: since >= RELEARN_WINDOW.min && since <= RELEARN_WINDOW.max };
}

export interface ProbeWindow {
  /** cards between the claim and the card chosen now */
  since: number;
  /** 5–10 cards after the claim (§7.7) */
  due: boolean;
  /** more than 10 cards after it */
  overdue: boolean;
}

/** The pending verification probe of an item, or null. */
export function probeWindow(state: LearnerState, id: string): ProbeWindow | null {
  const at = state.items.get(id)?.probeSince;
  if (at === undefined) return null;
  const since = nextCardIndex(state) - at;
  return { since, due: since >= PROBE_WINDOW.min && since <= PROBE_WINDOW.max, overdue: since > PROBE_WINDOW.max };
}

/** Errors of an (item, skill) on cards with index ≥ `sinceCard` (e.g. "recent errors" of §7.8.3). */
export const errorsSince = (state: LearnerState, id: string, skill: Skill, sinceCard: number): number =>
  (skillOf(state, id, skill)?.errorCards ?? []).filter((c) => c >= sinceCard).length;

/** Cards since a "not this format" exit on a card about the item (its content comes back in another format), or null. */
export function dislikedSince(state: LearnerState, id: string): number | null {
  const at = state.items.get(id)?.dislikedCard;
  return at === undefined ? null : nextCardIndex(state) - at;
}

// ── progress (settings sheet) ──────────────────────────────────────────────────────────────────

export const xpOf = (state: LearnerState): number => state.xp;

/** Consecutive local days with a completed card, ending today or yesterday. */
export const streakOf = (state: LearnerState, now: number): number => streakFrom(state.days, now);

/** Cards completed today (local day). */
export const cardsToday = (state: LearnerState, now: number): number => state.days.get(dayKey(now)) ?? 0;

export const bestScore = (state: LearnerState, format: FormatId): number | undefined => state.gameBest.get(format);

export interface UnitProgress {
  unit: string;
  total: number;
  /** items met (watched, answered or claimed) */
  met: number;
  /** share of the unit's items known for each skill, in [0, 1] (receptive and productive mastery) */
  receptive: number;
  productive: number;
  open: boolean;
  testedOut: boolean;
}

export function unitProgress(state: LearnerState): UnitProgress[] {
  return UNITS.map((u) => {
    const items = unitOrder(u.id);
    const known = (skill: Skill) => (items.length ? items.filter((id) => isKnown(skillOf(state, id, skill))).length / items.length : 0);
    return {
      unit: u.id,
      total: items.length,
      met: items.filter((id) => isMet(state.items.get(id))).length,
      receptive: known("receptive"),
      productive: known("productive"),
      open: state.openUnits.has(u.id),
      testedOut: state.testedOut.has(u.id),
    };
  });
}
