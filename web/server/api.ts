/**
 * Tiny JSON API used by the web app (mounted inside the Vite dev server, or by server/index.ts).
 *
 *   GET  /api/health   -> { ai: boolean }
 *   POST /api/coach    -> personalised end-of-session feedback + difficulty adjustment
 *   POST /api/phrases  -> new practice phrases built ONLY from signs that have a real video
 *
 * Generative AI never produces sign media: phrases are sequences of existing sign ids, and every
 * id is validated against the downloaded WLASL clips before it reaches the browser. If Claude is
 * not configured or fails, each endpoint answers with a local rule-based fallback.
 */
import Anthropic from "@anthropic-ai/sdk";
import { readdirSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = "claude-opus-5-5";

interface SignDef { id: string; en: string; es: string; unit: string }

// ---------------------------------------------------------------------------------------------
// content helpers

/** Words that exist as real signs (content/signs/*.json) — the only vocabulary phrases may use. */
function loadVocabulary(): SignDef[] {
  const dir = path.join(ROOT, "content", "signs");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")))
    .filter((s) => s.type === "word" && s.video)
    .map((s) => ({ id: s.id, en: s.translations.en, es: s.translations.es, unit: s.unit }));
}

// ---------------------------------------------------------------------------------------------
// Claude

let client: Anthropic | null | undefined;
function getClient(): Anthropic | null {
  if (client === undefined) {
    try {
      client = new Anthropic();
    } catch {
      client = null; // no credentials configured
    }
  }
  return client;
}

/** Whether Claude is usable: credentials resolve and the model is reachable (checked once, free call). */
let health: Promise<boolean> | undefined;
function aiHealthy(): Promise<boolean> {
  health ??= (async () => {
    const c = getClient();
    if (!c) return false;
    try {
      await c.models.retrieve(MODEL);
      return true;
    } catch (e) {
      console.warn("[api] Claude unavailable, using local fallbacks:", (e as Error).message.split("\n")[0]);
      setTimeout(() => (health = undefined), 60_000); // re-check later (e.g. transient network error)
      return false;
    }
  })();
  return health;
}

/** One structured-output request; returns the parsed JSON object or throws. */
async function askJson<T>(system: string, user: string, schema: Record<string, unknown>): Promise<T> {
  const c = getClient();
  if (!c || !(await aiHealthy())) throw new Error("Claude not configured");
  const res = await c.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // a declined request is retried server-side on the recommended model
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new Error("request declined");
  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("no text in response");
  return JSON.parse(text.text) as T;
}

// ---------------------------------------------------------------------------------------------
// /api/coach

interface CoachRequest {
  level: number;               // 1..3
  goalMin: number;
  streak: number;
  accuracy: number;            // 0..1
  durationSec: number;
  results: { id: string; label: string; activity: string; correct: boolean }[];
  weak: { id: string; label: string }[];
}
interface CoachResponse {
  message: string;
  tips: string[];
  difficulty: "easier" | "same" | "harder";
  focus: string[];
  source: "ai" | "local";
}

const COACH_SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string" },
    tips: { type: "array", items: { type: "string" } },
    difficulty: { type: "string", enum: ["easier", "same", "harder"] },
    focus: { type: "array", items: { type: "string" } },
  },
  required: ["message", "tips", "difficulty", "focus"],
  additionalProperties: false,
};

const COACH_SYSTEM = `Eres el entrenador de una app gamificada para aprender Lengua de Signos Americana (ASL) en español.
Recibes el resultado de una sesión y devuelves feedback breve y motivador.
Reglas:
- Escribe en español, tono cercano, 2-3 frases en "message". Menciona algo concreto de la sesión.
- "tips": máximo 3 consejos de estudio accionables (repaso, ritmo, uso de la cámara, gramática ASL general como expresiones faciales o el orden tiempo-tópico-comentario si el nivel es 3).
- NO describas cómo se ejecuta un signo concreto (configuración, movimiento): la app muestra vídeos de referencia reales y una descripción inventada podría ser incorrecta.
- Habla solo de ASL, nunca de otras lenguas de signos.
- "difficulty": "harder" si la precisión es >= 0.85 y hubo variedad; "easier" si es < 0.6; si no, "same".
- "focus": hasta 4 ids de la lista de fallos/débiles que conviene repasar (usa solo ids recibidos).`;

function localCoach(r: CoachRequest): CoachResponse {
  const pct = Math.round(r.accuracy * 100);
  const missed = r.results.filter((x) => !x.correct).map((x) => x.label);
  const message =
    pct >= 85
      ? `¡Gran sesión! Has acertado un ${pct}%. Subiremos un poco el ritmo en la próxima.`
      : pct >= 60
        ? `Buen trabajo: ${pct}% de aciertos. Con un par de repasos más lo tendrás dominado.`
        : `Has acertado un ${pct}%. Es normal al principio: la próxima sesión repasaremos con más calma.`;
  const tips = [
    missed.length ? `Repasa: ${[...new Set(missed)].slice(0, 4).join(", ")}.` : "Mantén la racha: 5 minutos al día valen más que una hora a la semana.",
    "Mira cada vídeo dos veces: primero la mano dominante, después el movimiento y la cara.",
  ];
  return {
    message,
    tips,
    difficulty: r.accuracy >= 0.85 ? "harder" : r.accuracy < 0.6 ? "easier" : "same",
    focus: r.weak.slice(0, 4).map((w) => w.id),
    source: "local",
  };
}

