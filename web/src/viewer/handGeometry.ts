/**
 * Hand surface (Part H): one mesh for the whole hand, rebuilt from the 21 joints (MediaPipe order)
 * whenever they move. Shapes, in palm lengths (wrist → middle knuckle = 1):
 *   phalanges: tapered capsules (the hull of two spheres), so every joint reads as a knuckle and
 *              each finger thins towards its tip;
 *   palm:      a rounded slab swept from the wrist to the knuckle line, thicker at the heel and
 *              fleshier on the palm side;
 *   thumb web: a fleshy bridge between the base of the thumb and the index knuckle;
 *   forearm:   (optional) a tapered capsule continuing the wrist.
 * Vertex colours carry the palm tint (palm and finger pads lighter than the back, so palm vs back
 * reads at a glance) and the per-finger feedback colours. Nails are a second, small mesh on the
 * backs of the fingertips. Pure arrays (no three.js): the tests run it under Node and
 * HandMesh.tsx uploads the arrays.
 */
import type { V3 } from "./kinematics.ts";

export type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";
export type RGB = [number, number, number];

export interface HandLook {
  side: "left" | "right";
  forearm: boolean;
  /** linear RGB */
  back: RGB;
  palm: RGB;
  /** per-finger colour override (feedback), linear RGB */
  fingers?: Partial<Record<Finger, RGB>>;
}

/** phalanges: from joint, to joint, radius at each end (palm lengths), finger */
export const PHALANGES: [number, number, number, number, Finger][] = [
  [1, 2, 0.15, 0.12, "thumb"], [2, 3, 0.12, 0.104, "thumb"], [3, 4, 0.104, 0.088, "thumb"],
  [5, 6, 0.104, 0.091, "index"], [6, 7, 0.091, 0.083, "index"], [7, 8, 0.083, 0.072, "index"],
  [9, 10, 0.108, 0.095, "middle"], [10, 11, 0.095, 0.087, "middle"], [11, 12, 0.087, 0.075, "middle"],
  [13, 14, 0.102, 0.09, "ring"], [14, 15, 0.09, 0.082, "ring"], [15, 16, 0.082, 0.071, "ring"],
  [17, 18, 0.09, 0.079, "pinky"], [18, 19, 0.079, 0.072, "pinky"], [19, 20, 0.072, 0.063, "pinky"],
];
const TIP_SEGMENTS = [2, 5, 8, 11, 14]; // index into PHALANGES of each finger's last phalanx

const RADIAL = 12;        // vertices around a capsule
const CAP_RINGS = 4;      // rings per capsule end (pole included)
const CAPSULE_VERTS = 2 * CAP_RINGS * RADIAL;
const PALM_AROUND = 20;   // vertices around a palm cross-section
// palm cross-sections: [v along the palm (0 wrist → 1 knuckles), scale of the section]; the ends close the slab
const PALM_V: [number, number][] = [[-0.085, 0], [-0.075, 0.55], [-0.045, 0.85], [0, 1], [0.25, 1], [0.5, 1], [0.75, 1], [1, 1], [1.035, 0.85], [1.06, 0.55], [1.07, 0]];
const NAIL_RINGS = 5, NAIL_RADIAL = 8;

const SKIN_PARTS = PHALANGES.length + 1; // + the thumb web
export function handVertexCount(forearm: boolean) {
  return (SKIN_PARTS + (forearm ? 1 : 0)) * CAPSULE_VERTS + PALM_V.length * PALM_AROUND;
}
export const NAIL_VERTS = 5 * NAIL_RINGS * NAIL_RADIAL;

// ---- topology (constant: computed once per hand) ------------------------------------------------
function gridIndex(out: number[], base: number, rings: number, around: number) {
  for (let r = 0; r + 1 < rings; r++) {
    for (let k = 0; k < around; k++) {
      const a = base + r * around + k, b = base + r * around + ((k + 1) % around);
      const c = a + around, d = b + around;
      out.push(a, c, b, b, c, d);
    }
  }
}
/** Triangle indices of the skin mesh (capsules, then the palm). */
export function handIndices(forearm: boolean): Uint32Array {
  const out: number[] = [];
  const parts = SKIN_PARTS + (forearm ? 1 : 0);
  for (let p = 0; p < parts; p++) gridIndex(out, p * CAPSULE_VERTS, 2 * CAP_RINGS, RADIAL);
  gridIndex(out, parts * CAPSULE_VERTS, PALM_V.length, PALM_AROUND);
  return new Uint32Array(out);
}
export function nailIndices(): Uint32Array {
  const out: number[] = [];
  for (let n = 0; n < 5; n++) gridIndex(out, n * NAIL_RINGS * NAIL_RADIAL, NAIL_RINGS, NAIL_RADIAL);
  return new Uint32Array(out);
}

