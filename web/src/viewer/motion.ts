/**
 * Avatar motion: turns a motion file extracted OFFLINE from a real signer's clip
 * (scripts/extract_motion.py, MediaPipe Holistic, ~15 fps) into smooth display-rate frames for
 * AvatarScene. Nothing is invented: every pose comes from the clip; this module only cleans it.
 *   1. hands: detections whose palm is implausibly small or large (motion blur at the start and
 *      end of a sign) count as lost; a lost hand crossfades to a relaxed hand that follows the
 *      forearm, instead of freezing or popping;
 *   2. skeleton: every hand bone gets one length per clip (its median), each hand hangs from its
 *      arm's wrist, the arms keep their lengths (two-bone IK, the measured elbow as the pole), and
 *      so do the shoulders, hips, spine and neck;
 *   3. smoothing: zero-phase Gaussian kernels at the source rate. They are light while a hand is
 *      tracked in the signing space (taps and contacts are fast) and stronger while it is lost or
 *      below the signing space (rising from rest, dropping back: transitions, not the sign);
 *   4. resampling: a cubic B-spline to AVATAR.fps (continuous velocity AND acceleration), so the
 *      15 fps data plays without steps.
 * Pure (no React, no three.js), so the metrics script (scripts/motion-metrics.ts) and the tests
 * run exactly what the viewer plays.
 */
import { HANDSHAPES } from "./handshapeLibrary.ts";
import { handJointsLocal, type V3 } from "./kinematics.ts";
import { AVATAR } from "./params.ts";

/** A motion file (public/motion/<id>.json). `version` 2 = the same fields with compact numbers. */
export interface Motion {
  id: string;
  version?: number;
  fps: number;
  frames: number;
  poseJoints: number[];
  pose: (number[] | null)[];
  leftHand: (number[] | null)[];
  rightHand: (number[] | null)[];
  face: { keys: string[]; values: (number[] | null)[] };
  crop?: number[];
  quality?: Record<string, number>;
}

/** Indices inside Motion.pose (POSE_IDX in extract_motion.py). */
export const POSE = {
  NOSE: 0, L_EYE: 1, R_EYE: 2, L_EAR: 3, R_EAR: 4, MOUTH_L: 5, MOUTH_R: 6,
  L_SH: 7, R_SH: 8, L_EL: 9, R_EL: 10, L_WR: 11, R_WR: 12, L_HIP: 13, R_HIP: 14,
} as const;

/** One display frame, viewer space (x = signer's left, y up, z towards the viewer), metres, hips at the origin. */
export interface AvatarFrame {
  body: V3[];   // 15 pose joints
  left: V3[];   // 21 joints of the signer's LEFT hand (MediaPipe order), at the drawn size
  right: V3[];
  face: number[];
}

export interface PreparedMotion {
  fps: number;
  frames: AvatarFrame[];
  /** constant sizes of this clip, metres (palm = drawn palm length) */
  sizes: { upperArm: [number, number]; forearm: [number, number]; head: number; palm: [number, number] };
  /** per frame and hand: 1 = tracked data, 0 = the relaxed hand, in between = crossfade */
  tracked: { left: number[]; right: number[] };
}

export interface MotionOptions {
  /** drawn hand size relative to life (default AVATAR.handScale; the metrics use 1) */
  handScale?: number;
}

// ---- small vector / quaternion helpers ---------------------------------------------------------
type Q = [number, number, number, number]; // x, y, z, w
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3, fallback: V3 = [0, 1, 0]): V3 => { const l = len(a); return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : fallback; };
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mid = (a: V3, b: V3): V3 => lerp3(a, b, 0.5);
/** the part of v perpendicular to the unit vector u */
const perp = (v: V3, u: V3): V3 => sub(v, mul(u, dot(v, u)));
const smoothstep = (u: number) => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x); };

