/**
 * lesson (SPEC §4.3): teaches one new sign (letter, number or word): watch it, then try it — with
 * the camera check, the mirror, or from memory without a camera (checkModeFor) — then the card
 * completes with an exposure plus a productive retrieval. The relearn variant ("review") runs the
 * same flow for an item failed or found too hard recently.
 *
 * Items come only from the learner queries (D-042): `relearn` first (more urgent, SPEC §7.8.3),
 * then the `frontier` of new items.
 */
import { itemKindOf } from "../../content/curriculum";
import type { CandidateDraft, ItemKind, TaskSpec } from "../../core/types";
import { LESSON } from "../learningConfig";
import { previewName } from "../ui/labels";

export const LESSON_ID = "lesson";

export type LessonVariant = "new" | "relearn";

export type LessonParams = {
  /** dev: 0 = auto (relearn lessons first when items wait), 1 = new lessons only, 2 = relearn only */
  only: number;
  /** set by generate() */
  variant?: LessonVariant;
};

export const LESSON_KINDS: ItemKind[] = ["letter", "number", "word"];

const lessonDraft = (item: string, variant: LessonVariant, only: number): CandidateDraft<LessonParams> => ({
  format: LESSON_ID,
  items: [item],
  params: { only, variant },
  reasons: [{ code: variant === "relearn" ? "relearn" : "frontier", item }],
});

export const lesson: TaskSpec<LessonParams> = {
  id: LESSON_ID,
  family: "lesson",
  icon: "🎓",
  i18nKey: LESSON_ID,
  requires: { camera: "optional", itemKinds: LESSON_KINDS },
  trains: ["receptive", "productive"],
  seconds: 40,
  devParams: [{ key: "only", kind: "int", min: 0, max: 2 }],
  params: () => ({ only: 0 }),
  generate(q, _ctx, params) {
    const only = Math.max(0, Math.min(2, Math.round(params?.only ?? 0)));
    const known = (id: string) => itemKindOf(id) !== undefined && itemKindOf(id) !== "phrase";
    const relearn = only === 1 ? [] : q.relearn(LESSON_KINDS, LESSON.relearn).filter(known);
    const fresh = only === 2 ? [] : q.frontier(LESSON_KINDS, LESSON.frontier).filter((id) => known(id) && !relearn.includes(id));
    return [...relearn.map((id) => lessonDraft(id, "relearn", only)), ...fresh.map((id) => lessonDraft(id, "new", only))];
  },
  preview: (plan, t) => {
    const name = previewName(plan.items[0] ?? "", t);
    return plan.params.variant === "relearn" ? t.learning.lesson.previewRelearn(name) : t.learning.lesson.preview(name);
  },
};
