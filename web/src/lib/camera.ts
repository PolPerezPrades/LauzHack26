/**
 * Shared webcam stream + MediaPipe Hand Landmarker (loaded once, reused by every camera activity).
 * Prefers a Logitech MX Brio when one is connected; the choice can be overridden from the UI.
 */
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const PREF_KEY = "signa:camera";
let stream: MediaStream | null = null;
let users = 0;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;

function constraints(deviceId?: string): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      width: { ideal: 1280 },
      height: { ideal: 720 },
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

async function open(): Promise<MediaStream> {
  const saved = preferred();
  if (saved) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints(saved));
    } catch {
      /* saved camera unplugged: fall through */
    }
  }
  let s = await navigator.mediaDevices.getUserMedia(constraints());
  // device labels are only visible after permission is granted, so look for the Brio now
  const cams = await listCameras();
  const brio = cams.find((c) => /brio/i.test(c.label));
  const current = s.getVideoTracks()[0]?.getSettings().deviceId;
  if (brio && brio.deviceId !== current) {
    s.getTracks().forEach((t) => t.stop());
    s = await navigator.mediaDevices.getUserMedia(constraints(brio.deviceId));
  }
  return s;
}

export async function listCameras() {
  return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
}

export async function acquireCamera(): Promise<MediaStream> {
  clearTimeout(releaseTimer);
  users++;
  if (!stream || stream.getVideoTracks().every((t) => t.readyState === "ended")) stream = await open();
  return stream;
}

/** Release after a short delay so consecutive camera exercises reuse the same stream. */
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

export async function switchCamera(deviceId: string): Promise<MediaStream> {
  try {
    localStorage.setItem(PREF_KEY, deviceId);
  } catch {
    /* ignore */
  }
  stream?.getTracks().forEach((t) => t.stop());
  stream = await navigator.mediaDevices.getUserMedia(constraints(deviceId));
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
