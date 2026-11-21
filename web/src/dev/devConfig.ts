/**
 * The last dev-mode choices, kept in localStorage (not sessionStorage) so a new tab can replay the
 * same forced format — that is how the camera opt-out is tested across sessions.
 */
import type { ForcedConfig } from "./forcedSource";

const KEY = "signa:dev";

export const DEFAULT_DEV_CONFIG: ForcedConfig = { format: "quiz-choice", ce: 0, items: [], overrides: {} };

function sanitize(raw: unknown): ForcedConfig {
  const c = (raw ?? {}) as Partial<Record<keyof ForcedConfig, unknown>>;
  const overrides: Record<string, number> = {};
  if (c.overrides && typeof c.overrides === "object") {
    for (const [k, v] of Object.entries(c.overrides)) if (typeof v === "number" && Number.isFinite(v)) overrides[k] = v;
  }
  return {
    format: typeof c.format === "string" ? c.format : DEFAULT_DEV_CONFIG.format,
    ...(typeof c.unit === "string" ? { unit: c.unit } : {}),
    items: Array.isArray(c.items) ? c.items.filter((x): x is string => typeof x === "string") : [],
    ce: typeof c.ce === "number" && Number.isFinite(c.ce) ? Math.max(-1, Math.min(1, c.ce)) : 0,
    overrides,
  };
}

export function loadDevConfig(): ForcedConfig {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_DEV_CONFIG };
  } catch {
    return { ...DEFAULT_DEV_CONFIG };
  }
}

export function saveDevConfig(config: ForcedConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(config));
  } catch {
    /* storage blocked: choices last for this page only */
  }
}
