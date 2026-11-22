/**
 * Interim card source (Part A, replaced by the recommender in Part D). First launch: the gesture
 * tutorial. Then it alternates the eligible non-dev formats and skips formats that need a camera
 * when the camera isn't usable. Content comes from the learner queries (learner/queries.ts), except
 * Part A's `nextItems`, which still walks the curriculum in order. Each format gets the learner's
 * effective challenge ce for it (Part C).
 */
import { curriculumOrder } from "../content/curriculum";
import { newId } from "../core/ids";
import type { CandidateDraft, CardPlan, CardRef, CardSource, GenContext, LearnerQueries, Reason, TaskSpec } from "../core/types";
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

      const base = queriesFor(state, { avoid: avoid?.items });
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
      const q = pickerQueries(base, order(), walked, avoid?.items);
      for (let k = 0; k < eligible.length; k++) {
        const format = eligible[(start + k) % eligible.length];
        const draft = format.generate(q, gen(format))[0];
        if (draft) return toPlan(draft, makeId(), { code: "picker_walk", index: walked });
      }
      return null;
    },
  };
}
