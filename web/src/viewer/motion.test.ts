import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { V3 } from "./kinematics";
import { avatarExtent, bSpline, chainBones, HAND_PARENT, POSE, prepareMotion, smoothGauss, solveArm, trackedFrames, type AvatarFrame, type Motion } from "./motion";
import { AVATAR } from "./params";

const clip = (id: string) => JSON.parse(readFileSync(new URL(`../../public/motion/${id}.json`, import.meta.url), "utf8")) as Motion;
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const finite = (fr: AvatarFrame) => [...fr.body, ...fr.left, ...fr.right].every((p) => p.every(Number.isFinite)) && fr.face.every(Number.isFinite);
function spread(values: number[]) {
  const m = [...values].sort((a, b) => a - b)[values.length >> 1];
  return Math.max(...values.map((x) => Math.abs(x - m) / m));
}

/** a small synthetic clip: a still body, a right hand that appears at frame `from` */
function synthetic(n: number, from: number, opts: { palm?: (f: number) => number } = {}): Motion {
  const body: number[] = [];
  const P: Record<number, V3> = {
    [POSE.NOSE]: [0, -0.62, -0.12], [POSE.L_EYE]: [0.04, -0.65, -0.1], [POSE.R_EYE]: [-0.04, -0.65, -0.1],
    [POSE.L_EAR]: [0.075, -0.63, 0], [POSE.R_EAR]: [-0.075, -0.63, 0], [POSE.MOUTH_L]: [0.03, -0.58, -0.1], [POSE.MOUTH_R]: [-0.03, -0.58, -0.1],
    [POSE.L_SH]: [0.18, -0.45, 0], [POSE.R_SH]: [-0.18, -0.45, 0], [POSE.L_EL]: [0.24, -0.2, 0], [POSE.R_EL]: [-0.24, -0.2, -0.05],
    [POSE.L_WR]: [0.24, 0.02, -0.05], [POSE.R_WR]: [-0.2, -0.35, -0.25], [POSE.L_HIP]: [0.1, 0, 0], [POSE.R_HIP]: [-0.1, 0, 0],
  };
  for (let i = 0; i < 15; i++) body.push(...P[i]);
  // a flat right hand around the right wrist (MediaPipe axes: y down, z away from the camera)
  const hand = (f: number) => {
    const s = (opts.palm?.(f) ?? 0.09) / 0.09;
    const w = P[POSE.R_WR];
    const pts: V3[] = [[0, 0, 0], [0.025, -0.02, 0], [0.04, -0.045, 0], [0.05, -0.065, 0], [0.06, -0.085, 0]];
    for (const x of [0.02, 0, -0.018, -0.034]) for (let k = 1; k <= 4; k++) pts.push([x, -0.09 * (k === 1 ? 1 : 1) - (k - 1) * 0.028, 0]);
    return pts.flatMap((p) => [w[0] + p[0] * s, w[1] + p[1] * s, w[2] + p[2] * s]);
  };
  return {
    id: "synthetic", fps: 15, frames: n, poseJoints: [0, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 23, 24],
    pose: Array.from({ length: n }, () => [...body]),
    leftHand: Array.from({ length: n }, () => null),
    rightHand: Array.from({ length: n }, (_, f) => (f >= from ? hand(f) : null)),
    face: { keys: ["browInnerUp", "browDownLeft", "browDownRight", "browOuterUpLeft", "browOuterUpRight", "jawOpen", "mouthSmileLeft", "mouthSmileRight"], values: Array.from({ length: n }, () => [0, 0, 0, 0, 0, 0.2, 0.1, 0.1]) },
  };
}

describe("prepareMotion on a real clip", () => {
  const m = clip("w-hello");
  const p = prepareMotion(m);

  it("resamples to the display rate over the clip's duration", () => {
    expect(p.fps).toBe(AVATAR.fps);
    expect(p.frames.length).toBe(Math.floor(((m.pose.length - 1) / m.fps) * AVATAR.fps + 1e-6) + 1);
    expect(p.frames.every(finite)).toBe(true);
  });

  it("keeps every hand bone and both arms at one length", () => {
    for (const side of ["left", "right"] as const) {
      for (let i = 1; i < 21; i++) expect(spread(p.frames.map((fr) => dist(fr[side][i], fr[side][HAND_PARENT[i]])))).toBeLessThan(0.02);
    }
    for (const [a, b] of [[POSE.L_SH, POSE.L_EL], [POSE.L_EL, POSE.L_WR], [POSE.R_SH, POSE.R_EL], [POSE.R_EL, POSE.R_WR]]) {
      expect(spread(p.frames.map((fr) => dist(fr.body[a], fr.body[b])))).toBeLessThan(0.005);
    }
  });

  it("hangs each hand from its arm's wrist", () => {
    for (const fr of p.frames) {
      expect(dist(fr.right[0], fr.body[POSE.R_WR])).toBeLessThan(1e-9);
      expect(dist(fr.left[0], fr.body[POSE.L_WR])).toBeLessThan(1e-9);
    }
  });

  it("frames the signing space without the resting hand", () => {
    // HELLO is one-handed: the left hand rests at the hip, below every framing point of the head
    const pts = avatarExtent(p.frames);
    const lowest = Math.min(...pts.map((q) => q[1]));
    const restLeft = Math.min(...p.frames.map((fr) => fr.left[12][1]));
    expect(lowest).toBeGreaterThan(restLeft);
  });
});

