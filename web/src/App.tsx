import { useEffect, useState } from "react";
import { UNITS, hasMedia, registerPhrases } from "./content/curriculum";
import { buildLesson, finishSession, recordItems, type Exercise } from "./lib/engine";
import { emptyProgress, load, reset, save, type Profile, type Progress, type Saved } from "./lib/storage";
import { Onboarding } from "./screens/Onboarding";
import { Placement } from "./screens/Placement";
import { Home } from "./screens/Home";
import { Lesson, type LessonSummary } from "./screens/Lesson";
import { Results } from "./screens/Results";
import { SignSprint } from "./activities/SignSprint";
import { Lab } from "./screens/Lab";

type Screen =
  | { name: "onboarding" }
  | { name: "placement" }
  | { name: "home" }
  | { name: "lesson"; unitIdx: number; exercises: Exercise[] }
  | { name: "results"; unitIdx: number; summary: LessonSummary }
  | { name: "sprint" };

const initial = load();
registerPhrases(initial.progress.aiPhrases);

export function App() {
  const [saved, setSaved] = useState<Saved>(initial);
  const [screen, setScreen] = useState<Screen>(
    !initial.profile ? { name: "onboarding" } : !initial.profile.placementDone ? { name: "placement" } : { name: "home" },
  );
  useEffect(() => save(saved), [saved]);
  const [lab, setLab] = useState(() => location.hash === "#lab");
  useEffect(() => {
    const on = () => setLab(location.hash === "#lab");
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);

  const { profile, progress } = saved;
  const setProgress = (fn: (p: Progress) => Progress) => setSaved((s) => ({ ...s, progress: fn(s.progress) }));
  const setProfile = (p: Profile) => setSaved((s) => ({ ...s, profile: p }));

  if (lab) return <Lab onExit={() => { location.hash = ""; }} />;

  if (!hasMedia) {
    return (
      <div className="screen"><div className="card center">
        <h1>Faltan los vídeos de signos</h1>
        <p>Ejecuta <code>npm run setup:media</code> en la carpeta <code>web/</code> para descargar los clips reales (WLASL) y el alfabeto.</p>
      </div></div>
    );
  }

  switch (screen.name) {
    case "onboarding":
      return (
        <Onboarding onDone={(p, takeTest) => {
          setSaved({
            profile: { ...p, startUnit: 0, placementDone: !takeTest, createdAt: new Date().toISOString() },
            progress: emptyProgress(),
          });
          setScreen(takeTest ? { name: "placement" } : { name: "home" });
        }} />
      );

    case "placement":
      return (
        <Placement onDone={(startUnit, items) => {
          setSaved((s) => ({ profile: { ...s.profile!, startUnit, placementDone: true }, progress: recordItems(s.progress, items) }));
          setScreen({ name: "home" });
        }} />
      );

    case "home":
      return (
        <Home
          profile={profile!}
          progress={progress}
          onStart={(unitIdx) => setScreen({ name: "lesson", unitIdx, exercises: buildLesson(profile!, progress, unitIdx) })}
          onSprint={() => setScreen({ name: "sprint" })}
          onProgress={setProgress}
          onProfile={setProfile}
          onReset={() => { reset(); setSaved({ profile: null, progress: emptyProgress() }); setScreen({ name: "onboarding" }); }}
        />
      );

    case "lesson":
      return (
        <Lesson
          exercises={screen.exercises}
          onAnswer={(items) => setProgress((p) => recordItems(p, items))}
          onExit={() => setScreen({ name: "home" })}
          onFinish={(summary) => {
            setProgress((p) => finishSession(p, summary.xp, summary.seconds));
            setScreen({ name: "results", unitIdx: screen.unitIdx, summary });
          }}
        />
      );

    case "results":
      return (
        <Results
          summary={screen.summary}
          profile={profile!}
          progress={progress}
          level={UNITS[screen.unitIdx].level}
          onCoach={(c) => setProgress((p) => ({ ...p, difficulty: c.difficulty, focus: c.focus }))}
          onDone={() => setScreen({ name: "home" })}
        />
      );

    case "sprint":
      return (
        <div className="screen lesson">
          <SignSprint
            best={progress.sprintBest}
            onExit={(r) => {
              if (r) {
                setProgress((p) => {
                  const withItems = recordItems(p, r.items);
                  return { ...finishSession(withItems, r.score * 2, 60), sprintBest: Math.max(p.sprintBest, r.score) };
                });
              }
              setScreen({ name: "home" });
            }}
          />
        </div>
      );
  }
}
