/** React side of the learning formats (Part B owns this file): FormatId → view, and media prefetch. */
import { PHRASES } from "../content/curriculum";
import { prefetchSigns } from "../viewer/prefetch";
import { QuizChoiceView } from "./quiz-choice/View";
import { view, type PrefetchMap, type ViewMap } from "./viewTypes";

export const LEARNING_VIEWS: ViewMap = {
  "quiz-choice": view(QuizChoiceView),
};

export const LEARNING_PREFETCH: PrefetchMap = {
  "quiz-choice": (plan) => prefetchSigns(plan.items.flatMap((id) => PHRASES.get(id)?.signs ?? [id])),
};
