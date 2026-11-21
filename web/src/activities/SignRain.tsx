import { useEffect, useRef, useState } from "react";
import { label } from "../content/curriculum";
import { shuffle, signOptions, type Answer } from "../lib/engine";
import type { Profile } from "../learning/profile";
import { SignViewer } from "../viewer/SignViewer";

const LIVES = 3;

/**
 * Sign rain (receptive game): signs fall one after another; pick the meaning before the sign
 * reaches the ground. Each hit makes the next one fall faster (retrieval under time pressure).
 */
export function SignRain({ items, profile, onAnswer, locked }: { items: string[]; profile: Profile; onAnswer: (a: Answer) => void; locked: boolean }) {
  const [queue] = useState(() => shuffle(items));
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"intro" | "play" | "end">("intro");
  const [y, setY] = useState(0);                  // 0 … 1 fall progress
  const [fallSec, setFallSec] = useState(() => 9 - 2 * profile.difficulty);
  const [lives, setLives] = useState(LIVES);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const results = useRef<Answer["items"]>([]);
  const t0 = useRef(0);
  const busy = useRef(false);

  const id = queue[i];

  useEffect(() => {
    if (phase !== "play" || !id) return;
    setOptions(signOptions(id, profile));
    setY(0);
    t0.current = performance.now();
    busy.current = false;
    let raf = 0;
    const tick = () => {
      const p = (performance.now() - t0.current) / 1000 / fallSec;
      setY(Math.min(1, p));
      if (p >= 1) answer(null);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [i, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function answer(opt: string | null) {
    if (busy.current || locked) return;
    busy.current = true;
    const correct = opt === id;
    results.current.push({ id, correct, ms: Math.round(performance.now() - t0.current), confusedWith: !correct && opt ? opt : undefined });
    setFlash(correct ? "ok" : "bad");
    const left = correct ? lives : lives - 1;
    setLives(left);
    if (correct) setFallSec((s) => Math.max(3, s * 0.85));
    setTimeout(() => {
      setFlash(null);
      if (left <= 0 || i + 1 >= queue.length) {
        setPhase("end");
        const ok = results.current.filter((r) => r.correct).length;
        onAnswer({ correct: ok >= Math.ceil(results.current.length * 0.7), items: results.current, xp: ok * 4 + (left > 0 ? 6 : 0) });
      } else setI(i + 1);
    }, 550);
  }

  if (phase === "intro") {
    return (
      <div className="activity center">
        <h2 className="prompt">🌧 Lluvia de signos</h2>
        <p>Van a caer {queue.length} signos. Elige su significado antes de que toquen el suelo. Cada acierto, más rápido. Tienes {LIVES} vidas.</p>
        <button className="btn btn-primary" onClick={() => setPhase("play")}>¡Que llueva!</button>
      </div>
    );
  }
  const ok = results.current.filter((r) => r.correct).length;
  return (
    <div className="activity">
      <div className="row-between rain-hud">
        <span className="chip">{"❤️".repeat(Math.max(0, lives))}{"🤍".repeat(LIVES - Math.max(0, lives))}</span>
        <span className="chip">{Math.min(i + 1, queue.length)}/{queue.length}</span>
        <span className="chip chip-on">⭐ {ok}</span>
      </div>
      <div className={`rain-sky ${flash ? `rain-${flash}` : ""}`}>
        {phase === "play" && id && (
          <div className="rain-drop" style={{ top: `${y * 62}%` }}>
            <SignViewer key={id} ids={[id]} size="sm" controls={false} credit={false} />
          </div>
        )}
        <div className="rain-ground" />
      </div>
      <div className="options">
        {options.map((o) => (
          <button key={o} className="option" disabled={phase !== "play" || busy.current} onClick={() => answer(o)}>
            <span className="opt-main">{label(o)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
