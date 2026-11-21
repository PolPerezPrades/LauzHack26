/**
 * Strings of the recommender ("why this card" reasons, the dev recommender inspector), in every
 * UI language. Part D owns this file. Add each string to `en` and `es` (the build fails if
 * one is missing), and each new format's title and rules to `formats`. Components read them as
 * `t.recommender.…`, and format titles through `t.formats`.
 */
import { definePart } from "./types";

export const recommender = definePart({
  en: {},
  es: {},
  formats: { en: {}, es: {} },
});
