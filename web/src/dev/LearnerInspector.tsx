/**
 * Dev inspector of the learner model (SPEC §6, Part C), in the dev panel slot: the state folded from
 * the sandbox log or, read-only, the real one. Per item and skill: status, pKnown, retrievability,
 * FSRS due date, evidence and answers; per format: preference, mutes and challenge offset; and the
 * challenge level, pacing, open units, frontier, probes and relearn lists.
 */
import { useMemo, useState } from "react";
import { UNITS, itemLabel, unitOrder } from "../content/curriculum";
import { useLang, useT, type Lang } from "../i18n";
import { SKILLS, isMet, type ItemSkillState, type LearnerState } from "../learner/model";
import { queriesFor } from "../learner/queries";
import { cardsToday, effectiveChallenge, pacing, statusOf, streakOf, targetSuccess } from "../learner/selectors";
import { retrievability } from "../learner/schedule";
import { learnerStateOf } from "../learner/state";
import type { DevPanelProps } from "./panels";
import { useLogEvents } from "./useLogEvents";
import "./learnerInspector.css";

const ALL_KINDS = ["letter", "number", "word", "phrase"] as const;
const n2 = (x: number) => x.toFixed(2);

export function LearnerInspector({ sandbox, real }: DevPanelProps) {
  const t = useT();
  const lang = useLang();
  const [which, setWhich] = useState<"sandbox" | "real">("sandbox");
  const events = useLogEvents(which === "sandbox" ? sandbox : real);
  const state = useMemo(() => learnerStateOf(events), [events]);
  // the clock is read when the log changes: statuses and due dates are as of the last change
  const now = useMemo(() => (events.length ? Date.now() : 0), [events]);
  const l = t.learner;

  return (
    <section className="card dev-section learner-inspector">
      <h3>{l.title}</h3>
      <label>
        {l.source}{" "}
        <select value={which} onChange={(e) => setWhich(e.target.value as "sandbox" | "real")}>
          <option value="sandbox">{l.sourceSandbox}</option>
          <option value="real">{l.sourceReal}</option>
        </select>
      </label>
      {state.events === 0 ? <p className="dev-muted">{l.empty}</p> : <StateView state={state} now={now} lang={lang} />}
    </section>
  );
}

function StateView({ state, now, lang }: { state: LearnerState; now: number; lang: Lang }) {
  const t = useT();
  const l = t.learner;
  const p = pacing(state, now);
  const q = queriesFor(state, { now });
  const label = (id: string) => itemLabel(id, lang);
  const list = (ids: string[]) => (ids.length ? ids.map(label).join(", ") : l.lists.none);

  return (
    <>
      <dl className="li-summary">
        <Stat name={l.summary.challenge} value={n2(state.c)} />
        <Stat name={l.summary.accuracy} value={n2(state.accuracy)} />
        <Stat name={l.summary.target} value={n2(targetSuccess(state))} />
        <Stat name={l.summary.xp} value={String(state.xp)} />
        <Stat name={l.summary.streak} value={String(streakOf(state, now))} />
        <Stat name={l.summary.today} value={String(cardsToday(state, now))} />
        <Stat name={l.summary.cards} value={String(state.cards)} />
        <Stat name={l.summary.sessions} value={String(state.sessions)} />
      </dl>
      <p className="dev-muted">
        {l.pacing(p.inFlight, p.maxInFlight, p.overdue)} · <strong>{p.allowsNew ? l.newAllowed : l.newPaused}</strong>
        {state.backoff && <> · {l.backoff(label(state.backoff.itemId), state.backoff.card)}</>}
      </p>

      <h4>{l.units}</h4>
      <div className="dev-chips">
        {UNITS.map((u) => {
          const status = state.testedOut.has(u.id) ? "testedOut" : state.openUnits.has(u.id) ? "open" : "closed";
          return (
            <span key={u.id} className={`chip li-unit li-unit-${status}`} title={u.id}>
              {u.icon} {u.title[lang]} · {l.unitState[status]}
            </span>
          );
        })}
      </div>
      <p className="li-lists">
        <strong>{l.lists.frontier}:</strong> {list(q.frontier(ALL_KINDS, 6))}
        <br />
        <strong>{l.lists.probes}:</strong> {list(q.probes(ALL_KINDS, 6))}
        <br />
        <strong>{l.lists.relearn}:</strong> {list(q.relearn(ALL_KINDS, 6))}
      </p>

      <FormatsTable state={state} />
      <ItemsTable state={state} now={now} lang={lang} />
    </>
  );
}

