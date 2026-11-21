/**
 * Interim card source (Part A, replaced by the recommender in Part D). First launch: the gesture
 * tutorial. Then it alternates the eligible non-dev formats, walks the curriculum in order for
 * content, and skips formats that need a camera when the camera isn't usable.
 */
import { curriculumOrder, itemKindOf } from "../content/curriculum";
import { newId } from "../core/ids";
import type { CandidateDraft, CardPlan, CardRef, CardSource, LearnerQueries, Reason, TaskSpec } from "../core/types";
import { FORMATS, TUTORIAL_ID, needsCamera } from "../tasks/registry";

/** Items of the given kinds in `order`, starting at position `start` (wrapping around). */
export function curriculumWalker(order: readonly string[], start: number, avoid: readonly string[] = []): LearnerQueries {
  return {
    nextItems(kinds, n) {
      const pool = order.filter((id) => {
        const kind = itemKindOf(id);
        return kind !== undefined && kinds.includes(kind) && !avoid.includes(id);
      });
      return Array.from({ length: Math.min(n, pool.length) }, (_, i) => pool[(start + i) % pool.length]);
    },
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
      const gen = { rng: ctx.rng, ce: 0, cameraUsable: ctx.cameraUsable };
      const seen = settledCards(ctx.history);

      const tutorial = formats.find((f) => f.id === TUTORIAL_ID);
      if (tutorial && !seen.some((c) => c.format === TUTORIAL_ID)) {
        const draft = tutorial.generate(curriculumWalker([], 0), gen)[0];
        if (draft) return toPlan(draft, makeId());
      }

      const eligible = formats.filter((f) =>
        !f.devOnly && f.family !== "system" && (!needsCamera(f) || ctx.cameraUsable) && !avoid?.formats?.includes(f.id));
      if (!eligible.length) return null;

      // alternate: start after the format of the last learning card
      const last = seen.findLast((c) => eligible.some((f) => f.id === c.format));
      const start = last ? (eligible.findIndex((f) => f.id === last.format) + 1) % eligible.length : 0;
      const walked = seen.filter((c) => c.items.length > 0).length;
      const q = curriculumWalker(order(), walked, avoid?.items);
      for (let k = 0; k < eligible.length; k++) {
        const draft = eligible[(start + k) % eligible.length].generate(q, gen)[0];
        if (draft) return toPlan(draft, makeId(), { code: "picker_walk", index: walked });
      }
      return null;
    },
  };
}
