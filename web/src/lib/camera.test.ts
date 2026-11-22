import { afterEach, describe, expect, it, vi } from "vitest";

// camera.ts also loads the hand landmarker; these tests only exercise the camera choice
vi.mock("@mediapipe/tasks-vision", () => ({ FilesetResolver: {}, HandLandmarker: { HAND_CONNECTIONS: [] } }));

const PTZ_KEYS = ["pan", "tilt", "zoom"];
// Chrome 157 on Linux, MX Brio, once PTZ access is granted
const BRIO_CAPS = {
  pan: { min: -72000, max: 72000, step: 3600 },
  tilt: { min: -72000, max: 72000, step: 3600 },
  zoom: { min: 100, max: 400, step: 1 },
};

interface FakeCam {
  deviceId: string;
  label: string;
  /** the device has pan, tilt and zoom controls */
  ptz: boolean;
  state: { zoom: number; pan: number; tilt: number };
}

interface Options {
  /** the camera picked by hand earlier (localStorage) */
  saved?: string;
  /** the browser's default camera */
  defaultId?: string;
  /** the camera permission was granted on an earlier visit, so labels show before opening */
  labelsBeforeGrant?: boolean;
  /** Chrome supports PTZ constraints; Firefox doesn't */
  ptzSupported?: boolean;
  /** the PTZ permission was granted on an earlier visit */
  ptzGranted?: boolean;
  /** the answer to Chrome's "use and move your camera" prompt */
  answer?: "allow" | "block" | "reject";
  applyHangs?: boolean;
  userAgent?: string;
}

/**
 * A fake browser media layer that behaves like Chrome 157 (measured on the MX Brio): PTZ
 * capabilities and settings appear only when the origin has the PTZ permission, whether or not the
 * request asked for it; a request that names pan, tilt or zoom prompts for that permission.
 */
