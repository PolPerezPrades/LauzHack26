import { useRef, useState } from "react";
import { CameraView, type TrackInfo } from "../../components/CameraView";
import type { TaskViewProps } from "../../core/types";
import { useT } from "../../i18n";
import type { Features } from "../../lib/handshapes";
import type { CameraProbeParams } from "./spec";

export function DevCameraProbeView({ plan, active, camera, report }: TaskViewProps<CameraProbeParams>) {
  const t = useT();
  const holdMs = plan.params.holdMs;
  const since = useRef<number | null>(null);
  const done = useRef(false);
  const lastUi = useRef(0);
  const [progress, setProgress] = useState(0);
  const [seen, setSeen] = useState(false);
  const [track, setTrack] = useState<TrackInfo | null>(null);

  const onFrame = (f: Features | null) => {
    if (done.current) return;
    const now = performance.now();
    if (!f) since.current = null;
    else since.current ??= now;
    const p = since.current === null ? 0 : Math.min(1, (now - since.current) / holdMs);
    if (p >= 1) {
      done.current = true;
      setProgress(1);
      setSeen(true);
      report({ success: 1, evidence: [], xp: 0, feedback: { correct: true, note: t.probe.detected } });
      return;
    }
    if (now - lastUi.current > 100) {
      // throttle React updates; detection runs every frame
      lastUi.current = now;
      setProgress(p);
      setSeen(!!f);
    }
  };

  const status = progress >= 1 ? t.probe.detected : seen ? t.probe.holding : t.probe.noHand;
  return (
    <div className="task probe">
      <h2 className="task-prompt">{t.probe.instructions}</h2>
      <div className="task-media task-cam">
        {active ? (
          <CameraView session={camera} onFrame={onFrame} onTrack={setTrack} highlight={progress >= 1 ? "ok" : seen ? "near" : "none"}>
            <div className="cam-status">
              <div className="hold-bar"><div style={{ width: `${progress * 100}%` }} /></div>
              <div className="cam-hint">{status}</div>
            </div>
          </CameraView>
        ) : (
          <div className="cam cam-idle" />
        )}
      </div>
      <p className="task-note">{t.camera.privacy}</p>
      {track && (
        <p className="task-note small">
          {t.camera.trackInfo(track.label || "—", t.camera.facing[track.facingMode ?? "unknown"] ?? track.facingMode ?? "", track.width, track.height)}
        </p>
      )}
    </div>
  );
}
