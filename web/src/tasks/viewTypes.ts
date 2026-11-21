/** Shared typing of the format → view maps (views.tsx, learningViews.tsx, gameViews.tsx). */
import type { ComponentType } from "react";
import type { CardPlan, FormatId, TaskViewProps } from "../core/types";

export type AnyTaskView = ComponentType<TaskViewProps>;
export type ViewMap = Partial<Record<FormatId, AnyTaskView>>;
/** Warms the media a queued card will need, while it waits behind the current one. */
export type PrefetchMap = Partial<Record<FormatId, (plan: CardPlan) => void>>;

/** The registry guarantees plan.format matches the view, so each view's params type is erased here. */
export function view<P extends object>(component: ComponentType<TaskViewProps<P>>): AnyTaskView {
  return component as unknown as AnyTaskView;
}
