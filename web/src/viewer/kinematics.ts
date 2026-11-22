/**
 * Procedural hand kinematics. A HandPose (joint angles, degrees) is turned into the 21 joint
 * positions used by MediaPipe Hands (0 wrist, 1-4 thumb, 5-8 index, 9-12 middle, 13-16 ring,
 * 17-20 pinky). The same 21-point format feeds the renderer, so letters (authored poses), the
 * avatar (real MediaPipe data) and verification (reference landmarks) all share one hand mesh.
 *
 * Coordinates: viewer space, right-handed, units = palm length (wrist → middle knuckle ≈ 1).
 *   x → viewer's right (= signer's left)   y → up   z → towards the viewer.
 * Rest pose: RIGHT hand, palm facing the viewer (+z), fingers up (+y), thumb on the +x side.
 * No imports besides plain math, so this file also runs under Node for automated checks.
 */

export type V3 = [number, number, number];
export interface FingerPose { mcp: number; pip: number; dip: number; spread: number }
export interface ThumbPose { yaw: number; pitch: number; roll: number; mcp: number; ip: number }
export interface HandPose {
  thumb: ThumbPose;
  index: FingerPose;
  middle: FingerPose;
  ring: FingerPose;
  pinky: FingerPose;
}
export type FingerName = "index" | "middle" | "ring" | "pinky";
export const FINGERS: FingerName[] = ["index", "middle", "ring", "pinky"];

// ---- tiny 3x3 matrix helpers (row-major) --------------------------------------------------
type M3 = number[]; // 9 numbers
const rad = (d: number) => (d * Math.PI) / 180;
const mul = (a: M3, b: M3): M3 => {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
};
const apply = (m: M3, v: V3): V3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
const rx = (d: number): M3 => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const ry = (d: number): M3 => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rz = (d: number): M3 => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const vec = { add, sub, scale, dot, cross, norm, len: (a: V3) => Math.hypot(...a) };

// ---- skeleton proportions: averaged over the 21 real reference hands (MediaPipe world landmarks,
// canonical frame, palm length = 1), slightly lengthened where depth foreshortening shrinks them.
const MCP: Record<FingerName, V3> = {
  index: [0.21, 0.97, 0.04], middle: [0.0, 1.0, 0.0], ring: [-0.2, 0.96, 0.01], pinky: [-0.36, 0.83, 0.04],
};
const FAN: Record<FingerName, number> = { index: -5, middle: 0, ring: 5, pinky: 11 }; // rest splay (deg, +x is negative)
const SEG: Record<FingerName, [number, number, number]> = {
  index: [0.36, 0.24, 0.22], middle: [0.4, 0.27, 0.23], ring: [0.37, 0.26, 0.22], pinky: [0.29, 0.21, 0.19],
};
const THUMB_CMC: V3 = [0.17, 0.27, 0.12];
const THUMB_SEG: [number, number, number] = [0.34, 0.33, 0.29];

/**
 * Anatomical joint ranges (degrees). Poses are clamped to them, so a procedural letter can never
 * bend a finger backwards or fold it through the palm. Finger MCPs and the thumb IP may
 * hyperextend a little, as real ones do; PIP joints not at all. fit-letters.ts searches inside the
 * same ranges.
 */
export const JOINT_LIMITS = {
  thumb: { yaw: [-60, 95], pitch: [-10, 85], roll: [-100, 0], mcp: [-10, 75], ip: [-15, 85] },
  finger: { mcp: [-10, 95], pip: [0, 115], dip: [-5, 85], spread: [-25, 25] },
} as const;
const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

/** The pose with every angle inside JOINT_LIMITS. */
export function clampPose(p: HandPose): HandPose {
  const T = JOINT_LIMITS.thumb, F = JOINT_LIMITS.finger;
  const f = (x: FingerPose): FingerPose => ({ mcp: clamp(x.mcp, F.mcp), pip: clamp(x.pip, F.pip), dip: clamp(x.dip, F.dip), spread: clamp(x.spread, F.spread) });
  return {
    thumb: { yaw: clamp(p.thumb.yaw, T.yaw), pitch: clamp(p.thumb.pitch, T.pitch), roll: clamp(p.thumb.roll, T.roll), mcp: clamp(p.thumb.mcp, T.mcp), ip: clamp(p.thumb.ip, T.ip) },
    index: f(p.index), middle: f(p.middle), ring: f(p.ring), pinky: f(p.pinky),
  };
}

