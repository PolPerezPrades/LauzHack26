/**
 * Renderer-side realisation of named ASL handshapes as joint angles (degrees) for kinematics.ts.
 * Sign content only names a handshape ("A", "B", "flat-O"...); this table says how the procedural
 * 3D hand draws it. A different renderer (SVG, rigged avatar) can map the same names its own way.
 *
 * Every letter was checked against: real fingerspelling clips (WLASL/asldeafined, landmarks in
 * content/reference/letter-poses.json), the public-domain alphabet illustrations, Lifeprint's
 * descriptions, and the camera checker rules in src/lib/handshapes.ts (scripts/verify-letters.ts).
 */
import type { FingerPose, HandPose, ThumbPose, V3 } from "./kinematics";
import fitted from "./handshapes.fitted.json" with { type: "json" };

const f = (mcp: number, pip: number, dip: number, spread = 0): FingerPose => ({ mcp, pip, dip, spread });
const t = (yaw: number, pitch: number, roll: number, mcp: number, ip: number): ThumbPose => ({ yaw, pitch, roll, mcp, ip });

const STRAIGHT = f(0, 0, 0);
const FIST = f(88, 105, 65);
const pose = (thumb: ThumbPose, index: FingerPose, middle: FingerPose, ring: FingerPose, pinky: FingerPose): HandPose =>
  ({ thumb, index, middle, ring, pinky });

/** Thumb folded across the front of the curled fingers (S, I, X, …). */
const THUMB_OVER = t(-8, 52, -75, 38, 22);
/** Thumb folded across the palm under straight fingers (B, U, V, H, …). */
const THUMB_PALM = t(-22, 38, -80, 42, 30);

/** Hand-authored poses (starting point; also used where no reliable real reference exists). */
export const HANDSHAPES_AUTHORED: Record<string, HandPose> = {
  /** idle hand hanging at rest (avatar hands with no tracking data) */
  rest: pose(t(30, 30, -70, 20, 20), f(45, 55, 30), f(50, 58, 30), f(55, 60, 30), f(58, 60, 30)),
  relaxed: pose(t(40, 18, -70, 8, 8), f(12, 14, 8), f(14, 16, 8), f(16, 18, 10), f(18, 20, 10)),
  A: pose(t(6, 20, -35, 5, 0), FIST, FIST, FIST, FIST),
  B: pose(THUMB_PALM, f(0, 0, 0, -1), f(0, 0, 0), f(0, 0, 0, -1), f(0, 0, 0, -2)),
  C: pose(t(32, 58, -62, 12, 12), f(32, 48, 24, 2), f(34, 50, 24), f(34, 50, 24, 1), f(34, 48, 22, 2)),
  D: pose(t(-4, 55, -78, 32, 25), STRAIGHT, f(62, 78, 42), f(66, 80, 44), f(70, 82, 44)),
  E: pose(t(-18, 40, -82, 58, 42), f(78, 98, 70), f(78, 98, 70), f(78, 98, 70), f(80, 96, 66)),
  F: pose(t(18, 48, -70, 22, 20), f(48, 70, 42), f(0, 0, 0, 6), f(0, 0, 0, 8), f(0, 0, 0, 12)),
  G: pose(t(28, 8, -20, 0, 0), STRAIGHT, FIST, FIST, FIST),
  H: pose(t(-12, 46, -78, 40, 22), f(0, 0, 0, -2), f(0, 0, 0, 2), FIST, FIST),
  I: pose(THUMB_OVER, FIST, FIST, FIST, f(0, 0, 0, 4)),
  K: pose(t(8, 50, -48, 0, 0), f(0, 0, 0, 8), f(28, 0, 0, 10), FIST, FIST),
  L: pose(t(85, 2, -20, 0, 0), STRAIGHT, FIST, FIST, FIST),
  M: pose(t(-38, 32, -82, 30, 16), f(72, 92, 42), f(72, 92, 42), f(72, 92, 42), FIST),
  N: pose(t(-18, 34, -82, 30, 16), f(72, 92, 42), f(72, 92, 42), FIST, FIST),
  O: pose(t(22, 66, -72, 26, 26), f(58, 72, 42), f(60, 72, 40), f(62, 70, 38), f(64, 68, 36)),
  R: pose(THUMB_PALM, f(4, 0, 0, -14), f(18, 0, 0, 14), FIST, FIST),
  S: pose(t(-12, 58, -80, 46, 24), FIST, FIST, FIST, FIST),
  T: pose(t(4, 54, -72, 26, 6), f(86, 98, 50), FIST, FIST, FIST),
  U: pose(THUMB_PALM, f(0, 0, 0, -3), f(0, 0, 0, 3), FIST, FIST),
  V: pose(THUMB_PALM, f(0, 0, 0, 12), f(0, 0, 0, 12), FIST, FIST),
  W: pose(t(-30, 50, -82, 42, 32), f(0, 0, 0, 12), f(0, 0, 0), f(0, 0, 0, 12), f(70, 92, 52)),
  X: pose(THUMB_OVER, f(20, 70, 40), FIST, FIST, FIST),
  Y: pose(t(80, 4, -20, 0, 0), FIST, FIST, FIST, f(0, 0, 0, 18)),
  "index-up": pose(t(-10, 50, -80, 40, 24), STRAIGHT, FIST, FIST, FIST),
};

