import { useEffect, useRef, useState } from "react";
import { getSign, letterId } from "../content/curriculum";
import type { Answer } from "../lib/engine";

/** The app fingerspells a word letter by letter (real alphabet illustrations); the learner types it. */
export function FingerspellRead({ word, msPerLetter, onAnswer, locked }: {
  word: string; msPerLetter: number; onAnswer: (a: Answer) => void; locked: boolean;
}) {
  const [phase, setPhase] = useState<"ready" | "playing" | "input">("ready");
  const [shown, setShown] = useState(-1);   // index of the letter on screen, -1 = blank
  const [plays, setPlays] = useState(0);
  const [speed, setSpeed] = useState(msPerLetter);
  const [text, setText] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const play = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase("playing");
    const gap = Math.round(speed * 0.18); // short blank so double letters are visible
    word.split("").forEach((_, i) => {
      timers.current.push(setTimeout(() => setShown(i), i * speed));
      timers.current.push(setTimeout(() => setShown(-1), (i + 1) * speed - gap));
    });
    timers.current.push(setTimeout(() => {
      setPhase("input");
      setPlays((p) => p + 1);
      setSpeed((s) => Math.round(s * 0.85)); // each replay is a bit faster
      setTimeout(() => inputRef.current?.focus(), 50);
    }, word.length * speed + 200));
  };

  const submit = () => {
    if (result !== null || locked || !text.trim()) return;
    const correct = text.trim().toUpperCase().replace(/\s+/g, "") === word;
    setResult(correct);
    const letters = [...new Set(word.split(""))].filter((L) => getSign(letterId(L)));
    onAnswer({ correct, items: letters.map((L) => ({ id: letterId(L), correct })) });
  };

  const sign = shown >= 0 ? getSign(letterId(word[shown])) : undefined;

  return (
    <div className="activity">
      <h2 className="prompt">Deletreo rápido: ¿qué palabra es?</h2>
      <div className="spell-stage">
        {phase === "ready" && <button className="btn btn-primary" onClick={play}>▶ Ver deletreo</button>}
        {phase === "playing" && (sign ? <img src={sign.media.src} alt="letra" /> : <div className="spell-blank" />)}
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
      <div className="credit center">Alfabeto: ilustraciones de dominio público (Wikimedia Commons)</div>
    </div>
  );
}
