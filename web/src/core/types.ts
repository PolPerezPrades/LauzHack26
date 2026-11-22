/**
 * Core contracts of the feed (SPEC §8.3). Formats, card sources, the feed and the event log all
 * speak these shapes. Pure types: nothing here imports React or touches the DOM at runtime.
 */
import type { LearningEvent } from "../data/events";
import type { Messages } from "../i18n/en";

export type Skill = "receptive" | "productive";
export type CheckMode = "choice" | "build" | "typed" | "camera" | "mirror" | "self" | "game" | "none";
export type Family = "lesson" | "question" | "quiz" | "game" | "system";
export type ExitKind = "next" | "too_easy" | "too_hard" | "dislike_format" | "camera_off";
export type ItemKind = "letter" | "number" | "word" | "phrase";

/**
 * A format id ("quiz-choice", "game-rain"…). It stays a plain string because the log may hold ids of
 * formats that no longer exist (or synthetic ones from v1 logs): consumers must tolerate unknown ids.
 */
export type FormatId = string;

/** Who produced a card (logged in `card.shown`). "v1" marks cards synthesised from v1 logs. */
export type CardSourceKind = "picker" | "recommender" | "dev" | "v1";

export type ReasonValue = string | number | boolean;
/** Machine-readable reason attached to a card (SPEC §7.9), e.g. `{ code: "due_review", item: "w-hello", r: 0.72 }`. */
export interface Reason {
  readonly code: string;
  readonly [key: string]: ReasonValue;
}

/** Feature breakdown of a recommender score (filled from Part D on). */
export interface ScoreBreakdown {
  readonly total: number;
  readonly features: Readonly<Record<string, number>>;
}

/** One observation about an item and skill, as a task reports it. */
export interface EvidenceDraft {
  itemId: string;
  skill: Skill;
  kind: "retrieval" | "exposure";
  correct?: boolean;
  check: CheckMode;
  /** number of options shown (choice checks) */
  options?: number;
  similarity?: "low" | "high";
  selfGraded?: boolean;
  hints?: number;
  /** logged only, never used for knowledge (SPEC §7.10) */
  ms?: number;
  confusedWith?: string;
}

export interface TaskFeedback {
  correct: boolean;
  /** the correct answer, shown after a mistake (honest feedback) */
  answer?: string;
  note?: string;
}

/** What a task reports when it ends: exactly once per card. */
export interface TaskResult {
  /** 0..1 share of correct retrievals (1 for pure lessons) */
  success: number;
  evidence: EvidenceDraft[];
  /** games only */
  score?: number;
  xp: number;
  /**
   * The banner shown until the card leaves on its own: every result auto-advances (SPEC §3.4), and
   * a wrong answer stays longer, by the length of its `answer` and `note`. Formats should always
   * send it: without it there is no banner, and the card leaves after the correct-answer delay.
   */
  feedback?: TaskFeedback;
}

/** A card proposal before the source gives it an id. */
export interface CandidateDraft<P extends object = object> {
  format: FormatId;
  items: string[];
  pool?: string[];
  /** passage / dialogue id for content-driven formats */
  content?: string;
  params: P;
  reasons?: Reason[];
}

/** A concrete card: what the feed shows and logs in `card.shown`. */
export interface CardPlan<P extends object = object> {
  cardId: string;
  format: FormatId;
  /** target items (what the card is about) */
  items: string[];
  pool?: string[];
  content?: string;
  params: P;
  reasons: Reason[];
  score?: ScoreBreakdown;
}

/** Deterministic random source (core/rng.ts). */
export interface Rng {
  /** uniform in [0, 1) */
  next(): number;
}

/** Learner status of an item for one skill (SPEC §7.3). */
export type ItemStatus = "new" | "learning" | "known" | "due";

/**
 * What a format may ask about the learner when it proposes cards (SPEC §7.8.1). Frozen in Part 0 so
 * that parts B–E can be built in parallel: `learner/queries.ts` implements it, first as a stub, then
 * with the real learner model (Part C). Changes are additive only (SPEC §9.0).
 *
 * Every list is in priority order, has at most `n` entries and leaves out the items the card source
 * wants to avoid. Generators choose items only through these lists, never by filtering statuses
 * themselves: dev forced mode answers every list with the content the developer picked.
 */