/** Forward kinematics in the hand's own frame (rest orientation). Angles are clamped to JOINT_LIMITS. */
export function handJointsLocal(pose: HandPose): V3[] {
  const p = clampPose(pose);
  const j: V3[] = new Array(21);
  j[0] = [0, 0, 0];
  // thumb: base orientation (yaw in palm plane towards +x, pitch out of the palm, roll sets the
  // plane in which MCP/IP flexion curls the thumb across the palm)
  let R = mul(mul(rz(-p.thumb.yaw), rx(p.thumb.pitch)), ry(p.thumb.roll));
  j[1] = THUMB_CMC;
  j[2] = add(j[1], apply(R, [0, THUMB_SEG[0], 0]));
  R = mul(R, rx(p.thumb.mcp));
  j[3] = add(j[2], apply(R, [0, THUMB_SEG[1], 0]));
  R = mul(R, rx(p.thumb.ip));
  j[4] = add(j[3], apply(R, [0, THUMB_SEG[2], 0]));

  FINGERS.forEach((f, fi) => {
    const fp = p[f];
    const base = 5 + fi * 4;
    // + spread = away from the middle finger (index spreads towards +x, ring/pinky towards -x)
    const spreadSign = f === "index" ? -1 : 1;
    let Rf = mul(rz(FAN[f] + spreadSign * fp.spread), rx(fp.mcp));
    j[base] = MCP[f];
    j[base + 1] = add(j[base], apply(Rf, [0, SEG[f][0], 0]));
    Rf = mul(Rf, rx(fp.pip));
    j[base + 2] = add(j[base + 1], apply(Rf, [0, SEG[f][1], 0]));
    Rf = mul(Rf, rx(fp.dip));
    j[base + 3] = add(j[base + 2], apply(Rf, [0, SEG[f][2], 0]));
  });
  return j;
}

// ---- orientation ----------------------------------------------------------------------------
/** Phonological directions in the SIGNER's frame, mapped to viewer space. */
export const DIRS: Record<string, V3> = {
  up: [0, 1, 0], down: [0, -1, 0],
  out: [0, 0, 1],            // away from the signer, towards the viewer
  in: [0, 0, -1],            // towards the signer's body
  left: [1, 0, 0],           // signer's left = viewer's right
  right: [-1, 0, 0],
};

/** "out", "down+in"… → unit vector (compound labels are summed). */
export function dir(label: string): V3 {
  return norm(label.split("+").map((k) => DIRS[k.trim()] ?? [0, 0, 0]).reduce(add, [0, 0, 0] as V3));
}

/** Rotation taking the rest hand (fingers +y, palm +z) to the given finger / palm directions. */
export function orientationMatrix(fingers: V3, palm: V3): M3 {
  const y = norm(fingers);
  const z = norm(sub(palm, scale(y, dot(palm, y)))); // make palm ⟂ fingers
  const x = cross(y, z);
  // columns x, y, z
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

export function eulerMatrix(e: V3): M3 {
  return mul(mul(rz(e[2]), ry(e[1])), rx(e[0]));
}

export function transform(points: V3[], m: M3, offset: V3 = [0, 0, 0], mirror = false): V3[] {
  return points.map((p) => {
    const q = add(apply(m, p), offset);
    return mirror ? [-q[0], q[1], q[2]] : q;
  });
}

/** Linear blend of two poses (t in 0..1). */
export function lerpPose(a: HandPose, b: HandPose, t: number): HandPose {
  const l = (x: number, y: number) => x + (y - x) * t;
  const lf = (x: FingerPose, y: FingerPose): FingerPose => ({ mcp: l(x.mcp, y.mcp), pip: l(x.pip, y.pip), dip: l(x.dip, y.dip), spread: l(x.spread, y.spread) });
  return {
    thumb: { yaw: l(a.thumb.yaw, b.thumb.yaw), pitch: l(a.thumb.pitch, b.thumb.pitch), roll: l(a.thumb.roll, b.thumb.roll), mcp: l(a.thumb.mcp, b.thumb.mcp), ip: l(a.thumb.ip, b.thumb.ip) },
    index: lf(a.index, b.index), middle: lf(a.middle, b.middle), ring: lf(a.ring, b.ring), pinky: lf(a.pinky, b.pinky),
  };
}

/** Rotation matrix between two orientations, slerp-free: blend the direction vectors. */
export function lerpDir(a: V3, b: V3, t: number): V3 {
  return norm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}

/** Convert viewer-space joints to MediaPipe conventions (x right, y down, z away) for checks. */
export function toMediaPipe(points: V3[]): { world: { x: number; y: number; z: number }[]; image: { x: number; y: number; z: number }[] } {
  const world = points.map(([x, y, z]) => ({ x: x * 0.09, y: -y * 0.09, z: -z * 0.09 }));
  const image = points.map(([x, y, z]) => ({ x: 0.5 + x * 0.1, y: 0.5 - y * 0.1, z: -z * 0.1 }));
  return { world, image };
}
