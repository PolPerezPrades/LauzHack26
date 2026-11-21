#!/usr/bin/env node
/**
 * Downloads every real ASL media file the app needs and writes src/content/media.json.
 *
 *   - Word / number signs: WLASL v0.3 index (github.com/dxli94/WLASL). For each gloss we try the
 *     dataset's own clip URLs (dictionary sites curated by the WLASL authors) until one is a
 *     browser-playable H.264 MP4. Nothing is generated: if no clip works, the sign is left out.
 *   - Fingerspelling letters A–Z: public-domain ASL alphabet illustrations from Wikimedia Commons
 *     ("Sign language X.svg", wpclipart.com). WLASL has no clips for several letters (C, L, X, Y, Z).
 *   - MediaPipe Hands: WASM runtime (copied from node_modules) + hand_landmarker.task model.
 *
 * Usage: npm run setup:media   (re-running only downloads what is missing)
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, ".cache");
const PUBLIC = path.join(ROOT, "public");
const SIGNS_DIR = path.join(PUBLIC, "media", "signs");
const LETTERS_DIR = path.join(PUBLIC, "media", "letters");
const MP_DIR = path.join(PUBLIC, "mediapipe");
const MANIFEST = path.join(ROOT, "src", "content", "media.json");
const UA = "asl-learning-prototype/0.1 (educational hackathon project)";

const WLASL_URL = "https://raw.githubusercontent.com/dxli94/WLASL/master/start_kit/WLASL_v0.3.json";
const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
// Sources whose direct MP4 links were still alive when this was written, best first.
const SOURCE_ORDER = ["startasl", "aslbrick", "signschool", "asldeafined", "spreadthesign"];
const MAX_BYTES = 12 * 1024 * 1024;

for (const d of [CACHE, SIGNS_DIR, LETTERS_DIR, path.join(MP_DIR, "wasm")]) mkdirSync(d, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBuf(url, { timeoutMs = 30000, retries = 0 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal, redirect: "follow" });
      if (res.status === 429 && attempt < retries) {
        await sleep(Math.min(60000, 3000 * 2 ** attempt)); // rate limited: back off and retry
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      return { buf, type: res.headers.get("content-type") ?? "" };
    } finally {
      clearTimeout(t);
    }
  }
}

/** A browser-playable MP4: ISO BMFF container ("ftyp" box) with an H.264 ("avc1") video track. */
function isPlayableMp4(buf) {
  return buf.length > 20_000 && buf.length < MAX_BYTES && buf.subarray(4, 8).toString("latin1") === "ftyp" &&
    buf.includes(Buffer.from("avc1", "latin1"));
}

async function cached(url, file) {
  const p = path.join(CACHE, file);
  if (!existsSync(p)) {
    console.log(`[fetch] ${url}`);
    writeFileSync(p, (await fetchBuf(url, { timeoutMs: 120000 })).buf);
  }
  return readFileSync(p);
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }));
  return out;
}

const content = JSON.parse(readFileSync(path.join(ROOT, "content", "signs.json"), "utf8"));
const old = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const manifest = { generatedAt: new Date().toISOString(), signs: {}, letters: {} };

// ---- 1. word / number signs from WLASL -------------------------------------------------------
const wlasl = JSON.parse((await cached(WLASL_URL, "WLASL_v0.3.json")).toString("utf8"));
const byGloss = new Map(wlasl.map((e) => [e.gloss, e.instances]));