describe("prepareMotion on synthetic clips", () => {
  it("crossfades a hand that appears instead of popping it in", () => {
    // the hand appears at frame 14: frame 0 is further away than the fade (0.6 s = 9 frames)
    const p = prepareMotion(synthetic(30, 14));
    const w = p.tracked.right;
    expect(w[0]).toBeCloseTo(0, 9);
    expect(w[w.length - 1]).toBeCloseTo(1, 9);
    // the weight eases in: no step larger than a fraction of the fade per display frame
    for (let k = 1; k < w.length; k++) expect(Math.abs(w[k] - w[k - 1])).toBeLessThan(0.12);
    // and the fingertips move continuously while it does
    const tips = p.frames.map((fr) => fr.right[8]);
    for (let k = 1; k < tips.length; k++) expect(dist(tips[k], tips[k - 1])).toBeLessThan(0.02);
  });

  it("shows a relaxed hand, never a frozen one, when a hand is never tracked", () => {
    const p = prepareMotion(synthetic(12, 99));
    expect(p.tracked.right.every((x) => x === 0)).toBe(true);
    expect(p.frames.every(finite)).toBe(true);
    // relaxed: the fingers continue the forearm (elbow → wrist)
    const fr = p.frames[0], b = fr.body;
    const fore = [0, 1, 2].map((c) => b[POSE.R_WR][c] - b[POSE.R_EL][c]);
    const tip = [0, 1, 2].map((c) => fr.right[12][c] - fr.right[0][c]);
    expect(fore[0] * tip[0] + fore[1] * tip[1] + fore[2] * tip[2]).toBeGreaterThan(0);
  });

  it("ignores a detection whose palm is far too small (motion blur)", () => {
    const m = synthetic(16, 2, { palm: (f) => (f === 9 ? 0.03 : 0.09) });
    const ok = trackedFrames(m.rightHand.map((h) => (h ? Array.from({ length: 21 }, (_, i) => [h[i * 3], -h[i * 3 + 1], -h[i * 3 + 2]] as V3) : null)));
    // the bad frame is inside a run, so it is bridged, not dropped from the run
    expect(ok.slice(2).every(Boolean)).toBe(true);
    const p = prepareMotion(m);
    const palm = p.frames.map((fr) => dist(fr.right[9], fr.right[0]));
    expect(spread(palm)).toBeLessThan(0.01);
  });
});

describe("helpers", () => {
  it("trackedFrames drops runs shorter than the minimum", () => {
    const h: V3[] = Array.from({ length: 21 }, (_, i) => [0, i === 9 ? 0.09 : i * 0.005, 0]);
    const seq = [null, h, null, null, null, null, h, h, h, h, null];
    expect(trackedFrames(seq)).toEqual([false, false, false, false, false, false, true, true, true, true, false]);
  });

  it("smoothGauss keeps constants and stays inside a run", () => {
    const seq = [[1, 2, 3], [1, 2, 3], [1, 2, 3], [9, 9, 9], [9, 9, 9]];
    const out = smoothGauss(seq, () => 1, [0, 0, 0, 1, 1]);
    const close = (a: number[], b: number[]) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i], 9));
    close(out[0], [1, 2, 3]);
    close(out[2], [1, 2, 3]);
    close(out[3], [9, 9, 9]);
  });

  it("bSpline passes through a constant sequence and keeps a straight line straight", () => {
    const flat = [[2, 2, 2], [2, 2, 2], [2, 2, 2]];
    expect(bSpline(flat, 0.5)).toEqual([2, 2, 2]);
    const line = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]];
    expect(bSpline(line, 1.5)[0]).toBeCloseTo(1.5, 9);
  });

  it("solveArm keeps both lengths and pulls in an unreachable wrist", () => {
    const s: V3 = [0, 0, 0];
    const near = solveArm(s, [0.3, -0.2, 0.1], 0.25, 0.24, [0, -1, 0]);
    expect(dist(s, near.elbow)).toBeCloseTo(0.25, 9);
    expect(dist(near.elbow, near.wrist)).toBeCloseTo(0.24, 9);
    const far = solveArm(s, [2, 0, 0], 0.25, 0.24, [0, -1, 0]);
    expect(dist(s, far.wrist)).toBeLessThan(0.49);
    expect(dist(s, far.elbow)).toBeCloseTo(0.25, 9);
  });

  it("chainBones gives every bone its length", () => {
    const dirs: V3[] = Array.from({ length: 21 }, (_, i) => (i ? [0, 1, 0] : [0, 0, 0]));
    const lengths = HAND_PARENT.map((p, i) => (p < 0 ? 0 : 0.01 * i));
    const j = chainBones(dirs, lengths);
    for (let i = 1; i < 21; i++) expect(dist(j[i], j[HAND_PARENT[i]])).toBeCloseTo(lengths[i], 9);
  });
});