function setup(o: Options = {}) {
  const integrated: FakeCam = { deviceId: "int", label: "Integrated Camera", ptz: false, state: { zoom: 0, pan: 0, tilt: 0 } };
  const brio: FakeCam = { deviceId: "brio", label: "MX Brio", ptz: true, state: { zoom: 300, pan: 3600, tilt: 10800 } };
  const cams = [integrated, brio];
  let cameraGranted = o.labelsBeforeGrant ?? true;
  let ptzGranted = o.ptzGranted ?? false;
  const requests: { deviceId: string; video: Record<string, unknown> }[] = [];
  const applied: { deviceId: string; constraints: MediaTrackConstraints }[] = [];
  const live = new Set<string>();

  function open(cam: FakeCam, video: Record<string, unknown>): MediaStream {
    const ptzAllowed = cam.ptz && ptzGranted;
    let constraints: MediaTrackConstraints = { ...video };
    const id = `${cam.deviceId}#${requests.length}`;
    live.add(id);
    const track = {
      kind: "video",
      label: cam.label,
      id,
      get readyState() {
        return live.has(id) ? "live" : "ended";
      },
      stop: () => live.delete(id),
      getSettings: () => ({ deviceId: cam.deviceId, width: 1280, height: 720, frameRate: 30, ...(ptzAllowed ? cam.state : {}) }),
      getCapabilities: () => (ptzAllowed ? BRIO_CAPS : {}),
      getConstraints: () => constraints,
      applyConstraints(c: MediaTrackConstraints) {
        applied.push({ deviceId: cam.deviceId, constraints: c });
        if (o.applyHangs) return new Promise<void>(() => {});
        if (!ptzAllowed) return Promise.reject(new DOMException("PTZ not allowed", "NotAllowedError"));
        Object.assign(cam.state, c.advanced?.[0]);
        constraints = c;
        return Promise.resolve();
      },
    };
    return { getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
  }

  const mediaDevices = {
    async getUserMedia(c: MediaStreamConstraints) {
      const video = (typeof c.video === "object" ? c.video : {}) as Record<string, unknown>;
      const wanted = (video.deviceId as { exact?: string } | undefined)?.exact ?? o.defaultId ?? "int";
      const cam = cams.find((x) => x.deviceId === wanted);
      if (!cam) throw new DOMException("no such camera", "OverconstrainedError");
      requests.push({ deviceId: cam.deviceId, video });
      cameraGranted = true;
      if (cam.ptz && !ptzGranted && PTZ_KEYS.some((k) => k in video)) {
        const answer = o.answer ?? "allow";
        if (answer === "reject") throw new DOMException("Permission denied", "NotAllowedError");
        if (answer === "allow") ptzGranted = true;
      }
      return open(cam, video);
    },
    async enumerateDevices() {
      return cams.map((x) => ({ kind: "videoinput", deviceId: x.deviceId, groupId: "", label: cameraGranted ? x.label : "" }));
    },
    getSupportedConstraints: () => ({ deviceId: true, width: true, height: true, ...(o.ptzSupported === false ? {} : { pan: true, tilt: true, zoom: true }) }),
  };

  const store = new Map<string, string>(o.saved ? [["signa:camera", o.saved]] : []);
  vi.stubGlobal("navigator", { mediaDevices, maxTouchPoints: 0, userAgent: o.userAgent ?? "Mozilla/5.0 (X11; Linux x86_64)" });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  const asksPtz = (i: number) => PTZ_KEYS.some((k) => k in requests[i].video);
  return { integrated, brio, requests, applied, live, asksPtz };
}

/** camera.ts keeps the shared stream in module state: load a fresh copy per test. */
async function load() {
  vi.resetModules();
  return import("./camera");
}

const trackOf = (s: MediaStream) => s.getVideoTracks()[0];

describe("lib/camera: MX Brio defaults (Part A3)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("opens a saved MX Brio asking for PTZ, and resets its zoom, pan and tilt", async () => {
    const m = setup({ saved: "brio" });
    const s = await (await load()).acquireCamera();
    expect(trackOf(s).label).toBe("MX Brio");
    expect(m.requests.map((r) => r.deviceId)).toEqual(["brio"]);
    expect(m.requests[0].video).toMatchObject({ pan: true, tilt: true, zoom: true });
    expect(m.brio.state).toEqual({ zoom: 100, pan: 0, tilt: 0 });
    // the size and frame rate are kept, and the request's PTZ flags are not sent again
    expect(m.applied).toHaveLength(1);
    expect(m.applied[0].constraints).toMatchObject({ width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, advanced: [{ zoom: 100, pan: 0, tilt: 0 }] });
    expect(m.applied[0].constraints).not.toHaveProperty("zoom");
  });

  it("finds the Brio after the default camera, and asks only the Brio for PTZ", async () => {
    const m = setup();
    const s = await (await load()).acquireCamera();
    expect(m.requests.map((r) => r.deviceId)).toEqual(["int", "brio"]);
    expect(m.asksPtz(0)).toBe(false);
    expect(m.asksPtz(1)).toBe(true);
    expect(trackOf(s).label).toBe("MX Brio");
    expect([...m.live]).toEqual([trackOf(s).id]); // the default camera was stopped
    expect(m.brio.state).toEqual({ zoom: 100, pan: 0, tilt: 0 });
  });

  it("opens a Brio it could not recognise once more, asking for PTZ (no labels before the first grant)", async () => {
    const m = setup({ saved: "brio", labelsBeforeGrant: false });
    const s = await (await load()).acquireCamera();
    expect(m.requests.map((r) => r.deviceId)).toEqual(["brio", "brio"]);
    expect(m.asksPtz(0)).toBe(false);
    expect(m.asksPtz(1)).toBe(true);
    expect([...m.live]).toEqual([trackOf(s).id]); // the first Brio stream was stopped
    expect(m.brio.state).toEqual({ zoom: 100, pan: 0, tilt: 0 });
  });

  it("resets a default-camera Brio without opening it again once PTZ was granted on an earlier visit", async () => {
    const m = setup({ defaultId: "brio", labelsBeforeGrant: false, ptzGranted: true });
    await (await load()).acquireCamera();
    expect(m.requests.map((r) => r.deviceId)).toEqual(["brio"]);
    expect(m.brio.state).toEqual({ zoom: 100, pan: 0, tilt: 0 });
  });

  it("never sends a PTZ request to another camera, even one that has PTZ", async () => {
    const m = setup({ saved: "int", ptzGranted: true });
    m.integrated.ptz = true;
    m.integrated.state = { zoom: 200, pan: 3600, tilt: 0 };
    const s = await (await load()).acquireCamera();
    expect(trackOf(s).label).toBe("Integrated Camera");
    expect(m.requests.map((r) => r.deviceId)).toEqual(["int"]);
    expect(m.asksPtz(0)).toBe(false);
    expect(m.applied).toEqual([]);
    expect(m.integrated.state).toEqual({ zoom: 200, pan: 3600, tilt: 0 });
  });

  it("asks a phone's front camera for no PTZ", async () => {
    const m = setup({ userAgent: "Mozilla/5.0 (Linux; Android 15) Mobile" });
    await (await load()).acquireCamera();
    expect(m.requests).toHaveLength(1);
    expect(m.requests[0].video).toMatchObject({ facingMode: { ideal: "user" } });
    expect(m.asksPtz(0)).toBe(false);
    expect(m.applied).toEqual([]);
  });

  it("skips the reset without an error where the browser has no PTZ (Firefox)", async () => {
    for (const labelsBeforeGrant of [true, false]) {
      const m = setup({ saved: "brio", ptzSupported: false, labelsBeforeGrant });
      const s = await (await load()).acquireCamera();
      expect(trackOf(s).label).toBe("MX Brio");
      expect(m.requests).toHaveLength(1);
      expect(m.asksPtz(0)).toBe(false);
      expect(m.applied).toEqual([]);
      expect(m.brio.state).toEqual({ zoom: 300, pan: 3600, tilt: 10800 });
      vi.unstubAllGlobals();
    }
  });

  it("keeps the camera working when the PTZ prompt is refused", async () => {
    // blocked: Chrome opens the camera without PTZ
    const blocked = setup({ saved: "brio", answer: "block" });
    expect(trackOf(await (await load()).acquireCamera()).label).toBe("MX Brio");
    expect(blocked.requests).toHaveLength(1);
    expect(blocked.applied).toEqual([]);
    vi.unstubAllGlobals();
    // rejected: the request fails, so the Brio is opened again without asking
    const rejected = setup({ saved: "brio", answer: "reject" });
    expect(trackOf(await (await load()).acquireCamera()).label).toBe("MX Brio");
    expect(rejected.requests.map((r) => r.deviceId)).toEqual(["brio", "brio"]);
    expect(rejected.asksPtz(1)).toBe(false);
    expect(rejected.applied).toEqual([]);
  });

  it("leaves a Brio that is already at its defaults alone", async () => {
    const m = setup({ saved: "brio", ptzGranted: true });
    m.brio.state = { zoom: 100, pan: 0, tilt: 0 };
    await (await load()).acquireCamera();
    expect(m.applied).toEqual([]);
  });

  it("holds the preview back at most 1.5 s for a reset that never finishes", async () => {
    vi.useFakeTimers();
    setup({ saved: "brio", ptzGranted: true, applyHangs: true });
    const { acquireCamera } = await load();
    let opened = false;
    const p = acquireCamera().then((s) => ((opened = true), s));
    await vi.advanceTimersByTimeAsync(1000);
    expect(opened).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(opened).toBe(true);
    expect(trackOf(await p).label).toBe("MX Brio");
  });

  it("resets the Brio when the learner switches to it, and sends the other camera no PTZ", async () => {
    const m = setup({ saved: "int" });
    const { acquireCamera, switchCamera } = await load();
    await acquireCamera();
    expect(trackOf(await switchCamera("brio")).label).toBe("MX Brio");
    expect(m.brio.state).toEqual({ zoom: 100, pan: 0, tilt: 0 });
    await switchCamera("int");
    expect(m.requests.map((r) => r.deviceId)).toEqual(["int", "brio", "int"]);
    expect([m.asksPtz(0), m.asksPtz(1), m.asksPtz(2)]).toEqual([false, true, false]);
    expect(m.applied.map((a) => a.deviceId)).toEqual(["brio"]);
  });
});
