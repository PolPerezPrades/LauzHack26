/** Hooks to get the live log of a database once it is loaded. */
import { useEffect, useState } from "react";
import { cameraSession } from "../camera";
import { getLogStore, type LogStore } from "../data/logStore";
import { ensureAppOpen } from "./session";

/** A log to read or manage (dev inspector, sandbox reset). */
export function useLogStore(name: string): LogStore | null {
  const [store, setStore] = useState<LogStore | null>(null);
  useEffect(() => {
    let alive = true;
    getLogStore(name).then((s) => alive && setStore(s));
    return () => {
      alive = false;
    };
  }, [name]);
  return store;
}

/** The log a feed plays into: loaded, camera probed, and `app.open` written before the first card. */
export function useFeedLog(name: string): LogStore | null {
  const [store, setStore] = useState<LogStore | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([getLogStore(name), cameraSession.probe()]).then(([s]) => {
      if (!alive) return;
      ensureAppOpen(s);
      setStore(s);
    });
    return () => {
      alive = false;
    };
  }, [name]);
  return store;
}
