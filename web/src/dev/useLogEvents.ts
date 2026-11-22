/** The live events of a log store for a component (empty while the store loads). */
import { useSyncExternalStore } from "react";
import type { LearningEvent } from "../data/events";
import type { LogStore } from "../data/logStore";

const NONE: readonly LearningEvent[] = [];
const noSubscribe = () => () => {};
const noEvents = () => NONE;

export function useLogEvents(store: LogStore | null): readonly LearningEvent[] {
  return useSyncExternalStore(store ? store.subscribe : noSubscribe, store ? store.getEvents : noEvents);
}
