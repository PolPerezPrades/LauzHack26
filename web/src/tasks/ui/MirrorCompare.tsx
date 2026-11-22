/**
 * The `mirror` check (SPEC §4.2): the learner signs while seeing themselves, then sees a replay of
 * their own attempt next to the reference, and grades themselves.
 *
 * Privacy: the replay comes from MediaRecorder on the stream already open, keeps only the last few
 * seconds (RollingRecorder), and lives in memory as one Blob behind a blob: URL. Nothing is written
 * to IndexedDB, the Cache API or the network. The clip is dropped (URL revoked, recorder disposed)
 * when the card stops being active or unmounts, and on "try again". Where MediaRecorder doesn't
 * exist, the learner compares themselves live instead.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CameraView } from "../../components/CameraView";
import type { CameraSession } from "../../core/types";
import { useT } from "../../i18n";
import { SignViewer } from "../../viewer/SignViewer";
import { MIRROR } from "../learningConfig";
import { createRollingRecorder, type RollingRecorder } from "./rollingRecorder";
import "./ui.css";

export interface MirrorGrade {
  correct: boolean;
  /** length of the replayed clip, or null when the learner compared themselves live */
  clipMs: number | null;
}

interface Props {
  session: CameraSession;
  active: boolean;
  /** the reference: one sign, a phrase, or the letters of a word */
  reference: readonly string[];
  letterHoldMs?: number;
  instruction: string;
  onGrade(grade: MirrorGrade): void;
}

interface ClipView {
  url: string;
  ms: number;
  mirrored: boolean;
}

export function MirrorCompare({ session, active, reference, letterHoldMs, instruction, onGrade }: Props) {
  const t = useT();
  const [phase, setPhase] = useState<"live" | "compare">("live");
  const [clip, setClip] = useState<ClipView | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [graded, setGraded] = useState(false);
  const recorder = useRef<RollingRecorder | null>(null);
  const clipUrl = useRef<string | null>(null);
  const mirrored = useRef(true);
  const alive = useRef(true);

  const dropRecorder = () => {
    recorder.current?.dispose();
    recorder.current = null;
  };
  const dropClip = () => {
    if (clipUrl.current) URL.revokeObjectURL(clipUrl.current);
    clipUrl.current = null;
    setClip(null);
  };

  // the recorder follows the live stream (a camera switch brings a new one)
  const onStream = useCallback((stream: MediaStream | null) => {
    dropRecorder();
    setStreaming(!!stream);
    if (!stream) return;
    mirrored.current = stream.getVideoTracks()[0]?.getSettings().facingMode !== "environment";
    const r = createRollingRecorder(stream, MIRROR.segmentMs);
    r?.start();
    recorder.current = r;
  }, []);

  // the clip exists only while this card is the active one
  useEffect(() => {
    if (active) return;
    dropRecorder();
    dropClip();
  }, [active]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      dropRecorder();
      if (clipUrl.current) URL.revokeObjectURL(clipUrl.current);
      clipUrl.current = null;
    };
  }, []);

  const done = async () => {
    if (busy || !active) return;
    setBusy(true);
    const r = recorder.current;
    recorder.current = null;
    const recorded = r ? await r.finish() : null;
    r?.dispose();
    if (!alive.current) return;
    if (recorded) {
      clipUrl.current = URL.createObjectURL(recorded.blob);
      setClip({ url: clipUrl.current, ms: Math.round(recorded.ms), mirrored: mirrored.current });
    }
    setPhase("compare");
    setBusy(false);
  };
  const again = () => {
    dropClip();
    setPhase("live");
  };
  const grade = (correct: boolean) => {
    if (graded || !active) return;
    setGraded(true);
    onGrade({ correct, clipMs: clip?.ms ?? null });
  };

  if (phase === "live") {
    return (
      <div className="mc">
        <div className="mc-live task-cam">
          {active ? (
            <CameraView session={session} detect={false} onStream={onStream}>
              {streaming && <span className="mc-rec"><span aria-hidden="true">●</span> {t.learning.mirror.recording}</span>}
              <div className="cam-status"><div className="cam-hint">{instruction}</div></div>
            </CameraView>
          ) : (
            <div className="cam cam-idle" />
          )}
        </div>
        <p className="task-note">{t.learning.mirror.privacy}</p>
        <div className="tf-footer">
          <button type="button" className="btn btn-primary" disabled={!active || !streaming || busy} onClick={done}>{t.learning.mirror.done}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mc">
      <div className="mc-pair">
        <div className="mc-pane">
          <span className="mc-label">{t.learning.mirror.you}</span>
          {clip ? (
            <video className={`mc-clip ${clip.mirrored ? "mc-mirror" : ""}`} src={clip.url} autoPlay loop muted playsInline />
          ) : (
            <div className="mc-livepane task-cam">{active && <CameraView session={session} detect={false} />}</div>
          )}
        </div>
        <div className="mc-pane">
          <span className="mc-label">{t.learning.mirror.reference}</span>
          <SignViewer ids={[...reference]} size="md" controls={false} credit={false} orbit={false} letterHoldMs={letterHoldMs} />
        </div>
      </div>
      <p className="sc-question">{clip ? t.learning.mirror.compare : t.learning.mirror.noReplay}</p>
      <div className="tf-footer">
        <button type="button" className="btn btn-ghost mc-again" disabled={!active || graded} onClick={again}>{t.learning.mirror.again}</button>
        <button type="button" className="btn btn-ghost" disabled={!active || graded} onClick={() => grade(false)}>{t.learning.mirror.notQuite}</button>
        <button type="button" className="btn btn-primary" disabled={!active || graded} onClick={() => grade(true)}>{t.learning.mirror.matched}</button>
      </div>
    </div>
  );
}
