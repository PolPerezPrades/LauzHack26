/**
 * Production server: serves the built app (dist/) plus the /api endpoints.
 *   npm run build && npm start      ->  http://localhost:8787
 * (Node >= 23 runs this .ts file directly via type stripping.)
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleApi } from "./api.ts";

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PORT = Number(process.env.PORT ?? 8787);
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".mp4": "video/mp4", ".wasm": "application/wasm",
  ".task": "application/octet-stream",
};

createServer(async (req, res) => {
  if (await handleApi(req, res)) return;
  const rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let file = path.join(DIST, rel);
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Signa running on http://localhost:${PORT}`));
