import { describe, expect, it } from "vitest";
import { DIR_FOR_EXIT, EXIT_FOR_DIR, decideSwipe, dragProgress, releaseVelocity, rubberBand, type SwipeRelease } from "./swipe";

const card = { width: 400, height: 700 };
const rel = (p: Partial<SwipeRelease>): SwipeRelease => ({ dx: 0, dy: 0, vx: 0, vy: 0, ...card, ...p });
const done = { canUp: true };
const notDone = { canUp: false };

describe("decideSwipe: distance", () => {
  it("commits horizontally at 28 % of the card width", () => {
    expect(decideSwipe(rel({ dx: -112 }), notDone)).toBe("left"); // 0.28 × 400
    expect(decideSwipe(rel({ dx: 112 }), notDone)).toBe("right");
    expect(decideSwipe(rel({ dx: -111 }), notDone)).toBeNull();
  });

  it("commits down at 22 % of the card height", () => {
    expect(decideSwipe(rel({ dy: 154 }), notDone)).toBe("down"); // 0.22 × 700
    expect(decideSwipe(rel({ dy: 153 }), notDone)).toBeNull();
  });

  it("commits up only after completion", () => {
    expect(decideSwipe(rel({ dy: -300 }), notDone)).toBeNull();
    expect(decideSwipe(rel({ dy: -300, vy: -2 }), notDone)).toBeNull();
    expect(decideSwipe(rel({ dy: -154 }), done)).toBe("up");
  });
});

describe("decideSwipe: flick", () => {
  it("commits a short fast flick (≥ 40 px at ≥ 0.6 px/ms)", () => {
    expect(decideSwipe(rel({ dx: 40, vx: 0.6 }), notDone)).toBe("right");
    expect(decideSwipe(rel({ dx: -45, vx: -1.2 }), notDone)).toBe("left");
    expect(decideSwipe(rel({ dy: 40, vy: 0.7 }), notDone)).toBe("down");
    expect(decideSwipe(rel({ dy: -40, vy: -0.7 }), done)).toBe("up");
  });

  it("needs both the distance and the speed", () => {
    expect(decideSwipe(rel({ dx: 39, vx: 3 }), notDone)).toBeNull();
    expect(decideSwipe(rel({ dx: 60, vx: 0.59 }), notDone)).toBeNull();
  });

  it("ignores a flick back towards the start", () => {
    expect(decideSwipe(rel({ dx: 80, vx: -1.5 }), notDone)).toBeNull();
    expect(decideSwipe(rel({ dy: 60, vy: -1 }), notDone)).toBeNull();
  });
});

describe("decideSwipe: dominant axis", () => {
  it("lets the larger displacement decide", () => {
    // far enough horizontally, but the drag was mostly vertical (and too short for down)
    expect(decideSwipe(rel({ dx: 120, dy: 130 }), notDone)).toBeNull();
    expect(decideSwipe(rel({ dx: 130, dy: 120 }), notDone)).toBe("right");
    // mostly upwards before completion: no horizontal exit either
    expect(decideSwipe(rel({ dx: 115, dy: -200 }), notDone)).toBeNull();
  });

  it("springs back when nothing moved", () => {
    expect(decideSwipe(rel({}), done)).toBeNull();
  });
});

describe("drag feedback", () => {
  it("reports the direction and progress towards the commit distance", () => {
    expect(dragProgress(-56, 10, 400, 700, notDone)).toEqual({ dir: "left", progress: 0.5 });
    expect(dragProgress(0, 154, 400, 700, notDone).progress).toBeCloseTo(1);
    expect(dragProgress(0, -100, 400, 700, notDone)).toEqual({ dir: null, progress: 0 });
    expect(dragProgress(0, -77, 400, 700, done)).toEqual({ dir: "up", progress: 0.5 });
  });

  it("damps blocked drags and keeps their sign", () => {
    expect(rubberBand(-500)).toBeGreaterThan(-48);
    expect(rubberBand(-500)).toBeLessThan(0);
    expect(rubberBand(30)).toBeGreaterThan(0);
    expect(Math.abs(rubberBand(10))).toBeLessThan(10);
  });

  it("maps directions to exits and back", () => {
    expect(EXIT_FOR_DIR).toEqual({ up: "next", left: "too_easy", right: "too_hard", down: "dislike_format" });
    for (const [dir, exit] of Object.entries(EXIT_FOR_DIR)) expect(DIR_FOR_EXIT[exit]).toBe(dir);
    expect(DIR_FOR_EXIT.camera_off).toBe("up");
  });
});

describe("release velocity", () => {
  const W = 100;
  it("measures the last moves; a lift at the same spot adds nothing", () => {
    // the trace from a busy headless browser: moves ~40 ms apart, lift 28 ms after the last move
    const moves = [{ x: 206, y: 0, t: 2376 }, { x: 236, y: 0, t: 2419 }, { x: 266, y: 0, t: 2459 }, { x: 296, y: 0, t: 2496 }];
    const v = releaseVelocity(moves, { x: 296, y: 0, t: 2524 }, W);
    expect(v.vx).toBeCloseTo(60 / 77, 5);
    expect(v.vy).toBe(0);
  });

  it("counts a lift that moved as the newest sample", () => {
    const v = releaseVelocity([{ x: 0, y: 0, t: 0 }, { x: 0, y: 20, t: 20 }], { x: 0, y: 50, t: 30 }, W);
    expect(v.vy).toBeCloseTo(50 / 30, 5);
  });

  it("is zero when the finger rested before lifting", () => {
    expect(releaseVelocity([{ x: 0, y: 0, t: 0 }, { x: 120, y: 0, t: 40 }], { x: 120, y: 0, t: 200 }, W)).toEqual({ vx: 0, vy: 0 });
    expect(releaseVelocity([], { x: 1, y: 1, t: 1 }, W)).toEqual({ vx: 0, vy: 0 });
  });
});
