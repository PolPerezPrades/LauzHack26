import { describe, expect, it } from "vitest";
import { PHRASES, itemLabel } from "../../content/curriculum";
import { createRng } from "../../core/rng";
import { en } from "../../i18n/en";
import { es } from "../../i18n/es";
import { LANGS } from "../../i18n/langs";
import { genContext, strictQueries } from "../testing";
import { quizBuildResult } from "./result";
import { quizBuild } from "./spec";
import { buildTiles, checkBuild } from "./tiles";

describe("quiz-build generator", () => {
  it("builds eligible phrases, targeting the phrase and its signs", () => {
    const q = strictQueries({ eligiblePhrases: () => ["ph-name", "ph-deaf"] });
    const drafts = quizBuild.generate(q, genContext());
    expect(drafts.map((d) => d.items)).toEqual([["ph-name", "w-you", "w-name", "w-what"], ["ph-deaf", "w-you", "w-deaf"]]);
    expect(drafts[0].reasons).toEqual([{ code: "eligible_phrase", item: "ph-name" }]);
    expect(quizBuild.generate(strictQueries(), genContext())).toEqual([]);
  });

  it("adds 2–4 distractor tiles depending on the challenge level", () => {
    const q = strictQueries({ eligiblePhrases: () => ["ph-pizza"] });
    const tilesAt = (ce: number) => quizBuild.generate(q, genContext(1, ce))[0].params.tiles!;
    expect(tilesAt(-1)).toHaveLength(3 + 2);
    expect(tilesAt(0)).toHaveLength(3 + 3);
    expect(tilesAt(1)).toHaveLength(3 + 4);
    expect(quizBuild.generate(q, genContext(), { distractors: 9 })[0].params.tiles).toHaveLength(3 + 4);
  });

  it("offers every sign of the phrase among tiles unique in every UI language", () => {
    for (const p of PHRASES.values()) {
      for (const seed of [1, 2]) {
        const tiles = buildTiles(p.id, 4, createRng(seed));
        expect(tiles).toEqual(expect.arrayContaining(p.signs));
        for (const lang of LANGS) expect(new Set(tiles.map((id) => itemLabel(id, lang).toLowerCase())).size, `${p.id} ${lang}`).toBe(tiles.length);
        expect(buildTiles(p.id, 4, createRng(seed))).toEqual(tiles);
      }
    }
  });
});

describe("quiz-build checking and evidence", () => {
  const name = PHRASES.get("ph-name")!.signs; // YOU NAME WHAT

  it("tells a right answer, right signs in the wrong order, and wrong signs apart", () => {
    expect(checkBuild(name, ["w-you", "w-name", "w-what"])).toEqual({ correct: true, wrongOrder: false, marks: ["ok", "ok", "ok"] });
    expect(checkBuild(name, ["w-what", "w-you", "w-name"])).toEqual({ correct: false, wrongOrder: true, marks: ["bad", "bad", "bad"] });
    expect(checkBuild(name, ["w-you", "w-name"])).toEqual({ correct: false, wrongOrder: false, marks: ["ok", "ok"] });
    expect(checkBuild(name, ["w-you", "w-name", "w-where"]).wrongOrder).toBe(false);
  });

  it("logs a receptive build retrieval per sign plus one for the phrase", () => {
    const r = quizBuildResult("ph-name", ["w-you", "w-name", "w-what"], en, "en", 7000);
    expect(r.evidence).toEqual([
      { itemId: "w-you", skill: "receptive", kind: "retrieval", correct: true, check: "build", ms: 7000 },
      { itemId: "w-name", skill: "receptive", kind: "retrieval", correct: true, check: "build", ms: 7000 },
      { itemId: "w-what", skill: "receptive", kind: "retrieval", correct: true, check: "build", ms: 7000 },
      { itemId: "ph-name", skill: "receptive", kind: "retrieval", correct: true, check: "build", ms: 7000 },
    ]);
    expect(r).toMatchObject({ success: 1, xp: 15, feedback: { correct: true, answer: "you · name · what" } });
    expect(r.feedback?.note).toContain("YOU · NAME · WHAT");
  });

  it("says 'right signs, wrong order' distinctly", () => {
    const r = quizBuildResult("ph-name", ["w-what", "w-you", "w-name"], es, "es");
    expect(r.evidence.map((e) => e.correct)).toEqual([true, true, true, false]);
    expect(r.success).toBe(0.75);
    expect(r.xp).toBe(5);
    expect(r.feedback?.correct).toBe(false);
    expect(r.feedback?.note?.startsWith(es.learning.build.wrongOrder)).toBe(true);
    expect(r.feedback?.answer).toBe("tú · nombre · qué");
  });

  it("counts a missing sign as not recognised", () => {
    const r = quizBuildResult("ph-name", ["w-you", "w-where", "w-what"], en, "en");
    expect(r.evidence.map((e) => [e.itemId, e.correct])).toEqual([["w-you", true], ["w-name", false], ["w-what", true], ["ph-name", false]]);
    expect(r.feedback?.note?.startsWith(en.learning.build.wrongOrder)).toBe(false);
    expect(r.xp).toBe(0);
  });
});
