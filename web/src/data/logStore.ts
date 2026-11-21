/**
 * The live event log of one database, for the UI. `emit` appends synchronously to the in-memory
 * copy (so a card source called right after an exit already sees it) and persists in order in the
 * background. React subscribes with useSyncExternalStore. One store per database name.
 */
import { makeEvent, type EventBody, type LearningEvent } from "./events";
import { openRepository } from "./dexieRepository";
import type { LearningRepository } from "./repository";

export interface LogStore {
  readonly name: string;
  /** false when IndexedDB is unavailable and the log only lives in memory */
  readonly persistent: boolean;
  getEvents(): readonly LearningEvent[];
  subscribe(listener: () => void): () => void;
  emit(body: EventBody): LearningEvent;
  /** Replace the whole log (reset, import), then notify. */
  replaceAll(events: LearningEvent[]): Promise<void>;
  /** Resolves once every emitted event is written. */
  flush(): Promise<void>;
}

export function createLogStore(repo: LearningRepository, name: string, persistent: boolean, initial: readonly LearningEvent[]): LogStore {
  let events: readonly LearningEvent[] = initial;
  let writes: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  return {
    name,
    persistent,
    getEvents: () => events,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(body) {
      const e = makeEvent(body);
      events = [...events, e];
      // serialised so the stored order is the emitted order
      writes = writes.then(() => repo.append(e)).then(() => undefined, (err) => console.error("[log]", err));
      notify();
      return e;
    },
    async replaceAll(next) {
      await writes;
      await repo.replaceAll(next);
      events = await repo.all();
      notify();
    },
    flush: () => writes,
  };
}

const stores = new Map<string, Promise<LogStore>>();

/** The shared store of a database, opened and loaded once per page. */
export function getLogStore(name: string): Promise<LogStore> {
  let s = stores.get(name);
  if (!s) {
    s = openRepository(name).then(async ({ repo, persistent }) => createLogStore(repo, name, persistent, await repo.all()));
    stores.set(name, s);
  }
  return s;
}
