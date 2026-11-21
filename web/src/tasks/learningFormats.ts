/**
 * Learning formats (SPEC §4.3–§4.6): lessons, questions and quizzes. Part B owns this list and the
 * format folders it imports; the minigames have their own list (gameFormats.ts), so the two parts
 * never edit the same registry line.
 */
import type { TaskSpec } from "../core/types";
import { quizChoice } from "./quiz-choice/spec";

export const LEARNING_FORMATS: readonly TaskSpec[] = [quizChoice];
