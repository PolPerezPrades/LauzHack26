/**
 * Fingerspelling letter: procedural toon hand posed from the sign's phonology
 * (handshape + orientation), animated for letters with movement (J, Z) with the traced path
 * drawn in the air. Consecutive letters blend smoothly (used by the fast-spelling activity).
 */
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { useMemo, useRef } from "react";
import type { SignSpec } from "../content/signs";
import { HandMesh, type Highlight } from "./HandMesh";
import { HANDSHAPES, movementPath, type MovementPath } from "./handshapeLibrary";
import { dir, handJointsLocal, lerpDir, lerpPose, orientationMatrix, transform, vec, type HandPose, type V3 } from "./kinematics";

export const LETTER_MOVE_SECONDS = 1.5;
const BLEND_SECONDS = 0.18;

interface Frame { pose: HandPose; fingers: V3; palm: V3; offset: V3 }

export function letterFrames(spec: SignSpec): { base: Frame; keys: MovementPath | null; tip: number } {
  const ph = spec.phonology!;
  const pose = HANDSHAPES[ph.handshape] ?? HANDSHAPES.relaxed;
  const base: Frame = { pose, fingers: dir(ph.orientation.fingers), palm: dir(ph.orientation.palm), offset: [0, 0, 0] };
  const keys = ph.movement ? movementPath(ph.movement.shape) : null;
  const tip = ph.movement?.articulator === "pinky" ? 20 : 8;
  return { base, keys, tip };
}

/** Pose at normalized time t (0..1) of the letter's movement (a smooth path, Part H). */
export function frameAt(base: Frame, keys: MovementPath | null, t: number): Frame {
  if (!keys) return base;
  return { pose: base.pose, ...keys.at(t) };
}

export function jointsOf(f: Frame): V3[] {
  return transform(handJointsLocal(f.pose), orientationMatrix(f.fingers, f.palm), f.offset);
}

/** Every joint position the letter goes through (for camera framing). */
export function letterExtent(spec: SignSpec): V3[] {
  const { base, keys } = letterFrames(spec);
  const pts: V3[] = [];
  for (let k = 0; k <= (keys ? 12 : 0); k++) {
    const j = jointsOf(frameAt(base, keys, k / 12));
    pts.push(...j);
    // include a little of the forearm so the wrist is never cut
    const along = vec.norm(vec.sub(j[0], j[9]));
    pts.push(vec.add(j[0], vec.scale(along, 0.45)));
  }
  return pts;
}

interface Props {
  spec: SignSpec;
  speed: number;          // 1 normal, 0.5 slow
  playId: number;         // change to restart the movement
  highlight?: Highlight;
  onEnded?: () => void;
  holdSeconds?: number;   // static letters report "ended" after this long
  /** small dip at the start of each letter so repeated letters (BOOK) are visible */
  bounce?: boolean;
}

export function LetterScene({ spec, speed, playId, highlight, onEnded, holdSeconds = 1.2, bounce = false }: Props) {
  const { base, keys, tip } = useMemo(() => letterFrames(spec), [spec]);
  const joints = useRef<V3[] | null>(jointsOf(base));
  const state = useRef({ t: 0, ended: false, play: -1, spec: "", from: null as Frame | null, blend: 1, current: base });

  const path = useMemo(() => {
    if (!keys) return null;
    return Array.from({ length: 72 }, (_, k) => jointsOf(frameAt(base, keys, k / 71))[tip]);
  }, [base, keys, tip]);

  useFrame((_, dt) => {
    const s = state.current;
    if (s.play !== playId || s.spec !== spec.id) {
      if (s.spec && s.spec !== spec.id) { s.from = s.current; s.blend = 0; }
      s.play = playId; s.spec = spec.id; s.t = 0; s.ended = false;
    }
    const duration = keys ? LETTER_MOVE_SECONDS : holdSeconds;
    s.t += (dt * speed) / duration;
    let target = frameAt(base, keys, Math.min(1, s.t));
    if (bounce && !keys) {
      const u = Math.min(1, s.t * 5);
      const dip = -0.14 * (1 - u * u * (3 - 2 * u));
      target = { ...target, offset: [target.offset[0], target.offset[1] + dip, target.offset[2]] };
    }
    let f = target;
    if (s.from && s.blend < 1) {
      s.blend = Math.min(1, s.blend + dt / BLEND_SECONDS);
      const u = s.blend;
      f = {
        pose: lerpPose(s.from.pose, target.pose, u),
        fingers: lerpDir(s.from.fingers, target.fingers, u),
        palm: lerpDir(s.from.palm, target.palm, u),
        offset: target.offset.map((v, i) => s.from!.offset[i] + (v - s.from!.offset[i]) * u) as V3,
      };
    }
    s.current = f;
    joints.current = jointsOf(f);
    if (s.t >= 1 && !s.ended) {
      s.ended = true;
      onEnded?.();
    }
  });

  return (
    <group>
      <HandMesh joints={joints} side="right" highlight={highlight} />
      {path && (
        <Line points={path} color="#1cb0f6" lineWidth={5} transparent opacity={0.55} dashed dashSize={0.12} gapSize={0.07} />
      )}
    </group>
  );
}
