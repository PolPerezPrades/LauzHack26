/**
 * Interim card source (Part A, replaced by the recommender in Part D). First launch: the gesture
 * tutorial. Then it alternates the eligible non-dev formats and skips formats that need a camera
 * when the camera isn't usable. Content comes from the learner queries (learner/queries.ts), except
 * Part A's `nextItems`, which still walks the curriculum in order. Each format gets the learner's
 * effective challenge ce for it (Part C).
 *
 * Variety and "too hard" (2026-11-22, integrator): the items of the last cards are kept out of the
 * learner lists, so one item can't loop (R-028). After a "too hard" exit, the next cards review items
 * the learner already met (the best known first, never the item that was too hard) as lessons, and no
 * new item comes in, so the feed steps back instead of insisting. Part D's recommender replaces this.
 */
import { curriculumOrder } from "../content/curriculum";
import { newId } from "../core/ids";
import type { CandidateDraft, CardPlan, CardRef, CardSource, GenContext, ItemKind, LearnerQueries, Reason, TaskSpec } from "../core/types";
import { queriesFor, walk } from "../learner/queries";
import { effectiveChallenge } from "../learner/selectors";
import { learnerStateOf } from "../learner/state";
import { FORMATS, TUTORIAL_ID, needsCamera } from "../tasks/registry";

/** The learner queries, with Part A's curriculum walk as `nextItems` (starting at position `start`). */
export function pickerQueries(base: LearnerQueries, order: readonly string[], start: number, avoid: readonly string[] = []): LearnerQueries {
  const content = order.filter((id) => !avoid.includes(id));
  return {
    nextItems: (kinds, n) => walk(content, start, kinds, n),
    frontier: (kinds, n) => base.frontier(kinds, n),
    practice: (skill, kinds, n) => base.practice(skill, kinds, n),
    relearn: (kinds, n) => base.relearn(kinds, n),
    probes: (kinds, n) => base.probes(kinds, n),
    pool: (skill, kinds, n, minPKnown) => base.pool(skill, kinds, n, minPKnown),
    eligiblePhrases: (n) => base.eligiblePhrases(n),
    confusions: (id) => base.confusions(id),
    status: (id, skill) => base.status(id, skill),
    pKnown: (id, skill) => base.pKnown(id, skill),
  };
}

/** How the picker steps back after "too hard" and keeps items from looping. */
export const PICKER = {
  /** review cards after a "too hard" exit */
  reviewCards: 2,
  /** the items of this many last cards are kept out of the learner lists */
  recentCards: 3,
  /** a "too hard" item stays out for this many cards */
  tooHardCooldown: 6,
  /** at most one game in this many cards */
  gameGap: 4,
} as const;

/**
 * Review mode: the relearn list answers with items the learner already met, the best known first,
 * and the frontier is empty, so lessons repeat earlier signs instead of introducing new ones.
 */
export function reviewQueries(base: LearnerQueries, order: readonly string[], avoid: readonly string[]): LearnerQueries {
  const met = (kinds: readonly ItemKind[], n: number) => {
    const pool = base.pool("productive", kinds, 1000, 0).concat(base.pool("receptive", kinds, 1000, 0));
    const seen = new Set(order.filter((id) => !avoid.includes(id) && pool.includes(id)
      && (base.status(id, "productive") !== "new" || base.status(id, "receptive") !== "new")));
    const score = (id: string) => Math.max(base.pKnown(id, "productive"), base.pKnown(id, "receptive"));
    return [...seen].sort((a, b) => score(b) - score(a)).slice(0, n);
  };
  return { ...base, relearn: met, frontier: () => [] };
}

export function toPlan(draft: CandidateDraft, cardId: string, ...extra: Reason[]): CardPlan {
  return {
    cardId,
    format: draft.format,
    items: draft.items,
    ...(draft.pool ? { pool: draft.pool } : {}),
    ...(draft.content ? { content: draft.content } : {}),
    params: draft.params,
    reasons: [...(draft.reasons ?? []), ...extra],
  };
}

/** Cards that really happened or are queued (a card shown and abandoned by a reload doesn't count). */
export const settledCards = (history: readonly CardRef[]) => history.filter((c) => c.exit !== undefined || c.planned);

