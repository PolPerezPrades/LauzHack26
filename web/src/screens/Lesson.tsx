import { useRef, useState } from "react";
import { PHRASES, getSign, label } from "../content/curriculum";
import { Intro, Recognition } from "../activities/Recognition";
import { CameraSign } from "../activities/CameraSign";
import { Matching } from "../activities/Matching";
import { FingerspellRead } from "../activities/FingerspellRead";
import { xpFor, type Answer, type Exercise } from "../lib/engine";

export interface LessonSummary {
  xp: number;
  seconds: number;
  results: { ex: Exercise; answer: Answer }[];
}

const PRAISE = ["¡Correcto!", "¡Genial!", "¡Muy bien!", "¡Eso es!", "¡Perfecto!"];

function correctText(ex: Exercise) {
  switch (ex.kind) {
    case "recognize": return `Respuesta: ${label(ex.signId)}${getSign(ex.signId)?.kind === "word" ? ` (${getSign(ex.signId)!.en.toUpperCase()})` : ""}`;
    case "phrase": return `Respuesta: ${PHRASES.get(ex.phraseId)?.es}`;
    case "spell": return `La palabra era ${ex.word}`;
    case "camera": return "Repasa la imagen de referencia y vuelve a intentarlo en otra lección";
    case "match": return "Se acabó el tiempo o hubo varios fallos";
    default: return "";
  }
}

/** Runs one daily session: a list of activities with Duolingo-style feedback between them. */
export function Lesson({ exercises, onAnswer, onFinish, onExit }: {
  exercises: Exercise[];
  onAnswer: (items: Answer["items"]) => void;
  onFinish: (s: LessonSummary) => void;
  onExit: () => void;
}) {
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [combo, setCombo] = useState(0);
  const results = useRef<LessonSummary["results"]>([]);
  const xp = useRef(0);
  const started = useRef(Date.now());

  const ex = exercises[i];
  const scored = exercises.filter((e) => e.kind !== "intro").length;

  const handleAnswer = (a: Answer) => {
    if (answer) return;
    let gained = xpFor(ex, a);
    const nextCombo = a.correct ? combo + 1 : 0;
    if (a.correct && nextCombo >= 3) gained += 2; // combo bonus
    xp.current += gained;
    setCombo(nextCombo);
    results.current.push({ ex, answer: { ...a, xp: gained } });
    onAnswer(a.items);
    setAnswer({ ...a, xp: gained });
  };

  const next = () => {
    setAnswer(null);
    if (i + 1 >= exercises.length) {
      onFinish({ xp: xp.current, seconds: Math.round((Date.now() - started.current) / 1000), results: results.current });
    } else {
      setI(i + 1);
    }
  };

  const doneCount = results.current.length;

  return (
    <div className="screen lesson">
      <div className="lesson-top">
        <button className="icon-btn" onClick={() => confirm("¿Salir de la lección? Se guardará lo que has practicado.") && onExit()}>✕</button>
        <div className="progress"><div style={{ width: `${(doneCount / Math.max(1, scored)) * 100}%` }} /></div>
        <span className={`combo ${combo >= 3 ? "combo-on" : ""}`}>🔥 {combo}</span>
      </div>

      <div className="lesson-body" key={i}>
        {ex.kind === "intro" && <Intro signId={ex.signId} onDone={next} />}
        {(ex.kind === "recognize" || ex.kind === "phrase") && <Recognition ex={ex} onAnswer={handleAnswer} locked={!!answer} />}
        {ex.kind === "camera" && <CameraSign letter={ex.letter} onAnswer={handleAnswer} locked={!!answer} />}
        {ex.kind === "match" && <Matching signIds={ex.signIds} seconds={ex.seconds} onAnswer={handleAnswer} locked={!!answer} />}
        {ex.kind === "spell" && <FingerspellRead word={ex.word} msPerLetter={ex.msPerLetter} onAnswer={handleAnswer} locked={!!answer} />}
      </div>

      {answer && (
        <div className={`footer ${answer.correct ? "footer-ok" : "footer-bad"}`}>
          <div>
            <div className="footer-title">{answer.correct ? PRAISE[i % PRAISE.length] : "Casi…"}</div>
            <div className="footer-sub">{answer.correct ? `+${answer.xp ?? 0} XP${combo >= 3 ? " · combo" : ""}` : correctText(ex)}</div>
          </div>
          <button className={`btn ${answer.correct ? "btn-primary" : "btn-danger"}`} onClick={next} autoFocus>Continuar</button>
        </div>
      )}
    </div>
  );
}
