import { describe, expect, it, vi } from "vitest";
import { PHRASES } from "../content/curriculum";
import { FORMATS } from "../tasks/registry";
import { en } from "./en";
import { es } from "./es";
import { LANG_STORAGE_KEY, createLangStore, messagesFor } from "./index";
import { DEFAULT_LANG, LANGS, isLang } from "./langs";

/** Paths of every leaf (string, function) of a dictionary; arrays are compared by length elsewhere. */
function leaves(obj: unknown, prefix = ""): string[] {
  if (typeof obj === "string" || typeof obj === "function") return [prefix];
  if (Array.isArray(obj)) return [`${prefix}[]`];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

function strings(obj: unknown): string[] {
  if (typeof obj === "string") return [obj];
  if (typeof obj === "function") return [];
  if (Array.isArray(obj)) return obj.flatMap(strings);
  return Object.values(obj as Record<string, unknown>).flatMap(strings);
}

describe("dictionaries", () => {
  it("have the same keys in every language", () => {
    expect(leaves(es).sort()).toEqual(leaves(en).sort());
  });

  it("have no empty strings", () => {
    for (const t of [en, es]) for (const s of strings(t)) expect(s.trim()).not.toBe("");
  });

  it("leave no Spanish text in English", () => {
    const { lang, ...rest } = en; // language names are written in their own language
    expect(strings(lang.names)).toContain("Español");
    for (const s of strings(rest)) expect(s, s).not.toMatch(/[áéíóúñ¿¡]/i);
  });

  it("name and explain every format in every language", () => {
    for (const lang of LANGS) {
      for (const f of FORMATS) {
        expect(messagesFor(lang).formats[f.i18nKey]?.title, `${lang} ${f.id}`).toBeTruthy();
        expect(messagesFor(lang).formats[f.i18nKey]?.rules, `${lang} ${f.id}`).toBeTruthy();
      }
    }
  });

  it("explain in the tutorial that finished cards leave on their own, then the three swipes, in the same order", () => {
    expect(en.tutorial.rows.map((r) => r.exit)).toEqual(["next", "too_easy", "too_hard", "dislike_format"]);
    expect(es.tutorial.rows.map((r) => r.exit)).toEqual(en.tutorial.rows.map((r) => r.exit));
    expect(en.tutorial.rows[0].text).toMatch(/on its own/);
    expect(es.tutorial.rows[0].text).toMatch(/sola/);
  });

  it("have three action buttons and no Next button text left (Part A2)", () => {
    for (const t of [en, es]) expect(Object.keys(t.feed.actions).sort()).toEqual(["dislike_format", "too_easy", "too_hard"]);
    // the exit names are announced when a card leaves, they are not buttons
    const shown = (t: typeof en) => {
      const { exits: _announced, ...feed } = t.feed;
      return [...strings(feed), ...strings(t.tutorial)].join("\n");
    };
    expect(shown(en)).not.toMatch(/\bNext\b/);
    expect(shown(es)).not.toMatch(/\bContinuar\b/i);
  });

  it("label every non-manual marker used by the phrases", () => {
    for (const p of PHRASES.values()) for (const t of [en, es]) expect(t.content.nonManual[p.nonManual], p.id).toBeTruthy();
  });

  it("pluralise counts", () => {
    expect(en.dev.sandboxCount(1)).toMatch(/^1 event /);
    expect(en.dev.sandboxCount(2)).toMatch(/^2 events /);
    expect(es.dev.sandboxCount(1)).toMatch(/^1 evento /);
    expect(es.feed.statsLabel(1, 5)).toContain("1 día");
  });
});

describe("language store", () => {
  const memory = (initial: Record<string, string> = {}) => {
    const data = new Map(Object.entries(initial));
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
  };

  it("starts in English, or in the saved language", () => {
    expect(DEFAULT_LANG).toBe("en");
    expect(createLangStore(memory()).get()).toBe("en");
    expect(createLangStore(null).get()).toBe("en");
    expect(createLangStore(memory({ [LANG_STORAGE_KEY]: "es" })).get()).toBe("es");
    expect(createLangStore(memory({ [LANG_STORAGE_KEY]: "fr" })).get()).toBe("en");
    expect(isLang("es") && !isLang("ES")).toBe(true);
  });

  it("saves the choice, applies it and notifies once per change", () => {
    const storage = memory();
    const apply = vi.fn();
    const store = createLangStore(storage, apply);
    expect(apply).toHaveBeenLastCalledWith("en");
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set("es");
    store.set("es");
    expect(store.get()).toBe("es");
    expect(storage.data.get(LANG_STORAGE_KEY)).toBe("es");
    expect(apply).toHaveBeenLastCalledWith("es");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.set("en");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("works when storage is blocked", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    const store = createLangStore(blocked);
    expect(store.get()).toBe("en");
    store.set("es");
    expect(store.get()).toBe("es");
  });
});
