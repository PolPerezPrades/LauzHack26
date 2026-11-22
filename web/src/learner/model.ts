/**
 * The learner state (SPEC §7.3): its shape and the record helpers the fold uses.
 *
 * Records (items, skills, formats) are immutable: an update replaces the record. The fold mutates
 * only its containers (maps, sets, counters), so a snapshot copies the containers and shares the
 * records with the live fold, which keeps going without changing what the snapshot shows.
 */
import type { FormatId, Skill } from "../core/types";
import { clampP } from "./bkt";
import { KNOWN_ENTER, KNOWN_LEAVE, P0, VERIFIED_DAYS, VERIFIED_P } from "./params";
import type { FsrsCard } from "./schedule";

export const SKILLS: readonly Skill[] = ["receptive", "productive"];

/** What kind of proof exists (§7.3). It only moves up, except `claimed`, which drops to `exposed` when a probe fails. */
export type EvidenceLevel = "none" | "exposed" | "claimed" | "practiced" | "verified";
export const EVIDENCE_LEVELS: readonly EvidenceLevel[] = ["none", "exposed", "claimed", "practiced", "verified"];
const RANK = new Map(EVIDENCE_LEVELS.map((level, i) => [level, i]));
export const evidenceAtLeast = (e: EvidenceLevel, min: EvidenceLevel) => RANK.get(e)! >= RANK.get(min)!;

/** Per (item, skill) state (§7.3). */
export interface ItemSkillState {
  /** BKT probability that it is learned, in [0.01, 0.99]; P0 when first touched */
  readonly pKnown: number;
  /** the `known` latch: set at pKnown ≥ 0.85, cleared below 0.70 (hysteresis) */
  readonly known: boolean;
  readonly evidence: EvidenceLevel;
  /** FSRS card, created at the first retrieval (graded when the card exits) */
  readonly card?: FsrsCard;
  readonly attempts: number;
  readonly correct: number;
  /** consecutive correct retrievals */
  readonly streak: number;
  readonly exposures: number;
  /** ts of the last exposure or retrieval; 0 if none yet */
  readonly lastTs: number;
  /** distinct local days with a correct, not self-graded answer (`correctDays` of the spec is its length; D-C13) */
  readonly correctDays: readonly string[];
  /** a correct answer checked by camera, typed or build, not self-graded (for `verified`) */
  readonly strongCorrect: boolean;
  /** the last errors (max 10): their timestamps, and the card index of each */
  readonly errorTs: readonly number[];
  readonly errorCards: readonly number[];
  /** "confused with X" counts */
  readonly confusions: Readonly<Record<string, number>>;
  readonly tooEasy: number;
  readonly tooHard: number;
  /** "don't offer as new before card #N" (0 = no cooldown) */
  readonly cooldownUntilCard: number;
  /** card index of the failure or "too hard" that asks for a relearn; cleared by a correct answer on a later card */
  readonly relearnSince?: number;
}

/** One item: its two skills plus the item-level marks the queries need. */
export interface ItemState {
  readonly id: string;
  readonly receptive?: ItemSkillState;
  readonly productive?: ItemSkillState;
  /** card index of the claim that queued a verification probe; cleared once a retrieval tests the item */
  readonly probeSince?: number;
  /** card index at which a phrase swiped "too hard" asked for this sign first ("prerequisites first") */
  readonly prereqSince?: number;
  /** card index of the last "not this format" on a card about it, so it comes back in another format */
  readonly dislikedCard?: number;
  /** card index of its first exposure or retrieval (a claim is not an introduction) */
  readonly introducedCard?: number;
}

/** Per format (§7.3): Beta preference, counters, mute, challenge offset. */
export interface FormatState {
  readonly alpha: number;
  readonly beta: number;
  readonly shown: number;
  readonly completed: number;
  readonly dislikes: number;
  readonly muted: boolean;
  /** challenge offset cf ∈ [−1, 1] */
  readonly cf: number;
}

export const DEFAULT_FORMAT: FormatState = { alpha: 1, beta: 1, shown: 0, completed: 0, dislikes: 0, muted: false, cf: 0 };

/** The last back-off (§7.6): 3 wrong retrievals in a row, the last one on this item. */
export interface Backoff {
  readonly itemId: string;
  readonly skill: Skill;
  /** index of the card it happened on */
  readonly card: number;
}

/** The whole learner state: a pure fold over the event log (learner/state.ts). */
export interface LearnerState {
  /** events folded */
  readonly events: number;
  /** ts of the last event folded (the default "now" of the queries) */
  readonly lastTs: number;
  /** cards shown so far: the index of the latest card (cooldowns and windows count in cards) */
  readonly cards: number;
  /** app sessions (`app.open`) */
  readonly sessions: number;
  readonly items: ReadonlyMap<string, ItemState>;
  readonly formats: ReadonlyMap<FormatId, FormatState>;
  /** global challenge c ∈ [−1, 1] */
  readonly c: number;
  /** accuracy EMA over retrievals of completed cards */
  readonly accuracy: number;
  readonly xp: number;
  /** completed cards (`card.result`) per local day */
  readonly days: ReadonlyMap<string, number>;
  readonly openUnits: ReadonlySet<string>;
  readonly testedOut: ReadonlySet<string>;
  /** "too easy" claims in a row per unit and per track, for test-out (§7.7) */
  readonly unitRuns: ReadonlyMap<string, number>;
  readonly trackRuns: ReadonlyMap<string, number>;
  /** wrong retrievals in a row */
  readonly wrongStreak: number;
  readonly backoff?: Backoff;
  /** best `game.score` per format */
  readonly gameBest: ReadonlyMap<FormatId, number>;
}

