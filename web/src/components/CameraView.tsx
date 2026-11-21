import { useEffect, useRef, useState } from "react";
import { HAND_CONNECTIONS, acquireCamera, currentDeviceId, getHandLandmarker, listCameras, releaseCamera, switchCamera } from "../lib/camera";
import { computeFeatures, type Features, type P } from "../lib/handshapes";

interface Props {
  /** Called on every processed frame (null = no hand visible). Keep it cheap. */
  onFrame: (f: Features | null) => void;
  highlight?: "ok" | "near" | "none";
  children?: React.ReactNode; // overlay content
}

/** Mirrored webcam preview with MediaPipe hand tracking and a landmark overlay. */
export function CameraView({ onFrame, highlight = "none", children }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState<string>();

  useEffect(() => {
    let alive = true;
    let raf = 0;
    let lastTime = -1;
    (async () => {
      try {
        const [stream, landmarker] = await Promise.all([acquireCamera(), getHandLandmarker()]);
        if (!alive) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play().catch(() => {});
        setCams(await listCameras());
        setCamId(currentDeviceId());
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
        const err = e as DOMException;
        setError(err.name === "NotAllowedError" ? "Permiso de cámara denegado. Actívalo en el navegador." :
          err.name === "NotFoundError" ? "No se encontró ninguna cámara." : `No se pudo iniciar la cámara (${err.message}).`);
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      releaseCamera();
    };
  }, []);

  const changeCam = async (id: string) => {
    const s = await switchCamera(id);
    if (videoRef.current) videoRef.current.srcObject = s;
    setCamId(id);
  };

  return (
    <div className={`cam cam-${highlight}`}>
      <video ref={videoRef} muted playsInline />
      <canvas ref={canvasRef} />
      {status === "loading" && <div className="cam-msg">Iniciando cámara y detector de manos…</div>}
      {status === "error" && <div className="cam-msg cam-err">{error}</div>}
      {children}
      {cams.length > 1 && (
        <select className="cam-select" value={camId} onChange={(e) => changeCam(e.target.value)}>
          {cams.map((c, i) => <option key={c.deviceId} value={c.deviceId}>{c.label || `Cámara ${i + 1}`}</option>)}
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
