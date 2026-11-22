/**
 * Plausibility checks of a hand pose from its 21 joints (scripts/verify-letters.ts and the tests):
 * signed flexion at every finger joint (positive = towards the palm) and whether a finger goes
 * through the palm. Pure math, no imports besides the vector helpers.
 */
import { vec, type V3 } from "./kinematics.ts";

const CHAINS: Record<"index" | "middle" | "ring" | "pinky", [number, number, number, number]> = {
  index: [5, 6, 7, 8], middle: [9, 10, 11, 12], ring: [13, 14, 15, 16], pinky: [17, 18, 19, 20],
};

/** Hand frame of a RIGHT hand: x towards the index side, y wrist → middle knuckle, z out of the palm. */
function frame(j: V3[]) {
  const y = vec.norm(vec.sub(j[9], j[0]));
  const xr = vec.sub(j[5], j[17]);
  const x = vec.norm(vec.sub(xr, vec.scale(y, vec.dot(xr, y))));
  return { x, y, z: vec.cross(x, y), L: vec.len(vec.sub(j[9], j[0])) };
}

/** Signed angle (degrees) from a to b about `axis`. */
function signed(a: V3, b: V3, axis: V3) {
  return (Math.atan2(vec.dot(vec.cross(a, b), axis), vec.dot(a, b)) * 180) / Math.PI;
}

/** Flexion of MCP, PIP and DIP of each finger, degrees (negative = bent backwards). */
export function fingerFlexion(j: V3[]): Record<keyof typeof CHAINS, [number, number, number]> {
  const { x } = frame(j);
  const out = {} as Record<keyof typeof CHAINS, [number, number, number]>;
  for (const [name, [m, p, d, t]] of Object.entries(CHAINS) as [keyof typeof CHAINS, number[]][]) {
    const meta = vec.sub(j[m], j[0]), s1 = vec.sub(j[p], j[m]), s2 = vec.sub(j[d], j[p]), s3 = vec.sub(j[t], j[d]);
    out[name] = [signed(meta, s1, x), signed(s1, s2, x), signed(s2, s3, x)];
  }
  return out;
}

export interface PoseIssue { finger: string; issue: string }

/**
 * Problems a viewer would see: a joint bent backwards beyond the natural range, or a fingertip
 * on the back side of the palm (through it). Tolerances in degrees and palm lengths.
 */
export function poseIssues(j: V3[]): PoseIssue[] {
  const issues: PoseIssue[] = [];
  const flex = fingerFlexion(j);
  for (const [finger, [mcp, pip, dip]] of Object.entries(flex)) {
    if (mcp < -15) issues.push({ finger, issue: `MCP bent backwards ${mcp.toFixed(0)}°` });
    if (pip < -5) issues.push({ finger, issue: `PIP bent backwards ${pip.toFixed(0)}°` });
    if (dip < -10) issues.push({ finger, issue: `DIP bent backwards ${dip.toFixed(0)}°` });
  }
  const { x, y, z, L } = frame(j);
  for (const [finger, chain] of Object.entries(CHAINS)) {
    for (const i of chain.slice(2)) {
      const d = vec.sub(j[i], j[0]);
      const u = vec.dot(d, x) / L, v = vec.dot(d, y) / L, w = vec.dot(d, z) / L;
      // inside the palm's footprint and behind it: the finger went through the palm
      if (v > 0.1 && v < 0.95 && Math.abs(u) < 0.35 && w < -0.12) issues.push({ finger, issue: `joint ${i} through the palm` });
    }
  }
  return issues;
}
