import { describe, expect, it } from "vitest";
import { curriculumOrder } from "../content/curriculum";
import { createRng } from "../core/rng";
import type { CardPlan, CardRef, FeedContext, TaskSpec } from "../core/types";
import { makeEvent } from "../data/events";
import { FORMATS } from "../tasks/registry";
import { cardHistory } from "./derived";
import { createSimplePicker } from "./simplePicker";

let n = 0;
const ids = () => `card-${++n}`;
const ctx = (history: CardRef[], cameraUsable = true): FeedContext => ({ history, events: [], cameraUsable, rng: createRng(1) });
const exited = (format: string, items: string[] = []): CardRef => ({ cardId: ids(), format, items, exit: "next" });

/** A non-dev format that needs the camera (none exists in Part A, so the test brings its own). */
const cameraFormat: TaskSpec = {
  id: "test-camera", family: "question", icon: "📷", i18nKey: "test-camera",
  requires: { camera: "required", itemKinds: ["letter"] }, trains: ["productive"], seconds: 10,
  params: () => ({}),
  generate: (q) => q.nextItems(["letter"], 1).map((id) => ({ format: "test-camera", items: [id], params: {} })),
  preview: () => "",
};
/**
 * A format that walks the curriculum with `nextItems`, as quiz-choice did in Part A. Since Part B
 * the real formats take their items from the learner lists (D-042), so the picker's own walk is
 * tested with this double.
 */
const quiz: TaskSpec = {
  id: "test-walk", family: "quiz", icon: "👀", i18nKey: "test-walk",
  requires: { camera: "none", itemKinds: ["letter", "number", "word", "phrase"] }, trains: ["receptive"], seconds: 10,
  params: () => ({}),
  generate: (q) => q.nextItems(["letter", "number", "word", "phrase"], 1).map((id) => ({ format: "test-walk", items: [id], params: {} })),
  preview: () => "",
};
const tutorial = FORMATS.find((f) => f.id === "system-tutorial")!;

describe("simple picker", () => {
  it("starts with the tutorial on first launch, then a lesson on the first curriculum item", () => {
    const picker = createSimplePicker({ newId: ids });
    const first = picker.next(ctx([]))!;
    expect(first.format).toBe("system-tutorial");
    // the tutorial is now queued (current): the card behind it teaches the first item (SPEC §7.8.5)
    const second = picker.next(ctx([{ cardId: first.cardId, format: first.format, items: [], planned: true }]))!;
    expect(second.format).toBe("lesson");
    expect(second.items).toEqual([curriculumOrder()[0]]);
    expect(second.reasons).toContainEqual({ code: "picker_walk", index: 0 });
    expect(picker.kind).toBe("picker");
  });

  it("never shows the tutorial again once it has been dismissed", () => {
    const picker = createSimplePicker({ newId: ids });
    const plan = picker.next(ctx([exited("system-tutorial")]))!;
    expect(plan.format).toBe("lesson");
  });

  it("shows the tutorial again if it was abandoned by a reload before any exit", () => {
    const picker = createSimplePicker({ newId: ids });
    expect(picker.next(ctx([{ cardId: "t", format: "system-tutorial", items: [] }]))!.format).toBe("system-tutorial");
  });

  it("walks the curriculum in order across launches", () => {
    const picker = createSimplePicker({ formats: [tutorial, quiz], newId: ids });
    const order = curriculumOrder();
    const history = [exited("system-tutorial"), exited("test-walk", [order[0]]), exited("test-walk", [order[1]]), exited("test-walk", [order[2]])];
    expect(picker.next(ctx(history))!.items).toEqual([order[3]]);
  });

  it("builds the history from the log and the queue", () => {
    const card = { sessionId: "s", cardId: "c1", format: "quiz-choice" };
    const log = [
      makeEvent({ ...card, type: "card.shown", items: ["L-A"], params: {}, reasons: [], source: "picker" }),
      makeEvent({ ...card, type: "card.exit", exit: "too_easy", completed: false, msVisible: 10 }),
    ];
    const queued: CardPlan = { cardId: "c2", format: "quiz-choice", items: ["L-B"], params: {}, reasons: [] };
    expect(cardHistory(log, [queued, null])).toEqual([
      { cardId: "c1", format: "quiz-choice", items: ["L-A"], exit: "too_easy" },
      { cardId: "c2", format: "quiz-choice", items: ["L-B"], planned: true },
    ]);
  });

  it("skips formats that need the camera when it isn't usable", () => {
    const picker = createSimplePicker({ formats: [tutorial, cameraFormat, quiz], newId: ids });
    let history: CardRef[] = [exited("system-tutorial")];
    for (let i = 0; i < 12; i++) {
      const plan = picker.next(ctx(history, false))!;
      expect(plan.format).toBe("test-walk");
      history = [...history, { cardId: plan.cardId, format: plan.format, items: plan.items, exit: "next" }];
    }
  });

  it("alternates between eligible formats, camera ones included when usable", () => {
    const picker = createSimplePicker({ formats: [tutorial, cameraFormat, quiz], newId: ids });
    let history: CardRef[] = [exited("system-tutorial")];
    const formats: string[] = [];
    for (let i = 0; i < 6; i++) {
      const plan = picker.next(ctx(history, true))!;
      formats.push(plan.format);
      history = [...history, { cardId: plan.cardId, format: plan.format, items: plan.items, exit: "next" }];
    }
    expect(formats).toEqual(["test-camera", "test-walk", "test-camera", "test-walk", "test-camera", "test-walk"]);
  });

  it("never offers dev-only formats and returns null when nothing is eligible", () => {
    const probe = FORMATS.find((f) => f.id === "dev-camera-probe")!;
    expect(createSimplePicker({ formats: [probe], newId: ids }).next(ctx([], true))).toBeNull();
    expect(createSimplePicker({ formats: [tutorial, cameraFormat], newId: ids }).next(ctx([exited("system-tutorial")], false))).toBeNull();
  });

  it("respects formats and items to avoid", () => {
    const picker = createSimplePicker({ formats: [tutorial, cameraFormat, quiz], newId: ids });
    expect(picker.next(ctx([exited("system-tutorial")], true), { formats: ["test-camera"] })!.format).toBe("test-walk");
    const plan = picker.next(ctx([exited("system-tutorial")], false), { items: [curriculumOrder()[0]] })!;
    expect(plan.items).toEqual([curriculumOrder()[1]]);
  });
});
