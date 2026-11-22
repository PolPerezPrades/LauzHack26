/**
 * Rule-based checker for static ASL fingerspelling handshapes, from MediaPipe Hands landmarks.
 *
 * We always know the TARGET letter, so instead of a full classifier each letter is a list of
 * checks ("index extended", "thumb touches middle finger"...). All checks pass -> correct;
 * failing checks become feedback. Geometry uses metric world landmarks, so it works for either
 * hand and any distance to the camera; only "pointing up/side/down" uses image coords.
 *
 * Feedback is data, not text: a failed check reports a `HandIssue`, which the UI renders in the
 * learner's language (i18n `learning.hints`, R-020). This module imports nothing, so the Node
 * scripts (scripts/verify-letters.ts, fit-letters.ts) keep loading it directly.
 *
 * Thresholds are first guesses, tuned against the real letter poses (scripts/verify-letters.ts).
 * J and Z involve movement and are not checked.
 */

export interface P { x: number; y: number; z: number }
export type Finger = "index" | "middle" | "ring" | "pinky";
export type FState = "ext" | "bent" | "curled";

const CHAINS: Record<Finger, [number, number, number, number]> = {
  index: [5, 6, 7, 8], middle: [9, 10, 11, 12], ring: [13, 14, 15, 16], pinky: [17, 18, 19, 20],
};
const FINGERS: Finger[] = ["index", "middle", "ring", "pinky"];

export interface Features {
  fingers: Record<Finger, FState>;
  bend: Record<Finger, number>;
  thumbBend: number;
  thumbOut: number;      // thumb tip → index base, in palm lengths (large = thumb sticking out)
  thumbLat: number;      // thumb tip across the palm: 0 = index side, 1 = pinky side
  thumbIndexAngle: number;
  spreadIM: number;      // angle between index and middle fingers (deg)
  spreadMR: number;
  crossedIM: boolean;    // index crossed over middle (R)
  pointing: "up" | "side" | "down";
  d: (a: number, b: number) => number; // landmark distance in palm lengths
}

type V = [number, number, number];
const sub = (a: P, b: P): V => [a.x - b.x, a.y - b.y, a.z - b.z];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V) => Math.hypot(a[0], a[1], a[2]);
const angle = (a: V, b: V) => (Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b) + 1e-9)))) * 180) / Math.PI;

function bendAlong(w: P[], chain: number[]) {
  let total = 0;
  for (let i = 0; i + 2 < chain.length; i++) total += angle(sub(w[chain[i + 1]], w[chain[i]]), sub(w[chain[i + 2]], w[chain[i + 1]]));
  return total;
}

/** lm: normalized image landmarks; w: world landmarks (metres); aspect = video width / height. */
export function computeFeatures(lm: P[], w: P[], aspect: number): Features {
  const palm = len(sub(w[9], w[0])) || 1;
  const d = (a: number, b: number) => len(sub(w[a], w[b])) / palm;
  const fingers = {} as Record<Finger, FState>;
  const bend = {} as Record<Finger, number>;
  for (const f of FINGERS) {
    const [, pip, , tip] = CHAINS[f];
    const b = bendAlong(w, [0, ...CHAINS[f]]);
    bend[f] = b;
    const tipW = d(tip, 0);
    const pipW = d(pip, 0);
    fingers[f] = b < 75 && tipW > pipW * 1.1 ? "ext" : tipW < pipW * 0.95 || b > 210 ? "curled" : "bent";
  }
  const axis = sub(w[17], w[5]);
  const axis2 = dot(axis, axis) || 1;
  const lat = (i: number) => dot(sub(w[i], w[5]), axis) / axis2;
  const dirIdx = sub(w[8], w[5]);
  const dirMid = sub(w[12], w[9]);
  const dirRing = sub(w[16], w[13]);

  // pointing direction in the image (y grows downwards); use the index finger when it is out
  const from = fingers.index === "ext" ? 5 : 0;
  const to = fingers.index === "ext" ? 8 : 9;
  const vx = (lm[to].x - lm[from].x) * aspect;
  const vy = lm[to].y - lm[from].y;
  const n = Math.hypot(vx, vy) || 1;
  const uy = vy / n;

  return {
    fingers, bend, d,
    thumbBend: bendAlong(w, [1, 2, 3, 4]),
    thumbOut: d(4, 5),
    thumbLat: lat(4),
    thumbIndexAngle: angle(sub(w[4], w[2]), dirIdx),
    spreadIM: angle(dirIdx, dirMid),
    spreadMR: angle(dirMid, dirRing),
    crossedIM: lat(8) > lat(12) - 0.02,
    pointing: uy < -0.55 ? "up" : uy > 0.45 ? "down" : "side",
  };
}