/** One retrieval waiting for its card's exit (the FSRS grade is decided then). */
export interface Retrieval {
  readonly itemId: string;
  readonly skill: Skill;
  readonly correct: boolean;
  readonly selfGraded: boolean;
  readonly ts: number;
}

/** A card shown and not closed yet. */
export interface OpenCard {
  readonly cardId: string;
  readonly format: FormatId;
  /** target items (§7.5) */
  readonly items: readonly string[];
  /** its card index */
  readonly index: number;
  /** target items that were new when it was shown */
  readonly newItems: readonly string[];
  readonly retrievals: Retrieval[];
  /** skills with evidence on this card, per item */
  readonly evidenceSkills: Map<string, Set<Skill>>;
  completed: boolean;
  backedOff: boolean;
  lastTs: number;
}

/** The fold's working copy: the state with mutable containers, plus the open cards. */
export interface Draft {
  events: number;
  lastTs: number;
  cards: number;
  sessions: number;
  items: Map<string, ItemState>;
  formats: Map<FormatId, FormatState>;
  c: number;
  accuracy: number;
  xp: number;
  days: Map<string, number>;
  openUnits: Set<string>;
  testedOut: Set<string>;
  unitRuns: Map<string, number>;
  trackRuns: Map<string, number>;
  wrongStreak: number;
  backoff?: Backoff;
  gameBest: Map<FormatId, number>;
  open: Map<string, OpenCard>;
}

// ── records ────────────────────────────────────────────────────────────────────────────────────

export function emptySkill(): ItemSkillState {
  return {
    pKnown: P0, known: false, evidence: "none", attempts: 0, correct: 0, streak: 0, exposures: 0, lastTs: 0,
    correctDays: [], strongCorrect: false, errorTs: [], errorCards: [], confusions: {}, tooEasy: 0, tooHard: 0,
    cooldownUntilCard: 0,
  };
}

/** `verified` = pKnown ≥ 0.85 AND (a strong correct answer OR correct answers on ≥ 2 days) (§7.3). */
function promote(rec: ItemSkillState): ItemSkillState {
  if (rec.evidence === "verified" || !evidenceAtLeast(rec.evidence, "practiced") || rec.pKnown < VERIFIED_P) return rec;
  return rec.strongCorrect || rec.correctDays.length >= VERIFIED_DAYS ? { ...rec, evidence: "verified" } : rec;
}

/** Sets pKnown (clamped), moves the known latch, and promotes the evidence when it qualifies. */
export function withP(rec: ItemSkillState, p: number): ItemSkillState {
  const pKnown = clampP(p);
  const known = rec.known ? pKnown >= KNOWN_LEAVE : pKnown >= KNOWN_ENTER;
  return promote({ ...rec, pKnown, known });
}

/** Moves the evidence up to `level` (never down), then checks `verified`. */
export function raise(rec: ItemSkillState, level: EvidenceLevel): ItemSkillState {
  return evidenceAtLeast(rec.evidence, level) ? promote(rec) : promote({ ...rec, evidence: level });
}

// ── draft access ───────────────────────────────────────────────────────────────────────────────

export const itemOf = (d: Draft, id: string): ItemState => d.items.get(id) ?? { id };

export function updateItem(d: Draft, id: string, fn: (item: ItemState) => ItemState) {
  d.items.set(id, fn(itemOf(d, id)));
}

/** Replaces one skill of an item, creating it (pKnown = P0) the first time it is touched. */
export function updateSkill(d: Draft, id: string, skill: Skill, fn: (rec: ItemSkillState) => ItemSkillState) {
  updateItem(d, id, (item) => ({ ...item, [skill]: fn(item[skill] ?? emptySkill()) }));
}

export function updateFormat(d: Draft, format: FormatId, fn: (f: FormatState) => FormatState) {
  d.formats.set(format, fn(d.formats.get(format) ?? DEFAULT_FORMAT));
}

// ── reading ────────────────────────────────────────────────────────────────────────────────────

/** Met = some skill has evidence (watched, answered or claimed). */
export const isMet = (item: ItemState | undefined): boolean =>
  !!item && SKILLS.some((s) => (item[s]?.evidence ?? "none") !== "none");

export const skillOf = (state: Pick<LearnerState, "items">, id: string, skill: Skill): ItemSkillState | undefined =>
  state.items.get(id)?.[skill];

export const formatOf = (state: Pick<LearnerState, "formats">, format: FormatId): FormatState =>
  state.formats.get(format) ?? DEFAULT_FORMAT;

/** Highest pKnown over the skills (unlock rules); 0 if never met. */
export function maxPKnown(item: ItemState | undefined): number {
  let best = 0;
  for (const s of SKILLS) {
    const rec = item?.[s];
    if (rec && rec.evidence !== "none" && rec.pKnown > best) best = rec.pKnown;
  }
  return best;
}

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** A copy of a record without one optional field (records are immutable). */
export function without<T extends object, K extends keyof T>(obj: T, key: K): T {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}
