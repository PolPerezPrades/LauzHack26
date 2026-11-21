import { useRef, useState } from "react";
import { getSign, letterId } from "../content/curriculum";
import type { Answer } from "../lib/engine";
import { SignViewer } from "../viewer/SignViewer";

/** The 3D hand fingerspells a word letter by letter (smooth transitions); the learner types it. */
export function FingerspellRead({ word, msPerLetter, onAnswer, locked }: {
  word: string; msPerLetter: number; onAnswer: (a: Answer) => void; locked: boolean;
}) {
  const [phase, setPhase] = useState<"ready" | "playing" | "input">("ready");
  const [plays, setPlays] = useState(0);
  const [speed, setSpeed] = useState(msPerLetter);
  const [text, setText] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ids = word.split("").map(letterId).filter((id) => getSign(id));

  const play = () => setPhase("playing");
  const ended = () => {
    setPhase("input");
    setPlays((p) => p + 1);
    setSpeed((s) => Math.round(s * 0.85)); // each replay is a bit faster
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const submit = () => {
    if (result !== null || locked || !text.trim()) return;
    const correct = text.trim().toUpperCase().replace(/\s+/g, "") === word;
    setResult(correct);
    const letters = [...new Set(word.split(""))].filter((L) => getSign(letterId(L)));
    onAnswer({ correct, items: letters.map((L) => ({ id: letterId(L), correct })) });
  };

  return (
    <div className="activity">
      <h2 className="prompt">Deletreo rápido: ¿qué palabra es?</h2>
      <div className="spell-stage">
        {phase === "ready" && <button className="btn btn-primary" onClick={play}>▶ Ver deletreo</button>}
        {phase === "playing" && (
          <SignViewer key={plays} ids={ids} size="md" controls={false} credit={false} loop={false} letterHoldMs={speed} onSequenceEnd={ended} />
        )}
        {phase === "input" && (
          <div className="spell-letters">
            {result !== null ? word.split("").map((L, i) => <span key={i}>{L}</span>) : <span className="muted">{word.length} letras</span>}
          </div>
        )}
      </div>
      <div className="row-center">
        <span className="chip">⏱ {(speed / 1000).toFixed(2)} s / letra</span>
        {phase === "input" && result === null && plays < 3 && (
          <button className="chip" onClick={play}>↻ Otra vez (más rápido)</button>
        )}
      </div>
      {phase === "input" && (
        <form className="spell-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} disabled={result !== null || locked}
            placeholder="Escribe la palabra" autoComplete="off" spellCheck={false} />
          <button className="btn btn-primary" disabled={result !== null || locked || !text.trim()}>Comprobar</button>
        </form>
      )}
    </div>
  );
}
