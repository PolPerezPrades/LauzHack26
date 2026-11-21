/**
 * The UI languages. React-free, so pure modules (content helpers, generators) can name a language
 * without pulling in the language store.
 */
export type Lang = "en" | "es";

/** English first: it is the default (D-038). */
export const LANGS: readonly Lang[] = ["en", "es"];
export const DEFAULT_LANG: Lang = "en";

export const isLang = (v: unknown): v is Lang => v === "en" || v === "es";