// ---- feedback ----------------------------------------------------------------------------
/** Part of the hand a failed check is about (drives the per-finger feedback on the 3D hand). */
export type Part = Finger | "thumb" | "orientation";
/** What a finger has to do to pass: straighten, curve, or close into the palm. */
export type FingerAction = "extend" | "bend" | "close";

/** Fixed feedback sentences; their text lives in i18n (`learning.hints`), one per key. */
export const HINT_KEYS = [
  "together", "apartV", "pointUp", "pointSide", "pointDown", "thumbOut", "thumbAlong", "thumbIn",
  "thumbBesideIndex", "thumbAcrossPalm", "thumbCurvedC", "openC", "touchMiddleTip", "thumbUnderTips", "tipsToThumb",
  "indexThumbCircle", "thumbBetweenK", "rightAngleL", "thumbUnderThree", "thumbUnderTwo", "indexTipToThumbO", "closeO",
  "crossMiddle", "thumbAcrossFront", "thumbOnFingers", "thumbBetweenT", "thumbPeeksT", "noCross", "hookX", "movement",
] as const;
export type HintKey = (typeof HINT_KEYS)[number];

/** One thing to fix, as data: the UI renders it in the learner's language. */
export type HandIssue =
  | { key: "fingers"; action: FingerAction; fingers: Finger[] }
  | { key: HintKey };

/** Stable short code of an issue, for scripts, logs and tests ("extend:index+middle", "thumbIn"). */
export const issueCode = (i: HandIssue) => (i.key === "fingers" ? `${i.action}:${i.fingers.join("+")}` : i.key);

// ---- checks ------------------------------------------------------------------------------
interface Check { issue: HandIssue | ((f: Features) => HandIssue); test: (f: Features) => boolean; parts?: (f: Features) => Part[] }
/** attach the parts of the hand a check is about */
const on = (parts: Part[], c: Check): Check => ({ ...c, parts: () => parts });

const actionFor = (allowed: FState[]): FingerAction =>
  allowed.includes("ext") ? "extend" : allowed.includes("bent") && !allowed.includes("curled") ? "bend" : "close";
function fingers(names: Finger[], allowed: FState[]): Check {
  const wrong = (f: Features) => names.filter((n) => !allowed.includes(f.fingers[n]));
  return {
    test: (f) => names.every((n) => allowed.includes(f.fingers[n])),
    parts: wrong,
    issue: (f) => ({ key: "fingers", action: actionFor(allowed), fingers: wrong(f) }),
  };
}
const ext = (...n: Finger[]) => fingers(n, ["ext"]);
const closed = (...n: Finger[]) => fingers(n, ["curled", "bent"]);
const fist = (...n: Finger[]) => fingers(n, ["curled"]);
const curved = (...n: Finger[]) => fingers(n, ["bent"]);
const check = (key: HintKey, test: (f: Features) => boolean): Check => ({ issue: { key }, test });

