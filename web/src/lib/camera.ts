/**
 * Shared camera stream + MediaPipe Hand Landmarker (loaded once, reused by every camera task).
 * Always used behind the camera session gate (camera/cameraSession.ts), never directly by tasks.
 *
 * Which camera (SPEC §5.6): a camera the learner picked by hand comes first on any device. Then,
 * on phones and tablets, the front (selfie) camera (`facingMode: "user"`, ideal constraint), falling
 * back to any camera; on desktop, the webcam: a Logitech MX Brio if one is connected, else the
 * browser default. Phones get smaller frames (battery, heat).
 */
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { isHandheld } from "./env";

const PREF_KEY = "signa:camera";
let stream: MediaStream | null = null;
let users = 0;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;

interface Want { deviceId?: string; frontFacing?: boolean; handheld: boolean }

export function cameraConstraints({ deviceId, frontFacing, handheld }: Want): MediaStreamConstraints {
  const size = handheld
    ? { width: { ideal: 640, max: 1280 }, height: { ideal: 480, max: 720 } }
    : { width: { ideal: 1280 }, height: { ideal: 720 } };
  return {
    audio: false,
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      ...(frontFacing ? { facingMode: { ideal: "user" } } : {}),
      ...size,
      frameRate: { ideal: 30 },
    },
  };
}

function preferred(): string | null {
  try {
    return localStorage.getItem(PREF_KEY);
  } catch {
    return null;
  }
}

/** Permission problems must surface at once: retrying with other constraints would prompt again. */
const isPermissionError = (e: unknown) => e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");

function getUserMedia(c: MediaStreamConstraints) {
  if (!navigator.mediaDevices?.getUserMedia) {
    // insecure context (plain http on a LAN address) or an embedding host without camera support
    return Promise.reject(new DOMException("getUserMedia is not available", "NotFoundError"));
  }
  return navigator.mediaDevices.getUserMedia(c);
}

async function open(): Promise<MediaStream> {
  const handheld = isHandheld();
  const saved = preferred();
  if (saved) {
    try {
      return await getUserMedia(cameraConstraints({ deviceId: saved, handheld }));
    } catch (e) {
      if (isPermissionError(e)) throw e;
      /* saved camera unplugged: fall through */
    }
  }
  if (handheld) {
    try {
      return await getUserMedia(cameraConstraints({ frontFacing: true, handheld }));
    } catch (e) {
      if (isPermissionError(e)) throw e;
      return await getUserMedia({ audio: false, video: true });
    }
  }
  let s = await getUserMedia(cameraConstraints({ handheld }));
  // device labels are only visible after permission is granted, so look for the Brio now
  const cams = await listCameras();
  const brio = cams.find((c) => /brio/i.test(c.label));
  const current = s.getVideoTracks()[0]?.getSettings().deviceId;
  if (brio && brio.deviceId !== current) {
    s.getTracks().forEach((t) => t.stop());
    s = await getUserMedia(cameraConstraints({ deviceId: brio.deviceId, handheld }));
  }
  return s;
}

export async function listCameras() {
  return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
}

/** Whether a camera seems to exist, without asking for permission. */
export async function hasCamera(): Promise<boolean> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return false;
    return (await listCameras()).length > 0;
  } catch {
    return false;
  }
}

let opening: Promise<MediaStream> | null = null;

export async function acquireCamera(): Promise<MediaStream> {
  clearTimeout(releaseTimer);
  users++;
  try {
    if (!stream || stream.getVideoTracks().every((t) => t.readyState === "ended")) {
      // concurrent callers (two views mounting, React StrictMode) share one request: two separate
      // streams would leave one of them running after the other is stopped
      opening ??= open().finally(() => (opening = null));
      stream = await opening;
    }
  } catch (e) {
    users = Math.max(0, users - 1);
    throw e;
  }
  return stream;
}

/** Release after a short delay so consecutive camera tasks reuse the same stream. */
export function releaseCamera() {
  users = Math.max(0, users - 1);
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    if (users === 0 && stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }, 4000);
}

/** Stops every track now (camera opt-out): the browser's camera indicator turns off at once. */
export function stopCameraNow() {
  clearTimeout(releaseTimer);
  users = 0;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

export async function switchCamera(deviceId: string): Promise<MediaStream> {
  try {
    localStorage.setItem(PREF_KEY, deviceId);
  } catch {
    /* ignore */
  }
  stream?.getTracks().forEach((t) => t.stop());
  stream = await getUserMedia(cameraConstraints({ deviceId, handheld: isHandheld() }));
  return stream;
}

export function currentDeviceId() {
  return stream?.getVideoTracks()[0]?.getSettings().deviceId;
}

let landmarker: Promise<HandLandmarker> | null = null;
export function getHandLandmarker(): Promise<HandLandmarker> {
  landmarker ??= (async () => {
    const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    const make = (delegate: "GPU" | "CPU") =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "/mediapipe/hand_landmarker.task", delegate },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    try {
      return await make("GPU");
    } catch {
      return await make("CPU");
    }
  })();
  landmarker.catch(() => (landmarker = null));
  return landmarker;
}

export const HAND_CONNECTIONS = HandLandmarker.HAND_CONNECTIONS;
