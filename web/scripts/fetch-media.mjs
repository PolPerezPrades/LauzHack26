#!/usr/bin/env node
/**
 * Downloads the real media referenced by the sign files (content/signs/*.json):
 *   - each sign's original clip (video.src ← video.source.url, WLASL dictionary clips), used for the
 *     "real video" view, as the source of the avatar motion, and as fallback rendering;
 *   - the public-domain alphabet illustrations listed as letter references (optional, for the lab);
 *   - MediaPipe Hands runtime (WASM copied from node_modules) + hand_landmarker.task model.
 * Nothing is generated. Re-running only downloads what is missing.
 *
 * Usage: npm run setup:media
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const SIGNS = path.join(ROOT, "content", "signs");
const MP_DIR = path.join(PUBLIC, "mediapipe");
const UA = "asl-learning-prototype/0.1 (educational hackathon project)";
const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBuf(url, timeoutMs = 60000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}

/** A browser-playable MP4: ISO BMFF container with an H.264 ("avc1") track. */
const playable = (b) => b.length > 20_000 && b.subarray(4, 8).toString("latin1") === "ftyp" && b.includes(Buffer.from("avc1", "latin1"));

const specs = readdirSync(SIGNS).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(path.join(SIGNS, f), "utf8")));

// ---- 1. sign clips ----------------------------------------------------------------------------
let ok = 0, missing = [];
const queue = specs.filter((s) => s.video?.src && s.video?.source?.url);
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const s = queue.shift();
    const file = path.join(PUBLIC, s.video.src.replace(/^\//, ""));
    if (existsSync(file)) { ok++; continue; }
    mkdirSync(path.dirname(file), { recursive: true });
    try {
      const buf = await fetchBuf(s.video.source.url);
      if (!playable(buf)) throw new Error("not a playable H.264 MP4");
      writeFileSync(file, buf);
      ok++;
      console.log(`[clip] ${s.id}`);
    } catch (e) {
      missing.push(`${s.id} (${e.message})`);
    }
  }
}));
console.log(`[clip] ${ok}/${specs.filter((s) => s.video?.src).length} clips present`);
if (missing.length) console.warn(`[clip] missing: ${missing.join(", ")}`);

// ---- 2. alphabet illustrations (references for the lab; Wikimedia throttles, so one at a time) --
for (const s of specs.filter((x) => x.type === "letter")) {
  for (const r of s.references.filter((x) => x.image)) {
    const file = path.join(PUBLIC, r.image.replace(/^\//, ""));
    if (existsSync(file)) continue;
    mkdirSync(path.dirname(file), { recursive: true });
    const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(r.url.split("File:")[1] ?? "")}`;
    try {
      execFileSync("curl", ["-sSfL", "-A", UA, "-o", file, url], { stdio: "ignore", timeout: 30000 });
      await sleep(500);
    } catch {
      rmSync(file, { force: true });
      console.warn(`[ref] ${s.gloss} illustration not downloaded (optional; Wikimedia may be rate limiting)`);
    }
  }
}

// ---- 3. MediaPipe Hands runtime + model ------------------------------------------------------
mkdirSync(path.join(MP_DIR, "wasm"), { recursive: true });
const wasmSrc = path.join(ROOT, "node_modules", "@mediapipe", "tasks-vision", "wasm");
for (const f of readdirSync(wasmSrc)) copyFileSync(path.join(wasmSrc, f), path.join(MP_DIR, "wasm", f));
const modelPath = path.join(MP_DIR, "hand_landmarker.task");
if (!existsSync(modelPath)) {
  console.log("[mediapipe] downloading hand_landmarker.task");
  writeFileSync(modelPath, await fetchBuf(HAND_MODEL_URL, 120000));
}
console.log("Done.");
