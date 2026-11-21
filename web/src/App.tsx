import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UNITS } from "./content/curriculum";
import { openRepository } from "./data/dexieRepository";
import { makeEvent, type EventBody, type LearningEvent, type SessionContext } from "./data/events";
import { migrateLegacy } from "./data/legacy";
import { exportLog, parseExport, type LearningRepository } from "./data/repository";
import { contextNow, type SessionPlan } from "./learning/orchestrator";
import { buildProfile } from "./learning/profile";
import { Home } from "./screens/Home";
import { Lab } from "./screens/Lab";
import { Onboarding } from "./screens/Onboarding";
import { Placement } from "./screens/Placement";
import { Results } from "./screens/Results";
import { Session, type SessionResult } from "./screens/Session";

type Screen = { name: "home" } | { name: "session"; plan: SessionPlan } | { name: "results"; result: SessionResult };

const UNIT_ORDER = UNITS.map((u) => u.id);

export function App() {
  const [repo, setRepo] = useState<LearningRepository | null>(null);
  const [persistent, setPersistent] = useState(true);
  const [events, setEvents] = useState<LearningEvent[]>([]);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const [ctxOverride, setCtxOverride] = useState<Partial<SessionContext>>({});
  const [lab, setLab] = useState(() => location.hash === "#lab");
  const queue = useRef(Promise.resolve());

  // load the event log (IndexedDB) once; migrate v1 localStorage progress the first time
  useEffect(() => {
    (async () => {
      const { repo, persistent } = await openRepository();
      await migrateLegacy(repo);
      setEvents(await repo.all());
      setPersistent(persistent);
      setRepo(repo);
    })();
    navigator.mediaDevices?.enumerateDevices?.()
      .then((d) => setCameraAvailable(d.some((x) => x.kind === "videoinput")))
      .catch(() => setCameraAvailable(false));
    const on = () => setLab(location.hash === "#lab");
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);

  /** Append to the immutable log (serialised so the order is preserved). */
  const emit = useCallback((body: EventBody) => {
    if (!repo) return;
    const e = makeEvent(body);
    setEvents((prev) => [...prev, e]);
    queue.current = queue.current.then(() => repo.append(e).then(() => undefined)).catch((err) => console.error("[log]", err));
  }, [repo]);

  // the profile is ALWAYS derived from the log
  const profile = useMemo(() => buildProfile(events, { unitOrder: UNIT_ORDER }), [events]);

  const ctx: SessionContext = useMemo(() => {
    const base = contextNow(profile.settings.cameraPref, profile.settings.goalMin, cameraAvailable);
    return { ...base, ...ctxOverride, camera: (ctxOverride.camera ?? base.camera) && cameraAvailable && profile.settings.cameraPref };
  }, [profile.settings.cameraPref, profile.settings.goalMin, cameraAvailable, ctxOverride]);

  if (lab) return <Lab onExit={() => { location.hash = ""; }} />;
  if (!repo) return <div className="screen"><div className="card center">Cargando…</div></div>;

  if (!profile.settings.onboarded) {
    return (
      <Onboarding onDone={(a, takeTest) => {
        emit({ type: "profile.set", selfLevel: a.selfLevel, goalMin: a.goalMin, cameraPref: a.camera });
        if (!takeTest) emit({ type: "placement.done", startUnit: "abc1", demonstrated: 0 });
        if (a.camera) setCameraAvailable(true);
      }} />
    );
  }
  if (!profile.settings.placementDone) {
    return (
      <Placement onDone={(r, items) => {
        for (const it of items) emit({ type: "answer", activity: "placement", itemId: it.id, modality: "receptive", correct: it.correct, confusedWith: it.confusedWith });
        emit({ type: "placement.done", startUnit: r.startUnit, demonstrated: r.demonstrated });
        setScreen({ name: "home" });
      }} />
    );
  }

  switch (screen.name) {
    case "session":
      return (
        <Session
          plan={screen.plan}
          profile={profile}
          ctx={ctx}
          emit={emit}
          onExit={() => setScreen({ name: "home" })}
          onFinish={(result) => setScreen({ name: "results", result })}
        />
      );
    case "results":
      return <Results result={screen.result} profile={profile} events={events} onDone={() => setScreen({ name: "home" })} />;
    default:
      return (
        <Home
          profile={profile}
          ctx={ctx}
          cameraAvailable={cameraAvailable}
          persistent={persistent}
          onContext={(c) => setCtxOverride((o) => ({ ...o, ...c }))}
          onStart={(plan) => setScreen({ name: "session", plan })}
          onSettings={(s) => emit({ type: "settings.set", ...s })}
          onExport={async () => {
            const blob = new Blob([JSON.stringify(await exportLog(repo), null, 1)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `signa-progreso-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}
          onImport={async (file) => {
            try {
              const evs = parseExport(JSON.parse(await file.text()));
              if (!confirm(`¿Sustituir tu progreso por el del archivo (${evs.length} eventos)?`)) return;
              await repo.replaceAll(evs);
              setEvents(await repo.all());
            } catch (e) {
              alert(`No se pudo importar: ${(e as Error).message}`);
            }
          }}
          onReset={async () => {
            await repo.replaceAll([]);
            setEvents([]);
            setCtxOverride({});
          }}
        />
      );
  }
}