// ---- math ------------------------------------------------------------------------------------
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3, fb: V3 = [0, 1, 0]): V3 => { const l = len(a); return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : fb; };
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const perp = (v: V3, u: V3): V3 => sub(v, mul(u, dot(v, u)));
const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const COS = Array.from({ length: RADIAL }, (_, k) => Math.cos((2 * Math.PI * k) / RADIAL));
const SIN = Array.from({ length: RADIAL }, (_, k) => Math.sin((2 * Math.PI * k) / RADIAL));

export interface HandFrame {
  /** palm length */
  L: number;
  /** wrist → knuckles */
  y: V3;
  /** towards the index side */
  x: V3;
  /** palm normal (out of the palm) */
  n: V3;
}
/** The hand's own frame from its joints (both hands: n points out of the palm). */
export function handFrame(j: V3[], side: "left" | "right"): HandFrame {
  const L = len(sub(j[9], j[0])) || 1;
  const K = mul(add(add(j[5], j[9]), add(j[13], j[17])), 0.25);
  const y = norm(sub(K, j[0]));
  const x = norm(perp(sub(j[5], j[17]), y), norm(perp([1, 0, 0], y), [0, 0, 1]));
  const n = mul(cross(x, y), side === "left" ? -1 : 1);
  return { L, y, x, n };
}

/** Writes one vertex: position, normal, colour. */
class Writer {
  i = 0;
  pos: Float32Array;
  nrm: Float32Array;
  col: Float32Array | null;
  constructor(pos: Float32Array, nrm: Float32Array, col: Float32Array | null) { this.pos = pos; this.nrm = nrm; this.col = col; }
  put(p: V3, n: V3, c?: RGB) {
    const o = this.i * 3;
    this.pos[o] = p[0]; this.pos[o + 1] = p[1]; this.pos[o + 2] = p[2];
    this.nrm[o] = n[0]; this.nrm[o + 1] = n[1]; this.nrm[o + 2] = n[2];
    if (this.col && c) { this.col[o] = c[0]; this.col[o + 1] = c[1]; this.col[o + 2] = c[2]; }
    this.i++;
  }
}
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * Tapered capsule from a (radius r0) to b (radius r1): the hull of the two spheres, so the cone is
 * tangent to both and the normals are continuous. `ref` fixes where the ring starts (stable over
 * frames); `pad` is the direction of the pad side, for the palm tint (null: no tint).
 */
function capsule(w: Writer, a: V3, b: V3, r0: number, r1: number, ref: V3, pad: V3 | null, look: { back: RGB; palm: RGB }) {
  const d = sub(b, a);
  const L = len(d);
  const e = L > 1e-9 ? mul(d, 1 / L) : [0, 1, 0] as V3;
  const u = norm(perp(ref, e), norm(perp([0, 0, 1], e), [1, 0, 0]));
  // rings run a → b and turn from u towards u × e: the same sense as the palm, so one index
  // pattern gives outward-facing triangles everywhere
  const v = cross(u, e);
  const s = Math.max(-0.95, Math.min(0.95, L > 1e-9 ? (r0 - r1) / L : 0));
  const phi = Math.asin(s);
  const turn = Math.PI / 2 - phi; // polar angle of the tangent circles
  for (let ring = 0; ring < 2 * CAP_RINGS; ring++) {
    const top = ring >= CAP_RINGS;
    const kk = top ? ring - CAP_RINGS : ring;
    const theta = top ? turn - (kk * turn) / (CAP_RINGS - 1) : Math.PI - (kk * (Math.PI - turn)) / (CAP_RINGS - 1);
    const c = top ? b : a, r = top ? r1 : r0;
    const ct = Math.cos(theta), st = Math.sin(theta);
    for (let k = 0; k < RADIAL; k++) {
      const n: V3 = [ct * e[0] + st * (COS[k] * u[0] + SIN[k] * v[0]), ct * e[1] + st * (COS[k] * u[1] + SIN[k] * v[1]), ct * e[2] + st * (COS[k] * u[2] + SIN[k] * v[2])];
      const col = pad ? mix(look.back, look.palm, smooth(-0.05, 0.55, dot(n, pad))) : look.back;
      w.put(add(c, mul(n, r)), n, col);
    }
  }
}

