import { useEffect, useMemo, useRef, useState } from "react";
import { getSign, label } from "../content/curriculum";
import { SignViewer } from "../viewer/SignViewer";
import { shuffle, type Answer } from "../lib/engine";

/** Match sign videos with their meaning against the clock. Mistakes cost 2 seconds. */
export function Matching({ signIds, seconds, onAnswer, locked }: {
  signIds: string[]; seconds: number; onAnswer: (a: Answer) => void; locked: boolean;
}) {
  const left = useMemo(() => shuffle(signIds), [signIds]);
  const right = useMemo(() => shuffle(signIds), [signIds]);
  const [selL, setSelL] = useState<string | null>(null);
  const [selR, setSelR] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<[string, string] | null>(null);
  const [timeLeft, setTimeLeft] = useState(seconds);
  const mistakes = useRef<Record<string, number>>({});
  const done = useRef(false);

  const finish = (m: string[]) => {
    if (done.current) return;
    done.current = true;
    const items = signIds.map((id) => ({ id, correct: m.includes(id) && !mistakes.current[id] }));
    const good = items.filter((i) => i.correct).length;
    const all = m.length === signIds.length;
    onAnswer({ correct: all && good >= signIds.length - 1, items, xp: good * 3 + (all && good === signIds.length ? 5 : 0) });
  };

  useEffect(() => {
    if (locked) return;
    const t = setInterval(() => setTimeLeft((s) => Math.max(0, s - 0.1)), 100);
    return () => clearInterval(t);
  }, [locked]);
  useEffect(() => {
    if (timeLeft <= 0) finish(matched);
  }, [timeLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selL || !selR) return;
    if (selL === selR) {
      const m = [...matched, selL];
      setMatched(m);
      setSelL(null);
      setSelR(null);
      if (m.length === signIds.length) finish(m);
    } else {
      mistakes.current[selL] = (mistakes.current[selL] ?? 0) + 1;
      mistakes.current[selR] = (mistakes.current[selR] ?? 0) + 1;
      setWrong([selL, selR]);
      setTimeLeft((s) => Math.max(0, s - 2));
      const t = setTimeout(() => { setWrong(null); setSelL(null); setSelR(null); }, 450);
      return () => clearTimeout(t);
    }
  }, [selL, selR]); // eslint-disable-line react-hooks/exhaustive-deps

  const cls = (id: string, side: "l" | "r") => {
    if (matched.includes(id)) return "tile tile-done";
    if (wrong && wrong[side === "l" ? 0 : 1] === id) return "tile tile-wrong";
    if ((side === "l" ? selL : selR) === id) return "tile tile-sel";
    return "tile";
  };
  const isLetter = getSign(signIds[0])?.kind === "letter";
  const disabled = locked || done.current;

  return (
    <div className="activity">
      <h2 className="prompt">Une cada signo con su significado</h2>
      <div className="timer"><div style={{ width: `${(timeLeft / seconds) * 100}%` }} className={timeLeft < 8 ? "timer-low" : ""} /></div>
      <div className="match-grid">
        <div className="match-col">
          {left.map((id) => (
            <button key={id} className={cls(id, "l")} disabled={disabled || matched.includes(id)} onClick={() => setSelL(id)}>
              <SignViewer ids={[id]} size="sm" controls={false} credit={false} />
            </button>
          ))}
        </div>
        <div className="match-col">
          {right.map((id) => (
            <button key={id} className={`${cls(id, "r")} tile-word ${isLetter ? "tile-letter" : ""}`} disabled={disabled || matched.includes(id)} onClick={() => setSelR(id)}>
              {label(id)}
            </button>
          ))}
        </div>
      </div>
      <div className="credit center">Signos: movimiento real de WLASL (diccionarios ASL) · Letras: mano 3D verificada</div>
    </div>
  );
}
