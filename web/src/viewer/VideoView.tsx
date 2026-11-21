import { useEffect, useRef, useState } from "react";

/**
 * The original dictionary clip, framed on the signing space (crop box computed from the signer's
 * pose during extraction) so every video has the same composition and nothing is cut off.
 */
export function VideoView({ src, crop, speed, playId, loop, onEnded }: {
  src: string;
  crop?: number[] | null;
  speed: number;
  playId: number;
  loop: boolean;
  onEnded?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [layout, setLayout] = useState<React.CSSProperties>({ width: "100%", height: "100%", objectFit: "contain" });

  useEffect(() => {
    const v = video.current, el = box.current;
    if (!v || !el) return;
    const place = () => {
      if (!v.videoWidth || !crop) return;
      const W = el.clientWidth, H = el.clientHeight;
      const [x0, y0, x1, y1] = crop;
      const cw = (x1 - x0) * v.videoWidth, ch = (y1 - y0) * v.videoHeight;
      const s = Math.min(W / cw, H / ch);
      setLayout({
        position: "absolute",
        width: v.videoWidth * s,
        height: v.videoHeight * s,
        left: W / 2 - (x0 * v.videoWidth + cw / 2) * s,
        top: H / 2 - (y0 * v.videoHeight + ch / 2) * s,
        maxWidth: "none",
      });
    };
    v.addEventListener("loadedmetadata", place);
    const ro = new ResizeObserver(place);
    ro.observe(el);
    place();
    return () => { v.removeEventListener("loadedmetadata", place); ro.disconnect(); };
  }, [src, crop]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.playbackRate = speed;
  }, [speed]);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  }, [playId]);

  return (
    <div ref={box} className="sv-video">
      <video
        ref={video}
        src={src}
        style={layout}
        autoPlay
        muted
        playsInline
        loop={loop}
        onLoadedMetadata={(e) => (e.currentTarget.playbackRate = speed)}
        onEnded={onEnded}
      />
    </div>
  );
}