function quatFromBasis(x: V3, y: V3, z: V3): Q {
  // rotation matrix with columns x, y, z
  const [m00, m10, m20] = x, [m01, m11, m21] = y, [m02, m12, m22] = z;
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s];
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
}
const qconj = (q: Q): Q => [-q[0], -q[1], -q[2], q[3]];
function qrot(q: Q, v: V3): V3 {
  const u: V3 = [q[0], q[1], q[2]];
  const t = mul(cross(u, v), 2);
  return add(add(v, mul(t, q[3])), cross(u, t));
}

// ---- hand skeleton -------------------------------------------------------------------------------
/** parent of each MediaPipe hand joint (the wrist is the root) */
export const HAND_PARENT = [-1, 0, 1, 2, 3, 0, 5, 6, 7, 0, 9, 10, 11, 0, 13, 14, 15, 0, 17, 18, 19];
const KNUCKLES = [5, 9, 13, 17];

/** Hand basis: y = wrist → middle knuckle, x = towards the index knuckle, z = x × y. */
function handBasis(j: V3[]): Q {
  const y = norm(sub(j[9], j[0]));
  const x = norm(perp(sub(j[5], j[17]), y), norm(perp([1, 0, 0], y), [0, 0, 1]));
  return quatFromBasis(x, y, cross(x, y));
}

/** Shortest rotation taking unit vector a to unit vector b (a swing, no twist). */
function swing(a: V3, b: V3): Q {
  const d = dot(a, b);
  if (d < -0.9999) { const ax = norm(perp([1, 0, 0], a), norm(perp([0, 0, 1], a))); return [ax[0], ax[1], ax[2], 0]; }
  const c = cross(a, b);
  const l = Math.hypot(c[0], c[1], c[2], 1 + d);
  return [c[0] / l, c[1] / l, c[2] / l, (1 + d) / l];
}

/** Relaxed hand in the hand basis, unit palm length (right hand; `left` mirrors it). */
function restShape(left: boolean): V3[] {
  const j = handJointsLocal(HANDSHAPES.rest).map((p): V3 => (left ? [-p[0], p[1], p[2]] : p));
  const q = qconj(handBasis(j));
  return j.map((p) => qrot(q, sub(p, j[0])));
}

/** Rotation of a relaxed hand: fingers along the forearm, palm towards the body's midline. */
function restRotation(elbow: V3, wrist: V3): Q {
  const y = norm(sub(wrist, elbow), [0, -1, 0]);
  // basis z = +x for both hands (a right hand's palm normal; a left hand's back normal)
  const z = norm(perp([1, 0, 0], y), norm(perp([0, 0, 1], y), [1, 0, 0]));
  return quatFromBasis(cross(y, z), y, z);
}

/** Canonical bone length / palm length (the procedural skeleton, itself averaged over real hands). */
const CANON = (() => {
  const j = handJointsLocal(HANDSHAPES.relaxed);
  const palm = len(sub(j[9], j[0]));
  return HAND_PARENT.map((p, i) => (p < 0 ? 0 : len(sub(j[i], j[p])) / palm));
})();

/** Re-chain a hand from the wrist so every bone has its fixed length (directions kept). */
export function fixBoneLengths(shape: V3[], lengths: number[]): V3[] {
  const out: V3[] = new Array(21);
  out[0] = shape[0];
  for (let i = 1; i < 21; i++) {
    const p = HAND_PARENT[i];
    out[i] = add(out[p], mul(norm(sub(shape[i], shape[p])), lengths[i]));
  }
  return out;
}

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };

/** Bone lengths of a hand: medians over its tracked frames, kept within anatomical ratios. */
function handLengths(tracked: V3[][]): number[] {
  const palm = median(tracked.map((s) => len(sub(s[9], s[0]))));
  return HAND_PARENT.map((p, i) => {
    if (p < 0) return 0;
    const m = median(tracked.map((s) => len(sub(s[i], s[p]))));
    const c = CANON[i] * palm;
    return Math.min(c * AVATAR.boneRatioClamp[1], Math.max(c * AVATAR.boneRatioClamp[0], m));
  });
}

