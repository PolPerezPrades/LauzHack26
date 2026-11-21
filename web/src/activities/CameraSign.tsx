import { useEffect, useRef, useState } from "react";
import { getSign, letterId } from "../content/curriculum";
import { CameraView } from "../components/CameraView";
import { SignViewer } from "../viewer/SignViewer";
import { describe, evaluateLetter, type Evaluation, type Features } from "../lib/handshapes";
import type { Answer } from "../lib/engine";

const HOLD_FRAMES = 12; // ~0.4 s of a correct handshape in a row

/** Fingerspell a letter in front of the webcam; MediaPipe Hands checks the handshape live. */
export function CameraSign({ letter, onAnswer, locked }: { letter: string; onAnswer: (a: Answer) => void; locked: boolean }) {
  const [ev, setEv] = useState<Evaluation | null>(null);
  const [hold, setHold] = useState(0);
  const [debug, setDebug] = useState(false);
  const [debugText, setDebugText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const holdRef = useRef(0);
  const doneRef = useRef(false);
  const lastUi = useRef(0);
  const sign = getSign(letterId(letter));

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const onFrame = (f: Features | null) => {
    if (doneRef.current || locked) return;
    const e = f ? evaluateLetter(letter, f) : null;
    holdRef.current = e?.ok ? holdRef.current + 1 : Math.max(0, holdRef.current - 2);
    if (holdRef.current >= HOLD_FRAMES) {
      doneRef.current = true;
      setHold(HOLD_FRAMES);
      setEv(e);
      onAnswer({ correct: true, items: [{ id: letterId(letter), correct: true }] });
      return;
    }
    const now = performance.now();
    if (now - lastUi.current > 120) { // throttle React updates
      lastUi.current = now;
      setEv(e);
      setHold(holdRef.current);
      if (debug && f) setDebugText(describe(f));
    }
  };

  const skip = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onAnswer({ correct: false, items: [{ id: letterId(letter), correct: false }] });
  };

  const success = doneRef.current && hold >= HOLD_FRAMES;
  const status = success ? "¡Perfecto!" : !ev ? "Muestra tu mano a la cámara" : ev.ok ? "¡Así! Mantén la posición…" : ev.hints[0];

  return (
    <div className="activity">
      <h2 className="prompt">Signa la letra <span className="big-letter">{letter}</span></h2>
      <div className="camera-row">
        <div className="ref-card">
          {sign && <SignViewer ids={[sign.id]} size="md" credit={false} controls={false} />}
          <div className="credit">Referencia</div>
        </div>
        <CameraView onFrame={onFrame} highlight={success ? "ok" : ev?.ok ? "near" : "none"}>
          <div className="cam-status">
            <div className="hold-bar"><div style={{ width: `${(hold / HOLD_FRAMES) * 100}%` }} /></div>
            <div className="cam-hint">{status}</div>
            {ev && !ev.ok && ev.hints.length > 1 && <div className="cam-hint2">{ev.hints.slice(1, 3).join(" · ")}</div>}
          </div>
        </CameraView>
      </div>
      {debug && <pre className="debug">{debugText || "sin mano"}</pre>}
      <div className="row-between">
        <button className="link" onClick={() => setDebug(!debug)}>🔧 {debug ? "Ocultar" : "Ver"} datos del detector</button>
        {!doneRef.current && !locked && (
          <button className={`btn ${elapsed > 15 ? "btn-secondary" : "btn-ghost"}`} onClick={skip}>
            {elapsed > 15 ? "Saltar esta letra" : "Saltar"}
          </button>
        )}
      </div>
    </div>
  );
}
