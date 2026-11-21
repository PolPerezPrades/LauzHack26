/**
 * Core contracts of the feed (SPEC §8.3). Formats, card sources, the feed and the event log all
 * speak these shapes. Pure types: nothing here imports React or touches the DOM at runtime.
 */
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
  /** no feedback = nothing to show (no overlay, no auto-advance) */
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

/**
 * What a format may ask about the learner when it proposes cards. Part A only needs a curriculum
 * walker; Part B adds a richer stub and Part C replaces it with the real learner queries.
 */
export interface LearnerQueries {
  /** Up to `n` items of the given kinds, in the order this source wants them practised. */
  nextItems(kinds: readonly ItemKind[], n: number): string[];
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