// ---- sequences -----------------------------------------------------------------------------------
/** Linear interpolation over gaps; the ends hold the nearest value. Null if every value is null. */
function fillGaps(seq: (number[] | null)[]): number[][] | null {
  const idx = seq.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return null;
  return seq.map((v, i) => {
    if (v) return v;
    const b = idx.find((k) => k > i), a = [...idx].reverse().find((k) => k < i);
    if (a === undefined) return seq[b!]!;
    if (b === undefined) return seq[a]!;
    const t = (i - a) / (b - a);
    return seq[a]!.map((x, k) => x + (seq[b]![k] - x) * t);
  });
}

/**
 * Zero-phase Gaussian smoothing of flat number arrays (groups of 3 = points), with a sigma in
 * frames per frame and point. Only frames of the same run (`run[i]` equal) are averaged, and the
 * weights are renormalised at the edges, so a run's ends are not pulled towards its neighbours.
 */
export function smoothGauss(seq: number[][], sigma: (frame: number, point: number) => number, run?: number[]): number[][] {
  return seq.map((v, i) => {
    const out = [...v];
    for (let p = 0; p < v.length / 3; p++) {
      const s = sigma(i, p);
      if (s < 0.05) continue;
      const h = Math.ceil(3 * s);
      let wsum = 0;
      const acc: V3 = [0, 0, 0];
      for (let k = -h; k <= h; k++) {
        const j = i + k;
        if (j < 0 || j >= seq.length || (run && run[j] !== run[i])) continue;
        const wt = Math.exp((-k * k) / (2 * s * s));
        wsum += wt;
        acc[0] += wt * seq[j][p * 3]; acc[1] += wt * seq[j][p * 3 + 1]; acc[2] += wt * seq[j][p * 3 + 2];
      }
      out[p * 3] = acc[0] / wsum; out[p * 3 + 1] = acc[1] / wsum; out[p * 3 + 2] = acc[2] / wsum;
    }
    return out;
  });
}

/** Uniform cubic B-spline sample (C2, approximating: a [1 4 1]/6 smoothing at the knots), ends clamped. */
export function bSpline(seq: number[][], x: number): number[] {
  const n = seq.length;
  const i = Math.max(0, Math.min(n - 1, Math.floor(x)));
  const t = Math.min(1, Math.max(0, x - i));
  const p0 = seq[Math.max(0, i - 1)], p1 = seq[i], p2 = seq[Math.min(n - 1, i + 1)], p3 = seq[Math.min(n - 1, i + 2)];
  const t2 = t * t, t3 = t2 * t;
  const b0 = (1 - t) ** 3 / 6, b1 = (3 * t3 - 6 * t2 + 4) / 6, b2 = (-3 * t3 + 3 * t2 + 3 * t + 1) / 6, b3 = t3 / 6;
  return p1.map((_, c) => b0 * p0[c] + b1 * p1[c] + b2 * p2[c] + b3 * p3[c]);
}
const flat = (pts: V3[]) => pts.flat();
const unflat = (a: number[]): V3[] => Array.from({ length: a.length / 3 }, (_, i) => [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]] as V3);
/** MediaPipe world (x right, y down, z away from the camera) → viewer space */
const decode = (a: number[], count: number): V3[] => Array.from({ length: count }, (_, i) => [a[i * 3], -a[i * 3 + 1], -a[i * 3 + 2]] as V3);

// ---- two-bone IK ---------------------------------------------------------------------------------
/**
 * Elbow for a shoulder → wrist chain with fixed lengths. The wrist is pulled in when out of reach.
 * `pole` is where the elbow should point.
 */
