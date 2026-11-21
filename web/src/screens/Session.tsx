/**
 * Runs a planned session step by step and writes every interaction to the event log:
 * activity.start → answer (per item, with modality and time) → activity.end (completed / abandoned).
 * Each step can show WHY the orchestrator chose it.
 */
import { useEffect, useRef, useState } from "react";
import { PHRASES, getSign, label } from "../content/curriculum";
import type { EventBody, SessionContext } from "../data/events";
import { ACTIVITY } from "../learning/activityCatalog";
import type { SessionPlan } from "../learning/orchestrator";
import type { Profile } from "../learning/profile";
import type { Answer } from "../lib/engine";
import { COMPONENTS } from "../activities/registry";

export interface SessionResult {
  sessionId: string;
  xp: number;
  seconds: number;
  answers: { itemId: string; correct: boolean; activity: string }[];
}

const PRAISE = ["¡Correcto!", "¡Genial!", "¡Muy bien!", "¡Eso es!", "¡Perfecto!"];

function correctText(activity: string, items: string[]) {
  const id = items[0];
  if (!id) return "";
  if (activity === "phrase") return `Respuesta: ${PHRASES.get(id)?.es}`;
  if (activity === "recognize") return `Respuesta: ${label(id)}${getSign(id)?.kind === "word" ? ` (${getSign(id)!.en.toUpperCase()})` : ""}`;
  if (activity === "camera" || activity === "imitate") return "Mira la referencia y vuelve a intentarlo: reaparecerá pronto";
  if (activity === "match") return "Se acabó el tiempo o hubo varios fallos";
  return "Lo repasaremos pronto";
}

export function Session({ plan, profile, ctx, emit, onFinish, onExit }: {
  plan: SessionPlan;
  profile: Profile;
  ctx: SessionContext;
  emit: (e: EventBody) => void;
  onFinish: (r: SessionResult) => void;
  onExit: () => void;
}) {
  const sessionId = useRef(crypto.randomUUID());
  const started = useRef(Date.now());
  const stepStart = useRef(Date.now());
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [combo, setCombo] = useState(0);
  const [showWhy, setShowWhy] = useState(false);
  const xp = useRef(0);
  const answers = useRef<SessionResult["answers"]>([]);
  const begun = useRef(false);

  const step = plan.steps[i];
  const meta = ACTIVITY.get(step?.activity ?? "");

  // session.start once, activity.start on every step
  useEffect(() => {
    if (!begun.current) {
      begun.current = true;
      emit({ type: "session.start", sessionId: sessionId.current, mode: plan.mode, target: plan.target, ctx, log: plan.log,
        plan: plan.steps.map((s) => ({ activity: s.activity, items: s.items, why: s.why, content: s.content })) });
      console.debug("[orquestador]", plan.log.join(" | "));
    }
    if (!step) return;
    stepStart.current = Date.now();
    emit({ type: "activity.start", sessionId: sessionId.current, step: i, activity: step.activity, items: step.items, content: step.content });
    console.debug(`[orquestador] paso ${i + 1}: ${step.activity} [${step.items.join(", ")}] · elegido porque: ${step.why.join(" + ")}`);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const handle = (a: Answer) => {
    if (answer) return;
    const elapsed = Date.now() - stepStart.current;
    const perItem = a.items.length ? Math.round(elapsed / a.items.length) : elapsed;
    for (const it of a.items) {
      emit({ type: "answer", sessionId: sessionId.current, activity: step.activity, itemId: it.id, modality: it.modality ?? meta?.trains ?? "receptive",
        correct: it.correct, ms: it.ms ?? perItem, confusedWith: it.confusedWith });
      answers.current.push({ itemId: it.id, correct: it.correct, activity: step.activity });
    }
    if (step.activity === "sprint" && a.xp !== undefined) emit({ type: "game.score", activity: "sprint", score: a.xp / 2 });
    let gained = a.xp ?? (a.correct ? (step.activity === "imitate" ? 15 : step.activity === "phrase" ? 12 : 10) : 0);
    const nextCombo = a.items.length ? (a.correct ? combo + 1 : 0) : combo;
    if (a.correct && nextCombo >= 3) gained += 2;
    xp.current += gained;
    setCombo(nextCombo);
    if (step.activity === "intro") return next(true);
    setAnswer({ ...a, xp: gained });
  };

  function next(completed = true) {
    emit({ type: "activity.end", sessionId: sessionId.current, step: i, activity: step.activity, status: completed ? "completed" : "abandoned",
      ms: Date.now() - stepStart.current, xp: answer?.xp ?? 0 });
    setAnswer(null);
    setShowWhy(false);
    if (i + 1 >= plan.steps.length) {
      const seconds = Math.round((Date.now() - started.current) / 1000);
      emit({ type: "session.end", sessionId: sessionId.current, status: "completed", xp: xp.current, seconds });
      onFinish({ sessionId: sessionId.current, xp: xp.current, seconds, answers: answers.current });
    } else {
      setI(i + 1);
    }
  }

  const exit = () => {
    if (!confirm("¿Salir de la sesión? Lo que has practicado queda guardado.")) return;
    if (step && !answer) emit({ type: "activity.end", sessionId: sessionId.current, step: i, activity: step.activity, status: "abandoned", ms: Date.now() - stepStart.current, xp: 0 });
    emit({ type: "session.end", sessionId: sessionId.current, status: "abandoned", xp: xp.current, seconds: Math.round((Date.now() - started.current) / 1000) });
    onExit();
  };

  if (!step) return null;
  const Component = COMPONENTS[step.activity];
  const scored = plan.steps.filter((s) => s.activity !== "intro").length;
  const done = plan.steps.slice(0, i).filter((s) => s.activity !== "intro").length + (answer ? 1 : 0);

  return (
    <div className="screen lesson">
      <div className="lesson-top">
        <button className="icon-btn" onClick={exit} aria-label="Salir">✕</button>
        <div className="progress"><div style={{ width: `${(done / Math.max(1, scored)) * 100}%` }} /></div>
        <span className={`combo ${combo >= 3 ? "combo-on" : ""}`}>🔥 {combo}</span>
        <button className="icon-btn why-btn" onClick={() => setShowWhy(!showWhy)} title="¿Por qué esta actividad?">ℹ</button>
      </div>
      {showWhy && (
        <div className="why card">
          <b>{meta?.icon} {meta?.title}</b> · elegida porque: {step.why.join(" · ")}
        </div>
      )}
      <div className="lesson-body" key={i}>
        {Component ? <Component step={step} profile={profile} ctx={ctx} locked={!!answer} onResult={handle} /> : <p>Actividad desconocida: {step.activity}</p>}
      </div>
      {answer && (
        <div className={`footer ${answer.correct ? "footer-ok" : "footer-bad"}`}>
          <div>
            <div className="footer-title">{answer.correct ? PRAISE[i % PRAISE.length] : "Casi…"}</div>
            <div className="footer-sub">{answer.correct ? `+${answer.xp ?? 0} XP${combo >= 3 ? " · combo" : ""}` : correctText(step.activity, step.items)}</div>
          </div>
          <button className={`btn ${answer.correct ? "btn-primary" : "btn-danger"}`} onClick={() => next(true)} autoFocus>Continuar</button>
        </div>
      )}
    </div>
  );
}
