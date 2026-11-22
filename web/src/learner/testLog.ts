/**
 * Builds event logs for the learner tests: cards with their evidence, result and exit, at
 * controlled times, with deterministic ids. Test support only (imported by *.test.ts files).
 */
import type { EvidenceDraft, ExitKind, FormatId, Skill } from "../core/types";
import { makeEvent, type EventBody, type LearningEvent } from "../data/events";

/** 2026-11-02 10:00 local time */
export const T0 = new Date(2026, 10, 2, 10, 0, 0).getTime();
export const MINUTE = 60_000;
export const DAY = 86_400_000;

export interface CardSpec {
  format?: FormatId;
  items?: string[];
  evidence?: EvidenceDraft[];
  /** null: the card is never closed by an exit */
  exit?: ExitKind | null;
  /** default: true when there is evidence */
  completed?: boolean;
  xp?: number;
}

export interface AnswerOptions extends Partial<Omit<EvidenceDraft, "itemId" | "correct">> {
  format?: FormatId;
  exit?: ExitKind | null;
}

export interface TestLog {
  readonly events: LearningEvent[];
  /** time of the next event */
  readonly now: number;
  advance(ms: number): void;
  /** a new app session */
  open(sessionId?: string): void;
  emit(body: EventBody): LearningEvent;
  /** one card: shown, evidence, result (when completed), exit; returns its id */
  card(spec?: CardSpec): string;
  /** a quiz-choice card (by default) with one retrieval */
  answer(itemId: string, correct: boolean, opts?: AnswerOptions): string;
  /** a lesson: receptive exposure plus a productive self-check */
  lesson(itemId: string, opts?: { correct?: boolean; exit?: ExitKind | null }): string;
  /** a card left before completing it */
  swipe(items: string[], exit: ExitKind, format?: FormatId): string;
}

export function createLog(start = T0): TestLog {
  const events: LearningEvent[] = [];
  let t = start;
  let cards = 0;
  let sessionId = "s1";
  const emit = (body: EventBody) => {
    const e = makeEvent(body, t, `e${events.length + 1}`);
    events.push(e);
    t += 1000;
    return e;
  };
  const log: TestLog = {
    events,
    get now() {
      return t;
    },
    advance: (ms) => {
      t += ms;
    },
    open(id = `s${events.length}`) {
      sessionId = id;
      emit({ type: "app.open", sessionId, device: "desktop", cameraAvailable: true, appVersion: "test" });
    },
    emit,
    card({ format = "quiz-choice", items = [], evidence = [], exit = "next", completed, xp = 10 } = {}) {
      const cardId = `c${++cards}`;
      const on = { sessionId, cardId, format };
      emit({ ...on, type: "card.shown", items, params: {}, reasons: [], source: "picker" });
      for (const ev of evidence) emit({ ...on, ...ev, type: "evidence" });
      const done = completed ?? evidence.length > 0;
      const retrievals = evidence.filter((e) => e.kind === "retrieval");
      if (done) {
        const success = retrievals.length ? retrievals.filter((e) => e.correct).length / retrievals.length : 1;
        emit({ ...on, type: "card.result", success, xp, ms: 1500 });
      }
      if (exit) emit({ ...on, type: "card.exit", exit, completed: done, msVisible: 2500 });
      return cardId;
    },
    answer(itemId, correct, { format = "quiz-choice", exit = "next", skill = "receptive" as Skill, kind = "retrieval", check = "choice", ...rest } = {}) {
      const evidence: EvidenceDraft = { itemId, skill, kind, correct, check, ...(check === "choice" && rest.options === undefined ? { options: 4 } : {}), ...rest };
      return log.card({ format, items: [itemId], evidence: [evidence], exit });
    },
    lesson(itemId, { correct = true, exit = "next" } = {}) {
      return log.card({
        format: "lesson",
        items: [itemId],
        evidence: [
          { itemId, skill: "receptive", kind: "exposure", check: "none" },
          { itemId, skill: "productive", kind: "retrieval", correct, check: "self", selfGraded: true },
        ],
        exit,
      });
    },
    swipe(items, exit, format = "lesson") {
      return log.card({ format, items, exit, completed: false });
    },
  };
  return log;
}