export function solveArm(shoulder: V3, target: V3, a: number, b: number, pole: V3): { elbow: V3; wrist: V3 } {
  const u = norm(sub(target, shoulder), [0, -1, 0]);
  const dist = Math.min((a + b) * 0.999, Math.max(Math.abs(a - b) * 1.001 + 1e-6, len(sub(target, shoulder))));
  const wrist = add(shoulder, mul(u, dist));
  const along = (a * a - b * b + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  const p = norm(perp(pole, u), norm(perp([0, -1, 0], u), [1, 0, 0]));
  return { elbow: add(add(shoulder, mul(u, along)), mul(p, h)), wrist };
}

// ---- the pipeline --------------------------------------------------------------------------------
/** A hand per source frame as bone directions (unit vectors, world space; index = child joint, 0 unused). */
/**
 * `shift`: per frame, where the constant-size hand moves so that its fingertips sit where the
 * detected fingertips were (MediaPipe sees a hand larger or smaller from frame to frame; a hand
 * shrunk about the wrist would pull the fingertips away from what they touch). The wrist, and with
 * it the arm, takes up the difference.
 */
interface HandTrack { dirs: V3[][]; w: number[]; lengths: number[]; shift: V3[] }

const TIPS = [4, 8, 12, 16, 20];
const centroid = (pts: V3[]): V3 => mul(TIPS.reduce((a, i) => add(a, pts[i]), [0, 0, 0] as V3), 1 / TIPS.length);

/**
 * Which frames of a hand count as tracked: detections whose palm is within the plausible range of
 * the clip's median, plus short gaps between them (filled by interpolation later); runs shorter
 * than AVATAR.minRun frames are dropped (flickering detections at the start and end of a sign).
 */
export function trackedFrames(hands: (V3[] | null)[]): boolean[] {
  const palms = hands.map((j) => (j ? len(sub(j[9], j[0])) : NaN));
  const med = median(palms.filter((x) => !Number.isNaN(x)));
  const ok = hands.map((j, f) => !!j && Math.abs(palms[f] / med - 1) <= AVATAR.palmTolerance);
  const out = [...ok];
  // fill short internal gaps
  for (let f = 0; f < ok.length; f++) {
    if (ok[f] || !out[f - 1]) continue;
    let e = f;
    while (e < ok.length && !ok[e]) e++;
    if (e < ok.length && e - f <= AVATAR.maxGap) for (let k = f; k < e; k++) out[k] = true;
    f = e - 1;
  }
  // drop short runs
  for (let f = 0; f < out.length; f++) {
    if (!out[f]) continue;
    let e = f;
    while (e < out.length && out[e]) e++;
    if (e - f < AVATAR.minRun) for (let k = f; k < e; k++) out[k] = false;
    f = e - 1;
  }
  return out;
}

/** Weight of the tracked data per frame: 1 on detections, easing to 0 away from them. */
function presence(ok: boolean[], fadeFrames: number): number[] {
  const idx = ok.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  return ok.map((v, f) => {
    if (v) return 1;
    let best = Infinity;
    for (const i of idx) best = Math.min(best, Math.abs(i - f));
    return smoothstep(1 - best / fadeFrames);
  });
}

const boneDirs = (o: V3[]): V3[] => o.map((p, i) => (i ? norm(sub(p, o[HAND_PARENT[i]])) : [0, 0, 0]));
/** Joint offsets from the wrist, chaining bone directions with fixed lengths. */
export function chainBones(dirs: V3[], lengths: number[]): V3[] {
  const out: V3[] = new Array(21);
  out[0] = [0, 0, 0];
  for (let i = 1; i < 21; i++) out[i] = add(out[HAND_PARENT[i]], mul(dirs[i], lengths[i]));
  return out;
}

/**
 * Source-rate hand track in bone-direction space, so every bone keeps its length by construction.
 * Tracked runs are smoothed (a foreshortened bone, whose direction MediaPipe guesses badly, weighs
 * less); the other frames blend from the nearest tracked hand (swinging with the forearm) to a
 * relaxed hand.
 */
function trackHand(hands: (V3[] | null)[], isT: boolean[], w: number[], body: V3[][], side: "left" | "right", otherLengths: number[] | null): HandTrack {
  const isL = side === "left";
  const EL = isL ? POSE.L_EL : POSE.R_EL, WR = isL ? POSE.L_WR : POSE.R_WR;
  // real detections inside tracked runs (a detection outside them, or an implausible one, is not used)
  const palms = hands.map((j) => (j ? len(sub(j[9], j[0])) : NaN));
  const med = median(palms.filter((x) => !Number.isNaN(x)));
  const offs = hands.map((j, f) => (j && isT[f] && Math.abs(palms[f] / med - 1) <= AVATAR.palmTolerance ? j.map((p) => sub(p, j[0])) : null));
  const tracked = offs.filter(Boolean) as V3[][];
  const lengths = tracked.length ? handLengths(tracked) : otherLengths ?? CANON.map((c) => c * AVATAR.defaultPalm);

  // bone directions; frames in a filled gap interpolate their neighbours' and weigh little
  const raw: (V3[] | null)[] = offs.map((o) => (o ? boneDirs(o) : null));
  const weight: (number[] | null)[] = offs.map((o) => (o ? o.map((p, i) => (i ? Math.min(1, len(sub(p, o[HAND_PARENT[i]])) / lengths[i]) ** 2 : 0)) : null));
  for (let f = 0; f < raw.length; f++) {
    if (!isT[f] || raw[f]) continue;
    let a = f - 1, b = f + 1;
    while (a >= 0 && !raw[a]) a--;
    while (b < raw.length && !raw[b]) b++;
    const da = raw[a] ?? raw[b], db = raw[b] ?? raw[a];
    if (!da || !db) continue;
    const t = a >= 0 && b < raw.length ? (f - a) / (b - a) : 0;
    raw[f] = da.map((d, i) => (i ? norm(lerp3(d, db[i], t), d) : d));
    weight[f] = new Array(21).fill(0.3);
  }
  const sig = AVATAR.sigma.handShape, h = Math.ceil(3 * sig);
  const sm = raw.map((d, f) => {
    if (!d || !isT[f]) return null;
    return d.map((_, i) => {
      if (!i) return [0, 0, 0] as V3;
      // only frames of the same tracked run
      let lo = f, hi = f;
      while (lo - 1 >= 0 && isT[lo - 1] && raw[lo - 1] && f - (lo - 1) <= h) lo--;
      while (hi + 1 < raw.length && isT[hi + 1] && raw[hi + 1] && hi + 1 - f <= h) hi++;
      let acc: V3 = [0, 0, 0];
      for (let k = lo; k <= hi; k++) acc = add(acc, mul(raw[k]![i], Math.exp(-((k - f) ** 2) / (2 * sig * sig)) * (0.05 + weight[k]![i])));
      return norm(acc, d[i]);
    });
  });

  const rest = restShape(isL).map((p) => mul(p, lengths[9]));
  const idx = sm.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  const dirs = body.map((b, f) => {
    if (sm[f]) return sm[f]!;
    const restD = boneDirs(rest.map((p) => qrot(restRotation(b[EL], b[WR]), p)));
    if (!idx.length || w[f] <= 0) return restD;
    let k = idx[0];
    for (const i of idx) if (Math.abs(i - f) < Math.abs(k - f)) k = i;
    // the held hand swings with the forearm while the arm moves (no twist: it is not measured)
    const carry = swing(norm(sub(body[k][WR], body[k][EL])), norm(sub(b[WR], b[EL])));
    return sm[k]!.map((d, i) => (i ? norm(lerp3(restD[i], qrot(carry, d), w[f]), restD[i]) : d));
  });

  // the detected fingertips' centre (relative to the wrist) vs the constant-size hand's: smoothed
  // like the directions, eased out with the tracking weight where the hand is lost
  const cen: (V3 | null)[] = offs.map((o) => (o ? centroid(o) : null));
  for (let f = 0; f < cen.length; f++) {
    if (!isT[f] || cen[f]) continue;
    let a = f - 1, b = f + 1;
    while (a >= 0 && !cen[a]) a--;
    while (b < cen.length && !cen[b]) b++;
    const ca = cen[a] ?? cen[b], cb = cen[b] ?? cen[a];
    if (ca && cb) cen[f] = lerp3(ca, cb, a >= 0 && b < cen.length ? (f - a) / (b - a) : 0);
  }
  const run = isT.map((t, f) => (t ? isT.slice(0, f + 1).filter((x, i) => x && !isT[i - 1]).length : -1));
  const raw3 = dirs.map((d, f) => (isT[f] && cen[f] ? flat([sub(cen[f]!, centroid(chainBones(d, lengths)))]) : [0, 0, 0]));
  const shift = smoothGauss(raw3, () => sig, run).map((v, f) => mul([v[0], v[1], v[2]], isT[f] ? 1 : 0));
  // untracked frames: the nearest tracked shift, eased out with the weight
  const tIdx = isT.map((t, i) => (t ? i : -1)).filter((i) => i >= 0);
  const shiftOut = shift.map((v, f) => {
    if (isT[f] || !tIdx.length) return v;
    let k = tIdx[0];
    for (const i of tIdx) if (Math.abs(i - f) < Math.abs(k - f)) k = i;
    return mul(shift[k], w[f]);
  });
  return { dirs, w, lengths, shift: shiftOut };
}

/** Clean a motion file into display-rate frames (see the header). */
export function prepareMotion(m: Motion, opts: MotionOptions = {}): PreparedMotion {
  const handScale = opts.handScale ?? AVATAR.handScale;
  const n = m.pose.length;
  const fps = m.fps || 15;
  const J = m.poseJoints?.length || 15;
  const poseFilled = fillGaps(m.pose);
  if (!poseFilled) throw new Error(`motion ${m.id}: no pose`);

  // hands: usable detections and the tracked/relaxed weight per frame
  const raw = { left: m.leftHand.map((h) => (h ? decode(h, 21) : null)), right: m.rightHand.map((h) => (h ? decode(h, 21) : null)) };
  const ok = { left: trackedFrames(raw.left), right: trackedFrames(raw.right) };
  const fade = Math.max(1, AVATAR.fadeSeconds * fps);
  const w = { left: presence(ok.left, fade), right: presence(ok.right, fade) };

  // body: light smoothing; an arm whose hand is lost or below the signing space gets more
  const LEFT_ARM = new Set<number>([POSE.L_EL, POSE.L_WR]), RIGHT_ARM = new Set<number>([POSE.R_EL, POSE.R_WR]);
  const { body: sBody, untracked: sLoose, transition: sTrans } = AVATAR.sigma;
  const pre = poseFilled.map((p) => decode(p, J));
  // transition: a hand below the signing space (rising from rest, dropping back)
  const low = (f: number, wr: number) => {
    const b = pre[f];
    const sh = (b[POSE.L_SH][1] + b[POSE.R_SH][1]) / 2, hip = (b[POSE.L_HIP][1] + b[POSE.R_HIP][1]) / 2;
    const thr = hip + 0.45 * (sh - hip);
    return smoothstep((thr - b[wr][1]) / (0.15 * (sh - hip)) + 0.5);
  };
  const tau = { left: pre.map((_, f) => low(f, POSE.L_WR)), right: pre.map((_, f) => low(f, POSE.R_WR)) };
  const body = smoothGauss(poseFilled, (f, p) => {
    const isLA = LEFT_ARM.has(p), isRA = RIGHT_ARM.has(p);
    const wt = isLA ? w.left[f] : isRA ? w.right[f] : 1;
    const tr = (isLA ? tau.left[f] : isRA ? tau.right[f] : 0) * sTrans;
    return sBody + (sLoose - sBody) * (1 - wt) + tr;
  }).map((p) => decode(p, J));

  const anyL = ok.left.some(Boolean), anyR = ok.right.some(Boolean);
  let right = trackHand(raw.right, ok.right, w.right, body, "right", null);
  const left = trackHand(raw.left, ok.left, w.left, body, "left", anyR ? right.lengths : null);
  if (!anyR && anyL) right = trackHand(raw.right, ok.right, w.right, body, "right", left.lengths);

  const face = fillGaps(m.face.values) ?? body.map(() => new Array(m.face.keys.length || 8).fill(0));

  // constant body sizes (medians over the clip)
  const med = (fn: (b: V3[]) => number) => median(body.map(fn));
  const d = (i: number, k: number) => (b: V3[]) => len(sub(b[i], b[k]));
  const upperArm: [number, number] = [med(d(POSE.L_SH, POSE.L_EL)), med(d(POSE.R_SH, POSE.R_EL))];
  const forearm: [number, number] = [med(d(POSE.L_EL, POSE.L_WR)), med(d(POSE.R_EL, POSE.R_WR))];
  const shoulderW = med(d(POSE.L_SH, POSE.R_SH)), hipW = med(d(POSE.L_HIP, POSE.R_HIP));
  const spine = med((b) => len(sub(mid(b[POSE.L_SH], b[POSE.R_SH]), mid(b[POSE.L_HIP], b[POSE.R_HIP]))));
  const neck = med((b) => len(sub(mid(b[POSE.L_EAR], b[POSE.R_EAR]), mid(b[POSE.L_SH], b[POSE.R_SH]))));
  const head = med(d(POSE.L_EAR, POSE.R_EAR));

  // resample to the display rate
  const out = AVATAR.fps;
  const N = Math.max(1, Math.floor(((n - 1) / fps) * out + 1e-6) + 1);
  const bodySeq = body.map(flat);
  const hands = { left, right };
  // sign-continuous directions are already unit vectors; Catmull–Rom then renormalise per bone
  const seqs = {
    left: { d: left.dirs.map(flat), w: left.w.map((x) => [x]), s: left.shift.map((v) => [...v]) },
    right: { d: right.dirs.map(flat), w: right.w.map((x) => [x]), s: right.shift.map((v) => [...v]) },
  };
  const frames: AvatarFrame[] = [];
  const trackedOut = { left: [] as number[], right: [] as number[] };
  for (let k = 0; k < N; k++) {
    const x = Math.min(n - 1, (k * fps) / out);
    const b = unflat(bSpline(bodySeq, x));
    // torso: constant shoulder and hip widths and spine length, around the measured centres
    const hipC = mid(b[POSE.L_HIP], b[POSE.R_HIP]);
    const hipDir = norm(sub(b[POSE.L_HIP], b[POSE.R_HIP]), [1, 0, 0]);
    b[POSE.L_HIP] = add(hipC, mul(hipDir, hipW / 2)); b[POSE.R_HIP] = sub(hipC, mul(hipDir, hipW / 2));
    const shC = add(hipC, mul(norm(sub(mid(b[POSE.L_SH], b[POSE.R_SH]), hipC)), spine));
    const shDir = norm(sub(b[POSE.L_SH], b[POSE.R_SH]), [1, 0, 0]);
    b[POSE.L_SH] = add(shC, mul(shDir, shoulderW / 2)); b[POSE.R_SH] = sub(shC, mul(shDir, shoulderW / 2));
    // the head points move together, so the neck keeps its length
    const headC0 = mid(b[POSE.L_EAR], b[POSE.R_EAR]);
    const headShift = sub(add(shC, mul(norm(sub(headC0, shC)), neck)), headC0);
    for (const i of [POSE.NOSE, POSE.L_EYE, POSE.R_EYE, POSE.L_EAR, POSE.R_EAR, POSE.MOUTH_L, POSE.MOUTH_R]) b[i] = add(b[i], headShift);

    const frame: AvatarFrame = { body: b, left: [], right: [], face: bSpline(face, x).map((v) => Math.max(0, Math.min(1, v))) };
    for (const side of ["left", "right"] as const) {
      const h = hands[side], s = seqs[side];
      const isL = side === "left";
      const SH = isL ? POSE.L_SH : POSE.R_SH, EL = isL ? POSE.L_EL : POSE.R_EL, WR = isL ? POSE.L_WR : POSE.R_WR;
      // constant-size hand, placed so its fingertips are where the detected ones were
      const sh = bSpline(s.s, x) as V3;
      const shape = chainBones(unflat(bSpline(s.d, x)).map((d, i) => (i ? norm(d) : d)), h.lengths).map((p) => add(p, sh));
      trackedOut[side].push(Math.max(0, Math.min(1, bSpline(s.w, x)[0])));
      // drawn bigger about the knuckles: the fingertips stay near the real ones, the wrist moves back
      const K = mul(KNUCKLES.reduce((acc, i) => add(acc, shape[i]), [0, 0, 0] as V3), 1 / KNUCKLES.length);
      const local = shape.map((p) => add(K, mul(sub(p, K), handScale)));
      const target = add(b[WR], local[0]);
      // arm with constant lengths; the measured elbow is the pole, leaning towards a natural elbow
      const natural = norm([isL ? 0.5 : -0.5, -1, -0.4]);
      const measured = perp(sub(b[EL], b[SH]), norm(sub(target, b[SH])));
      const pole = add(len(measured) > 1e-4 ? norm(measured) : natural, mul(natural, AVATAR.elbowBias));
      const arm = solveArm(b[SH], target, upperArm[isL ? 0 : 1], forearm[isL ? 0 : 1], pole);
      b[EL] = arm.elbow;
      b[WR] = arm.wrist;
      frame[side] = local.map((p) => add(arm.wrist, sub(p, local[0])));
    }
    frames.push(frame);
  }
  return {
    fps: out,
    frames,
    sizes: { upperArm, forearm, head, palm: [left.lengths[9] * handScale, right.lengths[9] * handScale] },
    tracked: trackedOut,
  };
}

/** Frame at fractional index x (linear blend of two display-rate frames). */
export function frameAt(frames: AvatarFrame[], x: number): AvatarFrame {
  const i = Math.max(0, Math.min(frames.length - 1, Math.floor(x)));
  return blendFrames(frames[i], frames[Math.min(frames.length - 1, i + 1)], x - i);
}

export function blendFrames(a: AvatarFrame, b: AvatarFrame, t: number): AvatarFrame {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    body: a.body.map((p, k) => lerp3(p, b.body[k], t)),
    left: a.left.map((p, k) => lerp3(p, b.left[k], t)),
    right: a.right.map((p, k) => lerp3(p, b.right[k], t)),
    face: a.face.map((v, k) => v + (b.face[k] - v) * t),
  };
}