const TOGETHER = on(["index", "middle"], check("together", (f) => f.spreadIM < 18));
const APART = on(["index", "middle"], check("apartV", (f) => f.spreadIM >= 14));
const UP = on(["orientation"], check("pointUp", (f) => f.pointing === "up"));
const SIDE = on(["orientation"], check("pointSide", (f) => f.pointing === "side"));
const DOWN = on(["orientation"], check("pointDown", (f) => f.pointing === "down" || f.pointing === "side"));
const THUMB_OUT = on(["thumb"], check("thumbOut", (f) => f.thumbOut > 0.6));
const THUMB_ALONG = on(["thumb"], check("thumbAlong", (f) => f.thumbOut > 0.45));
const THUMB_IN = on(["thumb"], check("thumbIn", (f) => f.thumbOut < 0.95));
const thumbLat = (min: number, max: number, key: HintKey) => on(["thumb"], check(key, (f) => f.thumbLat >= min && f.thumbLat <= max));
const TIP_FINGER: Record<number, Finger> = { 6: "index", 8: "index", 10: "middle", 12: "middle", 16: "ring", 20: "pinky" };
const touch = (a: number, b: number, max: number, key: HintKey) =>
  on(["thumb", ...(TIP_FINGER[b] ? [TIP_FINGER[b]] : [])], check(key, (f) => f.d(a, b) < max));

const RULES: Record<string, Check[]> = {
  A: [fist("index", "middle", "ring", "pinky"), thumbLat(-1, 0.18, "thumbBesideIndex"), THUMB_IN],
  B: [ext("index", "middle", "ring", "pinky"), TOGETHER, thumbLat(0.2, 2, "thumbAcrossPalm"), UP],
  C: [curved("index", "middle", "ring", "pinky"), thumbLat(-1, 0.45, "thumbCurvedC"),
    on(["thumb", "index"], check("openC", (f) => f.d(4, 8) > 0.3 && f.d(4, 8) < 1.4))],
  D: [ext("index"), closed("middle", "ring", "pinky"), touch(4, 12, 0.7, "touchMiddleTip")],
  E: [closed("index", "middle", "ring", "pinky"), thumbLat(0.25, 2, "thumbUnderTips"),
    on(["index", "middle", "ring"], check("tipsToThumb", (f) => (f.d(4, 8) + f.d(4, 12) + f.d(4, 16)) / 3 < 0.75)), THUMB_IN],
  F: [touch(4, 8, 0.35, "indexThumbCircle"), fingers(["middle", "ring", "pinky"], ["ext", "bent"])],
  G: [ext("index"), closed("middle", "ring", "pinky"), THUMB_ALONG, SIDE],
  H: [ext("index", "middle"), closed("ring", "pinky"), TOGETHER, SIDE],
  I: [ext("pinky"), closed("index", "middle", "ring"), THUMB_IN],
  K: [ext("index"), fingers(["middle"], ["ext", "bent"]), closed("ring", "pinky"), APART,
    on(["thumb"], check("thumbBetweenK", (f) => Math.min(f.d(4, 10), f.d(4, 6), f.d(4, 9)) < 0.55)), UP],
  L: [ext("index"), closed("middle", "ring", "pinky"), THUMB_OUT,
    on(["thumb", "index"], check("rightAngleL", (f) => f.thumbIndexAngle > 45)), UP],
  M: [closed("index", "middle", "ring", "pinky"), thumbLat(0.6, 2, "thumbUnderThree")],
  N: [closed("index", "middle", "ring", "pinky"), thumbLat(0.3, 0.8, "thumbUnderTwo")],
  O: [closed("index", "middle", "ring", "pinky"), touch(4, 8, 0.4, "indexTipToThumbO"), touch(4, 12, 0.55, "closeO")],
  P: [fingers(["index", "middle"], ["ext", "bent"]), closed("ring", "pinky"), APART, DOWN],
  Q: [ext("index"), closed("middle", "ring", "pinky"), THUMB_ALONG, DOWN],
  R: [ext("index", "middle"), closed("ring", "pinky"), on(["index", "middle"], check("crossMiddle", (f) => f.crossedIM))],
  S: [fist("index", "middle", "ring", "pinky"), thumbLat(0.12, 0.75, "thumbAcrossFront"),
    on(["thumb"], check("thumbOnFingers", (f) => Math.min(f.d(4, 6), f.d(4, 10)) < 0.65))],
  T: [closed("index", "middle", "ring", "pinky"), thumbLat(-0.15, 0.45, "thumbBetweenT"), touch(4, 6, 0.5, "thumbPeeksT")],
  U: [ext("index", "middle"), closed("ring", "pinky"), TOGETHER,
    on(["index", "middle"], check("noCross", (f) => !f.crossedIM || f.spreadIM > 8)), UP],
  V: [ext("index", "middle"), closed("ring", "pinky"), APART, UP],
  W: [ext("index", "middle", "ring"), closed("pinky"), UP],
  X: [curved("index"), closed("middle", "ring", "pinky"), on(["index"], check("hookX", (f) => f.bend.index > 70))],
  Y: [ext("pinky"), closed("index", "middle", "ring"), THUMB_OUT],
};