export interface LearnerQueries {
  /** Part A's list: the simple picker's curriculum walk. New generators use the lists below. */
  nextItems(kinds: readonly ItemKind[], n: number): string[];
  /** new items to introduce next: the frontier of the open units, in curriculum order (lessons) */
  frontier(kinds: readonly ItemKind[], n: number): string[];
  /** met items worth practising for a skill, most urgent first: relearn, due, learning, known */
  practice(skill: Skill, kinds: readonly ItemKind[], n: number): string[];
  /** items failed (or swiped "too hard") recently, most recent first (relearn lessons) */
  relearn(kinds: readonly ItemKind[], n: number): string[];
  /** items claimed "too easy" that wait for a verification probe (SPEC §7.7) */
  probes(kinds: readonly ItemKind[], n: number): string[];
  /** met items with pKnown ≥ minPKnown (default 0) for the skill, weakest first (game pools) */
  pool(skill: Skill, kinds: readonly ItemKind[], n: number, minPKnown?: number): string[];
  /** phrases eligible for quiz-build and sign-sentence (SPEC §4.6, §7.7) */
  eligiblePhrases(n: number): string[];
  /** items this one was confused with, most frequent first (distractors, minimal pairs) */
  confusions(itemId: string): string[];
  status(itemId: string, skill: Skill): ItemStatus;
  /** estimated probability that the item is learned for the skill, in [0, 1]; 0 if never met */
  pKnown(itemId: string, skill: Skill): number;
}

export interface GenContext {
  rng: Rng;
  /** effective challenge for this format, ce ∈ [−1, 1] (SPEC §7.6); 0 until the learner model exists */
  ce: number;
  cameraUsable: boolean;
}

/** One tunable parameter a format exposes to the dev-mode params picker. */
export interface ParamDescriptor {
  key: string;
  kind: "int";
  min: number;
  max: number;
  step?: number;
}

/** Pure metadata + generator of one format. No React. */
export interface TaskSpec<P extends object = object> {
  id: FormatId;
  family: Family;
  icon: string;
  /** title and one-line rules come from i18n `formats[i18nKey]` */
  i18nKey: string;
  requires: { camera: "required" | "optional" | "none"; itemKinds: ItemKind[] };
  trains: Skill[];
  /** typical duration in seconds */
  seconds: number;
  devOnly?: boolean;
  /** Next (swipe up) is allowed before completion: informative system cards such as the tutorial */
  nextAnytime?: boolean;
  /** parameters the dev-mode picker can override */
  devParams?: ParamDescriptor[];
  /** challenge level → concrete parameters */
  params(ce: number, ctx: GenContext): P;
  /** Proposes concrete candidates. `params`, when given, replaces `params(ctx.ce)` (dev overrides). */
  generate(q: LearnerQueries, ctx: GenContext, params?: P): CandidateDraft<P>[];
  /** Prompt text of the lightweight preview shown behind the current card, from the given strings. */
  preview(plan: CardPlan<P>, t: Messages): string;
}

export type CameraState = "unknown" | "available" | "in-use" | "off-this-session" | "denied" | "unavailable";
export type CameraOffReason = "user" | "denied" | "unavailable" | "error";

/** The camera gate every camera task goes through (implemented by camera/cameraSession.ts). */
export interface CameraSession {
  readonly state: CameraState;
  readonly usable: boolean;
  /** Opens (or reuses) the shared stream. Rejects when the camera isn't usable, recording failures. */
  acquire(): Promise<MediaStream>;
  release(): void;
  /** "Can't use the camera now": stops every track at once; camera formats are off until a new session. */
  optOut(): void;
}

/** React side: tasks/views.tsx maps a FormatId to a component with these props. */
export interface TaskViewProps<P extends object = object> {
  plan: CardPlan<P>;
  /** false while entering or leaving: no camera, timers or loops */
  active: boolean;
  camera: CameraSession;
  /** call exactly once */
  report(result: TaskResult): void;
}

/** A card the feed has shown or queued, oldest first. */
export interface CardRef {
  cardId: string;
  format: FormatId;
  items: readonly string[];
  /** how it left, once it has */
  exit?: ExitKind;
  /** in the feed's queue right now (current or next) */
  planned?: boolean;
}

export interface FeedContext {
  history: readonly CardRef[];
  /** the whole log (v2): sources fold it into learner queries or state (learner/queries.ts) */
  events: readonly LearningEvent[];
  cameraUsable: boolean;
  rng: Rng;
}

export interface CardAvoid {
  formats?: FormatId[];
  items?: string[];
}

/** The feed asks a CardSource for cards: the simple picker in Part A, the recommender from Part D, forced mode in dev. */
export interface CardSource {
  readonly kind: Exclude<CardSourceKind, "v1">;
  next(ctx: FeedContext, avoid?: CardAvoid): CardPlan | null;
}
