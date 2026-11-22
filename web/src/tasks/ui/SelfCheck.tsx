/**
 * The `self` check (SPEC §4.2): no camera, so the learner signs from memory, looks at the
 * reference and grades themselves.
 *   reveal  (questions): sign it → "show the answer" → the reference → "I got it right" / "not quite"
 *   lesson  (lessons):   "your turn" → "I did it", or "show it again" (counted as a hint) first
 * The reference (a WebGL viewer) mounts only once it is shown.
 */
import { useState, type ReactNode } from "react";
import { useT } from "../../i18n";
import "./ui.css";

export interface SelfGrade {
  correct: boolean;
  /** times the reference was shown again before answering (lesson variant) */
  hints: number;
}

interface Props {
  variant: "reveal" | "lesson";
  active: boolean;
  /** what to do, shown while the reference is hidden */
  instruction: string;
  reference(): ReactNode;
  onDone(grade: SelfGrade): void;
}

export function SelfCheck({ variant, active, instruction, reference, onDone }: Props) {
  const t = useT();
  const [shown, setShown] = useState(false);
  const [hints, setHints] = useState(0);
  const [done, setDone] = useState(false);
  const finish = (correct: boolean) => {
    if (done || !active) return;
    setDone(true);
    onDone({ correct, hints });
  };
  const show = () => {
    setShown(true);
    if (variant === "lesson") setHints((h) => h + 1);
  };

  return (
    <div className="sc">
      <div className="sc-stage">
        {shown ? (
          <div className="sc-ref">{reference()}</div>
        ) : (
          <div className="sc-hidden">
            <span className="sc-hand" aria-hidden="true">✋</span>
            <p>{instruction}</p>
          </div>
        )}
      </div>
      {variant === "reveal" && shown && <p className="sc-question">{t.learning.self.compare}</p>}
      <div className="tf-footer">
        {variant === "lesson" ? (
          <>
            {!shown && <button type="button" className="btn btn-ghost" disabled={!active || done} onClick={show}>{t.learning.self.showAgain}</button>}
            <button type="button" className="btn btn-primary" disabled={!active || done} onClick={() => finish(true)}>{t.learning.self.didIt}</button>
          </>
        ) : !shown ? (
          <button type="button" className="btn btn-secondary" disabled={!active || done} onClick={show}>{t.learning.self.showAnswer}</button>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" disabled={!active || done} onClick={() => finish(false)}>{t.learning.self.notQuite}</button>
            <button type="button" className="btn btn-primary" disabled={!active || done} onClick={() => finish(true)}>{t.learning.self.gotIt}</button>
          </>
        )}
      </div>
    </div>
  );
}
