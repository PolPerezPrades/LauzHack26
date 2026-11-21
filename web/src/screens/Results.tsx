import { useEffect, useRef, useState } from "react";
import { label } from "../content/curriculum";
import type { LearningEvent } from "../data/events";
import { localCoach, type CoachFeedback, type CoachProvider } from "../learning/extensions";
import type { Profile } from "../learning/profile";
import type { SessionResult } from "./Session";

/** End of session: XP, accuracy, streak and feedback from the coach provider (local in phase 2). */
export function Results({ result, profile, events, onDone, coach = localCoach }: {
  result: SessionResult;
  profile: Profile;
  events: LearningEvent[];
  onDone: () => void;
  coach?: CoachProvider;
}) {
  const n = result.answers.length;
  const accuracy = n ? result.answers.filter((a) => a.correct).length / n : 1;
  const [fb, setFb] = useState<CoachFeedback | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    coach.feedback(profile, result, events).then(setFb);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goalMet = profile.today.seconds >= profile.settings.goalMin * 60;

  return (
    <div className="screen">
      <div className="card center results">
        <div className="hero-emoji">{accuracy >= 0.8 ? "🏆" : accuracy >= 0.5 ? "💪" : "🌱"}</div>
        <h1>¡Sesión completada!</h1>
        <div className="result-tiles">
          <div className="tile-stat tile-xp"><b>+{result.xp}</b><span>XP</span></div>
          <div className="tile-stat tile-acc"><b>{Math.round(accuracy * 100)}%</b><span>aciertos</span></div>
          <div className="tile-stat tile-streak"><b>🔥 {profile.streak}</b><span>{profile.streak === 1 ? "día" : "días"} de racha</span></div>
          <div className="tile-stat tile-time"><b>{Math.max(1, Math.round(result.seconds / 60))} min</b><span>{goalMet ? "¡objetivo cumplido!" : `de ${profile.settings.goalMin} min`}</span></div>
        </div>
        <div className="coach">
          <div className="coach-head">🧑‍🏫 Tu entrenador</div>
          {!fb ? <div className="muted">Analizando tu sesión…</div> : (
            <>
              <p>{fb.message}</p>
              <ul>{fb.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
              {fb.focus.length > 0 && <div className="muted small">Volverán antes en los repasos: {fb.focus.map(label).join(", ")}</div>}
            </>
          )}
        </div>
        <button className="btn btn-primary btn-wide" onClick={onDone}>Continuar</button>
      </div>
    </div>
  );
}
