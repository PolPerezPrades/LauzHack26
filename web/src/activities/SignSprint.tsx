import { useEffect, useRef, useState } from "react";
import { CAMERA_LETTERS, getSign, letterId } from "../content/curriculum";
import { CameraView } from "../components/CameraView";
import { SignViewer } from "../viewer/SignViewer";
import { evaluateLetter, type Features } from "../lib/handshapes";
import { shuffle } from "../lib/engine";

const DURATION = 60;
const HOLD = 8;
// short words without J/Z (movement letters) or doubled letters
const WORDS = ["HI", "YES", "NO", "CAT", "DOG", "SUN", "RED", "BOX", "MOM", "DAD", "EAT", "TEA", "MILK", "FISH",
  "BLUE", "PINK", "LOVE", "WORK", "HELP", "NAME", "DEAF", "BABY", "COLD", "HOT", "CAKE", "BIRD", "FROG", "LION",
  "WIND", "STAR", "MAP", "VAN", "QUIT", "KING"];

export interface SprintResult { score: number; letters: number; words: number; items: { id: string; correct: boolean }[] }

/** Mini-game: words appear, fingerspell as many as you can in 60 seconds. */
export function SignSprint({ onExit, best }: { onExit: (r: SprintResult | null) => void; best: number }) {
  const available = new Set(CAMERA_LETTERS.filter((L) => getSign(letterId(L))));
  const [queue] = useState(() => shuffle(WORDS.filter((w) => [...w].every((c) => available.has(c)))));
  const [phase, setPhase] = useState<"intro" | "play" | "end">("intro");
  const [wordIdx, setWordIdx] = useState(0);
  const [letterIdx, setLetterIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [score, setScore] = useState(0);
  const [stats, setStats] = useState({ letters: 0, words: 0 });
  const [hint, setHint] = useState("");
  const [showRef, setShowRef] = useState(false);
  const hold = useRef(0);
  const sinceLetter = useRef(performance.now());
  const items = useRef<{ id: string; correct: boolean }[]>([]);
  const state = useRef({ wordIdx: 0, letterIdx: 0, playing: false });
  state.current = { wordIdx, letterIdx, playing: phase === "play" };

  const word = queue[wordIdx % Math.max(1, queue.length)] ?? "HI";
  const letter = word[letterIdx];

  useEffect(() => {
    if (phase !== "play") return;
    const t = setInterval(() => setTimeLeft((s) => {
      if (s <= 0.1) { setPhase("end"); return 0; }
      return s - 0.1;
    }), 100);
    return () => clearInterval(t);
  }, [phase]);

  const advance = (ok: boolean) => {
    items.current.push({ id: letterId(letter), correct: ok });
    hold.current = 0;
    sinceLetter.current = performance.now();
    setShowRef(false);
    if (ok) {
      setScore((s) => s + 1);
      setStats((s) => ({ ...s, letters: s.letters + 1 }));
    }
    if (letterIdx + 1 >= word.length) {
      if (ok) {
        setScore((s) => s + 3);
        setStats((s) => ({ ...s, words: s.words + 1 }));
      }
      setWordIdx((i) => i + 1);
      setLetterIdx(0);
    } else {
      setLetterIdx((i) => i + 1);
    }
  };

  const onFrame = (f: Features | null) => {
    if (!state.current.playing) return;
    const e = f ? evaluateLetter(letter, f) : null;
    hold.current = e?.ok ? hold.current + 1 : Math.max(0, hold.current - 2);
    if (performance.now() - sinceLetter.current > 5000) setShowRef(true);
    if (hold.current >= HOLD) advance(true);
    else setHint(!e ? "Muestra tu mano" : e.ok ? "¡Mantén!" : e.hints[0]);
  };

  const refSign = getSign(letterId(letter));

  if (phase === "intro") {
    return (
      <div className="activity sprint-intro">
        <h2 className="prompt">⚡ Sprint de deletreo</h2>
        <p>Aparecerán palabras en pantalla. Deletréalas letra a letra con la mano ante la cámara. Tienes <b>{DURATION} segundos</b>.</p>
        <p className="muted">+1 por letra · +3 por palabra completa · Récord: {best}</p>
        <div className="row-center">
          <button className="btn btn-ghost" onClick={() => onExit(null)}>Volver</button>
          <button className="btn btn-primary" onClick={() => { sinceLetter.current = performance.now(); setPhase("play"); }}>¡Empezar!</button>
        </div>
      </div>
    );
  }

  if (phase === "end") {
    return (
      <div className="activity sprint-intro">
        <h2 className="prompt">¡Tiempo!</h2>
        <div className="big-score">{score}</div>
        <p>{stats.letters} letras · {stats.words} palabras {score > best && <b>· ¡Nuevo récord! 🏆</b>}</p>
        <button className="btn btn-primary btn-wide" onClick={() => onExit({ score, ...stats, items: items.current })}>Continuar</button>
      </div>
    );
  }

  return (
    <div className="activity">
      <div className="row-between sprint-hud">
        <span className="chip">⏱ {Math.ceil(timeLeft)} s</span>
        <span className="chip chip-on">⭐ {score}</span>
      </div>
      <div className="sprint-word">
        {word.split("").map((L, i) => (
          <span key={i} className={i < letterIdx ? "done" : i === letterIdx ? "cur" : ""}>{L}</span>
        ))}
      </div>
      <div className="camera-row">
        {showRef && refSign && (
          <div className="ref-card ref-small"><SignViewer ids={[refSign.id]} size="sm" controls={false} credit={false} /><div className="credit">Ayuda</div></div>
        )}
        <CameraView onFrame={onFrame}>
          <div className="cam-status"><div className="cam-hint">{hint}</div></div>
        </CameraView>
      </div>
      <div className="row-center">
        <button className="btn btn-ghost" onClick={() => advance(false)}>Saltar letra</button>
        <button className="btn btn-ghost" onClick={() => setShowRef(true)}>Ver ayuda</button>
      </div>
    </div>
  );
}
