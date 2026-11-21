import { useState, useSyncExternalStore } from "react";
import type { EventType, LearningEvent } from "../data/events";
import type { LogStore } from "../data/logStore";
import { useLang, useT, type Lang } from "../i18n";

const TYPES: EventType[] = ["app.open", "card.shown", "evidence", "card.result", "card.exit", "game.score", "camera.off", "format.unmute", "settings.set"];
const NONE: readonly LearningEvent[] = [];
const noSubscribe = () => () => {};
const noEvents = () => NONE;
const LIMIT = 100;

const time = (ts: number, lang: Lang) => {
  const d = new Date(ts);
  return `${d.toLocaleTimeString(lang, { hour12: false })}.${String(d.getMilliseconds()).padStart(3, "0")}`;
};

/** The event's own fields, without the envelope shown in other columns. */
function details(e: LearningEvent) {
  const rest: Record<string, unknown> = { ...e };
  for (const k of ["id", "seq", "ts", "v", "type"]) delete rest[k];
  return JSON.stringify(rest);
}

/** Event-log inspector (SPEC §6): the last 100 matching events, newest first. */
export function EventLog({ sandbox, real }: { sandbox: LogStore | null; real: LogStore | null }) {
  const t = useT();
  const lang = useLang();
  const [which, setWhich] = useState<"sandbox" | "real">("sandbox");
  const [type, setType] = useState("");
  const [text, setText] = useState("");
  const store = which === "sandbox" ? sandbox : real;
  const events = useSyncExternalStore(store ? store.subscribe : noSubscribe, store ? store.getEvents : noEvents);
  const q = text.trim().toLowerCase();
  const shown = events.filter((e) => (!type || e.type === type) && (!q || JSON.stringify(e).toLowerCase().includes(q))).slice(-LIMIT).reverse();

  return (
    <section className="card dev-section">
      <h3>{t.dev.log}</h3>
      <div className="dev-filters">
        <label>
          {t.dev.logSource}{" "}
          <select value={which} onChange={(e) => setWhich(e.target.value as "sandbox" | "real")}>
            <option value="sandbox">{t.dev.logSandbox}</option>
            <option value="real">{t.dev.logReal}</option>
          </select>
        </label>
        <label>
          {t.dev.logType}{" "}
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{t.dev.logAll}</option>
            {TYPES.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label>
          {t.dev.logFilter} <input type="search" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      </div>
      <p className="dev-muted">{t.dev.logShowing(shown.length, events.length)}</p>
      {shown.length === 0 ? (
        <p>{t.dev.logEmpty}</p>
      ) : (
        <div className="dev-log-wrap">
          <table className="dev-log">
            <tbody>
              {shown.map((e) => (
                <tr key={e.id} data-type={e.type}>
                  <td className="dev-time">{time(e.ts, lang)}</td>
                  <td className="dev-type">{e.type}</td>
                  <td><code>{details(e)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
