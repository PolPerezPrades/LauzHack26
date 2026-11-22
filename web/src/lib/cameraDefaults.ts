/**
 * Logitech MX Brio defaults (SPEC §5.6, Part A3). The Brio keeps its digital zoom, pan and tilt in
 * the device, across apps, so another program (the Python prototype) can leave it zoomed in. When
 * the app opens an MX Brio, it puts them back to the device defaults: zoom at its minimum (1×), pan
 * and tilt 0, the same reset `view_cam.sh` does through V4L2. Other cameras are never sent PTZ
 * requests.
 *
 * Browsers expose pan, tilt and zoom (Media Capture Image) only once the page has the PTZ
 * permission, and Chrome only prompts for it when a getUserMedia request names them. Firefox and
 * Safari expose no PTZ for webcams, so there the reset is skipped. Pure: no DOM.
 */

export type PtzControl = "pan" | "tilt" | "zoom";
const CONTROLS: readonly PtzControl[] = ["pan", "tilt", "zoom"];

/** One control's range, as `MediaStreamTrack.getCapabilities()` reports it. */
export interface PtzRange {
  min?: number;
  max?: number;
  step?: number;
}
export type PtzCapabilities = { [K in PtzControl]?: PtzRange };
export type PtzSettings = { [K in PtzControl]?: number };
/** In a getUserMedia request, `true` asks for PTZ access without moving the camera. */
export type PtzRequest = { [K in PtzControl]?: true };

/** The browser's label for an MX Brio ("MX Brio" in Chrome and Firefox on Linux). Other Brio models don't match. */
export function isMxBrio(label: string | undefined): boolean {
  return /\bmx[\s_-]*brio\b/i.test(label ?? "");
}

/** The PTZ access to ask for when opening a Brio: the controls this browser supports, or null without PTZ support. */
export function ptzRequest(supported: { [K in PtzControl]?: boolean }): PtzRequest | null {
  const req: PtzRequest = {};
  for (const k of CONTROLS) if (supported[k] === true) req[k] = true;
  return Object.keys(req).length ? req : null;
}

function bounds(r: PtzRange | undefined): { min: number; max: number } | null {
  const min = r?.min;
  const max = r?.max;
  if (typeof min !== "number" || typeof max !== "number" || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
  return { min, max };
}

/** Whether the page may move this camera: the PTZ capabilities only appear once PTZ access is granted. */
export function exposesPtz(caps: PtzCapabilities): boolean {
  return CONTROLS.some((k) => bounds(caps[k]) !== null);
}

/**
 * (track label, capabilities[, current settings]) → the constraints that bring an MX Brio back to
 * its defaults, or null: another camera, no PTZ exposed, or nothing out of place. Only the controls
 * the browser exposes are included. Without `settings`, every exposed control is reset.
 */
export function brioReset(label: string, caps: PtzCapabilities, settings: PtzSettings = {}): PtzSettings | null {
  if (!isMxBrio(label)) return null;
  const reset: PtzSettings = {};
  for (const k of CONTROLS) {
    const b = bounds(caps[k]);
    if (!b) continue;
    // zoom's minimum is 1× (100 in the Brio's V4L2 units); pan and tilt 0 are the centre
    const target = k === "zoom" ? b.min : Math.min(b.max, Math.max(b.min, 0));
    if (settings[k] !== target) reset[k] = target;
  }
  return Object.keys(reset).length ? reset : null;
}
