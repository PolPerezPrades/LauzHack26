import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeFeatures, evaluateLetter } from "../lib/handshapes";
import { fingerFlexion, poseIssues } from "./handChecks";
import { HANDSHAPES, movementPath } from "./handshapeLibrary";
import { clampPose, dir, handJointsLocal, JOINT_LIMITS, orientationMatrix, toMediaPipe, transform, type V3 } from "./kinematics";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const phon = (L: string) => JSON.parse(readFileSync(new URL(`../../content/signs/L-${L}.json`, import.meta.url), "utf8")).phonology;

describe("letters (the same checks as scripts/verify-letters.ts)", () => {
  it("every static letter passes its camera rules", () => {
    for (const L of LETTERS) {
      if (L === "J" || L === "Z") continue;
      const ph = phon(L);
      const mp = toMediaPipe(transform(handJointsLocal(HANDSHAPES[ph.handshape]), orientationMatrix(dir(ph.orientation.fingers), dir(ph.orientation.palm))));
      expect(evaluateLetter(L, computeFeatures(mp.image, mp.world, 1)).ok, L).toBe(true);
    }
  });

  it("no letter bends a finger backwards or through the palm", () => {
    for (const L of LETTERS) expect(poseIssues(handJointsLocal(HANDSHAPES[phon(L).handshape])), L).toEqual([]);
  });
});

describe("joint limits", () => {
  it("clamps every angle into its range", () => {
    const wild = clampPose({
      thumb: { yaw: 200, pitch: -90, roll: 40, mcp: 120, ip: -60 },
      index: { mcp: -60, pip: -30, dip: 140, spread: 50 }, middle: { mcp: 0, pip: 0, dip: 0, spread: 0 },
      ring: { mcp: 0, pip: 0, dip: 0, spread: 0 }, pinky: { mcp: 0, pip: 0, dip: 0, spread: 0 },
    });
    expect(wild.thumb.yaw).toBe(JOINT_LIMITS.thumb.yaw[1]);
    expect(wild.thumb.pitch).toBe(JOINT_LIMITS.thumb.pitch[0]);
    expect(wild.index.mcp).toBe(JOINT_LIMITS.finger.mcp[0]);
    expect(wild.index.pip).toBe(0);
    expect(wild.index.dip).toBe(JOINT_LIMITS.finger.dip[1]);
  });

  it("measures flexion with the sign of the bend", () => {
    const flex = fingerFlexion(handJointsLocal({ ...HANDSHAPES.B, index: { mcp: 30, pip: 60, dip: 20, spread: 0 } }));
    // MCP is measured from the metacarpal, which tilts ~3° out of the palm plane in the skeleton
    expect(Math.abs(flex.index[0] - 30)).toBeLessThan(5);
    expect(flex.index[1]).toBeCloseTo(60, 0);
    expect(flex.index[2]).toBeCloseTo(20, 0);
  });

  it("flags a finger bent backwards and a finger through the palm", () => {
    const j = handJointsLocal(HANDSHAPES.B);
    // bend the index backwards at the PIP: rotate its last two segments away from the palm (−z)
    const bad: V3[] = j.map((p) => [...p] as V3);
    bad[7] = [bad[6][0], bad[6][1] + 0.17, bad[6][2] - 0.17];
    bad[8] = [bad[7][0], bad[7][1] + 0.1, bad[7][2] - 0.2];
    expect(poseIssues(bad).some((i) => i.finger === "index" && i.issue.includes("backwards"))).toBe(true);
    // fold the middle finger behind the palm
    const through: V3[] = j.map((p) => [...p] as V3);
    through[11] = [0, 0.6, -0.3];
    through[12] = [0, 0.4, -0.3];
    expect(poseIssues(through).some((i) => i.finger === "middle" && i.issue.includes("palm"))).toBe(true);
  });
});

describe("J and Z movement", () => {
  const near = (a: V3, b: V3, tol: number) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < tol;

  it("J is one continuous stroke: it never stops between the start and the end", () => {
    const p = movementPath("trace-J")!;
    const pts = Array.from({ length: 101 }, (_, k) => p.at(k / 100).offset);
    expect(near(pts[0], [0, 0.35, 0], 1e-6)).toBe(true);
    expect(near(pts[100], [0.45, -0.2, 0], 1e-6)).toBe(true);
    // the old keyframe easing stopped at 0.45 and 0.75; now every interior step moves
    for (let k = 5; k < 96; k++) expect(Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1])).toBeGreaterThan(1e-3);
  });

  it("Z keeps its three strokes and passes close to each corner", () => {
    const p = movementPath("trace-Z")!;
    const pts = Array.from({ length: 400 }, (_, k) => p.at(k / 399).offset);
    for (const c of [[-0.45, 0.45, 0], [0.55, -0.45, 0]] as V3[]) expect(pts.some((q) => near(q, c, 0.08))).toBe(true);
    expect(p.corners).toBe(2);
  });
});
