/**
 * Strings of the settings and progress sheet and of the install and offline UI, in every UI
 * language. Part F1 owns this file. Add each string to `en` and `es` (the build fails if
 * one is missing), and each new format's title and rules to `formats`. Components read them as
 * `t.settings.…`, and format titles through `t.formats`.
 */
import { definePart } from "./types";

export const settings = definePart({
  en: {},
  es: {},
  formats: { en: {}, es: {} },
});