const results = await pool(content.signs, 6, async (sign) => {
  const file = path.join(SIGNS_DIR, `${sign.id}.mp4`);
  if (existsSync(file) && old.signs?.[sign.id]) return [sign.id, old.signs[sign.id]];
  const instances = (byGloss.get(sign.wlasl) ?? [])
    .filter((i) => SOURCE_ORDER.includes(i.source) && i.frame_end === -1)
    .sort((a, b) => SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source));
  for (const inst of instances) {
    try {
      const { buf } = await fetchBuf(inst.url);
      if (!isPlayableMp4(buf)) continue;
      writeFileSync(file, buf);
      const entry = {
        src: `/media/signs/${sign.id}.mp4`,
        dataset: "WLASL v0.3",
        gloss: sign.wlasl,
        source: inst.source,
        sourceUrl: inst.url,
        videoId: inst.video_id,
        signerId: inst.signer_id,
        sha1: createHash("sha1").update(buf).digest("hex"),
      };
      console.log(`[sign] ${sign.id.padEnd(16)} <- ${inst.source} (${(buf.length / 1024).toFixed(0)} KB)`);
      return [sign.id, entry];
    } catch {
      /* dead link: try the next instance */
    }
  }
  console.warn(`[sign] ${sign.id.padEnd(16)} !! no playable clip found (left out of the app)`);
  return [sign.id, null];
});
for (const [id, entry] of results) if (entry) manifest.signs[id] = entry;
manifest.letters = old.letters ?? {};
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n"); // checkpoint
manifest.letters = {};

// ---- 2. fingerspelling letters from Wikimedia Commons ---------------------------------------
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const titles = LETTERS.map((l) => `File:Sign_language_${l}.svg`).join("|");
const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&titles=${encodeURIComponent(titles)}`;
const info = JSON.parse((await fetchBuf(api, { retries: 4 })).buf.toString("utf8"));
const pages = Object.values(info.query.pages);
await pool(LETTERS, 1, async (L) => { // Wikimedia rate-limits parallel downloads: one at a time
  const page = pages.find((p) => p.title === `File:Sign language ${L}.svg`);
  const ii = page?.imageinfo?.[0];
  if (!ii) return console.warn(`[letter] ${L} !! not found on Commons`);
  const file = path.join(LETTERS_DIR, `${L}.svg`);
  if (!existsSync(file)) {
    // upload.wikimedia.org throttles Node's HTTP client hard (429, retry-after 600) but not curl,
    // which ships with Windows 10+, macOS and Linux.
    try {
      execFileSync("curl", ["-sSfL", "-A", UA, "-o", file, ii.url.split("?")[0]], { stdio: "ignore", timeout: 30000 });
    } catch {
      rmSync(file, { force: true });
      return console.warn(`[letter] ${L} !! download failed (rate limited?) - re-run "npm run setup:media" later`);
    }
    await sleep(500);
  }
  const strip = (s) => (s ?? "").replace(/<[^>]+>/g, "").trim();
  manifest.letters[L] = {
    src: `/media/letters/${L}.svg`,
    source: "Wikimedia Commons",
    sourceUrl: ii.descriptionurl,
    license: strip(ii.extmetadata?.LicenseShortName?.value) || "Public domain",
    author: strip(ii.extmetadata?.Artist?.value),
  };
});
console.log(`[letter] ${Object.keys(manifest.letters).length}/26 letters`);

// ---- 3. MediaPipe Hands runtime + model -----------------------------------------------------
const wasmSrc = path.join(ROOT, "node_modules", "@mediapipe", "tasks-vision", "wasm");
for (const f of readdirSync(wasmSrc)) copyFileSync(path.join(wasmSrc, f), path.join(MP_DIR, "wasm", f));
const modelPath = path.join(MP_DIR, "hand_landmarker.task");
if (!existsSync(modelPath)) {
  console.log("[mediapipe] downloading hand_landmarker.task");
  writeFileSync(modelPath, (await fetchBuf(HAND_MODEL_URL, { timeoutMs: 120000 })).buf);
}

manifest.letters = Object.fromEntries(LETTERS.filter((l) => manifest.letters[l]).map((l) => [l, manifest.letters[l]]));
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
const missing = content.signs.filter((s) => !manifest.signs[s.id]).map((s) => s.id);
console.log(`\nDone: ${Object.keys(manifest.signs).length}/${content.signs.length} sign videos, ` +
  `${Object.keys(manifest.letters).length}/26 letters.${missing.length ? ` Missing: ${missing.join(", ")}` : ""}`);