/**
 * Final poses: authored, overridden by poses fitted to the real signer's hand where a reliable
 * reference exists (scripts/fit-letters.ts → handshapes.fitted.json).
 */
export const HANDSHAPES: Record<string, HandPose> = { ...HANDSHAPES_AUTHORED, ...(fitted as Record<string, HandPose>) };
// Fists (Part H, D-H06; R-003): MediaPipe cannot see fingers curled into the palm and reconstructs
// them half open, so the fitted A, S and T became claws. The real clips show tight fists: these
// letters keep their fitted thumb and curl the fingers fully (S's thumb pitched 10° out so it
// rests on the fingers instead of sinking into them). They still pass scripts/verify-letters.ts.
const tight = (p: HandPose): HandPose => ({ ...p, index: { ...FIST, spread: 0 }, middle: { ...FIST, spread: 0 }, ring: { ...FIST, spread: 0 }, pinky: { ...FIST, spread: 0 } });
HANDSHAPES.A = tight(HANDSHAPES.A);
HANDSHAPES.S = { ...tight(HANDSHAPES.S), thumb: { ...HANDSHAPES.S.thumb, pitch: HANDSHAPES.S.thumb.pitch + 10, roll: HANDSHAPES.S.thumb.roll + 2 } };
HANDSHAPES.T = { ...tight(HANDSHAPES.T), index: HANDSHAPES_AUTHORED.T.index };
// C has no reliable real reference (side views): a rounder C, thumb and fingers curved alike
// (still passes the rules; the opening between thumb and index is 0.54 palm lengths).
HANDSHAPES.C = {
  ...HANDSHAPES.C,
  thumb: { ...HANDSHAPES.C.thumb, mcp: 24, ip: 28 },
  index: { ...HANDSHAPES.C.index, mcp: 38, pip: 52, dip: 28 }, middle: { ...HANDSHAPES.C.middle, mcp: 38, pip: 52, dip: 28 },
  ring: { ...HANDSHAPES.C.ring, mcp: 38, pip: 52, dip: 28 }, pinky: { ...HANDSHAPES.C.pinky, mcp: 38, pip: 50, dip: 26 },
};
// Shapes without a reliable real reference reuse the real signer's fist + thumb from S
// (fitted to real data) and only change the selected finger.
HANDSHAPES["index-up"] = { ...HANDSHAPES.S, index: { mcp: 0, pip: 0, dip: 0, spread: 0 } };
HANDSHAPES.X = { ...HANDSHAPES.S, index: HANDSHAPES_AUTHORED.X.index };
// letters that share a handshape with another letter (orientation / movement make the difference)
HANDSHAPES.J = HANDSHAPES.I;
HANDSHAPES.P = HANDSHAPES.K;
HANDSHAPES.Q = HANDSHAPES.G;
HANDSHAPES.Z = HANDSHAPES["index-up"];

export interface Keyframe { t: number; fingers: V3; palm: V3; offset: V3 }

/** Movement templates (renderer side) for phonological movement descriptors. */
export function movementKeyframes(shape: string): Keyframe[] | null {
  const up: V3 = [0, 1, 0], out: V3 = [0, 0, 1], inn: V3 = [0, 0, -1];
  if (shape === "trace-J") {
    // I handshape: the pinky draws a J — down, then curving towards the signer while the palm
    // rotates to face the signer (Lifeprint: twist of the wrist / forearm rotation)
    return [
      { t: 0, fingers: up, palm: out, offset: [0, 0.35, 0] },
      { t: 0.45, fingers: up, palm: out, offset: [0, -0.15, 0] },
      { t: 0.75, fingers: [0.35, 0.94, 0], palm: [0.6, 0, -0.8], offset: [0.25, -0.3, 0] },
      { t: 1, fingers: [0.2, 0.98, 0], palm: inn, offset: [0.45, -0.2, 0] },
    ];
  }
  if (shape === "trace-Z") {
    // index finger draws a Z in the air (as seen by the viewer, the Z appears mirrored)
    const k = (tt: number, x: number, y: number): Keyframe => ({ t: tt, fingers: up, palm: out, offset: [x, y, 0] });
    return [k(0, 0.55, 0.45), k(0.3, -0.45, 0.45), k(0.65, 0.55, -0.45), k(1, -0.45, -0.45)];
  }
  return null;
}