function Stat({ name, value }: { name: string; value: string }) {
  return (
    <div>
      <dt>{name}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function FormatsTable({ state }: { state: LearnerState }) {
  const t = useT();
  const l = t.learner;
  const rows = [...state.formats].sort(([a], [b]) => a.localeCompare(b));
  return (
    <>
      <h4>{l.formats}</h4>
      {rows.length === 0 ? (
        <p className="dev-muted">{l.noFormats}</p>
      ) : (
        <div className="dev-log-wrap">
          <table className="li-table">
            <thead>
              <tr>
                <th>{l.formatCols.format}</th><th>α</th><th>β</th><th>{l.formatCols.pref}</th><th>{l.formatCols.shown}</th>
                <th>{l.formatCols.completed}</th><th>{l.formatCols.dislikes}</th><th>{l.formatCols.muted}</th><th>cf</th><th>ce</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([id, f]) => (
                <tr key={id} className={f.muted ? "li-muted" : undefined}>
                  <td><code>{id}</code></td><td>{n2(f.alpha)}</td><td>{n2(f.beta)}</td><td>{n2(f.alpha / (f.alpha + f.beta))}</td>
                  <td>{f.shown}</td><td>{f.completed}</td><td>{f.dislikes}</td><td>{f.muted ? l.yes : ""}</td>
                  <td>{n2(f.cf)}</td><td>{n2(effectiveChallenge(state, id))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function SkillCells({ rec, now, lang }: { rec?: ItemSkillState; now: number; lang: Lang }) {
  const t = useT();
  const l = t.learner;
  const status = statusOf(rec, now);
  if (!rec || rec.evidence === "none") {
    return (
      <>
        <td className="li-status li-new">{l.status.new}</td><td /><td /><td /><td /><td />
      </>
    );
  }
  return (
    <>
      <td className={`li-status li-${status}`}>{l.status[status]}</td>
      <td>{n2(rec.pKnown)}</td>
      <td>{rec.card ? n2(retrievability(rec.card, now)) : ""}</td>
      <td>{rec.card ? new Date(rec.card.due).toLocaleDateString(lang, { month: "short", day: "numeric" }) : ""}</td>
      <td>{l.evidence[rec.evidence]}</td>
      <td>{rec.attempts ? `${rec.correct}/${rec.attempts}` : ""}</td>
    </>
  );
}

function ItemsTable({ state, now, lang }: { state: LearnerState; now: number; lang: Lang }) {
  const t = useT();
  const l = t.learner;
  const [unit, setUnit] = useState("");
  const [metOnly, setMetOnly] = useState(true);
  const ids = (unit ? unitOrder(unit) : UNITS.flatMap((u) => unitOrder(u.id))).filter((id) => !metOnly || isMet(state.items.get(id)));
  return (
    <>
      <h4>{l.items}</h4>
      <div className="dev-filters">
        <label>
          {l.unit}{" "}
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="">{l.allUnits}</option>
            {UNITS.map((u) => <option key={u.id} value={u.id}>{u.icon} {u.title[lang]}</option>)}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={metOnly} onChange={(e) => setMetOnly(e.target.checked)} /> {l.metOnly}
        </label>
      </div>
      <div className="dev-log-wrap">
        <table className="li-table">
          <thead>
            <tr>
              <th rowSpan={2}>{l.itemCols.item}</th>
              {SKILLS.map((s) => <th key={s} colSpan={6} className="li-skill">{l.skills[s]}</th>)}
            </tr>
            <tr>
              {SKILLS.map((s) => (
                <SkillHead key={s} />
              ))}
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const item = state.items.get(id);
              return (
                <tr key={id}>
                  <td>
                    {itemLabel(id, lang)} <code className="dev-muted">{id}</code>
                  </td>
                  {SKILLS.map((s) => <SkillCells key={s} rec={item?.[s]} now={now} lang={lang} />)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SkillHead() {
  const t = useT();
  const c = t.learner.itemCols;
  return (
    <>
      <th>{c.status}</th><th>pKnown</th><th>R</th><th>{c.due}</th><th>{c.evidence}</th><th>{c.answers}</th>
    </>
  );
}
