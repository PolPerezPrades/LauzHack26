/**
 * Append-only learning-event log, schema v2 (SPEC §8.4). Every interaction is appended here and the
 * learner state is always a pure fold over it: nothing derived is stored as truth.
 *
 * Logs written by the pre-redesign app (schema v1) are upcast when read, best effort: each v1
 * `answer` becomes a synthetic one-card lifecycle (card.shown → evidence → card.result → card.exit
 * with the default "next" exit), so later folds see one uniform shape. Other v1 events are dropped.
 */
import { newId } from "../core/ids";
import type { CameraOffReason, CardSourceKind, CheckMode, EvidenceDraft, ExitKind, FormatId, Reason, ScoreBreakdown } from "../core/types";
import type { V1Event } from "./eventsV1";

export const EVENT_SCHEMA_VERSION = 2;

export type Device = "mobile" | "desktop";

/** Preferences kept in the log via `settings.set` (later parts add more fields). */
export interface Settings {
  soundMuted: boolean;
}

interface OnCard {
  sessionId: string;
  cardId: string;
  format: FormatId;
}

export type EventBody =
  | { type: "app.open"; sessionId: string; device: Device; cameraAvailable: boolean; appVersion: string }
  | (OnCard & {
      type: "card.shown"; items: string[]; pool?: string[]; content?: string; params: object;
      reasons: Reason[]; score?: ScoreBreakdown; source: CardSourceKind;
    })
  | (OnCard & EvidenceDraft & { type: "evidence" })
  | (OnCard & { type: "card.result"; success: number; xp: number; ms: number })
  | (OnCard & { type: "card.exit"; exit: ExitKind; completed: boolean; msVisible: number })
  | (OnCard & { type: "game.score"; score: number; params: object })
  | { type: "camera.off"; sessionId: string; reason: CameraOffReason }
  | { type: "format.unmute"; format: FormatId }
  | ({ type: "settings.set" } & Partial<Settings>);

export type EventType = EventBody["type"];

export interface EventMeta {
  /** unique id (stable across export/import) */
  id: string;
  /** monotonic local sequence assigned by the repository */
  seq?: number;
  /** epoch ms */
  ts: number;
  /** event schema version */
  v: number;
}

export type LearningEvent = EventBody & EventMeta;
export type EventOf<T extends EventType> = Extract<LearningEvent, { type: T }>;

/** Any row a repository or an export may hold: a current event or one written by schema v1. */
export type StoredEvent = LearningEvent | V1Event;

export function makeEvent(body: EventBody, ts = Date.now(), id = newId()): LearningEvent {
  return { ...body, id, ts, v: EVENT_SCHEMA_VERSION };
}

/** Brings rows written by older schema versions to the current shape (order preserved). */
export function upcastEvents(rows: readonly StoredEvent[]): LearningEvent[] {
  const out: LearningEvent[] = [];
  for (const row of rows) {
    if (isV1(row)) out.push(...upcastV1(row));
    else out.push(row);
  }
  return out;
}

// rows exported before versioning existed carry no `v`: they are v1
const isV1 = (e: StoredEvent): e is V1Event => (typeof e.v === "number" ? e.v : 1) < 2;

/** v1 activity → the v2 format that replaced it (SPEC §2.2). Unknown activities keep a "v1-" id. */
const V1_FORMAT: Record<string, FormatId> = {
  recognize: "quiz-choice", phrase: "quiz-choice", quiz: "quiz-choice", placement: "quiz-choice",
  imitate: "lesson", camera: "lesson",
  rain: "game-rain", memory: "game-memory", match: "game-match", spell: "game-spell-read", sprint: "game-spell-sprint",
  comprehension: "game-story", conversation: "game-dialogue", story: "game-dialogue",
};

/** v1 activity → how its answers were checked (SPEC §8.4); anything else counts as a 4-option choice. */
const V1_CHECK: Record<string, CheckMode> = {
  recognize: "choice", quiz: "choice", rain: "choice", match: "choice", memory: "choice",
  phrase: "choice", placement: "choice", comprehension: "choice",
  imitate: "camera", camera: "camera", sprint: "camera",
  spell: "typed",
  conversation: "build", story: "build",
};

const V1_SESSION = "v1";

function upcastV1(e: V1Event): LearningEvent[] {
  if (e.type !== "answer") return [];
  const card: OnCard = { sessionId: e.sessionId ?? V1_SESSION, cardId: `v1-${e.id}`, format: V1_FORMAT[e.activity] ?? `v1-${e.activity}` };
  const check = V1_CHECK[e.activity] ?? "choice";
  const meta = (suffix: string): EventMeta => ({ id: `${e.id}${suffix}`, ...(e.seq !== undefined ? { seq: e.seq } : {}), ts: e.ts, v: EVENT_SCHEMA_VERSION });
  const ms = e.ms ?? 0;
  const evidence: EvidenceDraft = {
    itemId: e.itemId, skill: e.modality, kind: "retrieval", correct: e.correct, check,
    ...(check === "choice" ? { options: 4 } : {}),
    ...(e.ms !== undefined ? { ms: e.ms } : {}),
    ...(e.confusedWith ? { confusedWith: e.confusedWith } : {}),
  };
  return [
    { ...card, type: "card.shown", items: [e.itemId], params: {}, reasons: [{ code: "v1_upcast", activity: e.activity }], source: "v1", ...meta(":shown") },
    // the evidence keeps the original id, so every v1 answer stays traceable
    { ...card, ...evidence, type: "evidence", ...meta("") },
    { ...card, type: "card.result", success: e.correct ? 1 : 0, xp: 0, ms, ...meta(":result") },
    { ...card, type: "card.exit", exit: "next", completed: true, msVisible: ms, ...meta(":exit") },
  ];
}
