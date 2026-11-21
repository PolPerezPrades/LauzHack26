/**
 * The UI language: English by default, Spanish from the language switch (D-038). The choice is a
 * device preference (like the chosen camera), kept in localStorage. It is not learner state, so it
 * is not logged, and it applies to the feed, dev mode and the lab alike.
 * Components read strings with `useT()`, which re-renders them when the language changes; code
 * outside render (callbacks, timers) reads `currentMessages()` when it needs the text.
 */
import { useSyncExternalStore } from "react";
import { en, type Messages } from "./en";
import { es } from "./es";
import { DEFAULT_LANG, isLang, type Lang } from "./langs";

export type { Messages } from "./en";
export { DEFAULT_LANG, LANGS, type Lang } from "./langs";

export const LANG_STORAGE_KEY = "signa:lang";

const DICTS: Record<Lang, Messages> = { en, es };

export const messagesFor = (lang: Lang): Messages => DICTS[lang];

type KeyValue = Pick<Storage, "getItem" | "setItem">;

export interface LangStore {
  get(): Lang;
  set(lang: Lang): void;
  subscribe(listener: () => void): () => void;
}

export function createLangStore(storage: KeyValue | null, apply?: (lang: Lang) => void): LangStore {
  let lang: Lang = DEFAULT_LANG;
  try {
    const saved = storage?.getItem(LANG_STORAGE_KEY);
    if (isLang(saved)) lang = saved;
  } catch {
    /* storage blocked: keep the default */
  }
  const listeners = new Set<() => void>();
  apply?.(lang);
  return {
    get: () => lang,
    set(next) {
      if (next === lang) return;
      lang = next;
      try {
        storage?.setItem(LANG_STORAGE_KEY, next);
      } catch {
        /* not persisted: the choice lasts until reload */
      }
      apply?.(next);
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function browserStorage(): KeyValue | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** <html lang> follows the UI language (screen-reader voice, hyphenation), and so does the tab title. */
function applyToDocument(lang: Lang) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.title = DICTS[lang].app.title;
}

export const langStore = createLangStore(browserStorage(), applyToDocument);

export const setLang = (lang: Lang) => langStore.set(lang);

/** Strings of the current language, for code that runs outside render (callbacks, timers). */
export const currentMessages = (): Messages => DICTS[langStore.get()];

export function useLang(): Lang {
  return useSyncExternalStore(langStore.subscribe, langStore.get, langStore.get);
}

/** Strings of the current language; the component re-renders when the language changes. */
export function useT(): Messages {
  return DICTS[useLang()];
}
