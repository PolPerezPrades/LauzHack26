/**
 * The app's single camera session, wired to the real media layer (lib/camera.ts) and to the tab's
 * sessionStorage, plus a React hook to follow its state.
 */
import { useSyncExternalStore } from "react";
import type { CameraState } from "../core/types";
import { acquireCamera, hasCamera, releaseCamera, stopCameraNow } from "../lib/camera";
import { createCameraStore, type KeyValueStorage } from "./cameraSession";

function tabStorage(): KeyValueStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export const cameraSession = createCameraStore(
  { open: acquireCamera, release: releaseCamera, stopNow: stopCameraNow, hasCamera },
  tabStorage(),
);

const subscribe = (onChange: () => void) => cameraSession.subscribe(onChange);

export function useCameraState(): CameraState {
  return useSyncExternalStore(subscribe, cameraSession.getState);
}
