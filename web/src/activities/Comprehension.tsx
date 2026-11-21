import { useRef, useState } from "react";
import { getSign } from "../content/curriculum";
import { PASSAGES } from "../content/scenarios";
import { shuffle, type Answer } from "../lib/engine";
import { SignViewer } from "../viewer/SignViewer";

/**
 * Comprehension: a short account told with a sequence of signs (real dictionary signs, ASL order);
 * then questions to show it was understood. Answers are logged on the signs each question tests.
 */
export function Comprehension({ passageId, onAnswer, locked }: { passageId: string; onAnswer: (a: Answer) => void; locked: boolean }) {
  const p = PASSAGES.get(passageId)!;
  const [phase, setPhase] = useState<"watch" | "questions">("watch");
  const [sentence, setSentence] = useState(0);
  const [watched, setWatched] = useState(false);
  const [q, setQ] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [opts] = useState(() => p.questions.map((qq) => shuffle(qq.options.map((o, i) => ({ o, ok: i === qq.answer })))));
  const results = useRef<Answer["items"]>([]);
  const correctQs = useRef(0);
  const t0 = useRef(performance.now());

  const nextSentence = () => {
    if (sentence + 1 < p.sentences.length) setSentence(sentence + 1);
    else setWatched(true);
  };

  const choose = (k: number) => {
    if (chosen !== null || locked) return;
    setChosen(k);
    const ok = opts[q][k].ok;
    const ms = Math.round(performance.now() - t0.current);
    for (const id of p.questions[q].items) results.current.push({ id, correct: ok, ms });
    if (ok) correctQs.current++;
    setTimeout(() => {
      if (q + 1 < p.questions.length) { setQ(q + 1); setChosen(null); t0.current = performance.now(); }
      else {
        const good = correctQs.current;
        onAnswer({ correct: good === p.questions.length, items: results.current, xp: good * 8 });
      }
    }, 900);
  };

  if (phase === "watch") {
    const s = p.sentences[sentence];
    return (
      <div className="activity">
        <div className="badge">📖 Comprensión · {p.title}</div>
        <h2 className="prompt">Mira lo que te cuentan ({sentence + 1}/{p.sentences.length})</h2>
        <SignViewer key={sentence} ids={s} loop={false} onSequenceEnd={nextSentence} />
        <div className="gloss-line muted small">{watched ? s.map((id) => getSign(id)?.en.toUpperCase()).join(" · ") : " "}</div>
        <div className="row-center">
          {watched && <button className="chip" onClick={() => { setSentence(0); setWatched(false); }}>↻ Ver todo otra vez</button>}
          <button className="btn btn-primary" disabled={!watched} onClick={() => { setPhase("questions"); t0.current = performance.now(); }}>
            {watched ? "Responder preguntas" : "Mirando…"}
          </button>
        </div>
      </div>
    );
  }

  const qq = p.questions[q];
  return (
    <div className="activity">
      <div className="badge">📖 Comprensión · pregunta {q + 1}/{p.questions.length}</div>
      <h2 className="prompt">{qq.q}</h2>
      <details className="muted small"><summary>Volver a ver el relato</summary>
        <SignViewer ids={p.sentences.flat()} size="md" credit={false} />
      </details>
      <div className="options options-1col">
        {opts[q].map((o, k) => (
          <button key={k} className={`option ${chosen === null ? "" : o.ok ? "opt-correct" : chosen === k ? "opt-wrong" : "opt-dim"}`} disabled={chosen !== null || locked} onClick={() => choose(k)}>
            <span className="opt-main">{o.o}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
