import { useEffect, useRef, useState } from "react";
import { PHRASES, label } from "../content/curriculum";
import { phraseOptions, signOptions, type Answer } from "../lib/engine";
import type { Profile } from "../learning/profile";
import { SignViewer } from "../viewer/SignViewer";

const SECONDS = 12;

/** Mini-exam: a few quick questions, no slow motion or replays, a timer per question. */
export function Quiz({ items, profile, onAnswer, locked }: { items: string[]; profile: Profile; onAnswer: (a: Answer) => void; locked: boolean }) {
  const [i, setI] = useState(0);
  const [options] = useState(() => items.map((id) => (PHRASES.has(id) ? phraseOptions(id) : signOptions(id, profile))));
  const [chosen, setChosen] = useState<string | null>(null);
  const [left, setLeft] = useState(SECONDS);
  const results = useRef<Answer["items"]>([]);
  const t0 = useRef(performance.now());

  const id = items[i];
  const ids = PHRASES.get(id)?.signs ?? [id];

  useEffect(() => {
    if (chosen || locked) return;
    const t = setInterval(() => setLeft((s) => s - 0.1), 100);
    return () => clearInterval(t);
  }, [i, chosen, locked]);
  useEffect(() => { if (left <= 0 && !chosen) choose("__timeout__"); }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  function choose(opt: string) {
    if (chosen || locked) return;
    setChosen(opt);
    const correct = opt === id;
    results.current.push({ id, correct, confusedWith: correct || opt === "__timeout__" ? undefined : opt, ms: Math.round(performance.now() - t0.current) });
    setTimeout(() => {
      if (i + 1 < items.length) {
        setI(i + 1); setChosen(null); setLeft(SECONDS); t0.current = performance.now();
      } else {
        const ok = results.current.filter((r) => r.correct).length;
        onAnswer({ correct: ok === items.length, items: results.current, xp: ok * 6 + (ok === items.length ? 6 : 0) });
      }
    }, 650);
  }

  return (
    <div className="activity">
      <div className="badge">🎯 Mini-examen · {i + 1}/{items.length}</div>
      <h2 className="prompt">{PHRASES.has(id) ? "¿Qué significa?" : "¿Qué signo es?"}</h2>
      <div className="timer"><div style={{ width: `${(left / SECONDS) * 100}%` }} className={left < 4 ? "timer-low" : ""} /></div>
      <SignViewer key={id} ids={ids} controls={false} credit={false} />
      <div className="options">
        {options[i].map((o) => (
          <button key={o} className={`option ${!chosen ? "" : o === id ? "opt-correct" : o === chosen ? "opt-wrong" : "opt-dim"}`} disabled={!!chosen || locked} onClick={() => choose(o)}>
            <span className="opt-main">{label(o)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
