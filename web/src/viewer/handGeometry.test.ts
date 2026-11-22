import { describe, expect, it } from "vitest";
import { buildHand, buildNails, handFrame, handIndices, handVertexCount, NAIL_VERTS, nailIndices, PHALANGES, type HandLook, type RGB } from "./handGeometry";
import { HANDSHAPES } from "./handshapeLibrary";
import { handJointsLocal, type V3 } from "./kinematics";

const BACK: RGB = [0.8, 0.5, 0.35], PALM: RGB = [0.95, 0.75, 0.65];
const right = handJointsLocal(HANDSHAPES.B);
const left = right.map(([x, y, z]): V3 => [-x, y, z]);

function build(j: V3[], look: Partial<HandLook> = {}) {
  const l: HandLook = { side: "right", forearm: true, back: BACK, palm: PALM, ...look };
  const n = handVertexCount(l.forearm);
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3);
  buildHand(j, l, pos, nrm, col);
  return { pos, nrm, col, idx: handIndices(l.forearm), n };
}
/** signed volume of a closed triangle mesh: positive when the triangles face outwards */
function volume(pos: Float32Array, idx: Uint32Array, from: number, to: number) {
  let v = 0;
  for (let t = from; t < to; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]].map((i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
    v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return v;
}

describe("hand surface", () => {
  it("fills every vertex with finite values and indexes inside the buffers", () => {
    for (const forearm of [true, false]) {
      const { pos, nrm, idx, n } = build(right, { forearm });
      expect(pos.every(Number.isFinite)).toBe(true);
      expect(nrm.every(Number.isFinite)).toBe(true);
      expect(Math.max(...idx)).toBeLessThan(n);
    }
  });

  it("faces outwards on both hands (each part is a closed surface)", () => {
    // per part: 15 phalanges + web + forearm capsules, then the palm
    const capsTris = (2 * 4 - 1) * 12 * 6;
    for (const [j, side] of [[right, "right"], [left, "left"]] as const) {
      const { pos, idx } = build(j, { side });
      const parts = PHALANGES.length + 2;
      for (let p = 0; p < parts; p++) expect(volume(pos, idx, p * capsTris, (p + 1) * capsTris)).toBeGreaterThan(0);
      expect(volume(pos, idx, parts * capsTris, idx.length)).toBeGreaterThan(0);
    }
  });

  it("tints the palm side lighter than the back", () => {
    const { nrm, col, n } = build(right);
    const { n: palmN } = handFrame(right, "right");
    let palmSide = 0, backSide = 0;
    for (let i = 0; i < n; i++) {
      const d = nrm[i * 3] * palmN[0] + nrm[i * 3 + 1] * palmN[1] + nrm[i * 3 + 2] * palmN[2];
      const isPalm = Math.abs(col[i * 3] - PALM[0]) < 1e-3, isBack = Math.abs(col[i * 3] - BACK[0]) < 1e-3;
      if (d > 0.7 && isPalm) palmSide++;
      if (d < -0.3 && isBack) backSide++;
    }
    expect(palmSide).toBeGreaterThan(100);
    expect(backSide).toBeGreaterThan(100);
  });

  it("colours a highlighted finger", () => {
    const red: RGB = [1, 0, 0];
    const { col } = build(right, { fingers: { index: red } });
    const capsVerts = 2 * 4 * 12;
    // index phalanges are parts 3, 4, 5
    for (let v = 3 * capsVerts; v < 6 * capsVerts; v++) expect(col[v * 3 + 1]).toBeLessThan(0.3);
  });

  it("puts nails on the back of the fingertips", () => {
    const pos = new Float32Array(NAIL_VERTS * 3), nrm = new Float32Array(NAIL_VERTS * 3);
    buildNails(right, "right", pos, nrm);
    expect(Math.max(...nailIndices())).toBeLessThan(NAIL_VERTS);
    // B hand, palm towards +z: the nails sit behind the fingertips (z below the tips)
    const perNail = NAIL_VERTS / 5;
    [8, 12, 16, 20].forEach((tip, k) => {
      let z = 0;
      for (let v = (k + 1) * perNail; v < (k + 2) * perNail; v++) z += pos[v * 3 + 2];
      expect(z / perNail).toBeLessThan(right[tip][2]);
    });
  });
});
