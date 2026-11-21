/**
 * React side of the format registry: FormatId → view component (and an optional prefetch of the
 * media the card will need, run while it waits behind the current card).
 */
import type { ComponentType } from "react";
import { PHRASES } from "../content/curriculum";
import type { CardPlan, FormatId, TaskViewProps } from "../core/types";
import { prefetchSigns } from "../viewer/prefetch";
import { DevCameraProbeView } from "./dev-camera-probe/View";
import { QuizChoiceView } from "./quiz-choice/View";
import { TutorialView } from "./system-tutorial/View";

export type AnyTaskView = ComponentType<TaskViewProps>;

/** The registry guarantees plan.format matches the view, so each view's params type is erased here. */
function view<P extends object>(component: ComponentType<TaskViewProps<P>>): AnyTaskView {
  return component as unknown as AnyTaskView;
}

export const VIEWS: Partial<Record<FormatId, AnyTaskView>> = {
  "system-tutorial": view(TutorialView),
  "quiz-choice": view(QuizChoiceView),
  "dev-camera-probe": view(DevCameraProbeView),
};

export const PREFETCH: Partial<Record<FormatId, (plan: CardPlan) => void>> = {
  "quiz-choice": (plan) => prefetchSigns(plan.items.flatMap((id) => PHRASES.get(id)?.signs ?? [id])),
};
