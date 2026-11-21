/**
 * Format registry: pure metadata of every format (SPEC §8.2). The React side lives in views.tsx.
 * Adding a format = a spec in its list + a view in the matching map: learning formats in
 * learningFormats.ts / learningViews.tsx (Part B), minigames in gameFormats.ts / gameViews.tsx (Part E).
 */
import type { FormatId, TaskSpec } from "../core/types";
import { devCameraProbe } from "./dev-camera-probe/spec";
import { GAME_FORMATS } from "./gameFormats";
import { LEARNING_FORMATS } from "./learningFormats";
import { systemTutorial } from "./system-tutorial/spec";

export { TUTORIAL_ID } from "./system-tutorial/spec";

export const FORMATS: readonly TaskSpec[] = [systemTutorial, ...LEARNING_FORMATS, ...GAME_FORMATS, devCameraProbe];

const BY_ID = new Map<FormatId, TaskSpec>(FORMATS.map((f) => [f.id, f]));

export function getFormat(id: FormatId): TaskSpec | undefined {
  return BY_ID.get(id);
}

/** Formats that can't run at all without a camera (they are skipped when it isn't usable). */
export const needsCamera = (spec: TaskSpec) => spec.requires.camera === "required";
