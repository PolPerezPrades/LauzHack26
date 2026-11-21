/**
 * dev-camera-probe (dev only): shows the camera preview and completes once a hand has been seen for
 * ~1 s. It exists to test the camera gate, permissions, the camera choice and the opt-out.
 */
import type { TaskSpec } from "../../core/types";

export const CAMERA_PROBE_ID = "dev-camera-probe";

export type CameraProbeParams = {
  /** how long a hand must stay visible, in ms */
  holdMs: number;
};

const DEFAULTS: CameraProbeParams = { holdMs: 1000 };

export const devCameraProbe: TaskSpec<CameraProbeParams> = {
  id: CAMERA_PROBE_ID,
  family: "system",
  icon: "📷",
  i18nKey: CAMERA_PROBE_ID,
  requires: { camera: "required", itemKinds: [] },
  trains: [],
  seconds: 10,
  devOnly: true,
  devParams: [{ key: "holdMs", kind: "int", min: 300, max: 3000, step: 100 }],
  params: () => ({ ...DEFAULTS }),
  generate: (_q, _ctx, params) => [{ format: CAMERA_PROBE_ID, items: [], params: params ?? { ...DEFAULTS }, reasons: [{ code: "dev_probe" }] }],
  preview: (_plan, t) => t.probe.title,
};
