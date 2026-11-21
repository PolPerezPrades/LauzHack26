import { useEffect, useRef, useState } from "react";
import { getSign } from "../content/curriculum";

interface Props {
  ids: string[];                 // one sign, or a sequence (phrase) played back to back
  size?: "lg" | "md" | "sm";
  controls?: boolean;
  credit?: boolean;
}

/** Plays real sign media (WLASL clip or alphabet illustration) with its source credit. */
export function SignMedia({ ids, size = "lg", controls = true, credit = true }: Props) {
  const [idx, setIdx] = useState(0);
  const [slow, setSlow] = useState(false);
  const [round, setRound] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const key = ids.join("|");

  useEffect(() => setIdx(0), [key]);
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = slow ? 0.5 : 1;
  }, [slow, idx, round]);

  const sign = getSign(ids[idx] ?? ids[0]);
  if (!sign) return <div className={`media media-${size} media-missing`}>Sin vídeo</div>;
  const seq = ids.length > 1;

  const onEnded = () => {
    if (!seq) return;
    if (idx < ids.length - 1) setIdx(idx + 1);
    else setTimeout(() => { setIdx(0); setRound((r) => r + 1); }, 900); // short pause, then loop the phrase
  };

  const credits = [...new Map(ids.map((id) => getSign(id)).filter(Boolean).map((s) => [s!.media.credit, s!.media])).values()];

  return (
    <div className={`media-wrap media-${size}`}>
      <div className="media">
        {sign.media.type === "image" ? (
          <img src={sign.media.src} alt="Signo" draggable={false} />
        ) : (
          <video
            key={`${key}-${idx}-${round}`}
            ref={videoRef}
            src={sign.media.src}
            autoPlay
            muted
            playsInline
            loop={!seq}
            onEnded={onEnded}
            onLoadedMetadata={(e) => (e.currentTarget.playbackRate = slow ? 0.5 : 1)}
          />
        )}
        {seq && (
          <div className="seq-dots">
            {ids.map((_, i) => <span key={i} className={i === idx ? "on" : ""} />)}
          </div>
        )}
      </div>
      {controls && sign.media.type === "video" && (
        <div className="media-controls">
          <button className="chip" onClick={() => { setIdx(0); setRound((r) => r + 1); }}>↻ Repetir</button>
          <button className={`chip ${slow ? "chip-on" : ""}`} onClick={() => setSlow(!slow)}>🐢 Lento</button>
        </div>
      )}
      {credit && (
        <div className="credit">
          {seq && <span>Secuencia de signos de diccionario · </span>}
          {credits.map((m, i) => (
            <a key={i} href={m.sourceUrl} target="_blank" rel="noreferrer">{m.credit}</a>
          ))}
        </div>
      )}
    </div>
  );
}
