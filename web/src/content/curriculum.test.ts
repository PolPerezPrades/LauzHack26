import { describe, expect, it } from "vitest";
import { LANGS } from "../i18n/langs";
import { PHRASES, SIGNS, UNITS, itemLabel, label } from "./curriculum";

describe("content in every UI language", () => {
  it("translates every sign, unit title and phrase (meaning and grammar note)", () => {
    for (const lang of LANGS) {
      for (const s of SIGNS.values()) expect(s[lang]?.trim(), `${lang} ${s.id}`).toBeTruthy();
      for (const u of UNITS) expect(u.title[lang]?.trim(), `${lang} ${u.id}`).toBeTruthy();
      for (const p of PHRASES.values()) {
        expect(p[lang]?.trim(), `${lang} ${p.id}`).toBeTruthy();
        expect(p.note[lang]?.trim(), `${lang} ${p.id} note`).toBeTruthy();
      }
    }
  });

  it("labels items in the requested language", () => {
    expect(itemLabel("L-A", "en")).toBe("A");
    expect(itemLabel("L-A", "es")).toBe("A");
    expect(itemLabel("w-black", "en")).toBe("black");
    expect(itemLabel("w-black", "es")).toBe("negro");
    expect(itemLabel("num-3", "en")).toBe("three");
    expect(itemLabel("ph-name", "en")).toBe("What is your name?");
    expect(itemLabel("ph-name", "es")).toBe("¿Cómo te llamas?");
    expect(itemLabel("nope", "en")).toBe("nope");
  });

  it("keeps the Spanish label for the old modules", () => {
    expect(label("w-black")).toBe("negro");
  });
});
