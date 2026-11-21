import { useMemo, useRef, useState } from "react";
import { LEVEL_NAMES, UNITS } from "../content/curriculum";
import type { SessionContext } from "../data/events";
import { ACTIVITIES, ACTIVITY } from "../learning/activityCatalog";
import { frontierUnit, planSession, unitProgress, type PlanRequest, type SessionPlan } from "../learning/orchestrator";
import type { Profile } from "../learning/profile";

interface Props {
  profile: Profile;
  ctx: SessionContext;
  cameraAvailable: boolean;
  onContext: (c: Partial<SessionContext>) => void;
  onStart: (plan: SessionPlan) => void;
  onSettings: (s: { goalMin?: number; cameraPref?: boolean }) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
  persistent: boolean;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function Home({ profile, ctx, cameraAvailable, onContext, onStart, onSettings, onExport, onImport, onReset, persistent }: Props) {
  const [why, setWhy] = useState(false);
  const [settings, setSettings] = useState(false);
  const [seed, setSeed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  // the session for today, regenerated whenever the profile or the context changes
  const plan = useMemo(() => planSession(profile, ctx, { mode: "auto" }), [profile, ctx, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const frontier = frontierUnit(profile);
  const goalSec = profile.settings.goalMin * 60;
  const goalPct = Math.min(1, profile.today.seconds / goalSec);
  const start = (req: PlanRequest) => onStart(planSession(profile, ctx, req));

  return (
    <div className="screen home">
      <header className="topbar">
        <div className="brand">🤟 Signa <span className="muted small">ASL</span></div>
        <div className="stats">
          <span className="stat" title="Racha de días">🔥 {profile.streak}</span>
          <span className="stat" title="Puntos de experiencia">⭐ {profile.xp}</span>
          <button className="stat stat-btn" onClick={() => setSettings(!settings)} title="Ajustes">⚙️</button>
        </div>
      </header>

      {settings && (
        <div className="card settings">
          <h3>Ajustes</h3>
          <div className="row-between">
            <span>Objetivo diario</span>
            <div className="seg">
              {[5, 10, 15].map((g) => (
                <button key={g} className={profile.settings.goalMin === g ? "on" : ""} onClick={() => onSettings({ goalMin: g })}>{g} min</button>
              ))}
            </div>
          </div>
          <div className="row-between">
            <span>Usar la cámara cuando esté disponible</span>
            <button className="chip" onClick={() => onSettings({ cameraPref: !profile.settings.cameraPref })}>{profile.settings.cameraPref ? "Sí" : "No"}</button>
          </div>
          <div className="row-between">
            <span>Tus datos ({profile.eventCount} eventos{persistent ? ", guardados en este navegador" : ", solo en memoria"})</span>
            <span className="row-center">
              <button className="chip" onClick={onExport}>⬇ Exportar JSON</button>
              <button className="chip" onClick={() => fileRef.current?.click()}>⬆ Importar</button>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
            </span>
          </div>
          <div className="row-between">
            <a className="link" href="#lab">🔬 Laboratorio de signos</a>
            <button className="btn btn-danger" onClick={() => confirm("¿Borrar todo el progreso?") && onReset()}>Reiniciar progreso</button>
          </div>
        </div>
      )}

      {/* ---- today's session: generated automatically ---- */}
      <section className="card today">
        <div className="today-head">
          <div className="ring" style={{ ["--p" as string]: goalPct }}><span>{pct(goalPct)}</span></div>
          <div className="goal-text">
            <b>Tu sesión de hoy</b>
            <div className="muted">{Math.floor(profile.today.seconds / 60)} de {profile.settings.goalMin} min · {profile.today.xp} XP hoy · tema: {frontier.icon} {frontier.title}</div>
          </div>
        </div>
        <div className="ctx-row">
          <span className="muted small">Ahora mismo:</span>
          <button className={`chip ${ctx.camera ? "chip-on" : ""}`} disabled={!cameraAvailable || !profile.settings.cameraPref}
            onClick={() => onContext({ camera: !ctx.camera })} title={cameraAvailable ? "" : "No se detecta ninguna cámara"}>
            📷 {ctx.camera ? "con cámara" : "sin cámara"}
          </button>
          <div className="seg">
            {[5, 10, 15].map((m) => <button key={m} className={ctx.minutes === m ? "on" : ""} onClick={() => onContext({ minutes: m })}>{m} min</button>)}
          </div>
        </div>
        <div className="plan-strip">
          {plan.steps.map((s, k) => (
            <span key={k} className={`plan-dot plan-${ACTIVITY.get(s.activity)?.kind}`} title={`${ACTIVITY.get(s.activity)?.title}: ${s.why.join(" · ")}`}>
              {ACTIVITY.get(s.activity)?.icon}
            </span>
          ))}
        </div>
        <div className="row-between">
          <button className="link" onClick={() => setWhy(!why)}>{why ? "Ocultar" : "¿Por qué este plan?"}</button>
          <button className="link" onClick={() => setSeed(seed + 1)}>↻ Otro plan</button>
        </div>
        {why && (
          <div className="why-box">
            <ul>{plan.log.map((l, k) => <li key={k}>{l}</li>)}</ul>
            <ol>{plan.steps.map((s, k) => <li key={k}><b>{ACTIVITY.get(s.activity)?.title}</b>{s.items.length ? ` (${s.items.length})` : ""}: {s.why.join(" · ")}</li>)}</ol>
          </div>
        )}
        <button className="btn btn-primary btn-wide btn-big" onClick={() => onStart(plan)} disabled={!plan.steps.length}>
          {profile.today.seconds >= goalSec ? "Practicar más" : "Empezar"}
        </button>
      </section>

      {/* ---- games: free access ---- */}
      <h3 className="level-title">Juegos</h3>
      <div className="games">
        {ACTIVITIES.filter((a) => a.inCatalog).map((a) => {
          const blocked = a.requires.camera && !ctx.camera;
          return (
            <button key={a.id} className="game-card" disabled={blocked} onClick={() => start({ mode: "game", activityId: a.id })}>
              <span className="game-icon">{a.icon}</span>
              <span><b>{a.title}</b><br /><span className="muted small">{blocked ? "Necesita cámara" : a.description}</span></span>
              <span className="game-tags">
                <span className={`tag tag-${a.trains}`}>{a.trains === "productive" ? "productiva" : "receptiva"}</span>
                {profile.gameBest[a.id] ? <span className="tag">🏆 {profile.gameBest[a.id]}</span> : null}
              </span>
            </button>
          );
        })}
      </div>

      {/* ---- topics / chapters: free access ---- */}
      {[1, 2, 3].map((lvl) => (
        <section key={lvl} className="level">
          <h3 className="level-title">{LEVEL_NAMES[lvl]}</h3>
          <div className="units">
            {UNITS.filter((u) => u.level === lvl).map((u) => {
              const pr = unitProgress(u, profile);
              const hasLetters = u.id.startsWith("abc");
              return (
                <button key={u.id} className={`unit ${u.id === frontier.id ? "unit-current" : ""}`} disabled={!u.items.length} onClick={() => start({ mode: "topic", unitId: u.id })}>
                  <span className="unit-icon">{u.icon}</span>
                  <span className="unit-body">
                    <b>{u.title}{u.id === frontier.id && <span className="tag tag-now">recomendado</span>}</b>
                    <span className="unit-bar" title="Comprensión (receptiva)"><span style={{ width: pct(pr.receptive) }} /></span>
                    {hasLetters && <span className="unit-bar unit-bar-prod" title="Producción con la mano"><span style={{ width: pct(pr.productive) }} /></span>}
                    <span className="muted small">
                      {pct(pr.seen)} visto · comprensión {pct(pr.receptive)}{hasLetters ? ` · producción ${pct(pr.productive)}` : ""} · {u.items.length} {u.id === "phrases" ? "frases" : "signos"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <footer className="sources">
        Signos: movimiento real de <a href="https://dxli94.github.io/WLASL/" target="_blank" rel="noreferrer">WLASL</a> (clips de diccionarios ASL; uso académico) mostrado con avatar o vídeo ·
        Alfabeto: mano 3D contrastada con signantes reales · Detección de manos: MediaPipe (en tu navegador) · Repetición espaciada: FSRS
      </footer>
    </div>
  );
}
