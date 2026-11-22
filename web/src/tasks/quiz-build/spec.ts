/**
 * quiz-build (SPEC §4.6): the avatar signs a phrase and the learner rebuilds it by tapping tiles in
 * order. Gloss mode: the tiles are the signs' meanings in the UI language, in ASL order, plus 2–4
 * distractor tiles depending on the challenge level. (The optional translation mode needs authored
 * per-language tokens, which no phrase has yet, so it isn't offered.)
 *
 * Items come only from `eligiblePhrases` (D-042). A card's target items are the phrase and its
 * signs (SPEC §7.5); the tiles are built here, so `card.shown` logs exactly what was offered.
 */
import { PHRASES } from "../../content/curriculum";
import type { TaskSpec } from "../../core/types";
import { QUIZ_BUILD, distractorTilesFor } from "../learningConfig";
import { buildTiles } from "./tiles";

export const QUIZ_BUILD_ID = "quiz-build";

export type QuizBuildParams = {
  /** distractor tiles, 2–4 */
  distractors: number;
  /** sign ids in display order (the phrase's signs and the distractors); built by generate() */
  tiles?: string[];
};

export const quizBuild: TaskSpec<QuizBuildParams> = {
  id: QUIZ_BUILD_ID,
  family: "quiz",
  icon: "🧩",
  i18nKey: QUIZ_BUILD_ID,
  requires: { camera: "none", itemKinds: ["phrase"] },
  trains: ["receptive"],
  seconds: 30,
  devParams: [{ key: "distractors", kind: "int", min: 2, max: 4 }],
  params: (ce) => ({ distractors: distractorTilesFor(ce) }),
  generate(q, ctx, params) {
    const distractors = Math.max(2, Math.min(4, Math.round(params?.distractors ?? distractorTilesFor(ctx.ce))));
    return q.eligiblePhrases(QUIZ_BUILD.phrases).filter((id) => PHRASES.has(id)).map((id) => ({
      format: QUIZ_BUILD_ID,
      items: [id, ...new Set(PHRASES.get(id)!.signs)],
      params: { distractors, tiles: buildTiles(id, distractors, ctx.rng) },
      reasons: [{ code: "eligible_phrase", item: id }],
    }));
  },
  preview: (_plan, t) => t.learning.build.preview,
};
