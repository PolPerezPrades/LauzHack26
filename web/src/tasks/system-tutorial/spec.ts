/**
 * First-launch gesture tutorial (SPEC §3.5): finished cards fly up on their own, and the three
 * swipes give an opinion; the action buttons are highlighted meanwhile. Any exit dismisses it — a
 * swipe in any direction, one of the three buttons, ↑ — and it is never scored (it reports no result).
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
