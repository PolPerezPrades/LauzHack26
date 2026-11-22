/**
 * Rewrites the avatar motion files (public/motion/*.json) with compact numbers (Part H).
 * The extractor rounded every value to 4 decimals but wrote it from float32 ("-0.15219999849796295"
 * for -0.1522), so the files were about three times larger than their data. This writes the same
 * values at the extractor's own precision (4 decimals; 3 for the face blendshapes) and adds
 * "version": 2. Nothing else changes. Run from web/:
 *   node scripts/compact-motion.ts           rewrite every file
 *   node scripts/compact-motion.ts --check   exit 1 if a file is not compact yet
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = new URL("../public/motion/", import.meta.url);
const check = process.argv.includes("--check");

const round = (x: number, d: number) => { const r = Math.round(x * 10 ** d) / 10 ** d; return Object.is(r, -0) ? 0 : r; };
const rows = (seq: (number[] | null)[], d: number) => seq.map((a) => (a ? a.map((x) => round(x, d)) : null));

let before = 0, after = 0, stale = 0;
for (const f of readdirSync(DIR).filter((n) => n.endsWith(".json") && !n.startsWith("_")).sort()) {
  const url = new URL(f, DIR);
  const text = readFileSync(url, "utf8");
  const m = JSON.parse(text);
  const { id, ...rest } = m;
  const out = {
    id,
    version: 2,
    ...rest,
    pose: rows(m.pose, 4),
    leftHand: rows(m.leftHand, 4),
    rightHand: rows(m.rightHand, 4),
    face: { ...m.face, values: rows(m.face.values, 3) },
    crop: m.crop?.map((x: number) => round(x, 4)),
  };
  const next = JSON.stringify(out);
  before += text.length; after += next.length;
  if (next !== text) {
    stale++;
    if (!check) writeFileSync(url, next, "utf8");
  }
}
console.log(`${check ? "checked" : "wrote"} motion files: ${(before / 1024).toFixed(0)} kB → ${(after / 1024).toFixed(0)} kB${stale ? ` (${stale} ${check ? "not compact" : "rewritten"})` : ""}`);
process.exit(check && stale ? 1 : 0);