export const CHECKABLE = new Set(Object.keys(RULES));

export interface Evaluation {
  ok: boolean;
  score: number;   // fraction of checks passed
  /** what to fix, most important first (render with i18n) */
  issues: HandIssue[];
  /** the same as stable codes (issueCode), for scripts and logs */
  hints: string[];
  /** parts of the hand with something wrong (for highlighting the 3D reference) */
  wrong: Part[];
}

export function evaluateLetter(letter: string, f: Features): Evaluation {
  const rules = RULES[letter.toUpperCase()];
  if (!rules) return { ok: false, score: 0, issues: [{ key: "movement" }], hints: ["movement"], wrong: [] };
  const failed = rules.filter((r) => !r.test(f));
  const issues = failed.map((r) => (typeof r.issue === "function" ? r.issue(f) : r.issue));
  return {
    ok: failed.length === 0,
    score: (rules.length - failed.length) / rules.length,
    issues,
    hints: issues.map(issueCode),
    wrong: [...new Set(failed.flatMap((r) => r.parts?.(f) ?? []))],
  };
}

/** Letters whose every rule passes for this hand (to tell the learner what they ARE signing). */
export function matchingLetters(f: Features): string[] {
  return Object.keys(RULES).filter((L) => RULES[L].every((r) => r.test(f)));
}

// ---- items ---------------------------------------------------------------------------------
// Formats speak item ids ("L-A"); these wrappers are the one place that maps an item to its rules,
// so Part E can add static numbers here without touching the formats or checkModeFor().
const letterOf = (itemId: string) => /^L-([A-Z])$/.exec(itemId)?.[1];

/** Whether the camera can check this item automatically (static letters today). */
export function hasCameraRule(itemId: string): boolean {
  const letter = letterOf(itemId);
  return letter !== undefined && CHECKABLE.has(letter);
}

/** Evaluates a hand against an item's rules (an item without rules never passes). */
export function evaluateSign(itemId: string, f: Features): Evaluation {
  return evaluateLetter(letterOf(itemId) ?? "", f);
}

/** Items (as ids) whose every rule passes for this hand: "that looks like an N". */
export function matchingSigns(f: Features): string[] {
  return matchingLetters(f).map((letter) => `L-${letter}`);
}

/** Live detector values, for debugging and tuning the thresholds (developer text). */
export function describe(f: Features) {
  const st = FINGERS.map((n) => `${n.slice(0, 3)}:${f.fingers[n]}(${f.bend[n].toFixed(0)}°)`).join(" ");
  return `${st}\nthumb out=${f.thumbOut.toFixed(2)} lat=${f.thumbLat.toFixed(2)} bend=${f.thumbBend.toFixed(0)}° ∠index=${f.thumbIndexAngle.toFixed(0)}°\n` +
    `spread I-M=${f.spreadIM.toFixed(0)}° M-R=${f.spreadMR.toFixed(0)}° crossed=${f.crossedIM} pointing=${f.pointing}\n` +
    `d(4,8)=${f.d(4, 8).toFixed(2)} d(4,12)=${f.d(4, 12).toFixed(2)} d(4,6)=${f.d(4, 6).toFixed(2)} d(4,10)=${f.d(4, 10).toFixed(2)}`;
}
