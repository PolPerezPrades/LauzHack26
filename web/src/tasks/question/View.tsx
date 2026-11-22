import { useRef, useState } from "react";
import { useCameraState } from "../../camera";
import { isUsable } from "../../camera/cameraSession";
import { checkModeFor } from "../../camera/checkMode";
import { PHRASES } from "../../content/curriculum";
import type { TaskViewProps } from "../../core/types";
import { useLang, useT } from "../../i18n";
import { SignViewer } from "../../viewer/SignViewer";
import { CAMERA_CHECK } from "../learningConfig";
import { CameraCheck, type CameraOutcome } from "../ui/CameraCheck";
import { glossLine, itemName } from "../ui/labels";
import { ProductiveTry, type TryOutcome } from "../ui/ProductiveTry";
import { SelfCheck, type SelfGrade } from "../ui/SelfCheck";
import { TaskFrame } from "../ui/TaskFrame";
import { signSentenceResult, signTermResult, spellWordResult, type LetterAttempt } from "./result";
import type { QuestionParams } from "./spec";
import { letterOfId } from "./spell";
import "./question.css";

type Props = TaskViewProps<QuestionParams>;

/** ms each letter is held when the reference fingerspells a word */
const SPELL_HOLD_MS = 900;

export function QuestionView(props: Props) {
  const { plan } = props;
  const variant = plan.params.variant ?? (plan.params.word ? "spell-word" : PHRASES.has(plan.items[0]) ? "sign-sentence" : "sign-term");
  if (variant === "spell-word") return <SpellWord {...props} />;
  if (variant === "sign-sentence") return <SignSentence {...props} />;
  return <SignTerm {...props} />;
}

/** "Sign: thank you" — no showing how first; the reference appears once it is checked. */
function SignTerm({ plan, active, camera, report }: Props) {
  const t = useT();
  const lang = useLang();
  const item = plan.items[0];
  const mode = checkModeFor(item, "productive", isUsable(useCameraState()));
  const [done, setDone] = useState(false);
  const finish = (o: TryOutcome) => {
    if (done) return;
    setDone(true);
    const note = o.confusedWith ? t.learning.camera.looksLike(o.confusedWith.replace(/^L-/, "")) : undefined;
    report(signTermResult(item, o, t, lang, note));
  };
  return (
    <TaskFrame className="question" prompt={t.learning.question.signIt(itemName(item, t, lang))}>
      {done ? (
        <div className="task-media"><SignViewer ids={[item]} orbit={false} /></div>
      ) : (
        <ProductiveTry style="question" mode={mode} session={camera} active={active} item={item} reference={[item]} onDone={finish} />
      )}
    </TaskFrame>
  );
}

/** A sentence in the UI language, signed in ASL order; then the avatar, the gloss and the grammar note. */
function SignSentence({ plan, active, camera, report }: Props) {
  const t = useT();
  const lang = useLang();
  const phraseId = plan.items[0];
  const phrase = PHRASES.get(phraseId);
  const mode = checkModeFor(phraseId, "productive", isUsable(useCameraState()));
  const [done, setDone] = useState(false);
  if (!phrase) return null;
  const finish = (o: TryOutcome) => {
    if (done) return;
    setDone(true);
    report(signSentenceResult(phraseId, o, t, lang));
  };
  return (
    <TaskFrame className="question" prompt={`“${phrase[lang]}”`} sub={`${t.learning.question.sentence}. ${t.learning.question.aslOrder}`}>
      {done ? (
        <>
          <div className="task-media"><SignViewer ids={phrase.signs} orbit={false} /></div>
          <p className="desc gloss-line">{glossLine(phrase.signs)}</p>
        </>
      ) : (
        <ProductiveTry style="question" mode={mode} session={camera} active={active} item={phraseId} reference={phrase.signs} onDone={finish} />
      )}
    </TaskFrame>
  );
}

/** "Fingerspell: CAB": the camera checks letter by letter (J and Z are confirmed); self-graded without it. */
function SpellWord({ plan, active, camera, report }: Props) {
  const t = useT();
  const word = plan.params.word ?? plan.items.map((id) => letterOfId(id) ?? "").join("");
  const letters = [...word].map((c) => `L-${c}`);
  const cameraUsable = isUsable(useCameraState());
  const [index, setIndex] = useState(0);
  const [marks, setMarks] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);
  const attempts = useRef<LetterAttempt[]>([]);

  const finish = () => {
    setDone(true);
    report(spellWordResult(word, attempts.current, t));
  };
  const onLetter = (o: CameraOutcome) => {
    if (done) return;
    attempts.current.push({ letter: letters[index], mode: o.check, correct: o.passed, ms: o.ms, ...(o.confusedWith ? { confusedWith: o.confusedWith } : {}) });
    setMarks((m) => [...m, o.passed]);
    if (index + 1 >= letters.length) finish();
    else setIndex(index + 1);
  };
  // without a camera (or after losing it mid-word) the rest of the word is graded by the learner
  const onSelf = (g: SelfGrade) => {
    if (done) return;
    for (let i = index; i < letters.length; i++) attempts.current.push({ letter: letters[i], mode: "self", correct: g.correct });
    setMarks((m) => [...m, ...letters.slice(index).map(() => g.correct)]);
    finish();
  };

  return (
    <TaskFrame className="question spell" prompt={t.learning.question.spell(word)}>
      <div className="spell-word" aria-hidden="true">
        {[...word].map((c, i) => (
          <span key={i} className={i < marks.length ? (marks[i] ? "sw-ok" : "sw-missed") : i === index && !done ? "sw-cur" : ""}>{c}</span>
        ))}
      </div>
      {done ? (
        <div className="task-media"><SignViewer ids={letters} orbit={false} letterHoldMs={SPELL_HOLD_MS} /></div>
      ) : cameraUsable ? (
        <CameraCheck
          session={camera}
          active={active}
          target={letters[index]}
          holdFrames={CAMERA_CHECK.spellHoldFrames}
          skipLabel={t.learning.question.skipLetter}
          onDone={onLetter}
        />
      ) : (
        <SelfCheck
          variant="reveal"
          active={active}
          instruction={t.learning.question.spellSelf}
          reference={() => <div className="task-media"><SignViewer ids={letters.slice(index)} orbit={false} letterHoldMs={SPELL_HOLD_MS} /></div>}
          onDone={onSelf}
        />
      )}
    </TaskFrame>
  );
}
