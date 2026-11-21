/**
 * SignViewer — the single component every activity uses to show a sign (or a sequence of signs).
 *   render "hand"   → procedural toon hand (letters), rotatable, J/Z animated with their path
 *   render "avatar" → toon avatar replaying motion extracted from the real WLASL clip
 *   render "video"  → the real clip, framed on the signing space
 * Controls: replay, slow motion, reset view, and "real video" for anything derived from a clip.
 * In the feed, drags are card swipes, so the 3D orbit is turned off there (`orbit={false}`).
 */
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { getSpec, type SignSpec } from "../content/signs";
import { useT } from "../i18n";
import { AvatarScene, avatarExtent, loadMotion, prepareMotion, type AvatarFrame } from "./AvatarScene";
import { OutlineSync } from "./OutlineSync";
import { CameraRig } from "./CameraRig";
import type { Highlight } from "./HandMesh";
import { LetterScene, letterExtent } from "./LetterScene";
import { VideoView } from "./VideoView";
import "./viewer.css";

export interface SignViewerProps {
  ids: string[];
  size?: "lg" | "md" | "sm";
  controls?: boolean;
  credit?: boolean;
  highlight?: Highlight;
  /** ms each static letter is held in a sequence (fingerspelling). */
  letterHoldMs?: number;
  /** loop the whole sign / sequence (default true) */
  loop?: boolean;
  onSequenceEnd?: () => void;
  /** force the original video even when a 3D rendering exists */
  preferVideo?: boolean;
  /** drag to rotate the 3D view (default true; off in the feed) */
  orbit?: boolean;
}

type Mode = "3d" | "video";

export function SignViewer({ ids, size = "lg", controls = true, credit = true, highlight, letterHoldMs = 1200, loop = true, onSequenceEnd, preferVideo, orbit = true }: SignViewerProps) {
  const t = useT();
  const specs = useMemo(() => ids.map(getSpec).filter(Boolean) as SignSpec[], [ids.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const [idx, setIdx] = useState(0);
  const [slow, setSlow] = useState(false);
  const [playId, setPlayId] = useState(0);
  const [viewKey, setViewKey] = useState(0);
  const [mode, setMode] = useState<Mode>(preferVideo ? "video" : "3d");
  const [motions, setMotions] = useState<Record<string, { frames: AvatarFrame[]; fps: number }>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setIdx(0); setPlayId((p) => p + 1); }, [ids.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  // preload avatar motion for every sign in the sequence
  useEffect(() => {
    let alive = true;
    for (const s of specs) {
      if (s.render.type !== "avatar" || motions[s.id]) continue;
      const url = s.render.motion;
      loadMotion(url).then((m) => {
        if (alive) setMotions((prev) => ({ ...prev, [s.id]: { frames: prepareMotion(m), fps: m.fps } }));
      }).catch(() => alive && setError(s.id));
    }
    return () => { alive = false; };
  }, [specs]); // eslint-disable-line react-hooks/exhaustive-deps

  const spec = specs[Math.min(idx, specs.length - 1)] as SignSpec | undefined;
  const motion = spec?.render.type === "avatar" ? motions[spec.id] : undefined;
  // framing: everything the current sign goes through
  const extent = useMemo(() => {
    if (!spec) return null;
    if (spec.render.type === "hand") return specs.every((s) => s.render.type === "hand") ? specs.flatMap(letterExtent) : letterExtent(spec);
    if (motion) return avatarExtent(motion.frames);
    return null;
  }, [spec, specs, motion]);

  if (!spec) return <div className={`sv sv-${size} sv-missing`}>{t.viewer.missing}</div>;

  const speed = slow ? 0.5 : 1;
  const seq = specs.length > 1;
  const hasVideo = !!spec.video;
  const renderType = spec.render.type === "avatar" && (error === spec.id) ? "video" : spec.render.type;
  const show3d = mode === "3d" && renderType !== "video";

  const next = () => {
    if (!seq) { if (!loop) onSequenceEnd?.(); return; }
    if (idx < specs.length - 1) setIdx(idx + 1);
    else {
      onSequenceEnd?.();
      if (loop) setTimeout(() => { setIdx(0); setPlayId((p) => p + 1); }, 900);
    }
  };

  const isHand = spec.render.type === "hand";

  return (
    <div className={`sv sv-${size}`}>
      <div className={`sv-stage ${isHand ? "sv-stage-hand" : ""}`}>
        {show3d && extent ? (
          <Canvas flat dpr={size === "sm" ? 1 : [1, 2]} camera={{ fov: 30 }} gl={{ antialias: true }}>
            <ambientLight intensity={1.1} />
            <directionalLight position={[2, 3, 4]} intensity={2.2} />
            <OutlineSync />
            <CameraRig points={extent} resetKey={viewKey} interactive={orbit && controls && size !== "sm"} pad={isHand ? 0.16 : 0.06} />
            {isHand ? (
              <LetterScene
                spec={spec}
                speed={speed}
                playId={playId * 100 + idx}
                highlight={highlight}
                holdSeconds={letterHoldMs / 1000}
                onEnded={seq || !loop ? next : undefined}
                bounce={seq}
              />
            ) : motion ? (
              <AvatarScene frames={motion.frames} fps={motion.fps} speed={speed} playId={playId * 100 + idx} loop={!seq && loop} onEnded={next} />
            ) : null}
          </Canvas>
        ) : show3d && !extent ? (
          <div className="sv-loading">{t.viewer.loading}</div>
        ) : spec.video ? (
          <VideoView key={spec.id} src={spec.video.src} crop={spec.video.crop} speed={speed} playId={playId} loop={!seq && loop} onEnded={next} />
        ) : (
          <div className="sv-loading">{t.viewer.noVideo}</div>
        )}
        {seq && (
          <div className="sv-dots">{specs.map((_, i) => <span key={i} className={i === idx ? "on" : ""} />)}</div>
        )}
        {show3d && orbit && controls && size !== "sm" && <div className="sv-hint">{t.viewer.dragHint}</div>}
      </div>

      {controls && size !== "sm" && (
        <div className="sv-controls">
          <button className="chip" onClick={() => { setIdx(0); setPlayId((p) => p + 1); }}>{t.viewer.replay}</button>
          <button className={`chip ${slow ? "chip-on" : ""}`} onClick={() => setSlow(!slow)}>{t.viewer.slow}</button>
          {show3d && orbit && <button className="chip" onClick={() => setViewKey((k) => k + 1)}>{t.viewer.resetView}</button>}
          {hasVideo && renderType !== "video" && (
            <button className={`chip ${mode === "video" ? "chip-on" : ""}`} onClick={() => setMode(mode === "video" ? "3d" : "video")}>
              {mode === "video" ? (isHand ? t.viewer.hand3d : t.viewer.avatar) : t.viewer.realVideo}
            </button>
          )}
        </div>
      )}
      {credit && size !== "sm" && <Credit specs={specs} spec={spec} mode={show3d ? "3d" : "video"} />}
    </div>
  );
}

function Credit({ specs, spec, mode }: { specs: SignSpec[]; spec: SignSpec; mode: Mode }) {
  const t = useT();
  const src = spec.video?.source;
  return (
    <div className="credit sv-credit">
      {specs.length > 1 && <span>{t.viewer.creditSequence} · </span>}
      {mode === "3d" && spec.render.type === "hand" && <span>{t.viewer.creditHand} · </span>}
      {mode === "3d" && spec.render.type === "avatar" && <span>{t.viewer.creditAvatar} · </span>}
      {src && <a href={src.url} target="_blank" rel="noreferrer">{src.dataset} · {src.site}</a>}
    </div>
  );
}
