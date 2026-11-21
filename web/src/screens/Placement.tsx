import { useMemo, useState } from "react";
import { LEVEL_NAMES, UNITS } from "../content/curriculum";
import { Recognition } from "../activities/Recognition";
import { buildPlacement, placementResult, type Answer } from "../lib/engine";

/** 6 quick recognition questions (letters → words → phrase) to find the starting unit. */
export function Placement({ onDone }: { onDone: (startUnit: number, items: Answer["items"]) => void }) {
  const qs = useMemo(buildPlacement, []);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [current, setCurrent] = useState<Answer | null>(null);
  const [items, setItems] = useState<Answer["items"]>([]);

  const finished = i >= qs.length;
  const result = finished ? placementResult(qs, answers) : null;

  const next = () => {
    setAnswers([...answers, current!.correct]);
    setItems([...items, ...current!.items]);
    setCurrent(null);
    setI(i + 1);
  };

  if (result) {
    const unit = UNITS[result.startUnit];
    return (
      <div className="screen">
        <div className="card center">
          <div className="hero-emoji">🎯</div>
          <h1>¡Prueba completada!</h1>
          <p>Has acertado {answers.filter(Boolean).length} de {qs.length}.</p>
          <p>Empezarás en <b>{unit.icon} {unit.title}</b><br /><span className="muted">{LEVEL_NAMES[unit.level]}</span></p>
          <button className="btn btn-primary btn-wide" onClick={() => onDone(result.startUnit, items)}>Ir a mi primera lección</button>
        </div>
      </div>
    );
  }

  const q = qs[i];
  return (
    <div className="screen lesson">
      <div className="lesson-top">
        <span className="muted small">Prueba de nivel</span>
        <div className="progress"><div style={{ width: `${(i / qs.length) * 100}%` }} /></div>
        <span className="muted small">{i + 1}/{qs.length}</span>
      </div>
      {(q.ex.kind === "recognize" || q.ex.kind === "phrase") && (
        <Recognition key={i} ex={q.ex} onAnswer={setCurrent} locked={!!current} />
      )}
      {current && (
        <div className="footer footer-neutral">
          <span>{current.correct ? "Correcto" : "Anotado"}</span>
          <button className="btn btn-primary" onClick={next}>Continuar</button>
        </div>
      )}
      {!current && (
        <div className="footer footer-plain">
          <button className="btn btn-ghost" onClick={() => setCurrent({ correct: false, items: [] })}>No lo sé</button>
        </div>
      )}
    </div>
  );
}