/**
 * Fill the skin buffers (positions, normals, colours) for 21 joints. The arrays must hold
 * handVertexCount(look.forearm) vertices; the order matches handIndices().
 */
export function buildHand(j: V3[], look: HandLook, pos: Float32Array, nrm: Float32Array, col: Float32Array) {
  const f = handFrame(j, look.side);
  const { L, x, y, n } = f;
  const w = new Writer(pos, nrm, col);
  const sideSign = look.side === "left" ? -1 : 1;

  // the thumb's pad faces the inside of its bend (it rotates when the thumb opposes the fingers)
  const tb = sub(lerp3(j[2], j[4], 0.5), j[3]);
  const thumbPadBent = len(tb) > 0.04 * L ? norm(tb) : null;

  PHALANGES.forEach(([a, b, r0, r1, finger]) => {
    const e = norm(sub(j[b], j[a]));
    let pad: V3;
    if (finger === "thumb") {
      const fallback = norm(perp(add(mul(n, 0.7), mul(x, -0.7)), e), n);
      pad = thumbPadBent ? norm(perp(thumbPadBent, e), fallback) : fallback;
    } else {
      // fingers flex about the hand's lateral axis: the pad side is lateral × bone
      pad = norm(mul(cross(x, e), sideSign), n);
    }
    const override = look.fingers?.[finger];
    const tint = override ? { back: override, palm: mix(override, [1, 1, 1], 0.25) } : look;
    capsule(w, j[a], j[b], r0 * L, r1 * L, x, pad, tint);
  });

  // thumb web: from the side of the palm near the thumb's base to between the thumb and index knuckles
  capsule(w, lerp3(j[1], j[5], 0.38), lerp3(j[2], j[5], 0.42), 0.105 * L, 0.07 * L, x, n, look);

  // long enough that the frame always cuts it, even when the view is rotated (no stump)
  if (look.forearm) capsule(w, sub(j[0], mul(y, 0.04 * L)), sub(j[0], mul(y, 2.8 * L)), 0.27 * L, 0.37 * L, x, n, look);

  palm(w, j, f, look);
}

