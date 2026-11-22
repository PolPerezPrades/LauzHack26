import { describe, expect, it } from "vitest";
import { brioReset, exposesPtz, isMxBrio, ptzRequest } from "./cameraDefaults";

// what Chrome 157 reports for the MX Brio on Linux once PTZ access is granted (raw V4L2 units)
const BRIO_PTZ = {
  pan: { min: -72000, max: 72000, step: 3600 },
  tilt: { min: -72000, max: 72000, step: 3600 },
  zoom: { min: 100, max: 400, step: 1 },
};

describe("isMxBrio", () => {
  it("matches the MX Brio's labels", () => {
    for (const label of ["MX Brio", "Logitech MX Brio", "MX BRIO (046d:0944)", "mx_brio"]) expect(isMxBrio(label)).toBe(true);
  });

  it("does not match other cameras, other Brio models or a hidden label", () => {
    for (const label of ["Integrated Camera", "Logitech BRIO (046d:085e)", "Brio 500", "OBSBOT Tiny 2", "", undefined]) expect(isMxBrio(label)).toBe(false);
  });
});

describe("ptzRequest", () => {
  it("asks for every PTZ control Chrome supports, without values", () => {
    expect(ptzRequest({ pan: true, tilt: true, zoom: true })).toEqual({ pan: true, tilt: true, zoom: true });
  });

  it("asks only for the supported controls", () => {
    expect(ptzRequest({ zoom: true, pan: false })).toEqual({ zoom: true });
  });

  it("is null where the browser has no PTZ (Firefox)", () => {
    expect(ptzRequest({})).toBeNull();
  });
});

describe("exposesPtz", () => {
  it("is true once PTZ access is granted", () => {
    expect(exposesPtz(BRIO_PTZ)).toBe(true);
    expect(exposesPtz({ zoom: BRIO_PTZ.zoom })).toBe(true);
  });

  it("is false without PTZ capabilities or with ranges that can't move", () => {
    expect(exposesPtz({})).toBe(false);
    expect(exposesPtz({ zoom: { min: 100, max: 100 } })).toBe(false);
    expect(exposesPtz({ pan: { min: Number.NaN, max: 10 } })).toBe(false);
  });
});

describe("brioReset", () => {
  it("resets a Brio with PTZ: zoom to its minimum, pan and tilt to 0", () => {
    expect(brioReset("MX Brio", BRIO_PTZ)).toEqual({ zoom: 100, pan: 0, tilt: 0 });
    expect(brioReset("MX Brio", BRIO_PTZ, { zoom: 300, pan: 3600, tilt: 10800 })).toEqual({ zoom: 100, pan: 0, tilt: 0 });
  });

  it("only sends the controls that are out of place", () => {
    expect(brioReset("MX Brio", BRIO_PTZ, { zoom: 300, pan: 0, tilt: 0 })).toEqual({ zoom: 100 });
    expect(brioReset("MX Brio", BRIO_PTZ, { zoom: 100, pan: 0, tilt: 0 })).toBeNull();
  });

  it("resets only the controls the browser exposes", () => {
    expect(brioReset("MX Brio", { zoom: { min: 1, max: 4, step: 0.1 } }, { zoom: 2.5 })).toEqual({ zoom: 1 });
  });

  it("keeps pan and tilt inside their range", () => {
    expect(brioReset("MX Brio", { pan: { min: 10, max: 20 }, tilt: { min: -20, max: -5 } })).toEqual({ pan: 10, tilt: -5 });
  });

  it("does nothing for a Brio without PTZ (no permission, or Firefox)", () => {
    expect(brioReset("MX Brio", {}, { zoom: 300 })).toBeNull();
  });

  it("never touches another camera, even one with PTZ", () => {
    expect(brioReset("Integrated Camera", BRIO_PTZ, { zoom: 300 })).toBeNull();
    expect(brioReset("OBSBOT Tiny 2", BRIO_PTZ, { zoom: 300 })).toBeNull();
  });
});
