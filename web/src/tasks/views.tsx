/**
 * React side of the format registry: FormatId → view component (and an optional prefetch of the
 * media the card will need, run while it waits behind the current card). The learning formats and
 * the minigames keep their maps in their own files (learningViews.tsx, gameViews.tsx).
 */
import { DevCameraProbeView } from "./dev-camera-probe/View";
import { GAME_PREFETCH, GAME_VIEWS } from "./gameViews";
import { LEARNING_PREFETCH, LEARNING_VIEWS } from "./learningViews";
import { TutorialView } from "./system-tutorial/View";
import { view, type PrefetchMap, type ViewMap } from "./viewTypes";

export type { AnyTaskView } from "./viewTypes";

export const VIEWS: ViewMap = {
  "system-tutorial": view(TutorialView),
  "dev-camera-probe": view(DevCameraProbeView),
  ...LEARNING_VIEWS,
  ...GAME_VIEWS,
};

export const PREFETCH: PrefetchMap = {
  ...LEARNING_PREFETCH,
  ...GAME_PREFETCH,
};