async function coach(r: CoachRequest): Promise<CoachResponse> {
  try {
    const out = await askJson<Omit<CoachResponse, "source">>(COACH_SYSTEM, JSON.stringify(r), COACH_SCHEMA);
    const valid = new Set([...r.results.map((x) => x.id), ...r.weak.map((x) => x.id)]);
    return {
      message: out.message,
      tips: out.tips.slice(0, 3),
      difficulty: out.difficulty,
      focus: out.focus.filter((id) => valid.has(id)).slice(0, 4),
      source: "ai",
    };
  } catch (e) {
    console.warn("[api/coach] using local fallback:", (e as Error).message);
    return localCoach(r);
  }
}

// ---------------------------------------------------------------------------------------------
// /api/phrases

interface PhraseRequest { known: string[]; count: number; difficulty?: string }
interface Phrase { id: string; signs: string[]; en: string; es: string; nonManual: string; note: string }

const PHRASE_SCHEMA = {
  type: "object",
  properties: {
    phrases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          signs: { type: "array", items: { type: "string" } },
          en: { type: "string" },
          es: { type: "string" },
          nonManual: { type: "string", enum: ["neutral", "yn", "wh", "neg", "topic"] },
          note: { type: "string" },
        },
        required: ["signs", "en", "es", "nonManual", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["phrases"],
  additionalProperties: false,
};

const PHRASE_SYSTEM = `Creas frases cortas de práctica en Lengua de Signos Americana (ASL) para estudiantes hispanohablantes.
Cada frase es una secuencia de 2 a 5 signos, escrita con los ids de la lista de vocabulario disponible. No puedes usar ningún signo que no esté en la lista (cada id corresponde a un vídeo real de diccionario).
Sigue la gramática ASL, no la del español ni la del inglés:
- Marcas de tiempo (HOY, MAÑANA) al inicio.
- Tópico-comentario cuando sea natural (p. ej. MI FAMILIA, YO AMAR).
- Pronombres interrogativos (QUÉ, DÓNDE, POR QUÉ) al final en preguntas abiertas.
- Sin verbo copulativo («ser/estar»).
"nonManual": "yn" (pregunta sí/no, cejas arriba), "wh" (pregunta abierta, cejas fruncidas), "neg" (negación con la cabeza), "topic" (tópico con cejas arriba) o "neutral".
"en" y "es": traducción natural. "note": una frase en español explicando el punto gramatical.
Prioriza los ids que el estudiante ya conoce, varía las estructuras y no repitas frases.`;

async function phrases(r: PhraseRequest): Promise<{ phrases: Phrase[]; source: "ai" | "local" }> {
  const vocab = loadVocabulary();
  const allowed = new Map(vocab.map((v) => [v.id, v]));
  const count = Math.min(Math.max(r.count || 4, 1), 8);
  try {
    const list = vocab.map((v) => `${v.id} = ${v.en.toUpperCase()} (${v.es})`).join("\n");
    const known = r.known.filter((id) => allowed.has(id));
    const out = await askJson<{ phrases: Omit<Phrase, "id">[] }>(
      PHRASE_SYSTEM,
      `Vocabulario disponible:\n${list}\n\nIds que el estudiante ya conoce: ${known.join(", ") || "(ninguno)"}\n` +
        `Dificultad: ${r.difficulty ?? "same"}\nGenera ${count} frases.`,
      PHRASE_SCHEMA,
    );
    const valid = out.phrases
      .filter((p) => p.signs.length >= 2 && p.signs.length <= 5 && p.signs.every((id) => allowed.has(id)))
      .map((p, i) => ({ ...p, id: `ai-${Date.now().toString(36)}-${i}` }));
    if (!valid.length) throw new Error("no valid phrases returned");
    return { phrases: valid.slice(0, count), source: "ai" };
  } catch (e) {
    console.warn("[api/phrases] using local fallback:", (e as Error).message);
    return { phrases: [], source: "local" }; // the client falls back to the curated phrase list
  }
}

// ---------------------------------------------------------------------------------------------
// HTTP plumbing

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 200_000) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

/** Handles /api/* requests; returns false for anything else. */
export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url?.split("?")[0] ?? "";
  if (!url.startsWith("/api/")) return false;
  try {
    if (req.method === "GET" && url === "/api/health") send(res, 200, { ai: await aiHealthy() });
    else if (req.method === "POST" && url === "/api/coach") send(res, 200, await coach((await readJson(req)) as CoachRequest));
    else if (req.method === "POST" && url === "/api/phrases") send(res, 200, await phrases((await readJson(req)) as PhraseRequest));
    else send(res, 404, { error: "not found" });
  } catch (e) {
    send(res, 400, { error: (e as Error).message });
  }
  return true;
}
