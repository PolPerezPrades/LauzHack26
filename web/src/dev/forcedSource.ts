/**
 * Dev forced mode (SPEC §6): every card comes from one chosen format, again and again, with the
 * chosen content (specific items, or a unit walked in order, or the whole curriculum) and params.
 * Camera-requiring formats yield nothing while the camera isn't usable, like everywhere else.
 */
import { curriculumOrder, unitOrder } from "../content/curriculum";
import { newId } from "../core/ids";
import type { CardSource, FormatId, TaskSpec } from "../core/types";
import { curriculumWalker, settledCards, toPlan } from "../feed/simplePicker";
import { FORMATS, needsCamera } from "../tasks/registry";

export interface ForcedConfig {
  format: FormatId;
  /** walk this unit when no items are chosen */
  unit?: string;
  /** cycle through these items */
  items?: string[];
  /** effective challenge level passed to the format */
  ce: number;
  /** params set by hand (keys from the format's devParams) */
  overrides?: Record<string, number>;
}

export function createForcedSource(cfg: ForcedConfig, opts: { formats?: readonly TaskSpec[]; newId?: () => string } = {}): CardSource {
  const formats = opts.formats ?? FORMATS;
  const makeId = opts.newId ?? newId;
  return {
    kind: "dev",
    next(ctx) {
      const spec = formats.find((f) => f.id === cfg.format);
      if (!spec || (needsCamera(spec) && !ctx.cameraUsable)) return null;
      const content = cfg.items?.length ? cfg.items : cfg.unit ? unitOrder(cfg.unit) : curriculumOrder();
      const played = settledCards(ctx.history).filter((c) => c.format === spec.id).length;
      const gen = { rng: ctx.rng, ce: cfg.ce, cameraUsable: ctx.cameraUsable };
      const params = { ...spec.params(cfg.ce, gen), ...cfg.overrides };
      const draft = spec.generate(curriculumWalker(content, played), gen, params)[0];
      return draft ? toPlan(draft, makeId(), { code: "dev_forced" }) : null;
    },
  };
}
