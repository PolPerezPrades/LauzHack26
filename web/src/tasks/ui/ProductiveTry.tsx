/**
 * "Now you": the productive try shared by lessons and questions, in the check mode chosen by
 * checkModeFor() — the camera check, the mirror, or self-grading without a camera.
 *   lesson:   coaching (what to fix, the reference hand with red fingers); "show it again" in self mode
 *   question: no showing how first; the reference is revealed only to grade, or after giving up
 */
import type { ProductiveCheck } from "../../camera/checkMode";
import type { CameraSession } from "../../core/types";
import { useT } from "../../i18n";
import type { HandIssue } from "../../lib/handshapes";
import { SignViewer } from "../../viewer/SignViewer";
import { CameraCheck } from "./CameraCheck";
import { MirrorCompare } from "./MirrorCompare";
import { SelfCheck } from "./SelfCheck";

export interface TryOutcome {
  /** how the try was actually checked (a fingerspelled J confirmed by the learner is a mirror check) */
  mode: ProductiveCheck;
  correct: boolean;
  hints?: number;
  confusedWith?: string;
  issue?: HandIssue;
  ms?: number;
}

interface Props {
  style: "lesson" | "question";
  mode: ProductiveCheck;
  session: CameraSession;
  active: boolean;
  /** the item the camera checks (a single sign) */
  item: string;
  /** what the reference viewer shows: the sign, a phrase's signs, or a word's letters */
  reference: readonly string[];
  letterHoldMs?: number;
  onDone(outcome: TryOutcome): void;
}

export function ProductiveTry({ style, mode, session, active, item, reference, letterHoldMs, onDone }: Props) {
  const t = useT();
  const lesson = style === "lesson";
  if (mode === "camera") {
    return (
      <CameraCheck
        session={session}
        active={active}
        target={item}
        coach={lesson}
        reference={lesson}
        skipLabel={lesson ? t.learning.camera.skip : t.learning.question.showMe}
        stuckLabel={lesson ? t.learning.camera.skipStuck : undefined}
        onDone={(o) => onDone({ mode: o.check, correct: o.passed, ms: o.ms, ...(o.confusedWith ? { confusedWith: o.confusedWith } : {}), ...(o.issue ? { issue: o.issue } : {}) })}
      />
    );
  }
  if (mode === "mirror") {
    return (
      <MirrorCompare
        session={session}
        active={active}
        reference={reference}
        letterHoldMs={letterHoldMs}
        instruction={t.learning.mirror.live}
        onGrade={(g) => onDone({ mode: "mirror", correct: g.correct })}
      />
    );
  }
  return (
    <SelfCheck
      variant={lesson ? "lesson" : "reveal"}
      active={active}
      instruction={lesson ? t.learning.self.lessonTry : t.learning.self.questionTry}
      reference={() => <div className="task-media"><SignViewer ids={[...reference]} orbit={false} letterHoldMs={letterHoldMs} /></div>}
      onDone={(g) => onDone({ mode: "self", correct: g.correct, ...(g.hints ? { hints: g.hints } : {}) })}
    />
  );
}
