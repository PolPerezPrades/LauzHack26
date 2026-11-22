/**
 * How a productive answer is verified (SPEC §4.2): the camera checks what it can (static letters,
 * through the handshape rules), the learner grades themselves while seeing their own mirror for
 * everything else, and with no camera the learner signs from memory and grades themselves.
 *
 * Pure: the item → rule mapping lives in lib/handshapes.ts (`hasCameraRule`), so when Part E adds
 * static number rules there, number tasks switch to `camera` with no change here or in the formats.
 */
import type { Skill } from "../core/types";
import { hasCameraRule } from "../lib/handshapes";

export type ProductiveCheck = "camera" | "mirror" | "self";

/**
 * camera: the camera is usable and the item has detector rules;
 * mirror: the camera is usable, but nothing can check this item (words, sentences, J, Z…);
 * self:   no camera (opted out, denied, missing), or a receptive skill: the camera only ever
 *         checks what the learner produces, never what they understand.
 */
export function checkModeFor(itemId: string, skill: Skill, cameraUsable: boolean): ProductiveCheck {
  if (skill !== "productive" || !cameraUsable) return "self";
  return hasCameraRule(itemId) ? "camera" : "mirror";
}

/** Self-graded checks: the learner, not a detector, decided whether it was right (SPEC §7.4). */
export const isSelfGraded = (mode: ProductiveCheck) => mode !== "camera";
