/**
 * Format registry: pure metadata of every format (SPEC §8.2). The React side lives in views.tsx.
 * Adding a format = a spec here + a view there.
 */
import type { FormatId, TaskSpec } from "../core/types";
import { devCameraProbe } from "./dev-camera-probe/spec";
import { quizChoice } from "./quiz-choice/spec";
import { systemTutorial } from "./system-tutorial/spec";

export { TUTORIAL_ID } from "./system-tutorial/spec";

export const FORMATS: readonly TaskSpec[] = [systemTutorial, quizChoice, devCameraProbe];

const BY_ID = new Map<FormatId, TaskSpec>(FORMATS.map((f) => [f.id, f]));

export function getFormat(id: FormatId): TaskSpec | undefined {
  return BY_ID.get(id);
}

/** Formats that can't run at all without a camera (they are skipped when it isn't usable). */
export const needsCamera = (spec: TaskSpec) => spec.requires.camera === "required";
