/**
 * App session: one id per launch. It lives in sessionStorage, so a reload of the same tab stays in
 * the same session (like the camera opt-out, D-008) while a new tab or app start begins a new one.
 */
import { cameraSession } from "../camera";
import { newId } from "../core/ids";
import type { LogStore } from "../data/logStore";
import { deviceKind } from "../lib/env";
import { APP_VERSION } from "./version";

const KEY = "signa:session";

function loadSessionId(): string {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) return saved;
    const id = newId();
    sessionStorage.setItem(KEY, id);
    return id;
  } catch {
    return newId();
  }
}

export const SESSION_ID = loadSessionId();

/** Logs `app.open` once per session in this log (call after the camera probe). */
export function ensureAppOpen(log: LogStore) {
  if (log.getEvents().some((e) => e.type === "app.open" && e.sessionId === SESSION_ID)) return;
  log.emit({ type: "app.open", sessionId: SESSION_ID, device: deviceKind(), cameraAvailable: cameraSession.usable, appVersion: APP_VERSION });
}
