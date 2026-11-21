/** IndexedDB implementation of the learning repository (Dexie, versioned schema with migrations). */
import Dexie, { type EntityTable } from "dexie";
import type { LearningEvent } from "./events";
import { upcast } from "./events";
import { MemoryRepository, type LearningRepository } from "./repository";

interface MetaRow { key: string; value: unknown }

class SignaDB extends Dexie {
  events!: EntityTable<LearningEvent, "seq">;
  meta!: EntityTable<MetaRow, "key">;
  constructor() {
    super("signa");
    // v1: append-only event log (auto-increment seq) + small key/value metadata table.
    // Future schema changes: add db.version(2).stores({...}).upgrade(tx => ...) below.
    this.version(1).stores({
      events: "++seq, &id, ts, type, itemId, sessionId",
      meta: "&key",
    });
  }
}

export class DexieRepository implements LearningRepository {
  private db = new SignaDB();

  async append(e: LearningEvent) {
    const { seq: _ignored, ...rest } = e;
    void _ignored;
    const seq = await this.db.events.add(rest as LearningEvent);
    return { ...e, seq: seq as number };
  }
  async all() {
    return (await this.db.events.orderBy("seq").toArray()).map(upcast);
  }
  async replaceAll(events: LearningEvent[]) {
    await this.db.transaction("rw", this.db.events, async () => {
      await this.db.events.clear();
      await this.db.events.bulkAdd(events.map(({ seq: _s, ...rest }) => { void _s; return rest as LearningEvent; }));
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
export async function openRepository(): Promise<{ repo: LearningRepository; persistent: boolean }> {
  try {
    const repo = new DexieRepository();
    await repo.getMeta("probe");
    return { repo, persistent: true };
  } catch {
    return { repo: new MemoryRepository(), persistent: false };
  }
}