export interface PathPoint { fingers: V3; palm: V3; offset: V3 }
/** A letter's movement as a smooth path, sampled by normalised time (0..1). */
export interface MovementPath { at(t: number): PathPoint; corners: number }

const v3 = {
  add: (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s],
  len: (a: V3) => Math.hypot(a[0], a[1], a[2]),
  norm: (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
const cr = (p0: V3, p1: V3, p2: V3, p3: V3, t: number): V3 => {
  const t2 = t * t, t3 = t2 * t;
  return [0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)) as V3;
};
/** ease in and out over the whole movement (zero speed only at the two ends) */
const easeInOut = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

/** Arc-length table over dense samples, so speed follows the path, not the keyframe spacing. */
function arcPath(samples: PathPoint[], corners: number): MovementPath {
  const s = [0];
  for (let i = 1; i < samples.length; i++) s.push(s[i - 1] + v3.len(v3.sub(samples[i].offset, samples[i - 1].offset)));
  const total = s[s.length - 1] || 1;
  return {
    corners,
    at(t: number) {
      const target = easeInOut(t) * total;
      let i = 1;
      while (i < s.length - 1 && s[i] < target) i++;
      const u = (target - s[i - 1]) / (s[i] - s[i - 1] || 1);
      const a = samples[i - 1], b = samples[i];
      return { offset: v3.lerp(a.offset, b.offset, u), fingers: v3.norm(v3.lerp(a.fingers, b.fingers, u)), palm: v3.norm(v3.lerp(a.palm, b.palm, u)) };
    },
  };
}

/**
 * Smooth movement for the keyframes of a shape (Part H): J follows a Catmull–Rom curve through its
 * keyframes (one continuous stroke, no stop at each keyframe); Z keeps its three straight strokes
 * with slightly rounded corners. Both are timed by arc length with one ease in and out.
 */
export function movementPath(shape: string): MovementPath | null {
  const keys = movementKeyframes(shape);
  if (!keys) return null;
  const N = 96;
  if (shape === "trace-Z") {
    // straight strokes, corners rounded with a quadratic arc of radius r
    const P = keys.map((k) => k.offset);
    const r = 0.09;
    const pts: V3[] = [P[0]];
    for (let i = 1; i < P.length - 1; i++) {
      const inDir = v3.norm(v3.sub(P[i], P[i - 1])), outDir = v3.norm(v3.sub(P[i + 1], P[i]));
      const a = v3.sub(P[i], v3.mul(inDir, r)), b = v3.add(P[i], v3.mul(outDir, r));
      pts.push(a);
      for (let k = 1; k < 8; k++) { const t = k / 8; pts.push(v3.add(v3.add(v3.mul(a, (1 - t) ** 2), v3.mul(P[i], 2 * t * (1 - t))), v3.mul(b, t * t))); }
      pts.push(b);
    }
    pts.push(P[P.length - 1]);
    // densify the straight parts so the arc-length lookup stays fine-grained
    const dense: PathPoint[] = [];
    for (let i = 0; i + 1 < pts.length; i++) for (let k = 0; k < 6; k++) dense.push({ offset: v3.lerp(pts[i], pts[i + 1], k / 6), fingers: keys[0].fingers, palm: keys[0].palm });
    dense.push({ offset: pts[pts.length - 1], fingers: keys[0].fingers, palm: keys[0].palm });
    return arcPath(dense, P.length - 2);
  }
  // a curve through every keyframe (ends extrapolated), orientation interpolated alongside
  const ext = <T extends V3>(get: (k: Keyframe) => T) => {
    const p = keys.map(get);
    return [v3.sub(v3.mul(p[0], 2), p[1]), ...p, v3.sub(v3.mul(p[p.length - 1], 2), p[p.length - 2])];
  };
  const O = ext((k) => k.offset), F = ext((k) => k.fingers), Pm = ext((k) => k.palm);
  const seg = keys.length - 1;
  const samples: PathPoint[] = [];
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * seg;
    const k = Math.min(seg - 1, Math.floor(x)), t = x - k;
    samples.push({ offset: cr(O[k], O[k + 1], O[k + 2], O[k + 3], t), fingers: v3.norm(cr(F[k], F[k + 1], F[k + 2], F[k + 3], t)), palm: v3.norm(cr(Pm[k], Pm[k + 1], Pm[k + 2], Pm[k + 3], t)) });
  }
  return arcPath(samples, 0);
}
