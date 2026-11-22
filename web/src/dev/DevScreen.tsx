/**
 * Developer mode v1 (#dev, SPEC §6): pick any format (dev-only ones included), its content and its
 * params, simulate the camera being on or off, and play it in forced mode. Everything played here
 * goes to the sandbox log "signa-dev"; the inspector reads the sandbox or, read-only, the real log.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { go } from "../app/routes";
import { useLogStore } from "../app/useLog";
import { cameraSession, useCameraState } from "../camera";
import { isUsable } from "../camera/cameraSession";
import { UNITS, itemKindOf, itemLabel, unitOrder } from "../content/curriculum";
import { createRng } from "../core/rng";
import type { ItemKind, TaskSpec } from "../core/types";
import { REAL_DB, SANDBOX_DB } from "../data/dexieRepository";
import type { LogStore } from "../data/logStore";
import { formatTitle } from "../feed/CardParts";
import { useLang, useT } from "../i18n";
import { LangSwitch } from "../i18n/LangSwitch";
import { FORMATS, getFormat } from "../tasks/registry";
import { ChallengeControl, useForcedCe } from "./ChallengeControl";
import { loadDevConfig, saveDevConfig } from "./devConfig";
import { EventLog } from "./EventLog";
import type { ForcedConfig } from "./forcedSource";
import { DEV_PANELS } from "./panels";
import "./dev.css";

type Update = (patch: Partial<ForcedConfig>) => void;

const ofKinds = (ids: string[], kinds: readonly ItemKind[]) => ids.filter((id) => {
  const k = itemKindOf(id);
  return k !== undefined && kinds.includes(k);
});

export function DevScreen() {
  const t = useT();
  const [cfg, setCfg] = useState<ForcedConfig>(loadDevConfig);
  useEffect(() => saveDevConfig(cfg), [cfg]);
  const sandbox = useLogStore(SANDBOX_DB);
  const real = useLogStore(REAL_DB);
  const camState = useCameraState();
  const spec = getFormat(cfg.format);
  const update: Update = (patch) => setCfg((c) => ({ ...c, ...patch }));

  return (
    <div className="screen dev">
      <div className="row-between">
        <h2>🛠 {t.dev.title}</h2>
        <div className="head-actions">
          <LangSwitch />
          <button type="button" className="btn btn-ghost" onClick={() => go("")}>{t.dev.backToFeed}</button>
        </div>
      </div>
      <p className="dev-note">{t.dev.sandboxNote}</p>

      <section className="card dev-section">
        <h3>1 · {t.dev.format}</h3>
        <select value={cfg.format} onChange={(e) => update({ format: e.target.value, unit: undefined, items: [], overrides: {} })}>
          {FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.icon} {formatTitle(f, f.id, t)} · {f.id}{f.devOnly ? ` · ${t.dev.devOnly}` : ""}
            </option>
          ))}
        </select>
        {spec && <p className="dev-muted">{t.dev.formatInfo(spec.family, spec.requires.camera, spec.trains.join(", "))}</p>}
      </section>

      <ContentPicker spec={spec} cfg={cfg} update={update} />
      <ParamsPicker spec={spec} cfg={cfg} update={update} sandbox={sandbox} />

      <section className="card dev-section">
        <h3>4 · {t.dev.camera}</h3>
        <label className="dev-radio">
          <input type="radio" name="dev-camera" checked={isUsable(camState)} onChange={() => cameraSession.reenable()} /> {t.dev.cameraOn}
        </label>
        <label className="dev-radio">
          <input type="radio" name="dev-camera" checked={!isUsable(camState)} onChange={() => cameraSession.optOut()} /> {t.dev.cameraOff}
        </label>
        <p className="dev-muted">{t.dev.cameraState(camState)}</p>
      </section>

      <button type="button" className="btn btn-primary btn-big dev-play" disabled={!spec} onClick={() => go("#dev/play")}>{t.dev.play}</button>

      <section className="card dev-section">
        <h3>{t.dev.sandbox}</h3>
        <SandboxCount store={sandbox} />
        <button
          type="button"
          className="btn btn-danger"
          disabled={!sandbox}
          onClick={async () => {
            if (sandbox && confirm(t.dev.resetConfirm)) await sandbox.replaceAll([]);
          }}
        >
          {t.dev.reset}
        </button>
      </section>

      {DEV_PANELS.map(({ id, Component }) => <Component key={id} sandbox={sandbox} real={real} />)}

      <EventLog sandbox={sandbox} real={real} />
    </div>
  );
}

function SandboxCount({ store }: { store: LogStore | null }) {
  const t = useT();
  const count = useSyncExternalStore(store ? store.subscribe : () => () => {}, () => store?.getEvents().length ?? 0);
  return <p className="dev-muted">{t.dev.sandboxCount(count)}</p>;
}

function ContentPicker({ spec, cfg, update }: { spec?: TaskSpec; cfg: ForcedConfig; update: Update }) {
  const t = useT();
  const lang = useLang();
  const kinds = useMemo(() => spec?.requires.itemKinds ?? [], [spec]);
  const units = useMemo(() => UNITS.filter((u) => ofKinds(unitOrder(u.id), kinds).length > 0), [kinds]);
  if (!kinds.length) {
    return (
      <section className="card dev-section">
        <h3>2 · {t.dev.content}</h3>
        <p className="dev-muted">{t.dev.noContent}</p>
      </section>
    );
  }
  const unitItems = cfg.unit ? ofKinds(unitOrder(cfg.unit), kinds) : [];
  const selected = new Set(cfg.items ?? []);
  const toggle = (id: string) => update({ items: unitItems.filter((x) => (x === id ? !selected.has(x) : selected.has(x))) });
  return (
    <section className="card dev-section">
      <h3>2 · {t.dev.content}</h3>
      <label>
        {t.dev.unit}{" "}
        <select value={cfg.unit ?? ""} onChange={(e) => update({ unit: e.target.value || undefined, items: [] })}>
          <option value="">{t.dev.allUnits}</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.icon} {u.title[lang]}</option>)}
        </select>
      </label>
      <p className="dev-muted">{t.dev.itemsHint}</p>
      {unitItems.length > 0 && (
        <div className="dev-chips">
          {unitItems.map((id) => (
            <button key={id} type="button" className={`chip ${selected.has(id) ? "chip-on" : ""}`} aria-pressed={selected.has(id)} onClick={() => toggle(id)}>
              {itemLabel(id, lang)}
            </button>
          ))}
        </div>
      )}
      {selected.size > 0 && <button type="button" className="link" onClick={() => update({ items: [] })}>{t.dev.clearItems} ({selected.size})</button>}
    </section>
  );
}

function ParamsPicker({ spec, cfg, update, sandbox }: { spec?: TaskSpec; cfg: ForcedConfig; update: Update; sandbox: LogStore | null }) {
  const t = useT();
  const ce = useForcedCe(cfg, sandbox);
  if (!spec) return null;
  const overrides = cfg.overrides ?? {};
  const resulting: Record<string, unknown> = { ...spec.params(ce, { rng: createRng(0), ce, cameraUsable: true }), ...overrides };
  const setOverride = (key: string, value: number | null) => {
    const next = { ...overrides };
    if (value === null) delete next[key];
    else next[key] = value;
    update({ overrides: next });
  };
  return (
    <section className="card dev-section">
      <h3>3 · {t.dev.params}</h3>
      <ChallengeControl cfg={cfg} ce={ce} update={update} />
      {(spec.devParams ?? []).map((d) => {
        const auto = !(d.key in overrides);
        const value = Number(resulting[d.key] ?? d.min);
        return (
          <div key={d.key} className="dev-row">
            <code>{d.key}</code>
            <label>
              <input type="checkbox" checked={auto} onChange={(e) => setOverride(d.key, e.target.checked ? null : value)} /> {t.dev.auto}
            </label>
            <input
              type="number"
              min={d.min}
              max={d.max}
              step={d.step ?? 1}
              disabled={auto}
              value={value}
              onChange={(e) => setOverride(d.key, Math.max(d.min, Math.min(d.max, Number(e.target.value) || d.min)))}
            />
          </div>
        );
      })}
      <p className="dev-muted">
        {t.dev.resulting}: <code>{JSON.stringify(resulting)}</code>
      </p>
    </section>
  );
}