export interface PickerOptions {
  formats?: readonly TaskSpec[];
  order?: () => readonly string[];
  newId?: () => string;
}

export function createSimplePicker(opts: PickerOptions = {}): CardSource {
  const formats = opts.formats ?? FORMATS;
  const order = opts.order ?? curriculumOrder;
  const makeId = opts.newId ?? newId;

  return {
    kind: "picker",
    next(ctx, avoid) {
      const state = learnerStateOf(ctx.events);
      const gen = (f: TaskSpec): GenContext => ({ rng: ctx.rng, ce: effectiveChallenge(state, f.id), cameraUsable: ctx.cameraUsable });
      const seen = settledCards(ctx.history);

      // keep the items of the last cards, and a recent "too hard" item, out of every learner list
      const learning = seen.filter((c) => c.items.length > 0);
      const recent = learning.slice(-PICKER.recentCards).flatMap((c) => c.items);
      const lastHard = learning.findLastIndex((c) => c.exit === "too_hard");
      const sinceHard = lastHard < 0 ? Infinity : learning.length - 1 - lastHard;
      const hardItems = sinceHard < PICKER.tooHardCooldown ? learning[lastHard].items : [];
      const keepOut = [...new Set([...(avoid?.items ?? []), ...recent, ...hardItems])];
      const loose = queriesFor(state, { avoid: avoid?.items });
      const tight = queriesFor(state, { avoid: keepOut });
      const reviewing = sinceHard < PICKER.reviewCards;
      const base = loose;
      const tutorial = formats.find((f) => f.id === TUTORIAL_ID);
      if (tutorial && !seen.some((c) => c.format === TUTORIAL_ID)) {
        const draft = tutorial.generate(pickerQueries(base, [], 0), gen(tutorial))[0];
        if (draft) return toPlan(draft, makeId());
      }

      const eligible = formats.filter((f) =>
        !f.devOnly && f.family !== "system" && (!needsCamera(f) || ctx.cameraUsable) && !avoid?.formats?.includes(f.id));
      if (!eligible.length) return null;

      // alternate: start after the format of the last learning card
      const last = seen.findLast((c) => eligible.some((f) => f.id === c.format));
      const start = last ? (eligible.findIndex((f) => f.id === last.format) + 1) % eligible.length : 0;
      const walked = seen.filter((c) => c.items.length > 0).length;
      const rotated = Array.from({ length: eligible.length }, (_, k) => eligible[(start + k) % eligible.length]);
      // games take turns: in the games' slots of the rotation, the least recently played game comes first
      const lastPlayed = (id: string) => seen.findLastIndex((c) => c.format === id);
      const games = rotated.filter((f) => f.family === "game").sort((a, b) => lastPlayed(a.id) - lastPlayed(b.id));
      let g = 0;
      const rotationAll = rotated.map((f) => (f.family === "game" ? games[g++] : f));
      // games stay a treat: none while one of the last cards was a game
      const isGame = (id: string) => formats.find((f) => f.id === id)?.family === "game";
      const recentGame = seen.slice(-(PICKER.gameGap - 1)).some((c) => isGame(c.format));
      const rotation = recentGame ? rotationAll.filter((f) => f.family !== "game") : rotationAll;
      const tries: { q: LearnerQueries; formats: TaskSpec[]; reason: Reason }[] = [];
      if (reviewing) {
        // step back: lessons first, on items met before
        const review = reviewQueries(tight, order(), keepOut);
        tries.push({ q: pickerQueries(review, order(), walked, avoid?.items), formats: [...rotation].sort((a, b) => Number(b.family === "lesson") - Number(a.family === "lesson")), reason: { code: "review_after_too_hard" } });
      }
      tries.push({ q: pickerQueries(tight, order(), walked, avoid?.items), formats: rotation, reason: { code: "picker_walk", index: walked } });
      // nothing without the recent items: allow them again rather than stall
      tries.push({ q: pickerQueries(loose, order(), walked, avoid?.items), formats: rotationAll, reason: { code: "picker_walk", index: walked } });
      for (const { q, formats: fs, reason } of tries) {
        for (const format of fs) {
          const draft = format.generate(q, gen(format))[0];
          if (draft) return toPlan(draft, makeId(), reason);
        }
      }
      return null;
    },
  };
}
