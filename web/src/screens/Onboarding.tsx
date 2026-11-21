import { useState } from "react";
export interface OnboardingAnswers { selfLevel: 0 | 1 | 2 | 3; goalMin: 5 | 10 | 15; camera: boolean }
type Profile = OnboardingAnswers;

const LEVELS: { v: Profile["selfLevel"]; t: string; d: string; e: string }[] = [
  { v: 0, t: "Nunca he signado", d: "Empiezo desde cero", e: "🌱" },
  { v: 1, t: "Conozco el alfabeto", d: "Sé deletrear algunas letras", e: "🔤" },
  { v: 2, t: "Conozco palabras básicas", d: "Saludos, familia, colores…", e: "👋" },
  { v: 3, t: "Puedo formar frases", d: "Me defiendo con frases cortas", e: "💬" },
];
const GOALS: { v: Profile["goalMin"]; t: string; d: string }[] = [
  { v: 5, t: "5 min / día", d: "Casual" },
  { v: 10, t: "10 min / día", d: "Regular" },
  { v: 15, t: "15 min / día", d: "Intenso" },
];

export function Onboarding({ onDone }: { onDone: (p: OnboardingAnswers, takeTest: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<Profile["selfLevel"] | null>(null);
  const [goal, setGoal] = useState<Profile["goalMin"] | null>(null);
  const [camera, setCamera] = useState<boolean | null>(null);
  const [camTest, setCamTest] = useState<"idle" | "ok" | "fail">("idle");

  const testCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
      setCamTest("ok");
      setCamera(true);
    } catch {
      setCamTest("fail");
      setCamera(false);
    }
  };

  const finish = (takeTest: boolean) => onDone({ selfLevel: level!, goalMin: goal!, camera: !!camera }, takeTest);

  return (
    <div className="screen onboarding">
      <div className="steps">{[0, 1, 2, 3].map((i) => <span key={i} className={i <= step ? "on" : ""} />)}</div>

      {step === 0 && (
        <div className="card center">
          <div className="hero-emoji">🤟</div>
          <h1>Aprende Lengua de Signos Americana</h1>
          <p>Lecciones cortas cada día con vídeos de signantes reales y práctica con tu webcam.</p>
          <p className="muted small">Todo el contenido es ASL (American Sign Language), no LSE.</p>
          <button className="btn btn-primary btn-wide" onClick={() => setStep(1)}>Empezar</button>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h2>¿Cuánto ASL sabes ya?</h2>
          <div className="choice-list">
            {LEVELS.map((l) => (
              <button key={l.v} className={`choice ${level === l.v ? "choice-on" : ""}`} onClick={() => setLevel(l.v)}>
                <span className="choice-emoji">{l.e}</span>
                <span><b>{l.t}</b><br /><span className="muted">{l.d}</span></span>
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-wide" disabled={level === null} onClick={() => setStep(2)}>Continuar</button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h2>¿Cuál es tu objetivo diario?</h2>
          <div className="choice-list">
            {GOALS.map((g) => (
              <button key={g.v} className={`choice ${goal === g.v ? "choice-on" : ""}`} onClick={() => setGoal(g.v)}>
                <span className="choice-emoji">⏱</span>
                <span><b>{g.t}</b><br /><span className="muted">{g.d}</span></span>
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-wide" disabled={goal === null} onClick={() => setStep(3)}>Continuar</button>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2>¿Practicamos con la cámara?</h2>
          <p>En las lecciones de dactilología podrás signar letras ante la webcam y recibir feedback al momento. El vídeo se procesa en tu navegador y no se envía a ningún sitio.</p>
          <div className="choice-list">
            <button className={`choice ${camera === true ? "choice-on" : ""}`} onClick={testCamera}>
              <span className="choice-emoji">📷</span>
              <span><b>Sí, usar mi cámara</b><br /><span className="muted">
                {camTest === "ok" ? "Cámara lista ✓" : camTest === "fail" ? "No se pudo acceder a la cámara" : "Te pediremos permiso"}
              </span></span>
            </button>
            <button className={`choice ${camera === false ? "choice-on" : ""}`} onClick={() => setCamera(false)}>
              <span className="choice-emoji">🙈</span>
              <span><b>Ahora no</b><br /><span className="muted">Solo ejercicios de vídeo</span></span>
            </button>
          </div>
          {level === 0 ? (
            <div className="stack">
              <button className="btn btn-primary btn-wide" disabled={camera === null} onClick={() => finish(false)}>Empezar desde cero</button>
              <button className="btn btn-ghost btn-wide" disabled={camera === null} onClick={() => finish(true)}>Hacer la prueba de nivel igualmente</button>
            </div>
          ) : (
            <button className="btn btn-primary btn-wide" disabled={camera === null} onClick={() => finish(true)}>Hacer la prueba de nivel (1 min)</button>
          )}
        </div>
      )}
    </div>
  );
}
