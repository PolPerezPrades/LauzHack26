/**
 * The challenge row of dev mode's parameters: a slider, or "auto", which plays at the sandbox
 * learner's own effective challenge ce for the chosen format (SPEC §9, Part C item 6).
 */
import type { LogStore } from "../data/logStore";
import { useT } from "../i18n";
import { forcedCe, type ForcedConfig } from "./forcedSource";
import { useLogEvents } from "./useLogEvents";
import "./learnerInspector.css";

/** The ce forced play will use: the slider's, or the sandbox learner's when on auto. */
export function useForcedCe(cfg: ForcedConfig, sandbox: LogStore | null): number {
  return forcedCe(cfg, useLogEvents(sandbox));
}

export function ChallengeControl({ cfg, ce, update }: { cfg: ForcedConfig; ce: number; update: (patch: Partial<ForcedConfig>) => void }) {
  const t = useT();
  return (
    <div className="dev-challenge">
      <label>
        {t.dev.challenge}
        <input type="range" min={-1} max={1} step={0.1} value={ce} disabled={!!cfg.autoCe} onChange={(e) => update({ ce: Number(e.target.value) })} />
        <code>{ce.toFixed(2)}</code>
      </label>
      <label>
        <input type="checkbox" checked={!!cfg.autoCe} onChange={(e) => update({ autoCe: e.target.checked })} /> {t.dev.auto}
      </label>
      {cfg.autoCe && <span className="dev-muted">{t.learner.autoChallenge(ce.toFixed(2))}</span>}
    </div>
  );
}
