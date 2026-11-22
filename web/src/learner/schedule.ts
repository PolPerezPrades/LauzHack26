/**
 * Memory per (item, skill): an FSRS card (ts-fsrs) for review timing and retrievability (SPEC §7.4).
 * The grade is decided when the card leaves the feed, so the exit refines it the way Anki's four
 * buttons do: wrong → Again; correct → Good, Easy with "too easy", Hard with "too hard".
 *
 * Cards are stored as plain objects with epoch-ms dates, so the learner state copies cheaply and
 * compares with toEqual. No fuzz (determinism) and no short-term steps, so FSRS's due date matches
 * the spec's "retrievability below the target retention" (D-C07).
 */
import { createEmptyCard, fsrs, Rating, type Card, type CardInput, type Grade, type State } from "ts-fsrs";
import type { ExitKind } from "../core/types";
import { TARGET_RETENTION } from "./params";

export const scheduler = fsrs({ request_retention: TARGET_RETENTION, enable_fuzz: false, enable_short_term: false });

export interface FsrsCard {
  /** epoch ms */
  readonly due: number;
  readonly stability: number;
  readonly difficulty: number;
  readonly elapsed_days: number;
  readonly scheduled_days: number;
  readonly learning_steps: number;
  readonly reps: number;
  readonly lapses: number;
  readonly state: State;
  /** epoch ms */
  readonly last_review?: number;
}

const toInput = (c: FsrsCard): CardInput => ({ ...c, last_review: c.last_review ?? null });

function toPlain(c: Card): FsrsCard {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    ...(c.last_review ? { last_review: c.last_review.getTime() } : {}),
  };
}

/** One review. Creates the card on the first one (a retrieval, never an exposure). */
export function review(card: FsrsCard | undefined, ts: number, grade: Grade): FsrsCard {
  // logs can hold timestamps that go backwards (clock changes, merged imports): never review in the past
  const at = Math.max(ts, card?.last_review ?? -Infinity);
  const input = card ? toInput(card) : createEmptyCard(new Date(at));
  return toPlain(scheduler.next(input, new Date(at), grade).card);
}

/** Probability of recall at `now`; 1 when there is no card yet (§7.8.2). */
export function retrievability(card: FsrsCard | undefined, now: number): number {
  if (!card?.last_review) return 1;
  return scheduler.get_retrievability(toInput(card), new Date(Math.max(now, card.last_review)), false);
}

/** Due = retrievability below the target retention (§7.3). */
export const isDue = (card: FsrsCard | undefined, now: number) => !!card && retrievability(card, now) < TARGET_RETENTION;

/** How a card's answers on one (item, skill) turned out, collapsed to one review (§7.4). */
export interface ReviewOutcome {
  /** false if any retrieval of the item on the card was wrong */
  correct: boolean;
  /** every retrieval was self-graded (mirror, self) */
  selfGraded: boolean;
}

/**
 * The grade at exit (§7.4). A missing exit (crash, closed tab, next card shown) uses the default
 * column, like Next. Self-graded correct answers are Good at most from the self-grade alone; the
 * "too easy" column still makes them Easy.
 */
export function gradeAtExit(outcome: ReviewOutcome, exit: ExitKind | null): Grade {
  if (!outcome.correct) return Rating.Again;
  if (exit === "too_easy") return Rating.Easy;
  if (exit === "too_hard") return Rating.Hard;
  // next, not this format, camera off, or no exit: the default column. Good is also the cap of a
  // self-grade, so outcome.selfGraded never raises it.
  return Rating.Good;
}

export { Rating };
