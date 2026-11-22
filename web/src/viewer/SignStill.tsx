/**
 * A still picture of a letter sign, for boards with many signs (game-wordsearch). Each letter is
 * drawn once by a short-lived 3D canvas and cached as an image, and at most STILL_SLOTS canvases
 * exist at a time, so a 5×5 board never exceeds the browser's WebGL context limit (about 16 on
 * desktop, fewer on phones). Added by the integrator on 2026-11-22 for the demo.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSpec } from "../content/signs";
import { CameraRig } from "./CameraRig";
import { LetterScene, letterExtent } from "./LetterScene";
import { OutlineSync } from "./OutlineSync";
import "./viewer.css";

const STILL_SLOTS = 4;
/** seconds of animation before the picture is taken (the camera rig and the pose settle) */
const SETTLE_S = 0.45;

const cache = new Map<string, string>();
const queue: string[] = [];
const running = new Set<string>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function pump() {
  while (running.size < STILL_SLOTS && queue.length) {
    const id = queue.shift()!;
    if (!cache.has(id)) running.add(id);
  }
  notify();
}

function request(id: string) {
  if (cache.has(id) || running.has(id) || queue.includes(id)) return;
  queue.push(id);
  pump();
}

function done(id: string, url: string) {
  cache.set(id, url);
  running.delete(id);
  pump();
}

/** Warm the cache ahead of a board (e.g. from a format's prefetch). */
export function prefetchStills(ids: readonly string[]) {
  ids.forEach(request);
}

function Capture({ id }: { id: string }) {
  const gl = useThree((s) => s.gl);
  // refs, not locals: the board re-renders (its clock ticks), and a re-render must not restart the wait
  const state = useRef({ t: 0, taken: false });
  useFrame((_, dt) => {
    const s = state.current;
    s.t += dt;
    if (!s.taken && s.t > SETTLE_S) {
      s.taken = true;
      done(id, gl.domElement.toDataURL("image/png"));
    }
  });
  return null;
}

/** The short-lived canvas that draws one letter, off screen; rendered by <StillHost>. */
function Snapshotter({ id }: { id: string }) {
  const spec = getSpec(id);
  const extent = useMemo(() => (spec && spec.render.type === "hand" ? letterExtent(spec) : null), [spec]);
  if (!spec || !extent || spec.render.type !== "hand") {
    // nothing to draw: give up on this id so the queue moves on
    queueMicrotask(() => done(id, ""));
    return null;
  }
  return (
    <div className="sv-still-snap" aria-hidden="true">
      <Canvas flat dpr={1} camera={{ fov: 30 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[2, 3, 4]} intensity={2.2} />
        <OutlineSync />
        <CameraRig points={extent} resetKey={0} interactive={false} pad={0.16} view={spec.render.view} />
        <LetterScene spec={spec} speed={1} playId={0} holdSeconds={0.3} />
        <Capture id={id} />
      </Canvas>
    </div>
  );
}

function useStill(id: string) {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    request(id);
    return () => { listeners.delete(l); };
  }, [id]);
  return { url: cache.get(id) };
}

export function SignStill({ id }: { id: string }) {
  const { url } = useStill(id);
  return (
    <div className="sv sv-sm sv-still">
      <div className="sv-stage sv-stage-hand">
        {url ? <img src={url} alt="" draggable={false} /> : <div className="sv-still-wait" />}
      </div>
    </div>
  );
}

/** Mount once next to a board of SignStills: it draws the queued letters, STILL_SLOTS at a time. */
export function StillHost() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return <>{[...running].map((id) => <Snapshotter key={id} id={id} />)}</>;
}
