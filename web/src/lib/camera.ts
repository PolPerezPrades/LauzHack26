/**
 * Shared camera stream + MediaPipe Hand Landmarker (loaded once, reused by every camera task).
 * Always used behind the camera session gate (camera/cameraSession.ts), never directly by tasks.
 *
 * Which camera (SPEC §5.6): a camera the learner picked by hand comes first on any device. Then,
 * on phones and tablets, the front (selfie) camera (`facingMode: "user"`, ideal constraint), falling
 * back to any camera; on desktop, the webcam: a Logitech MX Brio if one is connected, else the
 * browser default. Phones get smaller frames (battery, heat).
 *
 * MX Brio defaults (Part A3): whichever way an MX Brio is opened, its zoom, pan and tilt go back to
 * the device defaults before the stream is handed out (cameraDefaults.ts). PTZ access is asked for
 * only when the camera is known to be an MX Brio: from its label before opening when the browser
 * already shows labels, else by opening it once more after its label is seen. Any other camera is
 * opened exactly as asked and never gets a PTZ request.
 */
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { brioReset, exposesPtz, isMxBrio, ptzRequest, type PtzCapabilities, type PtzControl, type PtzRequest, type PtzSettings } from "./cameraDefaults";
import { isHandheld } from "./env";

const PREF_KEY = "signa:camera";
/** The longest the Brio reset may hold back the preview: a slow device must never block the camera. */
const RESET_WAIT_MS = 1500;
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

/** The same request with more video constraints. */
function withVideo(c: MediaStreamConstraints, extra: MediaTrackConstraints | PtzRequest): MediaStreamConstraints {
  return { ...c, video: { ...(typeof c.video === "object" ? c.video : {}), ...extra } };
}

const stopTracks = (s: MediaStream) => s.getTracks().forEach((t) => t.stop());

/** Older Firefox has no getCapabilities(); browsers without PTZ simply report none. */
const capabilitiesOf = (t: MediaStreamTrack): PtzCapabilities => (typeof t.getCapabilities === "function" ? (t.getCapabilities() as PtzCapabilities) : {});

function supportedPtz(): PtzRequest | null {
  try {
    return ptzRequest((navigator.mediaDevices?.getSupportedConstraints?.() ?? {}) as { [K in PtzControl]?: boolean });
  } catch {
    return null;
  }
}

/** Whether `deviceId` is an MX Brio, as far as the labels tell before opening (they only show after a grant). */
async function isMxBrioDevice(deviceId: string): Promise<boolean> {
  try {
    return (await listCameras()).some((d) => d.deviceId === deviceId && isMxBrio(d.label));
  } catch {
    return false;
  }
}

/** The request, also asking for PTZ access; null where the browser has no PTZ, or if the request fails. */
async function askingPtz(c: MediaStreamConstraints): Promise<MediaStream | null> {
  const ptz = supportedPtz();
  if (!ptz) return null;
  try {
    return await getUserMedia(withVideo(c, ptz));
  } catch {
    return null; // PTZ refused or unavailable: the camera opens as usual, without the reset
  }
}

/** getUserMedia, then the MX Brio defaults. `brio`: the camera is known to be an MX Brio before opening. */
async function openCamera(c: MediaStreamConstraints, brio = false): Promise<MediaStream> {
  const s = (brio ? await askingPtz(c) : null) ?? (await getUserMedia(c));
  return withBrioDefaults(s, c, brio);
}

/**
 * Resets an MX Brio that was just opened with `c`, and returns the stream to use. Any other camera
 * comes back untouched. `askedPtz`: the request already asked for PTZ access.
 */
async function withBrioDefaults(opened: MediaStream, c: MediaStreamConstraints, askedPtz: boolean): Promise<MediaStream> {
  let s = opened;
  const track = s.getVideoTracks()[0];
  if (!track || !isMxBrio(track.label)) return s;
  const deviceId = track.getSettings().deviceId;
  if (!askedPtz && deviceId && !exposesPtz(capabilitiesOf(track))) {
    // an MX Brio we couldn't recognise before opening it: PTZ only shows once asked for, so open it
    // once more, asking (one PTZ prompt in Chrome), and keep the first stream if that fails
    const again = await askingPtz(withVideo(c, { deviceId: { exact: deviceId } }));
    if (again) {
      stopTracks(s);
      s = again;
    }
  }
  await resetToDefaults(s.getVideoTracks()[0]);
  return s;
}

/** Moves an MX Brio back to its default framing. Skipped, without an error, where no PTZ is exposed. */
async function resetToDefaults(track: MediaStreamTrack | undefined) {
  if (!track) return;
  const reset = brioReset(track.label, capabilitiesOf(track), track.getSettings() as PtzSettings);
  if (!reset) return;
  // applyConstraints replaces every constraint of the track, so keep the size and frame rate
  const { pan: _pan, tilt: _tilt, zoom: _zoom, ...keep } = track.getConstraints() as MediaTrackConstraints & PtzRequest;
  const applied = track.applyConstraints({ ...keep, advanced: [reset as MediaTrackConstraintSet] }).catch(() => {
    /* the camera refused the move: it stays as it is */
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([applied, new Promise<void>((done) => (timer = setTimeout(done, RESET_WAIT_MS)))]);
  clearTimeout(timer);
}

async function open(): Promise<MediaStream> {
  const handheld = isHandheld();
  const saved = preferred();
  if (saved) {
    try {
      return await openCamera(cameraConstraints({ deviceId: saved, handheld }), await isMxBrioDevice(saved));
    } catch (e) {
      if (isPermissionError(e)) throw e;
      /* saved camera unplugged: fall through */
    }
  }
  if (handheld) {
    try {
      return await openCamera(cameraConstraints({ frontFacing: true, handheld }));
    } catch (e) {
      if (isPermissionError(e)) throw e;
      return await openCamera({ audio: false, video: true });
    }
  }
  const plain = cameraConstraints({ handheld });
  const s = await getUserMedia(plain);
  // device labels are only visible after permission is granted, so look for the Brio now
  const cams = await listCameras();
  const brio = cams.find((c) => /brio/i.test(c.label));
  const current = s.getVideoTracks()[0]?.getSettings().deviceId;
  if (brio && brio.deviceId !== current) {
    stopTracks(s);
    return openCamera(cameraConstraints({ deviceId: brio.deviceId, handheld }), isMxBrio(brio.label));
  }
  return withBrioDefaults(s, plain, false);
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
  const brio = await isMxBrioDevice(deviceId);
  if (stream) stopTracks(stream);
  stream = await openCamera(cameraConstraints({ deviceId, handheld: isHandheld() }), brio);
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
