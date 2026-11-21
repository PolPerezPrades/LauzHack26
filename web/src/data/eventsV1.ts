/**
 * Frozen event schema v1 (the pre-redesign app). Nothing writes these any more: they exist for the
 * v1 → v2 upcaster (data/events.ts) and for the old modules (learning/, activities/, lib/engine.ts)
 * that later parts port or delete. Don't extend this file.
 */
export type Modality = "receptive" | "productive";
export type Device = "mobile" | "desktop";

/** What the learner had available in a v1 session. */
export interface SessionContext {
  camera: boolean;
  device: Device;
  minutes: number;
  hour: number;
}

export interface PlanStepSummary { activity: string; items: string[]; why: string[]; content?: string }

export type V1EventBody =
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

export type V1Event = V1EventBody & { id: string; seq?: number; ts: number; v: number };

/** localStorage progress of the very first prototype, imported into v1 logs as one event. */
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
