/**
 * Learning formats (SPEC §4.3–§4.6): lessons, questions and quizzes. Part B owns this list and the
 * format folders it imports; the minigames have their own list (gameFormats.ts), so the two parts
 * never edit the same registry line. The simple picker rotates through the list in this order.
 */
import type { TaskSpec } from "../core/types";
import { lesson } from "./lesson/spec";
import { question } from "./question/spec";
import { quizBuild } from "./quiz-build/spec";
import { quizChoice } from "./quiz-choice/spec";

export const LEARNING_FORMATS: readonly TaskSpec[] = [lesson, quizChoice, question, quizBuild];
