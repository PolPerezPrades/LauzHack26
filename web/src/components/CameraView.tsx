import { useEffect, useRef, useState } from "react";
import { cameraSession, useCameraState } from "../camera";
import { CameraOffError, isUsable } from "../camera/cameraSession";
import type { CameraSession } from "../core/types";
import { useT, type Messages } from "../i18n";
import { HAND_CONNECTIONS, currentDeviceId, getHandLandmarker, listCameras, switchCamera } from "../lib/camera";
import { computeFeatures, type Features, type P } from "../lib/handshapes";

export interface TrackInfo {
  label: string;
  facingMode?: string;
  width: number;
  height: number;
}

interface Props {
  /** Called on every processed frame (null = no hand visible). Keep it cheap. */
  onFrame: (f: Features | null) => void;
  highlight?: "ok" | "near" | "none";
  /** camera gate; defaults to the app's camera session */
  session?: CameraSession;
  /** the camera actually opened (label, facing mode, resolution) */
  onTrack?: (info: TrackInfo) => void;
  children?: React.ReactNode; // overlay content
}

type Status = "loading" | "ready" | "error" | "off";

/** What went wrong, kept as data so the message follows the UI language. */
type CamError = { kind: "off" | "denied" | "notFound" | "detector" } | { kind: "failed"; detail: string };

function classify(e: unknown): CamError {
  if (e instanceof CameraOffError) return { kind: "off" };
  const name = typeof e === "object" && e !== null && "name" in e ? String((e as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "SecurityError") return { kind: "denied" };
  if (name === "NotFoundError") return { kind: "notFound" };
  return { kind: "failed", detail: e instanceof Error ? e.message : String(e) };
}

function errorText(err: CamError, t: Messages): string {
  switch (err.kind) {
    case "off": return t.camera.offThisSession;
    case "denied": return t.camera.denied;
    case "notFound": return t.camera.notFound;
    case "detector": return t.camera.detectorFailed;
    case "failed": return t.camera.failed(err.detail);
  }
}

/**
 * Camera preview (mirrored for front cameras and webcams) with MediaPipe hand tracking and a
 * landmark overlay. It only opens the camera through the camera session, and stops the moment the
 * session becomes unusable (opt-out): tracks are stopped by the session, the loop stops here.
 */
export function CameraView({ onFrame, highlight = "none", session = cameraSession, onTrack, children }: Props) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const onTrackRef = useRef(onTrack);
  onTrackRef.current = onTrack;
  const usable = isUsable(useCameraState());
  const [status, setStatus] = useState<Status>(usable ? "loading" : "off");
  const [error, setError] = useState<CamError | null>(null);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState<string>();
  const [mirrored, setMirrored] = useState(true);

  useEffect(() => {
    if (!usable) {
      setStatus("off");
      return;
    }
    setStatus("loading");
    let alive = true;
    let raf = 0;
    let lastTime = -1;
    let acquired = false;
    let released = false;
    const releaseOnce = () => {
      if (acquired && !released) {
        released = true;
        session.release();
      }
    };
    (async () => {
      const landmarkerReady = getHandLandmarker();
      landmarkerReady.catch(() => {}); // handled below; avoid an unhandled rejection meanwhile
      try {
        const stream = await session.acquire();
        acquired = true;
        if (!alive) return releaseOnce();
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play().catch(() => {});
        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings() ?? {};
        setMirrored(settings.facingMode !== "environment");
        onTrackRef.current?.({ label: track?.label ?? "", facingMode: settings.facingMode, width: settings.width ?? video.videoWidth, height: settings.height ?? video.videoHeight });
        setCams(await listCameras().catch(() => []));
        setCamId(currentDeviceId());
        let landmarker;
        try {
          landmarker = await landmarkerReady;
        } catch {
          if (alive) {
            setStatus("error");
            setError({ kind: "detector" });
          }
          return;
        }
        if (!alive) return;
        setStatus("ready");
        const loop = () => {
          if (!alive) return;
          raf = requestAnimationFrame(loop);
          if (video.readyState < 2 || video.currentTime === lastTime) return;
          lastTime = video.currentTime;
          const res = landmarker.detectForVideo(video, performance.now());
          const lm = res.landmarks[0] as P[] | undefined;
          const wl = res.worldLandmarks[0] as P[] | undefined;
          draw(canvasRef.current, video, lm);
          onFrameRef.current(lm && wl ? computeFeatures(lm, wl, video.videoWidth / video.videoHeight) : null);
        };
        loop();
      } catch (e) {
        if (!alive) return;
        setStatus("error");
        setError(classify(e));
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (videoRef.current) videoRef.current.srcObject = null;
      releaseOnce();
    };
  }, [usable, session]);

  const changeCam = async (id: string) => {
    const s = await switchCamera(id);
    if (videoRef.current) videoRef.current.srcObject = s;
    setMirrored(s.getVideoTracks()[0]?.getSettings().facingMode !== "environment");
    setCamId(id);
  };

  return (
    <div className={`cam cam-${highlight} ${mirrored ? "" : "cam-unmirrored"}`}>
      <video ref={videoRef} muted playsInline />
      <canvas ref={canvasRef} />
      {status === "loading" && <div className="cam-msg">{t.camera.starting}</div>}
      {status === "error" && error && <div className="cam-msg cam-err">{errorText(error, t)}</div>}
      {status === "off" && <div className="cam-msg">{t.camera.offThisSession}</div>}
      {children}
      {cams.length > 1 && status === "ready" && (
        <select className="cam-select" data-noswipe value={camId} onChange={(e) => changeCam(e.target.value)}>
          {cams.map((c, i) => <option key={c.deviceId} value={c.deviceId}>{c.label || t.camera.camera(i + 1)}</option>)}
        </select>
      )}
    </div>
  );
}

function draw(canvas: HTMLCanvasElement | null, video: HTMLVideoElement, lm?: P[]) {
  if (!canvas) return;
  if (canvas.width !== video.videoWidth) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!lm) return;
  const w = canvas.width, h = canvas.height;
  ctx.lineWidth = Math.max(2, w / 320);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  for (const c of HAND_CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(lm[c.start].x * w, lm[c.start].y * h);
    ctx.lineTo(lm[c.end].x * w, lm[c.end].y * h);
    ctx.stroke();
  }
  for (let i = 0; i < lm.length; i++) {
    ctx.beginPath();
    ctx.fillStyle = [4, 8, 12, 16, 20].includes(i) ? "#58cc02" : "#1cb0f6";
    ctx.arc(lm[i].x * w, lm[i].y * h, Math.max(3, w / 200), 0, Math.PI * 2);
    ctx.fill();
  }
}
