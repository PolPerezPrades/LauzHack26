/**
 * Binds the activity catalogue (src/learning/activityCatalog.ts) to React components.
 * Every activity receives the same props — the planned step, the profile, the context — and
 * reports one ActivityResult. Configuration (options, speed, timer) is derived here from the
 * profile's difficulty, so the orchestrator stays UI-agnostic.
 */
import { useState, type ComponentType } from "react";
import { getSign, letterId } from "../content/curriculum";
import type { SessionContext } from "../data/events";
import type { PlanStep } from "../learning/orchestrator";
import type { Profile } from "../learning/profile";
import { phraseOptions, signOptions, spellWord, type Answer } from "../lib/engine";
import { Comprehension } from "./Comprehension";
import { Conversation } from "./Conversation";
import { Imitate } from "./Imitate";
import { Memory } from "./Memory";
import { SignRain } from "./SignRain";
import { FingerspellRead } from "./FingerspellRead";
import { Matching } from "./Matching";
import { Quiz } from "./Quiz";
import { Intro, Recognition } from "./Recognition";
import { SignSprint } from "./SignSprint";

export interface ActivityProps {
  step: PlanStep;
  profile: Profile;
  ctx: SessionContext;
  locked: boolean;
  onResult: (a: Answer) => void;
}

const d = (p: Profile) => p.difficulty; // -1 … +1

export const COMPONENTS: Record<string, ComponentType<ActivityProps>> = {
  intro: ({ step, onResult }) => <Intro signId={step.items[0]} onDone={() => onResult({ correct: true, items: [], xp: 0 })} />,

  recognize: function RecognizeActivity({ step, profile, onResult, locked }) {
    const [options] = useState(() => signOptions(step.items[0], profile)); // fixed once per step
    return <Recognition ex={{ kind: "recognize", signId: step.items[0], options }} onAnswer={onResult} locked={locked} />;
  },

  phrase: function PhraseActivity({ step, onResult, locked }) {
    const [options] = useState(() => phraseOptions(step.items[0]));
    return <Recognition ex={{ kind: "phrase", phraseId: step.items[0], options }} onAnswer={onResult} locked={locked} />;
  },

  match: function MatchActivity({ step, profile, onResult, locked }) {
    const [seconds] = useState(() => Math.round(40 - 12 * d(profile)));
    return <Matching signIds={step.items} seconds={seconds} onAnswer={onResult} locked={locked} />;
  },

  imitate: ({ step, onResult, locked }) => <Imitate letter={getSign(step.items[0])!.en} onAnswer={onResult} locked={locked} />,

  rain: ({ step, profile, onResult, locked }) => <SignRain items={step.items} profile={profile} onAnswer={onResult} locked={locked} />,

  memory: ({ step, onResult, locked }) => <Memory items={step.items} onAnswer={onResult} locked={locked} />,

  comprehension: ({ step, onResult, locked }) => <Comprehension passageId={step.content!} onAnswer={onResult} locked={locked} />,

  conversation: ({ step, onResult, locked }) => <Conversation dialogueId={step.content!} onAnswer={onResult} locked={locked} />,

  story: ({ step, onResult, locked }) => <Conversation dialogueId={step.content!} onAnswer={onResult} locked={locked} />,

  spell: function SpellActivity({ step, profile, onResult, locked }) {
    const [word] = useState(() => spellWord(step.items, d(profile)));
    return <FingerspellRead word={word} msPerLetter={Math.round(950 * (1 - 0.3 * d(profile)))} onAnswer={onResult} locked={locked} />;
  },

  sprint: ({ profile, onResult }) => (
    <SignSprint
      best={profile.gameBest.sprint ?? 0}
      onExit={(r) => onResult(r
        ? { correct: r.score > 0, items: r.items.map((it) => ({ ...it, modality: "productive" as const })), xp: r.score * 2 }
        : { correct: false, items: [], xp: 0 })}
    />
  ),

  quiz: ({ step, profile, onResult, locked }) => <Quiz items={step.items} profile={profile} onAnswer={onResult} locked={locked} />,
};

// logs written before phase 2 call the camera activity "camera"
COMPONENTS.camera = COMPONENTS.imitate;

export { letterId };
