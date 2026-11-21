/**
 * IndexedDB implementation of the learning repository (Dexie, versioned DB schema with migrations).
 * One database per log: "signa" holds the learner's real log, "signa-dev" the dev-mode sandbox.
 * Event schema v2 needed no change to the DB schema: rows are upcast when read.
 */
import Dexie, { type EntityTable } from "dexie";
import { upcastEvents, type LearningEvent, type StoredEvent } from "./events";
import { MemoryRepository, withoutSeq, type LearningRepository } from "./repository";

export const REAL_DB = "signa";
export const SANDBOX_DB = "signa-dev";

interface MetaRow { key: string; value: unknown }

class SignaDB extends Dexie {
  events!: EntityTable<LearningEvent, "seq">;
  meta!: EntityTable<MetaRow, "key">;
  constructor(name: string) {
    super(name);
    // v1: append-only event log (auto-increment seq) + small key/value metadata table.
    // Future schema changes: add db.version(2).stores({...}).upgrade(tx => ...) below.
    this.version(1).stores({
      events: "++seq, &id, ts, type, itemId, sessionId",
      meta: "&key",
    });
  }
}

export class DexieRepository implements LearningRepository {
  private db: SignaDB;
  constructor(name = REAL_DB) {
    this.db = new SignaDB(name);
  }

  async append(e: LearningEvent) {
    const seq = await this.db.events.add(withoutSeq(e));
    return { ...e, seq: seq as number };
  }
  async all() {
    // rows may predate schema v2
    return upcastEvents((await this.db.events.orderBy("seq").toArray()) as StoredEvent[]);
  }
  async replaceAll(events: LearningEvent[]) {
    await this.db.transaction("rw", this.db.events, async () => {
      await this.db.events.clear();
      await this.db.events.bulkAdd(events.map(withoutSeq));
    });
  }
  async getMeta<T>(key: string) {
    return (await this.db.meta.get(key))?.value as T | undefined;
  }
  async setMeta<T>(key: string, value: T) {
    await this.db.meta.put({ key, value });
  }
}

/** IndexedDB when available; in-memory otherwise (e.g. some private-browsing modes). */
export async function openRepository(name = REAL_DB): Promise<{ repo: LearningRepository; persistent: boolean }> {
  try {
    const repo = new DexieRepository(name);
    await repo.getMeta("probe");
    return { repo, persistent: true };
  } catch {
    return { repo: new MemoryRepository(), persistent: false };
  }
}