/**
 * Points that bound the signing space while the sign is active (camera framing): the head and the
 * shoulders, plus the elbow and hand of every arm that is raised in that frame. A hand resting at
 * the hip stays out of the frame, so the signing space fills the stage (SPEC Part H, phone framing).
 */
export function avatarExtent(frames: AvatarFrame[]): V3[] {
  const raised = (fr: AvatarFrame, wr: number) => {
    const b = fr.body;
    const sh = (b[POSE.L_SH][1] + b[POSE.R_SH][1]) / 2, hip = (b[POSE.L_HIP][1] + b[POSE.R_HIP][1]) / 2;
    return b[wr][1] > hip + 0.35 * (sh - hip);
  };
  const anyRaised = frames.some((fr) => raised(fr, POSE.L_WR) || raised(fr, POSE.R_WR));
  const pts: V3[] = [];
  for (let k = 0; k < frames.length; k += 2) {
    const fr = frames[k], b = fr.body;
    const arms = ([[POSE.L_EL, POSE.L_WR, fr.left], [POSE.R_EL, POSE.R_WR, fr.right]] as const).filter(([, wr]) => !anyRaised || raised(fr, wr));
    if (anyRaised && !arms.length) continue;
    const headC = mid(b[POSE.L_EAR], b[POSE.R_EAR]);
    const r = len(sub(b[POSE.L_EAR], b[POSE.R_EAR]));
    pts.push(add(headC, [0, r * 0.95, 0]), add(headC, [0, -r * 0.85, 0]), b[POSE.L_SH], b[POSE.R_SH]);
    for (const [el, , hand] of arms) { pts.push(b[el]); for (const i of [0, 4, 8, 12, 16, 20]) pts.push(hand[i]); }
  }
  return pts;
}
