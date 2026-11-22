import { describe, expect, it } from "vitest";
import { evaluateLetter, evaluateSign, hasCameraRule, issueCode, matchingSigns, type Features } from "./handshapes";

/** Hand-made detector features (the checks only read these fields): a closed fist, thumb at the side. */
const features = (o: Partial<Features> = {}): Features => ({
  fingers: { index: "curled", middle: "curled", ring: "curled", pinky: "curled" },
  bend: { index: 250, middle: 250, ring: 250, pinky: 250 },
  thumbBend: 20, thumbOut: 0.5, thumbLat: 0, thumbIndexAngle: 10, spreadIM: 5, spreadMR: 5, crossedIM: false, pointing: "up",
  d: () => 1,
  ...o,
});
const openHand = features({
  fingers: { index: "ext", middle: "ext", ring: "ext", pinky: "ext" },
  bend: { index: 10, middle: 10, ring: 10, pinky: 10 },
  thumbLat: 0.5,
});

describe("handshape checker", () => {
  it("passes a letter whose every check holds, and says what else the hand matches", () => {
    expect(evaluateLetter("A", features())).toMatchObject({ ok: true, score: 1, issues: [], hints: [], wrong: [] });
    expect(matchingSigns(features())).toEqual(["L-A"]);
    expect(matchingSigns(openHand)).toEqual(["L-B"]);
  });

  it("reports what to fix as data, with stable codes and the parts of the hand involved", () => {
    const ev = evaluateLetter("A", openHand);
    expect(ev.ok).toBe(false);
    expect(ev.issues).toEqual([
      { key: "fingers", action: "close", fingers: ["index", "middle", "ring", "pinky"] },
      { key: "thumbBesideIndex" },
    ]);
    expect(ev.hints).toEqual(["close:index+middle+ring+pinky", "thumbBesideIndex"]);
    expect(ev.wrong).toEqual(["index", "middle", "ring", "pinky", "thumb"]);
    expect(issueCode({ key: "fingers", action: "extend", fingers: ["pinky"] })).toBe("extend:pinky");
  });

  it("can't check letters with movement", () => {
    expect(evaluateLetter("J", features())).toMatchObject({ ok: false, issues: [{ key: "movement" }] });
  });

  it("maps item ids to their rules", () => {
    expect(hasCameraRule("L-A")).toBe(true);
    expect(hasCameraRule("L-Z")).toBe(false);
    expect(hasCameraRule("w-hello")).toBe(false);
    expect(hasCameraRule("num-3")).toBe(false);
    expect(evaluateSign("L-A", features()).ok).toBe(true);
    expect(evaluateSign("w-hello", features()).ok).toBe(false);
  });
});
