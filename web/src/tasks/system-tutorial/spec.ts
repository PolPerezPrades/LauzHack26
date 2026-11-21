/**
 * First-launch gesture tutorial (SPEC §3.5): explains the four exits while the action buttons are
 * highlighted. Any exit dismisses it (Next included) and it is never scored.
 */
import type { TaskSpec } from "../../core/types";

export const TUTORIAL_ID = "system-tutorial";

export type NoParams = Record<string, never>;

export const systemTutorial: TaskSpec<NoParams> = {
  id: TUTORIAL_ID,
  family: "system",
  icon: "👋",
  i18nKey: TUTORIAL_ID,
  requires: { camera: "none", itemKinds: [] },
  trains: [],
  seconds: 20,
  nextAnytime: true,
  params: () => ({}),
  generate: () => [{ format: TUTORIAL_ID, items: [], params: {}, reasons: [{ code: "first_launch" }] }],
  preview: (_plan, t) => t.tutorial.title,
};
