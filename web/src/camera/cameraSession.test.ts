import { describe, expect, it } from "vitest";
import { CAMERA_STORAGE_KEY, CameraOffError, createCameraStore, failureReason, isUsable, nextCameraState, type CameraChange, type CameraMedia, type KeyValueStorage } from "./cameraSession";

class FakeTrack {
  readyState: "live" | "ended" = "live";
  stop() {
    this.readyState = "ended";
  }
}

function fakeMedia(opts: { fail?: string; hasCamera?: boolean } = {}) {
  const tracks: FakeTrack[] = [];
  const calls = { open: 0, release: 0, stopNow: 0 };
  const media: CameraMedia = {
    async open() {
      calls.open++;
      if (opts.fail) throw Object.assign(new Error(opts.fail), { name: opts.fail });
      const t = new FakeTrack();
      tracks.push(t);
      return { getTracks: () => [t] } as unknown as MediaStream;
    },
    release() {
      calls.release++;
    },
    stopNow() {
      calls.stopNow++;
      tracks.forEach((t) => t.stop());
    },
    async hasCamera() {
      return opts.hasCamera ?? true;
    },
  };
  return { media, tracks, calls };
}

function fakeStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe("camera state machine", () => {
  it("follows SPEC §5.1", () => {
    expect(nextCameraState("unknown", { type: "probed", hasCamera: true })).toBe("available");
    expect(nextCameraState("unknown", { type: "probed", hasCamera: false })).toBe("unavailable");
    expect(nextCameraState("available", { type: "acquired" })).toBe("in-use");
    expect(nextCameraState("in-use", { type: "released" })).toBe("available");
    expect(nextCameraState("in-use", { type: "opt-out" })).toBe("off-this-session");
    expect(nextCameraState("available", { type: "failed", reason: "denied" })).toBe("denied");
    expect(nextCameraState("unknown", { type: "failed", reason: "unavailable" })).toBe("unavailable");
    expect(nextCameraState("unknown", { type: "failed", reason: "error" })).toBe("unavailable");
  });

  it("keeps off states until re-enabled", () => {
    for (const off of ["off-this-session", "denied", "unavailable"] as const) {
      expect(isUsable(off)).toBe(false);
      expect(nextCameraState(off, { type: "acquired" })).toBe(off);
      expect(nextCameraState(off, { type: "probed", hasCamera: true })).toBe(off);
      expect(nextCameraState(off, { type: "reenable" })).toBe("unknown");
    }
    expect(nextCameraState("available", { type: "reenable" })).toBe("available");
  });

  it("maps getUserMedia errors to camera.off reasons", () => {
    expect(failureReason({ name: "NotAllowedError" })).toBe("denied");
    expect(failureReason({ name: "NotFoundError" })).toBe("unavailable");
    expect(failureReason({ name: "OverconstrainedError" })).toBe("unavailable");
    expect(failureReason({ name: "NotReadableError" })).toBe("error");
    expect(failureReason("boom")).toBe("error");
  });
});

describe("camera store", () => {
  it("opt-out stops the tracks at once, persists for the tab and notifies with reason user", async () => {
    const { media, tracks, calls } = fakeMedia();
    const storage = fakeStorage();
    const store = createCameraStore(media, storage);
    const changes: CameraChange[] = [];
    store.subscribe((c) => changes.push(c));

    await store.acquire();
    expect(store.state).toBe("in-use");
    store.optOut();
    expect(tracks.every((t) => t.readyState === "ended")).toBe(true);
    expect(calls.stopNow).toBe(1);
    expect(store.state).toBe("off-this-session");
    expect(store.usable).toBe(false);
    expect(changes.at(-1)).toMatchObject({ state: "off-this-session", reason: "user", event: { type: "opt-out" } });
    expect(JSON.parse(storage.data.get(CAMERA_STORAGE_KEY)!)).toEqual({ state: "off-this-session", reason: "user" });
    await expect(store.acquire()).rejects.toBeInstanceOf(CameraOffError);
  });

  it("restores the opt-out after a reload of the same tab, not in a new tab", () => {
    const storage = fakeStorage();
    createCameraStore(fakeMedia().media, storage).optOut();
    const reloaded = createCameraStore(fakeMedia().media, storage);
    expect(reloaded.state).toBe("off-this-session");
    expect(reloaded.reason).toBe("user");
    const newTab = createCameraStore(fakeMedia().media, fakeStorage());
    expect(newTab.state).toBe("unknown");
    expect(newTab.usable).toBe(true);
  });

  it("records a denied permission and never asks again in the session", async () => {
    const { media, calls } = fakeMedia({ fail: "NotAllowedError" });
    const storage = fakeStorage();
    const store = createCameraStore(media, storage);
    await expect(store.acquire()).rejects.toMatchObject({ name: "NotAllowedError" });
    expect(store.state).toBe("denied");
    expect(store.reason).toBe("denied");
    await expect(store.acquire()).rejects.toBeInstanceOf(CameraOffError);
    expect(calls.open).toBe(1);
    expect(createCameraStore(media, storage).state).toBe("denied");
  });

  it("probes without prompting and does not override a restored state", async () => {
    const none = createCameraStore(fakeMedia({ hasCamera: false }).media, fakeStorage());
    await none.probe();
    expect(none.state).toBe("unavailable");
    expect(none.reason).toBe("unavailable");

    const storage = fakeStorage();
    createCameraStore(fakeMedia().media, storage).optOut();
    const restored = createCameraStore(fakeMedia({ hasCamera: true }).media, storage);
    await restored.probe();
    expect(restored.state).toBe("off-this-session");
  });

  it("goes back to available when the last user releases", async () => {
    const { media, calls } = fakeMedia();
    const store = createCameraStore(media, fakeStorage());
    await store.acquire();
    await store.acquire();
    store.release();
    expect(store.state).toBe("in-use");
    store.release();
    expect(store.state).toBe("available");
    expect(calls.release).toBe(2);
    store.release();
    expect(calls.release).toBe(2);
  });

  it("stops a stream that arrives after an opt-out (prompt still open)", async () => {
    let resolveOpen: (s: MediaStream) => void = () => {};
    const track = new FakeTrack();
    const media: CameraMedia = {
      open: () => new Promise((r) => (resolveOpen = r)),
      release() {},
      stopNow: () => track.stop(),
      hasCamera: async () => true,
    };
    const store = createCameraStore(media, fakeStorage());
    const pending = store.acquire();
    store.optOut();
    resolveOpen({ getTracks: () => [track] } as unknown as MediaStream);
    await expect(pending).rejects.toBeInstanceOf(CameraOffError);
    expect(track.readyState).toBe("ended");
  });

  it("re-enabling clears the persisted state", () => {
    const storage = fakeStorage();
    const store = createCameraStore(fakeMedia().media, storage);
    store.optOut();
    store.reenable();
    expect(store.state).toBe("unknown");
    expect(storage.data.has(CAMERA_STORAGE_KEY)).toBe(false);
  });
});