/** Palm: superellipse cross-sections swept from the wrist to the knuckle line; normals from the grid. */
function palm(w: Writer, j: V3[], f: HandFrame, look: HandLook) {
  const { L, x, y, n } = f;
  // a left hand is a mirror image: turn the other way round, or its triangles would face inwards
  const turnSign = look.side === "left" ? -1 : 1;
  const start = w.i;
  // edges of the palm at the wrist and at the knuckles (index side = +x)
  const wristP = add(j[0], mul(x, -0.28 * L)), wristI = add(j[0], mul(x, 0.3 * L));
  const knuckP = add(j[17], mul(x, -0.075 * L)), knuckI = add(j[5], mul(x, 0.085 * L));
  const P = 3; // superellipse exponent: between an ellipse (2) and a box
  const rings: { c: V3; lat: V3; h: number; t: number }[] = [];
  for (const [v, scale] of PALM_V) {
    const vc = Math.max(0, Math.min(1, v));
    const ep = lerp3(wristP, knuckP, vc), ei = lerp3(wristI, knuckI, vc);
    let c = lerp3(ep, ei, 0.5);
    if (v < 0) c = add(c, mul(y, v * L));
    if (v > 1) c = add(c, mul(y, (v - 1) * L));
    const lat = norm(sub(ei, ep), x);
    const h = (len(sub(ei, ep)) / 2) * (0.35 + 0.65 * scale);
    const t = (0.165 - 0.065 * vc) * L * scale;
    rings.push({ c: add(c, mul(n, 0.018 * L * scale)), lat, h, t });
  }
  for (const r of rings) {
    for (let k = 0; k < PALM_AROUND; k++) {
      const a = (2 * Math.PI * k) / PALM_AROUND;
      const ca = Math.cos(a), sa = Math.sin(a);
      const X = Math.sign(ca) * Math.abs(ca) ** (2 / P), Y = turnSign * Math.sign(sa) * Math.abs(sa) ** (2 / P);
      w.put(add(add(r.c, mul(r.lat, X * r.h)), mul(n, Y * r.t)), [0, 0, 0], look.back);
    }
  }
  // normals by central differences over the grid; colours from the palm side
  const R = PALM_V.length;
  const at = (ri: number, k: number): V3 => {
    const o = (start + ri * PALM_AROUND + ((k + PALM_AROUND) % PALM_AROUND)) * 3;
    return [w.pos[o], w.pos[o + 1], w.pos[o + 2]];
  };
  for (let ri = 0; ri < R; ri++) {
    for (let k = 0; k < PALM_AROUND; k++) {
      let nv: V3;
      if (ri === 0) nv = mul(y, -1);
      else if (ri === R - 1) nv = y;
      else {
        const dk = sub(at(ri, k + 1), at(ri, k - 1));
        const dr = sub(at(ri + 1, k), at(ri - 1, k));
        nv = norm(cross(dr, dk), y);
        // outward: away from the section's centre
        if (dot(nv, sub(at(ri, k), rings[ri].c)) < 0) nv = mul(nv, -1);
      }
      const o = (start + ri * PALM_AROUND + k) * 3;
      w.nrm[o] = nv[0]; w.nrm[o + 1] = nv[1]; w.nrm[o + 2] = nv[2];
      const c = mix(look.back, look.palm, smooth(-0.05, 0.5, dot(nv, n)));
      if (w.col) { w.col[o] = c[0]; w.col[o + 1] = c[1]; w.col[o + 2] = c[2]; }
    }
  }
}

/** Nails: thin ellipsoids on the back of each fingertip. */
export function buildNails(j: V3[], side: "left" | "right", pos: Float32Array, nrm: Float32Array) {
  const { L, x, n } = handFrame(j, side);
  const sideSign = side === "left" ? -1 : 1;
  const w = new Writer(pos, nrm, null);
  const tb = sub(lerp3(j[2], j[4], 0.5), j[3]);
  TIP_SEGMENTS.forEach((si, fi) => {
    const [a, b, , r1] = PHALANGES[si];
    const e = norm(sub(j[b], j[a]));
    let pad: V3;
    if (fi === 0) {
      const fallback = norm(perp(add(mul(n, 0.7), mul(x, -0.7)), e), n);
      pad = len(tb) > 0.04 * L ? norm(perp(norm(tb), e), fallback) : fallback;
    } else pad = norm(mul(cross(x, e), sideSign), n);
    const back = mul(pad, -1);
    const side3 = cross(e, back);
    const r = r1 * L;
    const centre = add(add(j[b], mul(e, -0.55 * r)), mul(back, 0.8 * r));
    const ax: [V3, number][] = [[side3, 0.72 * r], [e, 0.95 * r], [back, 0.3 * r]];
    for (let ring = 0; ring < NAIL_RINGS; ring++) {
      const th = (Math.PI * ring) / (NAIL_RINGS - 1);
      for (let k = 0; k < NAIL_RADIAL; k++) {
        const ph = (2 * Math.PI * k) / NAIL_RADIAL;
        // unit sphere point → ellipsoid (rings run along +e, like the capsules)
        const sx = Math.sin(th) * Math.cos(ph), sy = -Math.cos(th), sz = Math.sin(th) * Math.sin(ph);
        const p = add(centre, add(add(mul(ax[0][0], sx * ax[0][1]), mul(ax[1][0], sy * ax[1][1])), mul(ax[2][0], sz * ax[2][1])));
        const nn = norm(add(add(mul(ax[0][0], sx / ax[0][1]), mul(ax[1][0], sy / ax[1][1])), mul(ax[2][0], sz / ax[2][1])), back);
        w.put(p, nn);
      }
    }
  });
}
