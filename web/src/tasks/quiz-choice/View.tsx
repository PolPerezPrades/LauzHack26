import { useEffect, useRef, useState } from "react";
import { PHRASES, getSign, itemLabel, type Phrase } from "../../content/curriculum";
import { createRng, seedFrom } from "../../core/rng";
import type { TaskViewProps } from "../../core/types";
import { useLang, useT, type Lang, type Messages } from "../../i18n";
import { SignViewer } from "../../viewer/SignViewer";
import { buildChoices } from "./choices";
import { QUIZ_XP, quizPrompt, type QuizChoiceParams } from "./spec";

/** A word's ASL gloss, shown with its meaning only when it adds something ("negro" · BLACK, not "black" · BLACK). */
function glossHint(id: string, lang: Lang): string | null {
  const s = getSign(id);
  if (s?.kind !== "word") return null;
  const gloss = s.en.toUpperCase();
  return gloss.toLowerCase() === itemLabel(id, lang).toLowerCase() ? null : gloss;
}

function answerText(id: string, lang: Lang) {
  const gloss = glossHint(id, lang);
  return gloss ? `${itemLabel(id, lang)} (${gloss})` : itemLabel(id, lang);
}

/** Gloss line, non-manual marker and grammar note, shown with the answer of a phrase. */
function phraseNote(p: Phrase, t: Messages, lang: Lang) {
  const gloss = p.signs.map((x) => getSign(x)?.en.toUpperCase() ?? x).join(" · ");
  return `${gloss}. ${t.content.nonManual[p.nonManual] ?? p.nonManual}. ${p.note[lang]}`;
}

export function QuizChoiceView({ plan, active, report }: TaskViewProps<QuizChoiceParams>) {
  const t = useT();
  const lang = useLang();
  const target = plan.items[0];
  const phrase = PHRASES.get(target);
  const sign = getSign(target);
  // plans built by generate() carry their options; the seeded fallback keeps old plans playable
  const [choices] = useState(() => plan.params.choices ?? buildChoices(target, plan.params.options, createRng(seedFrom(plan.cardId))));
  const [chosen, setChosen] = useState<string | null>(null);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (active && startedAt.current === null) startedAt.current = performance.now();
  }, [active]);

  const choose = (id: string) => {
    if (chosen || !active) return;
    setChosen(id);
    const correct = id === target;
    report({
      success: correct ? 1 : 0,
      evidence: [{
        itemId: target, skill: "receptive", kind: "retrieval", correct, check: "choice", options: choices.length,
        ...(startedAt.current !== null ? { ms: Math.round(performance.now() - startedAt.current) } : {}),
        ...(correct ? {} : { confusedWith: id }),
      }],
      xp: correct ? (phrase ? QUIZ_XP.phrase : QUIZ_XP.sign) : 0,
      feedback: { correct, answer: answerText(target, lang), ...(phrase ? { note: phraseNote(phrase, t, lang) } : {}) },
    });
  };

  return (
    <div className="task quiz-choice">
      <h2 className="task-prompt">{quizPrompt(target, t)}</h2>
      <div className="task-media">
        <SignViewer ids={phrase ? phrase.signs : [target]} orbit={false} />
      </div>
      <div className={`choices choices-n${choices.length} ${sign?.kind === "letter" ? "choices-letters" : phrase ? "choices-phrase" : ""}`}>
        {choices.map((id) => {
          const state = !chosen ? "" : id === target ? "opt-correct" : id === chosen ? "opt-wrong" : "opt-dim";
          const gloss = glossHint(id, lang);
          return (
            <button key={id} type="button" className={`option ${state}`} disabled={!!chosen || !active} onClick={() => choose(id)}>
              <span className="opt-main">{itemLabel(id, lang)}</span>
              {gloss && <span className="opt-sub">{gloss}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
