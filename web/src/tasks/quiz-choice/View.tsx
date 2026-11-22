import { useEffect, useRef, useState } from "react";
import { PHRASES, getSign, itemLabel } from "../../content/curriculum";
import { createRng, seedFrom } from "../../core/rng";
import type { TaskViewProps } from "../../core/types";
import { useLang, useT } from "../../i18n";
import { SignViewer } from "../../viewer/SignViewer";
import { QUIZ_CHOICE, clampOptions } from "../learningConfig";
import { ChoiceGrid } from "../ui/ChoiceGrid";
import { glossHint } from "../ui/labels";
import { TaskFrame } from "../ui/TaskFrame";
import { buildChoices } from "./choices";
import { quizChoiceResult, type QuizAnswer } from "./result";
import { quizPrompt, type QuizChoiceParams } from "./spec";

interface Question {
  item: string;
  choices: string[];
  similarity: "low" | "high";
}

/** The questions of a plan; plans logged before Part B (one item, `choices`) stay playable. */
function questionsOf(plan: TaskViewProps<QuizChoiceParams>["plan"]): Question[] {
  const p = plan.params;
  const rng = createRng(seedFrom(plan.cardId));
  return plan.items.map((item, i) => ({
    item,
    choices: p.sets?.[i] ?? (i === 0 ? p.choices : undefined) ?? buildChoices(item, clampOptions(p.options ?? 4), rng),
    similarity: p.similarity?.[i] ?? "low",
  }));
}

export function QuizChoiceView({ plan, active, report }: TaskViewProps<QuizChoiceParams>) {
  const t = useT();
  const lang = useLang();
  const [questions] = useState(() => questionsOf(plan));
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const answers = useRef<QuizAnswer[]>([]);
  const startedAt = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (active && startedAt.current === null) startedAt.current = performance.now();
  }, [active, step]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const q = questions[step];
  const phrase = PHRASES.get(q.item);
  const sign = getSign(q.item);
  const probe = questions.length > 1;
  // replay off: the sign plays once with no controls; slow off: it loops, controls hidden
  const replay = plan.params.replay !== 0;
  const controls = replay && plan.params.slow !== 0;

  const choose = (id: string) => {
    if (chosen || !active) return;
    setChosen(id);
    answers.current.push({
      item: q.item, chosen: id, options: q.choices.length, similarity: q.similarity,
      ...(startedAt.current !== null ? { ms: Math.round(performance.now() - startedAt.current) } : {}),
    });
    if (step + 1 < questions.length) {
      timer.current = setTimeout(() => {
        startedAt.current = null;
        setChosen(null);
        setStep((s) => s + 1);
      }, QUIZ_CHOICE.nextQuestionMs);
      return;
    }
    report(quizChoiceResult(answers.current, t, lang));
  };

  return (
    <TaskFrame
      className="quiz-choice"
      badge={probe ? t.learning.quiz.probeBadge : undefined}
      badgeTone="check"
      progress={probe ? { step: step + 1, of: questions.length } : undefined}
      prompt={quizPrompt(q.item, t)}
    >
      <div className="task-media">
        <SignViewer key={`${step}:${q.item}`} ids={phrase ? phrase.signs : [q.item]} orbit={false} controls={controls} loop={replay} />
      </div>
      <ChoiceGrid
        options={q.choices.map((id) => ({ id, main: itemLabel(id, lang), sub: glossHint(id, lang) }))}
        correct={q.item}
        chosen={chosen}
        disabled={!active}
        layout={sign?.kind === "letter" ? "letters" : phrase ? "phrase" : "default"}
        onChoose={choose}
      />
    </TaskFrame>
  );
}
