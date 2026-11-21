/**
 * Immutable learning-event log (schema versioned). Every interaction is appended here and the
 * learner profile is DERIVED from it (src/learning/profile.ts). This log is also the context a
 * language model will read in phase 3 (src/learning/extensions.ts).
 */
export const EVENT_SCHEMA_VERSION = 1;

export type Modality = "receptive" | "productive";
export type Device = "mobile" | "desktop";

/** What the learner has available right now (decides which activities are possible). */
export interface SessionContext {
  camera: boolean;
  device: Device;
  minutes: number;
  hour: number;
}

export interface PlanStepSummary { activity: string; items: string[]; why: string[]; content?: string }

export type EventBody =
  | { type: "profile.set"; selfLevel: 0 | 1 | 2 | 3; goalMin: number; cameraPref: boolean }
  | { type: "settings.set"; goalMin?: number; cameraPref?: boolean }
  | { type: "placement.done"; startUnit: string; demonstrated: number }
  | { type: "session.start"; sessionId: string; mode: "auto" | "topic" | "game"; target?: string; ctx: SessionContext; plan: PlanStepSummary[]; log: string[] }
  | { type: "activity.start"; sessionId: string; step: number; activity: string; items: string[]; content?: string }
  | {
      type: "answer"; sessionId?: string; activity: string; itemId: string; modality: Modality;
      correct: boolean; ms?: number; confusedWith?: string; detail?: string;
    }
  | { type: "activity.end"; sessionId: string; step: number; activity: string; status: "completed" | "abandoned"; ms: number; xp: number }
  | { type: "session.end"; sessionId: string; status: "completed" | "abandoned"; xp: number; seconds: number }
  | { type: "game.score"; activity: string; score: number }
  | { type: "legacy.import"; data: LegacyProgress };

export type EventType = EventBody["type"];

export type LearningEvent = EventBody & {
  /** unique id (stable across export/import) */
  id: string;
  /** monotonic local sequence assigned by the repository */
  seq?: number;
  /** epoch ms */
  ts: number;
  /** event schema version */
  v: number;
};

/** v1 (localStorage) progress, imported once as a single event. */
export interface LegacyProgress {
  profile: { selfLevel: 0 | 1 | 2 | 3; goalMin: number; camera: boolean; startUnit: number; placementDone: boolean } | null;
  xp: number;
  streak: number;
  bestStreak: number;
  lastActiveDay: string | null;
  sessions: number;
  sprintBest: number;
  items: Record<string, { strength: number; seen: number; correct: number; last: number }>;
}

export function makeEvent(body: EventBody, ts = Date.now()): LearningEvent {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${ts}-${Math.random().toString(36).slice(2)}`;
  return { ...body, id, ts, v: EVENT_SCHEMA_VERSION };
}

/** Upcaster: bring events written by older schema versions to the current shape. */
export function upcast(e: LearningEvent): LearningEvent {
  // v1 is the first version; future migrations go here (e.g. if (e.v === 1) {...; e.v = 2}).
  return e;
}
