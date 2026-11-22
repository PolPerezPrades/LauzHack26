import { describe, expect, it } from "vitest";
import { SIGNS } from "../../content/curriculum";
import { en } from "../../i18n/en";
import { es } from "../../i18n/es";
import { HINT_KEYS } from "../../lib/handshapes";
import { issueText } from "./handHints";
import { answerText, glossHint, itemName, pickDescription, previewName, signDescription } from "./labels";

describe("content labels", () => {
  it("names items in each language", () => {
    expect(itemName("L-A", en, "en")).toBe("Letter A");
    expect(itemName("L-A", es, "es")).toBe("Letra A");
    expect(itemName("num-3", es, "es")).toBe("tres");
    expect(itemName("ph-name", en, "en")).toBe("What is your name?");
    expect(previewName("L-B", es)).toBe("Letra B");
    expect(previewName("w-black", es)).toBe("negro");
    expect(glossHint("w-black", "es")).toBe("BLACK");
    expect(glossHint("w-black", "en")).toBeNull();
    expect(answerText("w-black", "es")).toBe("negro (BLACK)");
  });

  it("has a faithful English description for every letter (R-020) and invents none for other signs", () => {
    for (const s of SIGNS.values()) {
      const d = signDescription(s.id, "en");
      if (s.kind === "letter") {
        expect(d, s.id).toMatchObject({ lang: "en" });
        expect(d!.text).not.toMatch(/[áéíóúñ]/i);
        expect(signDescription(s.id, "es")).toEqual({ text: s.spec.description!.es, lang: "es" });
      } else {
        expect(d, s.id).toBeNull();
      }
    }
  });

  it("falls back to the Spanish original, marked as Spanish", () => {
    expect(pickDescription({ es: "Puño cerrado." }, "en")).toEqual({ text: "Puño cerrado.", lang: "es" });
    expect(pickDescription(null, "en")).toBeNull();
  });
});

describe("camera feedback in each language", () => {
  it("renders every hint in English and Spanish", () => {
    for (const key of HINT_KEYS) {
      const english = issueText({ key }, en);
      const spanish = issueText({ key }, es);
      expect(english.trim(), key).not.toBe("");
      expect(spanish.trim(), key).not.toBe("");
      expect(english, key).not.toMatch(/[áéíóúñ¿¡]/i);
      expect(english).not.toBe(spanish);
    }
  });

  it("says which fingers to move, as a natural list", () => {
    expect(issueText({ key: "fingers", action: "extend", fingers: ["index"] }, en)).toBe("Straighten your index finger");
    expect(issueText({ key: "fingers", action: "close", fingers: ["index", "middle", "ring", "pinky"] }, en)).toBe("Curl your index, middle, ring and pinky fingers");
    expect(issueText({ key: "fingers", action: "bend", fingers: ["index", "middle"] }, es)).toBe("Curva el índice y el corazón");
  });

  it("uses the right article for letter names", () => {
    expect(en.learning.camera.looksLike("N")).toBe("That looks like an N");
    expect(en.learning.camera.looksLike("B")).toBe("That looks like a B");
    expect(es.learning.camera.looksLike("N")).toBe("Eso parece una N");
  });
});
