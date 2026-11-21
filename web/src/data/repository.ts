/**
 * Storage abstraction. The app only talks to `LearningRepository`, so moving from the local
 * IndexedDB implementation to a backend (phase 3+) means writing one new class.
 */
import { EVENT_SCHEMA_VERSION, upcast, type LearningEvent } from "./events";

export const EXPORT_FORMAT = "signa-learning-log";

export interface ExportBundle {
  format: typeof EXPORT_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  events: LearningEvent[];
}

export interface LearningRepository {
  /** Append one event (immutable; never updated or deleted individually). */
  append(e: LearningEvent): Promise<LearningEvent>;
  /** All events in append order (upcast to the current schema). */
  all(): Promise<LearningEvent[]>;
  /** Replace the whole log (import) or wipe it (reset). */
  replaceAll(events: LearningEvent[]): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta<T>(key: string, value: T): Promise<void>;
}

export async function exportLog(repo: LearningRepository): Promise<ExportBundle> {
  return { format: EXPORT_FORMAT, schemaVersion: EVENT_SCHEMA_VERSION, exportedAt: new Date().toISOString(), events: await repo.all() };
}

/** Validates an export bundle and returns its events (throws with a readable message). */
export function parseExport(raw: unknown): LearningEvent[] {
  const b = raw as Partial<ExportBundle>;
  if (!b || b.format !== EXPORT_FORMAT) throw new Error("No es una exportación de Signa");
  if (typeof b.schemaVersion !== "number" || b.schemaVersion > EVENT_SCHEMA_VERSION) throw new Error("Versión de datos no compatible");
  if (!Array.isArray(b.events)) throw new Error("Faltan los eventos");
  const ids = new Set<string>();
  return b.events
    .filter((e) => e && typeof e.id === "string" && typeof e.ts === "number" && typeof e.type === "string" && !ids.has(e.id) && ids.add(e.id))
    .sort((a, b2) => (a.seq ?? 0) - (b2.seq ?? 0) || a.ts - b2.ts)
    .map((e) => upcast({ ...e, seq: undefined }));
}

/** In-memory implementation (tests, Node scripts, private browsing fallback). */
export class MemoryRepository implements LearningRepository {
  private events: LearningEvent[] = [];
  private meta = new Map<string, unknown>();
  async append(e: LearningEvent) {
    const stored = { ...e, seq: this.events.length + 1 };
    this.events.push(stored);
    return stored;
  }
  async all() {
    return this.events.map(upcast);
  }
  async replaceAll(events: LearningEvent[]) {
    this.events = events.map((e, i) => ({ ...e, seq: i + 1 }));
  }
  async getMeta<T>(key: string) {
    return this.meta.get(key) as T | undefined;
  }
  async setMeta<T>(key: string, value: T) {
    this.meta.set(key, value);
  }
}
