/**
 * The `camera` check (SPEC §4.2), ported from the old Imitate activity: the learner holds the
 * handshape in front of the camera and the detector passes it after ~0.4 s. In coach mode (lessons)
 * it shows what to fix, live: a checklist per part of the hand, the fingers to fix in red on the
 * reference hand, and "that looks like an N" when the hand matches another letter. Questions turn
 * coaching off: no showing how first.
 *
 * Items without detector rules (J and Z inside a fingerspelled word) are confirmed by the learner
 * while they see themselves, which makes that letter a mirror check.
 */
import { useEffect, useRef, useState } from "react";
import { CameraView } from "../../components/CameraView";
import type { CameraSession } from "../../core/types";
import { useT } from "../../i18n";
import { evaluateSign, hasCameraRule, matchingSigns, type Evaluation, type Features, type HandIssue, type Part } from "../../lib/handshapes";
import type { Highlight } from "../../viewer/HandMesh";
import { SignViewer } from "../../viewer/SignViewer";
import { CAMERA_CHECK } from "../learningConfig";
import { issueText } from "./handHints";
import { HoldTracker } from "./holdTracker";
import "./ui.css";

export interface CameraOutcome {
  passed: boolean;
  /** camera: the detector decided; mirror: the learner confirmed a sign the detector can't check */
  check: "camera" | "mirror";
  /** the sign the hand kept matching instead, on a give-up */
  confusedWith?: string;
  /** the main thing still wrong when the learner gave up (for the feedback note) */
  issue?: HandIssue;
  ms: number;
}

interface Props {
  session: CameraSession;
  active: boolean;
  /** item id of the sign to make */
  target: string;
  holdFrames?: number;
  /** show what to fix: hints, the parts checklist and, with `reference`, the red fingers */
  coach?: boolean;
  /** the reference hand in a corner (lessons) */
  reference?: boolean;
  /** no label, no skip button: in a lesson, swiping down is the skip */
  skipLabel?: string;
  /** the skip button's label once the learner has been stuck for a while */
  stuckLabel?: string;
  onDone(outcome: CameraOutcome): void;
}

const PARTS: Part[] = ["thumb", "index", "middle", "ring", "pinky", "orientation"];
const FINGERS = ["thumb", "index", "middle", "ring", "pinky"] as const;
const letterOf = (id: string) => id.replace(/^L-/, "");

export function CameraCheck({ session, active, target, holdFrames = CAMERA_CHECK.holdFrames, coach = false, reference = false, skipLabel, stuckLabel, onDone }: Props) {
  const t = useT();
  const detectable = hasCameraRule(target);
  const tracker = useRef(new HoldTracker(holdFrames, CAMERA_CHECK.decay));
  const lastIssue = useRef<HandIssue | undefined>(undefined);
  const done = useRef(false);
  const startedAt = useRef(0);
  const lastUi = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [ev, setEv] = useState<Evaluation | null>(null);
  const [looksLike, setLooksLike] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [passed, setPassed] = useState(false);
  const [stuck, setStuck] = useState(false);

  // a new target (the next letter of a word) starts clean, with the same camera
  useEffect(() => {
    tracker.current = new HoldTracker(holdFrames, CAMERA_CHECK.decay);
    lastIssue.current = undefined;
    done.current = false;
    startedAt.current = performance.now();
    setEv(null);
    setLooksLike(null);
    setProgress(0);
    setPassed(false);
    setStuck(false);
  }, [target, holdFrames]);

  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setStuck(true), CAMERA_CHECK.stuckMs);
    return () => clearTimeout(id);
  }, [active, target]);

  const finish = (o: Omit<CameraOutcome, "ms">) => {
    if (done.current || !active) return;
    done.current = true;
    onDoneRef.current({ ...o, ms: Math.round(performance.now() - startedAt.current) });
  };

  const onFrame = (f: Features | null) => {
    if (done.current || !detectable) return;
    const e = f ? evaluateSign(target, f) : null;
    const other = f && e && !e.ok ? matchingSigns(f).find((id) => id !== target) ?? null : null;
    if (e && !e.ok) lastIssue.current = e.issues[0];
    if (tracker.current.step(e?.ok ?? false, other)) {
      setEv(e);
      setLooksLike(null);
      setProgress(1);
      setPassed(true);
      finish({ passed: true, check: "camera" });
      return;
    }
    const now = performance.now();
    if (now - lastUi.current > CAMERA_CHECK.uiMs) {
      // React updates are throttled; detection runs on every frame
      lastUi.current = now;
      setEv(e);
      setLooksLike(other);
      setProgress(tracker.current.progress);
    }
  };

  const skip = () => {
    const confusedWith = detectable ? tracker.current.confusion(CAMERA_CHECK.confusionFrames) : undefined;
    finish({
      passed: false,
      check: detectable ? "camera" : "mirror",
      ...(confusedWith ? { confusedWith } : {}),
      ...(detectable && lastIssue.current ? { issue: lastIssue.current } : {}),
    });
  };

  const wrong = new Set(ev?.wrong ?? []);
  const highlight: Highlight | undefined = coach && ev
    ? Object.fromEntries(FINGERS.map((k) => [k, passed || !wrong.has(k) ? "ok" : "error"]))
    : undefined;
  const status = !detectable
    ? t.learning.camera.movement(letterOf(target))
    : passed ? t.learning.camera.passed
    : !ev ? t.learning.camera.showHand
    : ev.ok ? t.learning.camera.hold
    : coach && ev.issues[0] ? issueText(ev.issues[0], t)
    : t.learning.camera.notYet;

  return (
    <div className="cc">
      <div className="cc-stage task-cam">
        {active ? (
          <CameraView session={session} onFrame={onFrame} highlight={passed ? "ok" : ev?.ok ? "near" : "none"}>
            <div className="cam-status">
              {detectable && <div className="hold-bar"><div style={{ width: `${progress * 100}%` }} /></div>}
              <div className="cam-hint">{status}</div>
              {looksLike && !passed && <div className="cam-hint2">{t.learning.camera.looksLike(letterOf(looksLike))}</div>}
              {coach && ev && !ev.ok && ev.issues.length > 1 && (
                <div className="cam-hint2">{ev.issues.slice(1, 3).map((i) => issueText(i, t)).join(" · ")}</div>
              )}
            </div>
          </CameraView>
        ) : (
          <div className="cam cam-idle" />
        )}
        {reference && (
          <div className="cc-ref" aria-hidden="true">
            <SignViewer ids={[target]} size="sm" controls={false} credit={false} orbit={false} highlight={highlight} />
          </div>
        )}
      </div>
      {coach && detectable && (
        <div className="cc-parts" aria-hidden="true">
          {PARTS.map((p) => {
            const state = !ev ? "idle" : passed || !wrong.has(p) ? "ok" : "bad";
            return (
              <span key={p} className={`cc-part cc-part-${state}`}>
                {state === "ok" ? "✓" : state === "bad" ? "✗" : "·"} {t.learning.parts[p]}
              </span>
            );
          })}
        </div>
      )}
      <div className="tf-footer">
        {skipLabel && (
          <button type="button" className={`btn ${stuck ? "btn-secondary" : "btn-ghost"}`} disabled={!active || passed} onClick={skip}>
            {stuck && stuckLabel ? stuckLabel : skipLabel}
          </button>
        )}
        {!detectable && (
          <button type="button" className="btn btn-primary" disabled={!active} onClick={() => finish({ passed: true, check: "mirror" })}>
            {t.learning.camera.signedIt(letterOf(target))}
          </button>
        )}
      </div>
    </div>
  );
}
