/**
 * Strings that later parts add live in one module per part (i18n/parts/<part>.ts), with every UI
 * language side by side, so parts built in parallel never edit en.ts or es.ts for their own strings
 * (SPEC §9.0). en.ts and es.ts mount each module under its own key (`t.learning`, `t.games`…) and
 * merge its format titles into `t.formats`.
 */

/** Title and one-line rules of a format (card chip, dev picker, game intro). */
export interface FormatText {
  title: string;
  rules: string;
}
export type FormatTexts = Record<string, FormatText>;

export interface PartMessages<T> {
  /** the reference shape, as en.ts is for the core strings */
  en: T;
  /** typed against `en`: a missing or extra key fails the build */
  es: NoInfer<T>;
  /** format id (TaskSpec.i18nKey) → title and rules, in each language */
  formats: { en: FormatTexts; es: FormatTexts };
}

export const definePart = <T,>(part: PartMessages<T>): PartMessages<T> => part;
