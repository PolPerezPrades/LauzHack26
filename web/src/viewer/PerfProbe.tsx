/**
 * Optional performance read-out of one viewer (Part H): frames per second, the worst frame time,
 * and the draw calls and triangles of the last frame. Off unless switched on (the lab's ⏱ button,
 * or localStorage "signa:perf" = "1", which also shows it in the feed), so nothing runs otherwise.
 */
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { currentMessages } from "../i18n";

const KEY = "signa:perf";
export function perfEnabled(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
export function setPerfEnabled(on: boolean) {
  try { if (on) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch { /* private mode: the switch just doesn't stick */ }
}

export function PerfProbe({ target }: { target: React.RefObject<HTMLDivElement | null> }) {
  const acc = useRef({ frames: 0, t0: 0, last: 0, worst: 0 });
  // priority 0: runs before this frame's render, so gl.info holds the previous frame's numbers
  useFrame(({ gl }) => {
    const now = performance.now();
    const a = acc.current;
    if (!a.t0) { a.t0 = a.last = now; return; }
    a.frames++;
    a.worst = Math.max(a.worst, now - a.last);
    a.last = now;
    if (now - a.t0 >= 500 && target.current) {
      target.current.textContent = currentMessages().viewer.perf((a.frames * 1000) / (now - a.t0), a.worst, gl.info.render.calls, gl.info.render.triangles);
      a.frames = 0; a.t0 = now; a.worst = 0;
    }
  });
  return null;
}
