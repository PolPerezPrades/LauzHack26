import { useEffect, useRef, useState } from "react";
import { label } from "../content/curriculum";
import { getCoaching, type CoachOutput } from "../lib/ai";
import type { Profile, Progress } from "../lib/storage";
import type { LessonSummary } from "./Lesson";

const ACTIVITY: Record<string, string> = {
  recognize: "reconocimiento", phrase: "frase", camera: "cámara", match: "emparejar", spell: "deletreo",
};

/** End of session: XP, accuracy, streak, and personalised feedback from the AI coach. */
export function Results({ summary, profile, progress, level, onCoach, onDone }: {
  summary: LessonSummary;
  profile: Profile;
  progress: Progress;
  level: number;
  onCoach: (c: CoachOutput) => void;
  onDone: () => void;
}) {
  const scored = summary.results.filter((r) => r.ex.kind !== "intro");
  const correct = scored.filter((r) => r.answer.correct).length;
  const accuracy = scored.length ? correct / scored.length : 1;
  const [coach, setCoach] = useState<CoachOutput | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return; // StrictMode runs effects twice in dev: ask the coach only once
    asked.current = true;
    const flat = scored.flatMap((r) => r.answer.items.map((it) => ({ id: it.id, label: label(it.id), activity: ACTIVITY[r.ex.kind] ?? r.ex.kind, correct: it.correct })));
    const weak = Object.entries(progress.items)
      .filter(([, s]) => s.seen > 0 && s.strength <= 1)
      .sort((a, b) => a[1].strength - b[1].strength)
      .slice(0, 8)
      .map(([id]) => ({ id, label: label(id) }));
    getCoaching({
      level, goalMin: profile.goalMin, streak: progress.streak, accuracy, durationSec: summary.seconds, results: flat, weak,
    }).then((c) => {
      setCoach(c);
      onCoach(c);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goalMet = progress.today.seconds >= profile.goalMin * 60;

  return (
    <div className="screen">
      <div className="card center results">
        <div className="hero-emoji">{accuracy >= 0.8 ? "🏆" : accuracy >= 0.5 ? "💪" : "🌱"}</div>
        <h1>¡Lección completada!</h1>
        <div className="result-tiles">
          <div className="tile-stat tile-xp"><b>+{summary.xp}</b><span>XP</span></div>
          <div className="tile-stat tile-acc"><b>{Math.round(accuracy * 100)}%</b><span>aciertos</span></div>
          <div className="tile-stat tile-streak"><b>🔥 {progress.streak}</b><span>{progress.streak === 1 ? "día" : "días"} de racha</span></div>
          <div className="tile-stat tile-time"><b>{Math.max(1, Math.round(summary.seconds / 60))} min</b><span>{goalMet ? "¡objetivo cumplido!" : `de ${profile.goalMin} min`}</span></div>
        </div>

        <div className="coach">
          <div className="coach-head">🧑‍🏫 Tu entrenador {coach?.source === "ai" && <span className="badge badge-ai">✨ IA</span>}</div>
          {!coach ? <div className="muted">Analizando tu sesión…</div> : (
            <>
              <p>{coach.message}</p>
              {coach.tips.length > 0 && <ul>{coach.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>}
              {coach.focus.length > 0 && <div className="muted small">Repasaremos pronto: {coach.focus.map(label).join(", ")}</div>}
              <div className="muted small">Próxima sesión: {{ easier: "un poco más suave", same: "mismo ritmo", harder: "un poco más retadora" }[coach.difficulty]}</div>
            </>
          )}
        </div>

        <button className="btn btn-primary btn-wide" onClick={onDone}>Continuar</button>
      </div>
    </div>
  );
}
