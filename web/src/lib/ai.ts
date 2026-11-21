/** Browser client for the /api endpoints (server/api.ts). Every call has a safe fallback. */
import type { Phrase } from "../content/curriculum";
import type { Difficulty } from "./storage";

export interface CoachInput {
  level: number;
  goalMin: number;
  streak: number;
  accuracy: number;
  durationSec: number;
  results: { id: string; label: string; activity: string; correct: boolean }[];
  weak: { id: string; label: string }[];
}
export interface CoachOutput {
  message: string;
  tips: string[];
  difficulty: Difficulty;
  focus: string[];
  source: "ai" | "local";
}

async function post<T>(url: string, body: unknown, timeoutMs = 25000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function getCoaching(input: CoachInput): Promise<CoachOutput> {
  try {
    return await post<CoachOutput>("/api/coach", input);
  } catch {
    const pct = Math.round(input.accuracy * 100);
    return {
      message: `Sesión completada con un ${pct}% de aciertos. ¡Sigue así!`,
      tips: ["Repasa los signos que fallaste viendo el vídeo a velocidad lenta."],
      difficulty: input.accuracy >= 0.85 ? "harder" : input.accuracy < 0.6 ? "easier" : "same",
      focus: input.weak.slice(0, 4).map((w) => w.id),
      source: "local",
    };
  }
}

export async function getPracticePhrases(known: string[], count: number, difficulty: Difficulty): Promise<Phrase[]> {
  try {
    const r = await post<{ phrases: Phrase[] }>("/api/phrases", { known, count, difficulty }, 40000);
    return r.phrases ?? [];
  } catch {
    return [];
  }
}

export async function aiAvailable(): Promise<boolean> {
  try {
    const r = await fetch("/api/health");
    return ((await r.json()) as { ai: boolean }).ai;
  } catch {
    return false;
  }
}
