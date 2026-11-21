/**
 * Fits the procedural hand's joint angles to the REAL signer's hand for each letter
 * (node scripts/fit-letters.ts → src/viewer/handshapes.fitted.json).
 *
 * Objective, in a canonical hand frame (wrist origin, palm length 1):
 *   Σ joint distance to the reference landmarks  +  penalty if the pose fails the ASL rules for
 *   that letter  +  a small pull towards the hand-authored pose (keeps it anatomically tidy).
 * Only letters whose real reference itself passes the rules are fitted (others keep the
 * authored pose — side-view hands are often mis-tracked by MediaPipe).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { HANDSHAPES_AUTHORED } from "../src/viewer/handshapeLibrary.ts";
import { dir, handJointsLocal, orientationMatrix, toMediaPipe, transform, vec, type HandPose, type V3 } from "../src/viewer/kinematics.ts";
import { computeFeatures, evaluateLetter } from "../src/lib/handshapes.ts";

const root = new URL("../", import.meta.url);
const ref = JSON.parse(readFileSync(new URL("content/reference/letter-poses.json", root), "utf8"));

const PARAMS: [keyof HandPose, string, number, number][] = [
  ["thumb", "yaw", -60, 95], ["thumb", "pitch", -10, 85], ["thumb", "roll", -100, 0], ["thumb", "mcp", -10, 75], ["thumb", "ip", -15, 85],
  ...(["index", "middle", "ring", "pinky"] as const).flatMap((f) => [
    [f, "mcp", -10, 95], [f, "pip", 0, 115], [f, "dip", 0, 85], [f, "spread", -25, 25],
  ] as [keyof HandPose, string, number, number][]),
];
const get = (p: HandPose, [g, k]: (typeof PARAMS)[number]) => (p[g] as unknown as Record<string, number>)[k];
const set = (p: HandPose, [g, k]: (typeof PARAMS)[number], v: number) => ((p[g] as unknown as Record<string, number>)[k] = v);
const clone = (p: HandPose): HandPose => JSON.parse(JSON.stringify(p));

function canonical(j: V3[]): V3[] {
  const o = j[0];
  const y = vec.norm(vec.sub(j[9], o));
  const tmp = vec.sub(j[5], j[17]);
  const x = vec.norm(vec.sub(tmp, vec.scale(y, vec.dot(tmp, y))));
  const z = vec.cross(x, y);
  const L = vec.len(vec.sub(j[9], o));
  return j.map((p) => { const d = vec.sub(p, o); return [vec.dot(d, x) / L, vec.dot(d, y) / L, vec.dot(d, z) / L] as V3; });
}

const out: Record<string, HandPose> = {};
const report: string[] = [];
for (const L of "ABCDEFGHIKLMNORSTUVWXY") { // J, P, Q, Z reuse I, K, G, index-up
  const spec = JSON.parse(readFileSync(new URL(`content/signs/L-${L}.json`, root), "utf8")).phonology;
  const P = (a: number[]) => Array.from({ length: 21 }, (_, i) => ({ x: a[i * 3], y: a[i * 3 + 1], z: a[i * 3 + 2] }));
  let target: V3[] | null = null;
  if (ref[L]) {
    const w = ref[L].world as number[], im = ref[L].image as number[];
    if (evaluateLetter(L, computeFeatures(P(im), P(w), 4 / 3)).ok) {
      target = canonical(Array.from({ length: 21 }, (_, i) => [w[i * 3], -w[i * 3 + 1], -w[i * 3 + 2]] as V3));
    } else report.push(`${L}: referencia real no fiable (no pasa las reglas) → solo reglas + pose de autor`);
  }
  const authored = HANDSHAPES_AUTHORED[spec.handshape];
  if (!authored) { report.push(`${L}: comparte configuración (${spec.handshape}) con otra letra → se ajusta allí`); continue; }
  const M = orientationMatrix(dir(spec.orientation.fingers), dir(spec.orientation.palm));
  const WEIGHT = [0, 1, 1.5, 2, 3, 1, 1, 1.5, 2, 1, 1, 1.5, 2, 1, 1, 1.5, 2, 1, 1, 1.5, 2]; // tips matter most

  const cost = (p: HandPose) => {
    const loc = handJointsLocal(p);
    const c = canonical(loc);
    let e = 0;
    if (target) for (let i = 1; i < 21; i++) e += WEIGHT[i] * vec.len(vec.sub(c[i], target[i])) ** 2;
    const mp = toMediaPipe(transform(loc, M));
    const ev = evaluateLetter(L, computeFeatures(mp.image, mp.world, 1));
    let reg = 0;
    for (const prm of PARAMS) reg += ((get(p, prm) - get(authored, prm)) / 90) ** 2;
    return e + (ev.ok ? 0 : 3 + 6 * (1 - ev.score)) + 0.05 * reg;
  };

  let best = clone(authored), bestC = cost(best);
  for (const step of [16, 8, 4, 2, 1]) {
    for (let iter = 0, improved = true; improved && iter < 40; iter++) {
      improved = false;
      for (const prm of PARAMS) {
        for (const d of [step, -step]) {
          const cand = clone(best);
          set(cand, prm, Math.max(prm[2], Math.min(prm[3], get(cand, prm) + d)));
          const c = cost(cand);
          if (c < bestC - 1e-6) { best = cand; bestC = c; improved = true; }
        }
      }
    }
  }
  const before = cost(authored);
  for (const prm of PARAMS) set(best, prm, Math.round(get(best, prm)));
  const mp = toMediaPipe(transform(handJointsLocal(best), M));
  const ok = evaluateLetter(L, computeFeatures(mp.image, mp.world, 1)).ok;
  out[spec.handshape] = best;
  report.push(`${L}: ${target ? "ajustada a la mano real" : "solo reglas (sin referencia fiable)"} · coste ${before.toFixed(2)} → ${bestC.toFixed(2)} · reglas ${ok ? "OK" : "FALLA"}`);
}
writeFileSync(new URL("src/viewer/handshapes.fitted.json", root), JSON.stringify(out, null, 1) + "\n");
console.log(report.join("\n"));
