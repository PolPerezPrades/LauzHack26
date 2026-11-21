/**
 * Camera session state (SPEC §5): one store that everything uses to decide whether the camera may
 * be used in this app session.
 *
 *   unknown → available (a camera exists; permission granted or not asked yet) ⇄ in-use
 *   any usable state → off-this-session ("can't use the camera now") | denied | unavailable
 *
 * Off states are sticky for the app session: kept in memory and in sessionStorage, so a reload of
 * the same tab keeps them while a new tab or app launch starts clean. Only `reenable()` (dev mode
 * now, the settings sheet in Part F) leaves them. The media layer and the storage are injected, so
 * this module stays testable in Node.
 */
import type { CameraOffReason, CameraSession, CameraState } from "../core/types";

export type CameraEvent =
  | { type: "probed"; hasCamera: boolean }
  | { type: "acquired" }
  | { type: "released" }
  | { type: "opt-out" }
  | { type: "failed"; reason: Exclude<CameraOffReason, "user"> }
  | { type: "reenable" };

export const isUsable = (s: CameraState) => s === "unknown" || s === "available" || s === "in-use";

/** Pure transition function. Events that don't apply to the current state leave it unchanged. */
export function nextCameraState(s: CameraState, e: CameraEvent): CameraState {
  switch (e.type) {
    case "probed":
      return s === "unknown" ? (e.hasCamera ? "available" : "unavailable") : s;
    case "acquired":
      return isUsable(s) ? "in-use" : s;
    case "released":
      return s === "in-use" ? "available" : s;
    case "opt-out":
      return isUsable(s) ? "off-this-session" : s;
    case "failed":
      return isUsable(s) ? (e.reason === "denied" ? "denied" : "unavailable") : s;
    case "reenable":
      return isUsable(s) ? s : "unknown";
  }
}

/** Maps a getUserMedia failure to the reason logged in `camera.off`. */
export function failureReason(err: unknown): Exclude<CameraOffReason, "user"> {
  const name = typeof err === "object" && err !== null && "name" in err ? String((err as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "unavailable";
  return "error";
}

/** Thrown by `acquire()` when the camera is off for this session. */
export class CameraOffError extends Error {
  readonly state: CameraState;
  constructor(state: CameraState) {
    super(`camera not usable (${state})`);
    this.name = "CameraOffError";
    this.state = state;
  }
}

export interface CameraMedia {
  open(): Promise<MediaStream>;
  /** delayed release of the shared stream */
  release(): void;
  /** stop every track immediately */
  stopNow(): void;
  hasCamera(): Promise<boolean>;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CameraChange {
  prev: CameraState;
  state: CameraState;
  event: CameraEvent;
  /** why the camera is off (null while usable) */
  reason: CameraOffReason | null;
}

export interface CameraStore extends CameraSession {
  readonly reason: CameraOffReason | null;
  getState(): CameraState;
  subscribe(listener: (change: CameraChange) => void): () => void;
  /** Checks once, without a permission prompt, whether a camera exists. */
  probe(): Promise<void>;
  /** Leaves an off state for the rest of this session. */
  reenable(): void;
}

export const CAMERA_STORAGE_KEY = "signa:camera-session";
const OFF_STATES: CameraState[] = ["off-this-session", "denied", "unavailable"];
const REASONS: CameraOffReason[] = ["user", "denied", "unavailable", "error"];

function restore(storage: KeyValueStorage | null): { state: CameraState; reason: CameraOffReason | null } {
  try {
    const raw = storage?.getItem(CAMERA_STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as { state?: unknown; reason?: unknown }) : null;
    if (saved && OFF_STATES.includes(saved.state as CameraState) && REASONS.includes(saved.reason as CameraOffReason)) {
      return { state: saved.state as CameraState, reason: saved.reason as CameraOffReason };
    }
  } catch {
    /* unreadable: start clean */
  }
  return { state: "unknown", reason: null };
}

export function createCameraStore(media: CameraMedia, storage: KeyValueStorage | null): CameraStore {
  let { state, reason } = restore(storage);
  let users = 0;
  const listeners = new Set<(c: CameraChange) => void>();

  const write = (fn: () => void) => {
    try {
      fn();
    } catch {
      /* storage blocked: the state still lasts for this page */
    }
  };

  function dispatch(event: CameraEvent, offReason: CameraOffReason | null = null) {
    const prev = state;
    const next = nextCameraState(state, event);
    if (next === prev) return;
    state = next;
    reason = isUsable(next) ? null : offReason;
    // user and failure states outlive a reload; "no camera found" is simply probed again
    if (event.type === "opt-out" || event.type === "failed") write(() => storage?.setItem(CAMERA_STORAGE_KEY, JSON.stringify({ state, reason })));
    if (event.type === "reenable") write(() => storage?.removeItem(CAMERA_STORAGE_KEY));
    const change: CameraChange = { prev, state, event, reason };
    listeners.forEach((l) => l(change));
  }

  return {
    get state() {
      return state;
    },
    get usable() {
      return isUsable(state);
    },
    get reason() {
      return reason;
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async probe() {
      if (state !== "unknown") return;
      const found = await media.hasCamera();
      dispatch({ type: "probed", hasCamera: found }, found ? null : "unavailable");
    },
    async acquire() {
      if (!isUsable(state)) throw new CameraOffError(state);
      let stream: MediaStream;
      try {
        stream = await media.open();
      } catch (err) {
        const r = failureReason(err);
        dispatch({ type: "failed", reason: r }, r);
        throw err;
      }
      if (!isUsable(state)) {
        // the learner opted out while the permission prompt was open
        media.stopNow();
        throw new CameraOffError(state);
      }
      users++;
      dispatch({ type: "acquired" });
      return stream;
    },
    release() {
      if (users === 0) return;
      users--;
      media.release();
      if (users === 0) dispatch({ type: "released" });
    },
    optOut() {
      users = 0;
      media.stopNow();
      dispatch({ type: "opt-out" }, "user");
    },
    reenable() {
      dispatch({ type: "reenable" });
    },
  };
}
