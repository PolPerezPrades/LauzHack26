/**
 * Smoothness and skeleton metrics of the avatar motion (Part H acceptance; run from web/):
 *   node scripts/motion-metrics.ts            the avatar review set (SPEC Part H)
 *   node scripts/motion-metrics.ts --all      every motion file
 *
 * Compares what the viewer plays, sampled at the display rate (60 Hz):
 *   before: the pre-Part-H viewer (AvatarScene.tsx at 8211eae) on the pre-Part-H motion files
 *           (read from git at 8211eae; the current files if git can't): gaps held, a resting hand
 *           when a hand was never tracked, linear interpolation of the ~15 fps frames;
 *   after:  src/viewer/motion.ts (smoothing, crossfades, B-spline, constant bones, arm IK) on the
 *           current files (re-extracted, hands anchored to the image).
 * Both at life size (hand scale 1), so the numbers compare the motion, not the drawing size.
 * Options: --all (every motion file), --before-ref <git ref> (default 8211eae).
 *
 * Metrics, per clip, over the wrists and fingertips of the hands tracked somewhere in the clip:
 *   rms    quadratic mean of the frame-to-frame acceleration |p[k+1] − 2p[k] + p[k−1]| × 60² (m/s²);
 *   mean   arithmetic mean of the same;
 *   jerk   arithmetic mean of the frame-to-frame jerk (third difference × 60³, m/s³);
 *   bones  max over bones of max |L − median| / median, for the arms and the hand bones.
 * The acceptance uses the quadratic mean (docs/parts/H.md, D-H03): the arithmetic mean cannot see
 * stepped playback. With linear interpolation the acceleration is a spike at every source frame,
 * and the mean of those spikes equals the mean of a smooth curve through the same samples.
 * Exit code 1 if the RMS acceleration does not drop by at least 50 % or a bone varies by 2 % or more.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { HANDSHAPES } from "../src/viewer/handshapeLibrary.ts";
import { handJointsLocal, orientationMatrix, transform, vec, type V3 } from "../src/viewer/kinematics.ts";
import { HAND_PARENT, POSE, prepareMotion, type AvatarFrame, type Motion } from "../src/viewer/motion.ts";

const REVIEW = ["w-hello", "w-thank-you", "w-mother", "w-father", "w-eat", "w-drink", "w-name", "w-want", "w-yes", "w-no", "num-3", "num-6", "num-9"];
const DIR = new URL("../public/motion/", import.meta.url);
const HZ = 60;
const TIPS = [4, 8, 12, 16, 20];

// ---- the pre-Part-H pipeline, as it was ------------------------------------------------------------
const toV3 = (a: number[], i: number): V3 => [a[i * 3], -a[i * 3 + 1], -a[i * 3 + 2]];
function holdFill<T>(arr: (T | null)[]): (T | null)[] {
  const out = [...arr];
  let last: T | null = null;
  for (let i = 0; i < out.length; i++) { if (out[i] != null) last = out[i]; else out[i] = last; }
  const first = out.find((x) => x != null) ?? null;
  for (let i = 0; i < out.length && out[i] == null; i++) out[i] = first;
  return out;
}
function restingHand(wrist: V3, elbow: V3, isLeft: boolean): V3[] {
  const fingers = vec.norm(vec.sub(wrist, elbow));
  const palm: V3 = isLeft ? [-1, 0, 0] : [1, 0, 0];
  const m = (v: V3): V3 => (isLeft ? [-v[0], v[1], v[2]] : v);
  const j = transform(handJointsLocal(HANDSHAPES.rest), orientationMatrix(m(fingers), m(palm)));
  return j.map((p) => vec.add(wrist, vec.scale(m(p), 0.085 * 1.15)));
}
function legacyFrames(m: Motion, handScale: number): AvatarFrame[] {
  const pose = holdFill(m.pose), lh = holdFill(m.leftHand), rh = holdFill(m.rightHand);
  return pose.map((p, f) => {
    const body = Array.from({ length: m.poseJoints.length }, (_, i) => toV3(p ?? pose[0]!, i));
    const hand = (data: number[] | null, wrist: number, elbow: number, isLeft: boolean) => {
      if (!data) return restingHand(body[wrist], body[elbow], isLeft);
      const pts = Array.from({ length: 21 }, (_, i) => toV3(data, i));
      return pts.map((q) => vec.add(body[wrist], vec.scale(vec.sub(q, pts[0]), handScale)));
    };
    return { body, left: hand(lh[f], POSE.L_WR, POSE.L_EL, true), right: hand(rh[f], POSE.R_WR, POSE.R_EL, false), face: [] };
  });
}
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function legacyAt(frames: AvatarFrame[], x: number): AvatarFrame {
  const i = Math.max(0, Math.min(frames.length - 1, Math.floor(x)));
  const j = Math.min(frames.length - 1, i + 1);
  const t = Math.min(1, Math.max(0, x - i));
  const a = frames[i], b = frames[j];
  return { body: a.body.map((p, k) => lerp3(p, b.body[k], t)), left: a.left.map((p, k) => lerp3(p, b.left[k], t)), right: a.right.map((p, k) => lerp3(p, b.right[k], t)), face: [] };
}

// ---- metrics -------------------------------------------------------------------------------------
const median = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];
interface Stats { rms: number; mean: number; jerk: number; bones: number }
function motionStats(track: V3[][]): Omit<Stats, "bones"> {
  // track[frame][point]
  let sum = 0, sum2 = 0, n = 0, jsum = 0, jn = 0;
  for (let f = 1; f + 1 < track.length; f++) {
    for (let p = 0; p < track[f].length; p++) {
      const a = vec.len(vec.sub(vec.add(track[f + 1][p], track[f - 1][p]), vec.scale(track[f][p], 2))) * HZ * HZ;
      sum += a; sum2 += a * a; n++;
      if (f + 2 < track.length) {
        const j = vec.sub(vec.sub(track[f + 2][p], vec.scale(track[f + 1][p], 3)), vec.sub(track[f - 1][p], vec.scale(track[f][p], 3)));
        jsum += vec.len(j) * HZ ** 3; jn++;
      }
    }
  }
  return { rms: Math.sqrt(sum2 / n), mean: sum / n, jerk: jsum / jn };
}
function boneVariation(frames: AvatarFrame[], hands: ("left" | "right")[]): number {
  const bones: [(fr: AvatarFrame) => V3, (fr: AvatarFrame) => V3][] = [
    [(fr) => fr.body[POSE.L_SH], (fr) => fr.body[POSE.L_EL]], [(fr) => fr.body[POSE.L_EL], (fr) => fr.body[POSE.L_WR]],
    [(fr) => fr.body[POSE.R_SH], (fr) => fr.body[POSE.R_EL]], [(fr) => fr.body[POSE.R_EL], (fr) => fr.body[POSE.R_WR]],
  ];
  for (const h of hands) for (let i = 1; i < 21; i++) bones.push([(fr) => fr[h][HAND_PARENT[i]], (fr) => fr[h][i]]);
  let worst = 0;
  for (const [a, b] of bones) {
    const L = frames.map((fr) => vec.len(vec.sub(a(fr), b(fr))));
    const m = median(L);
    for (const x of L) worst = Math.max(worst, Math.abs(x - m) / m);
  }
  return worst;
}

const refArg = process.argv.indexOf("--before-ref");
const BEFORE_REF = refArg > 0 ? process.argv[refArg + 1] : "8211eae";
let beforeFromGit = true;
function beforeFile(id: string): Motion {
  try {
    return JSON.parse(execFileSync("git", ["show", `${BEFORE_REF}:web/public/motion/${id}.json`], { cwd: new URL("..", import.meta.url), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 }));
  } catch {
    beforeFromGit = false;
    return JSON.parse(readFileSync(new URL(`${id}.json`, DIR), "utf8"));
  }
}

interface Row { id: string; before: Stats; after: Stats }
function measure(id: string): Row | null {
  const m = JSON.parse(readFileSync(new URL(`${id}.json`, DIR), "utf8")) as Motion;
  const m0 = beforeFile(id);
  const hands = (["left", "right"] as const).filter((h) => (h === "left" ? m0.leftHand : m0.rightHand).some(Boolean));
  if (!hands.length) return null;
  const old = legacyFrames(m0, 1);
  const before = Array.from({ length: Math.floor(((m0.pose.length - 1) / m0.fps) * HZ) + 1 }, (_, k) => legacyAt(old, (k / HZ) * m0.fps));
  const after = prepareMotion(m, { handScale: 1 }).frames;
  const stats = (frames: AvatarFrame[]): Stats => ({
    ...motionStats(frames.map((fr) => hands.flatMap((h) => [fr[h][0], ...TIPS.map((i) => fr[h][i])]))),
    bones: boneVariation(frames, hands),
  });
  return { id, before: stats(before), after: stats(after) };
}

const ids = process.argv.includes("--all")
  ? readdirSync(DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_")).map((f) => f.replace(/\.json$/, "")).sort()
  : REVIEW;
const rows = ids.map(measure).filter((r): r is Row => !!r);
const drop = (a: number, b: number) => `${(100 * (1 - b / a)).toFixed(0)}%`.padStart(5);
const f1 = (x: number) => x.toFixed(1).padStart(6);
console.log("clip            RMS accel m/s²           mean accel m/s²          mean jerk m/s³          bone-length variation");
console.log("                before  after  drop      before  after  drop      before  after  drop      before    after");
for (const r of rows) {
  const { before: b, after: a } = r;
  console.log(`${r.id.padEnd(15)} ${f1(b.rms)} ${f1(a.rms)} ${drop(b.rms, a.rms)}     ${f1(b.mean)} ${f1(a.mean)} ${drop(b.mean, a.mean)}     ${b.jerk.toFixed(0).padStart(6)} ${a.jerk.toFixed(0).padStart(6)} ${drop(b.jerk, a.jerk)}     ${(100 * b.bones).toFixed(1).padStart(6)}%  ${(100 * a.bones).toFixed(2).padStart(6)}%`);
}
const avg = (k: keyof Stats, w: "before" | "after") => rows.reduce((s, r) => s + r[w][k], 0) / rows.length;
const line = (label: string, k: keyof Stats, unit: string) =>
  console.log(`  ${label.padEnd(36)} ${avg(k, "before").toFixed(1)} → ${avg(k, "after").toFixed(1)} ${unit} (${drop(avg(k, "before"), avg(k, "after")).trim()} lower)`);
console.log(`\nmean over ${rows.length} clips, life size, 60 Hz (before: motion files at ${beforeFromGit ? BEFORE_REF : "HEAD (git unavailable!)"}):`);
line("acceleration, quadratic mean (RMS)", "rms", "m/s²");
line("acceleration, arithmetic mean", "mean", "m/s²");
line("jerk, arithmetic mean", "jerk", "m/s³");
const worst = Math.max(...rows.map((r) => r.after.bones));
console.log(`  ${"worst bone-length variation".padEnd(36)} ${(100 * Math.max(...rows.map((r) => r.before.bones))).toFixed(0)}% → ${(100 * worst).toFixed(2)}%`);
const rmsDrop = 1 - avg("rms", "after") / avg("rms", "before");
const ok = rmsDrop >= 0.5 && worst < 0.02;
console.log(ok ? `PASS: RMS acceleration ${(100 * rmsDrop).toFixed(0)}% lower (≥ 50 %), every bone within 2 %` : "FAIL");
process.exit(ok ? 0 : 1);
