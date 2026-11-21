/**
 * Strings of the learning formats (lessons, questions, quizzes) and the shared task UI, in
 * every UI language. Part B owns this file. Add each string to `en` and `es` (the build fails if
 * one is missing), and each new format's title and rules to `formats`. Components read them as
 * `t.learning.…`, and format titles through `t.formats`.
 */
import { definePart } from "./types";

export const learning = definePart({
  en: {},
  es: {},
  formats: { en: {}, es: {} },
});
