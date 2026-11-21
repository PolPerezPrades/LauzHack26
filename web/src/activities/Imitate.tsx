import { useEffect, useRef, useState } from "react";
import { letterId } from "../content/curriculum";
import { CameraView } from "../components/CameraView";
import { describe, evaluateLetter, matchingLetters, type Evaluation, type Features, type Part } from "../lib/handshapes";
import type { Answer } from "../lib/engine";
import type { Highlight } from "../viewer/HandMesh";
import { SignViewer } from "../viewer/SignViewer";

const HOLD_FRAMES = 12; // ~0.4 s of a correct handshape in a row
const PARTS: { id: Part; label: string }[] = [
  { id: "thumb", label: "Pulgar" }, { id: "index", label: "Índice" }, { id: "middle", label: "Corazón" },
  { id: "ring", label: "Anular" }, { id: "pinky", label: "Meñique" }, { id: "orientation", label: "Orientación" },
];

/**
 * Imitate the sign (productive, camera). The 3D reference hand lights up the fingers to fix,
 * a per-part checklist updates live, and if the hand matches ANOTHER letter the learner is told
 * which one ("eso parece una N") — that confusion is logged for the learner model.
 */
export function Imitate({ letter, onAnswer, locked }: { letter: string; onAnswer: (a: Answer) => void; locked: boolean }) {
  const [ev, setEv] = useState<Evaluation | null>(null);
  const [looksLike, setLooksLike] = useState<string | null>(null);
  const [hold, setHold] = useState(0);
  const [debug, setDebug] = useState(false);
  const [debugText, setDebugText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const holdRef = useRef(0);
  const doneRef = useRef(false);
  const lastUi = useRef(0);
  const confusions = useRef<Record<string, number>>({});
  const t0 = useRef(performance.now());

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const finish = (correct: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const top = Object.entries(confusions.current).sort((a, b) => b[1] - a[1])[0];
    onAnswer({ correct, items: [{ id: letterId(letter), correct, modality: "productive", ms: Math.round(performance.now() - t0.current),
      confusedWith: !correct && top && top[1] > 10 ? letterId(top[0]) : undefined }] });
  };

  const onFrame = (f: Features | null) => {
    if (doneRef.current || locked) return;
    const e = f ? evaluateLetter(letter, f) : null;
    const other = f && e && !e.ok ? matchingLetters(f).filter((L) => L !== letter)[0] ?? null : null;
    if (other) confusions.current[other] = (confusions.current[other] ?? 0) + 1;
    holdRef.current = e?.ok ? holdRef.current + 1 : Math.max(0, holdRef.current - 2);
    if (holdRef.current >= HOLD_FRAMES) {
      setHold(HOLD_FRAMES); setEv(e); setLooksLike(null);
      return finish(true);
    }
    const now = performance.now();
    if (now - lastUi.current > 120) { // throttle React updates
      lastUi.current = now;
      setEv(e);
      setLooksLike(other);
      setHold(holdRef.current);
      if (debug && f) setDebugText(describe(f));
    }
  };

  const done = doneRef.current;
  const success = done && hold >= HOLD_FRAMES;
  const wrong = new Set(ev?.wrong ?? []);
  const highlight: Highlight | undefined = ev
    ? Object.fromEntries((["thumb", "index", "middle", "ring", "pinky"] as const).map((k) => [k, success || !wrong.has(k) ? "ok" : "error"]))
    : undefined;
  const status = success ? "¡Perfecto!" : !ev ? "Muestra tu mano a la cámara" : ev.ok ? "¡Así! Mantén la posición…" : ev.hints[0];

  return (
    <div className="activity">
      <h2 className="prompt">Imita la letra <span className="big-letter">{letter}</span></h2>
      <div className="imitate-grid">
        <div className="imitate-ref">
          <SignViewer ids={[letterId(letter)]} size="md" credit={false} highlight={highlight} />
          <div className="muted small center">Los dedos en rojo son los que tienes que corregir</div>
        </div>
        <CameraView onFrame={onFrame} highlight={success ? "ok" : ev?.ok ? "near" : "none"}>
          <div className="cam-status">
            <div className="hold-bar"><div style={{ width: `${(hold / HOLD_FRAMES) * 100}%` }} /></div>
            <div className="cam-hint">{status}</div>
            {looksLike && !success && <div className="cam-hint2">Eso parece una <b>{looksLike}</b></div>}
            {ev && !ev.ok && ev.hints.length > 1 && <div className="cam-hint2">{ev.hints.slice(1, 3).join(" · ")}</div>}
          </div>
        </CameraView>
      </div>
      <div className="parts">
        {PARTS.map((p) => {
          const state = !ev ? "idle" : success || !wrong.has(p.id) ? "ok" : "bad";
          return <span key={p.id} className={`part part-${state}`}>{state === "ok" ? "✓" : state === "bad" ? "✗" : "·"} {p.label}</span>;
        })}
      </div>
      {debug && <pre className="debug">{debugText || "sin mano"}</pre>}
      <div className="row-between">
        <button className="link" onClick={() => setDebug(!debug)}>🔧 {debug ? "Ocultar" : "Ver"} datos del detector</button>
        {!done && !locked && (
          <button className={`btn ${elapsed > 15 ? "btn-secondary" : "btn-ghost"}`} onClick={() => finish(false)}>
            {elapsed > 15 ? "Saltar esta letra" : "Saltar"}
          </button>
        )}
      </div>
    </div>
  );
}
