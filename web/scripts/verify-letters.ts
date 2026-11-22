/**
 * Automated check of the 3D fingerspelling poses (run: node scripts/verify-letters.ts).
 *   1. rules: the authored pose must pass the camera checker for its own letter (src/lib/handshapes.ts,
 *      written from ASL handshape descriptions) — the same check the learner's hand must pass.
 *   2. reference: joint flexion and thumb-tip position compared with the REAL signer's hand
 *      (MediaPipe landmarks from WLASL clips, content/reference/letter-poses.json).
 *   3. anatomy (Part H): no finger joint bent backwards, no finger through the palm
 *      (src/viewer/handChecks.ts), for every letter, J and Z along their whole movement.
 * Prints a table; exit code 1 if any letter fails its rules or its anatomy.
 */
import { readFileSync } from "node:fs";
import { HANDSHAPES } from "../src/viewer/handshapeLibrary.ts";
import { dir, handJointsLocal, orientationMatrix, toMediaPipe, transform, vec, type V3 } from "../src/viewer/kinematics.ts";
import { computeFeatures, evaluateLetter } from "../src/lib/handshapes.ts";
import { poseIssues } from "../src/viewer/handChecks.ts";

const ref = JSON.parse(readFileSync(new URL("../content/reference/letter-poses.json", import.meta.url), "utf8"));
const signsDir = new URL("../content/signs/", import.meta.url);

const CHAINS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
const NAMES = ["pulgar", "índice", "corazón", "anular", "meñique"];

/** joint bend angles (deg) at each of the 3 joints of every finger, from 0 → tip */
function bends(j: V3[]): number[][] {
  return CHAINS.map((c) => {
    const pts = [c[0] === 1 ? 0 : 0, ...c].map((i) => j[i]);
    const out: number[] = [];
    for (let k = 1; k + 1 < pts.length; k++) {
      const a = vec.norm(vec.sub(pts[k], pts[k - 1]));
      const b = vec.norm(vec.sub(pts[k + 1], pts[k]));
      out.push((Math.acos(Math.max(-1, Math.min(1, vec.dot(a, b)))) * 180) / Math.PI);
    }
    return out.slice(-3);
  });
}

/** express points in a canonical hand frame (wrist origin, palm length 1, y→middle knuckle, z→palm) */
function canonical(j: V3[]): V3[] {
  const o = j[0];
  const y = vec.norm(vec.sub(j[9], o));
  const tmp = vec.sub(j[5], j[17]);
  const x = vec.norm(vec.sub(tmp, vec.scale(y, vec.dot(tmp, y))));
  const z = vec.cross(x, y);
  const L = vec.len(vec.sub(j[9], o));
  return j.map((p) => {
    const d = vec.sub(p, o);
    return [vec.dot(d, x) / L, vec.dot(d, y) / L, vec.dot(d, z) / L] as V3;
  });
}

let failures = 0;
const rows: string[] = [];
for (const L of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
  const spec = JSON.parse(readFileSync(new URL(`L-${L}.json`, signsDir), "utf8"));
  const ph = spec.phonology;
  const hs = HANDSHAPES[ph.handshape];
  const local = handJointsLocal(hs);
  const m = orientationMatrix(dir(ph.orientation.fingers), dir(ph.orientation.palm));
  const joints = transform(local, m);
  const mp = toMediaPipe(joints);
  const ev = evaluateLetter(L, computeFeatures(mp.image, mp.world, 1));
  const motion = L === "J" || L === "Z";
  if (!ev.ok && !motion) failures++;

  let cmp = "sin referencia real";
  const r = ref[L];
  if (r) {
    const w = r.world as number[];
    const rj: V3[] = Array.from({ length: 21 }, (_, i) => [w[i * 3], w[i * 3 + 1], w[i * 3 + 2]]);
    const br = bends(rj), bm = bends(local);
    const diffs = br.map((b, fi) => b.reduce((s, v, k) => s + Math.abs(v - bm[fi][k]), 0) / 3);
    const ct = canonical(rj)[4], cm = canonical(local)[4];
    const thumbErr = vec.len(vec.sub(ct, cm));
    const worst = diffs.map((d, i) => [d, i] as const).sort((a, b) => b[0] - a[0])[0];
    cmp = `flexión media Δ=${(diffs.reduce((a, b) => a + b) / 5).toFixed(0)}° (peor ${NAMES[worst[1]]} ${worst[0].toFixed(0)}°) · punta pulgar Δ=${thumbErr.toFixed(2)}`;
  }
  // the hand pose is the same through J's and Z's movement (only the orientation changes)
  const anatomy = poseIssues(local);
  if (anatomy.length) failures++;
  const anat = anatomy.length ? ` · anatomía FALLA → ${anatomy.map((a) => `${a.finger}: ${a.issue}`).join("; ")}` : " · anatomía OK";
  rows.push(`${L}  reglas:${motion ? " (movimiento)" : ev.ok ? " OK " : " FALLA"}${ev.ok || motion ? "" : " → " + ev.hints.join("; ")}${anat}\n   ${cmp}`);
}
console.log(rows.join("\n"));
console.log(failures ? `\n${failures} letras no pasan las reglas o la anatomía` : "\nTodas las letras estáticas pasan las reglas, y ninguna letra se dobla hacia atrás ni atraviesa la palma");
process.exit(failures ? 1 : 0);
