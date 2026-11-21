import { describe, expect, it } from "vitest";
import { unitOrder } from "../content/curriculum";
import { createRng } from "../core/rng";
import type { CardRef, CardSource, FeedContext } from "../core/types";
import { createForcedSource } from "./forcedSource";

const ctx = (history: CardRef[], cameraUsable = true): FeedContext => ({ history, cameraUsable, rng: createRng(9) });

/** Plays `count` cards in a row, each one exited before the next is asked for. */
function play(source: CardSource, count: number, cameraUsable = true) {
  const history: CardRef[] = [];
  const plans = [];
  for (let i = 0; i < count; i++) {
    const plan = source.next(ctx(history, cameraUsable));
    if (!plan) break;
    plans.push(plan);
    history.push({ cardId: plan.cardId, format: plan.format, items: plan.items, exit: "too_easy" });
  }
  return plans;
}

describe("dev forced source", () => {
  it("repeats the chosen format, cycling through the chosen items", () => {
    const plans = play(createForcedSource({ format: "quiz-choice", items: ["w-hello", "w-bye"], ce: 0 }), 5);
    expect(plans.map((p) => p.format)).toEqual(Array(5).fill("quiz-choice"));
    expect(plans.map((p) => p.items[0])).toEqual(["w-hello", "w-bye", "w-hello", "w-bye", "w-hello"]);
    expect(plans[0].reasons).toContainEqual({ code: "dev_forced" });
  });

  it("walks a chosen unit in order (numbers by value)", () => {
    const plans = play(createForcedSource({ format: "quiz-choice", unit: "numbers", ce: 0 }), 3);
    expect(plans.map((p) => p.items[0])).toEqual(unitOrder("numbers").slice(0, 3));
    expect(unitOrder("numbers").slice(0, 3)).toEqual(["num-1", "num-2", "num-3"]);
  });

  it("applies the challenge level and hand-set params", () => {
    const easy = play(createForcedSource({ format: "quiz-choice", items: ["L-A"], ce: -1 }), 1)[0];
    expect((easy.params as { choices: string[] }).choices).toHaveLength(2);
    const set = play(createForcedSource({ format: "quiz-choice", items: ["L-A"], ce: -1, overrides: { options: 3 } }), 1)[0];
    expect((set.params as { choices: string[] }).choices).toHaveLength(3);
    const probe = play(createForcedSource({ format: "dev-camera-probe", ce: 0, overrides: { holdMs: 2000 } }), 1)[0];
    expect(probe.params).toEqual({ holdMs: 2000 });
  });

  it("gives no camera card while the camera isn't usable", () => {
    expect(play(createForcedSource({ format: "dev-camera-probe", ce: 0 }), 3, false)).toHaveLength(0);
    expect(play(createForcedSource({ format: "dev-camera-probe", ce: 0 }), 3, true)).toHaveLength(3);
  });

  it("can force system formats and reports itself as a dev source", () => {
    const source = createForcedSource({ format: "system-tutorial", ce: 0 });
    expect(source.kind).toBe("dev");
    expect(play(source, 2).map((p) => p.format)).toEqual(["system-tutorial", "system-tutorial"]);
    expect(createForcedSource({ format: "nope", ce: 0 }).next(ctx([]))).toBeNull();
  });
});
