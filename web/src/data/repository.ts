/**
 * Storage abstraction. The app only talks to `LearningRepository`, so moving from the local
 * IndexedDB implementation to a backend means writing one new class. Rows written by older event
 * schemas are upcast on every read, so callers only ever see current events.
 */
import { EVENT_SCHEMA_VERSION, upcastEvents, type LearningEvent, type StoredEvent } from "./events";

export const EXPORT_FORMAT = "signa-learning-log";

export interface ExportBundle {
  format: typeof EXPORT_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  events: StoredEvent[];
}

export interface LearningRepository {
  /** Append one event (immutable; never updated or deleted individually). */
  append(e: LearningEvent): Promise<LearningEvent>;
  /** All events in append order, upcast to the current schema. */
  all(): Promise<LearningEvent[]>;
  /** Replace the whole log (import) or wipe it (reset). */
  replaceAll(events: LearningEvent[]): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta<T>(key: string, value: T): Promise<void>;
}

export async function exportLog(repo: LearningRepository, now = new Date()): Promise<ExportBundle> {
  return { format: EXPORT_FORMAT, schemaVersion: EVENT_SCHEMA_VERSION, exportedAt: now.toISOString(), events: await repo.all() };
}

/** Copy without the repository-local sequence number. */
export function withoutSeq<T extends { seq?: number }>(e: T): T {
  const copy = { ...e };
  delete copy.seq;
  return copy;
}

/** Validates an export bundle (any schema up to the current one) and returns its events, upcast. */
export function parseExport(raw: unknown): LearningEvent[] {
  const b = raw as Partial<ExportBundle> | null;
  if (!b || b.format !== EXPORT_FORMAT) throw new Error("Not a Signa export");
  if (typeof b.schemaVersion !== "number" || b.schemaVersion > EVENT_SCHEMA_VERSION) throw new Error("Unsupported data version");
  if (!Array.isArray(b.events)) throw new Error("Missing events");
  const ids = new Set<string>();
  const rows = (b.events as StoredEvent[])
    .filter((e) => e && typeof e.id === "string" && typeof e.ts === "number" && typeof e.type === "string" && !ids.has(e.id) && !!ids.add(e.id))
    .sort((a, c) => (a.seq ?? 0) - (c.seq ?? 0) || a.ts - c.ts)
    .map(withoutSeq);
  return upcastEvents(rows);
}

/** In-memory implementation (tests, Node scripts, private-browsing fallback). */
export class MemoryRepository implements LearningRepository {
  private rows: StoredEvent[] = [];
  private meta = new Map<string, unknown>();

  /** Seed with raw rows, e.g. a v1 log, to test the read path. */
  constructor(rows: StoredEvent[] = []) {
    this.rows = rows.map((e, i) => ({ ...e, seq: i + 1 }));
  }
  async append(e: LearningEvent) {
    const stored = { ...e, seq: this.rows.length + 1 };
    this.rows.push(stored);
    return stored;
  }
  async all() {
    return upcastEvents(this.rows);
  }
  async replaceAll(events: LearningEvent[]) {
    this.rows = events.map((e, i) => ({ ...e, seq: i + 1 }));
  }
  async getMeta<T>(key: string) {
    return this.meta.get(key) as T | undefined;
  }
  async setMeta<T>(key: string, value: T) {
    this.meta.set(key, value);
  }
}
