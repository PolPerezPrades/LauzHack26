/**
 * Strings of the learner model's UI (the dev learner-state inspector), in every UI language.
 * Part C owns this file. Add each string to `en` and `es` (the build fails if
 * one is missing), and each new format's title and rules to `formats`. Components read them as
 * `t.learner.…`, and format titles through `t.formats`.
 */
import { definePart } from "./types";

export const learner = definePart({
  en: {},
  es: {},
  formats: { en: {}, es: {} },
});
