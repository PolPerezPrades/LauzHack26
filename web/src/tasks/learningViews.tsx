/** React side of the learning formats (Part B owns this file): FormatId → view, and media prefetch. */
import { PHRASES } from "../content/curriculum";
import type { CardPlan } from "../core/types";
import { prefetchSigns } from "../viewer/prefetch";
import { LessonView } from "./lesson/View";
import { QuestionView } from "./question/View";
import { QuizBuildView } from "./quiz-build/View";
import { QuizChoiceView } from "./quiz-choice/View";
import { view, type PrefetchMap, type ViewMap } from "./viewTypes";

export const LEARNING_VIEWS: ViewMap = {
  lesson: view(LessonView),
  question: view(QuestionView),
  "quiz-choice": view(QuizChoiceView),
  "quiz-build": view(QuizBuildView),
};

/** The signs a card will show: a phrase's signs, or the items themselves (letters need nothing). */
const signsOf = (plan: CardPlan) => plan.items.flatMap((id) => PHRASES.get(id)?.signs ?? [id]);

export const LEARNING_PREFETCH: PrefetchMap = {
  lesson: (plan) => prefetchSigns(signsOf(plan)),
  question: (plan) => prefetchSigns(signsOf(plan)),
  "quiz-choice": (plan) => prefetchSigns(signsOf(plan)),
  "quiz-build": (plan) => prefetchSigns(signsOf(plan)),
};
