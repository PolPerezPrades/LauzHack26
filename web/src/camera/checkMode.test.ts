import { describe, expect, it } from "vitest";
import { checkModeFor, isSelfGraded } from "./checkMode";

describe("checkModeFor", () => {
  it("lets the camera check static letters when it is usable", () => {
    for (const id of ["L-A", "L-M", "L-Y"]) expect(checkModeFor(id, "productive", true)).toBe("camera");
  });

  it("falls back to the mirror for anything without detector rules", () => {
    // letters with movement, words, phrases, and numbers (until Part E adds their rules)
    for (const id of ["L-J", "L-Z", "w-hello", "ph-name", "num-3"]) expect(checkModeFor(id, "productive", true)).toBe("mirror");
  });

  it("uses self-grading for every item when the camera isn't usable", () => {
    for (const id of ["L-A", "L-J", "w-hello", "ph-name", "num-3"]) expect(checkModeFor(id, "productive", false)).toBe("self");
  });

  it("never sends receptive skills to the camera", () => {
    expect(checkModeFor("L-A", "receptive", true)).toBe("self");
  });

  it("ignores unknown ids", () => {
    expect(checkModeFor("L-AA", "productive", true)).toBe("mirror");
    expect(checkModeFor("nope", "productive", true)).toBe("mirror");
  });

  it("marks mirror and self as self-graded", () => {
    expect(isSelfGraded("camera")).toBe(false);
    expect(isSelfGraded("mirror")).toBe(true);
    expect(isSelfGraded("self")).toBe(true);
  });
});
