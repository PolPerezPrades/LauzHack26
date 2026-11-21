/**
 * Half-body toon avatar replaying motion extracted OFFLINE from a real signer's video
 * (scripts/extract_motion.py, MediaPipe Holistic): arms, both hands (21 points each), head
 * orientation and eyebrows/mouth — non-manual markers are grammatical in ASL.
 * Hands are drawn ~75% larger than life for legibility (cartoon convention).
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import { HandMesh, OUTLINE, PLACEHOLDER, SKIN } from "./HandMesh";
import { HANDSHAPES } from "./handshapeLibrary";
import { handJointsLocal, orientationMatrix, transform, vec, type V3 } from "./kinematics";
import { capsuleGeometry, outlineMaterial, setGeometry, toonGradient } from "./toon";

export interface Motion {
  id: string;
  fps: number;
  frames: number;
  poseJoints: number[];
  pose: (number[] | null)[];
  leftHand: (number[] | null)[];
  rightHand: (number[] | null)[];
  face: { keys: string[]; values: (number[] | null)[] };
  crop: number[];
  quality: Record<string, number>;
}

const cache = new Map<string, Promise<Motion>>();
export function loadMotion(url: string): Promise<Motion> {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`motion ${r.status}`); return r.json(); }));
  return cache.get(url)!;
}

// indices inside Motion.pose (see POSE_IDX in extract_motion.py)
const NOSE = 0, L_EAR = 3, R_EAR = 4, L_SH = 7, R_SH = 8, L_EL = 9, R_EL = 10, L_WR = 11, R_WR = 12, L_HIP = 13, R_HIP = 14;
const HAND_SCALE = 1.75;
const SHIRT = "#355c8c";
const HAIR = "#3a2a20";

const toV3 = (a: number[], i: number): V3 => [a[i * 3], -a[i * 3 + 1], -a[i * 3 + 2]]; // MediaPipe → viewer
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export interface AvatarFrame {
  body: V3[];           // 15 pose joints (viewer space, metres, hips at origin)
  left: V3[];           // 21 joints of the signer's LEFT hand, anchored at the left wrist
  right: V3[];
  face: number[];       // blendshapes, see Motion.face.keys
}

/** Fills gaps (hold last value; leading gaps take the first available value). */
function holdFill<T>(arr: (T | null)[]): (T | null)[] {
  const out = [...arr];
  let last: T | null = null;
  for (let i = 0; i < out.length; i++) { if (out[i] != null) last = out[i]; else out[i] = last; }
  const first = out.find((x) => x != null) ?? null;
  for (let i = 0; i < out.length && out[i] == null; i++) out[i] = first;
  return out;
}

function restingHand(wrist: V3, elbow: V3, isLeft: boolean): V3[] {
  // relaxed hand continuing the forearm, palm towards the body's midline
  const fingers = vec.norm(vec.sub(wrist, elbow));
  const palm: V3 = isLeft ? [-1, 0, 0] : [1, 0, 0];
  const m = (v: V3): V3 => (isLeft ? [-v[0], v[1], v[2]] : v);
  const local = handJointsLocal(HANDSHAPES.rest);
  const j = transform(local, orientationMatrix(m(fingers), m(palm)));
  return j.map((p) => vec.add(wrist, vec.scale(m(p), 0.085 * 1.15))); // idle hand: not enlarged
}

export function prepareMotion(m: Motion): AvatarFrame[] {
  const pose = holdFill(m.pose);
  const lh = holdFill(m.leftHand), rh = holdFill(m.rightHand);
  const face = holdFill(m.face.values);
  return pose.map((p, f) => {
    const body = Array.from({ length: m.poseJoints.length }, (_, i) => toV3(p ?? pose[0]!, i));
    const hand = (data: number[] | null, wrist: number, elbow: number, isLeft: boolean) => {
      if (!data) return restingHand(body[wrist], body[elbow], isLeft);
      const pts = Array.from({ length: 21 }, (_, i) => toV3(data, i));
      return pts.map((q) => vec.add(body[wrist], vec.scale(vec.sub(q, pts[0]), HAND_SCALE)));
    };
    return { body, left: hand(lh[f], L_WR, L_EL, true), right: hand(rh[f], R_WR, R_EL, false), face: face[f] ?? new Array(8).fill(0) };
  });
}

export function frameAt(frames: AvatarFrame[], x: number): AvatarFrame {
  const i = Math.max(0, Math.min(frames.length - 1, Math.floor(x)));
  const j = Math.min(frames.length - 1, i + 1);
  const t = Math.min(1, Math.max(0, x - i));
  const a = frames[i], b = frames[j];
  return {
    body: a.body.map((p, k) => lerp3(p, b.body[k], t)),
    left: a.left.map((p, k) => lerp3(p, b.left[k], t)),
    right: a.right.map((p, k) => lerp3(p, b.right[k], t)),
    face: a.face.map((v, k) => v + (b.face[k] - v) * t),
  };
}

/** Points that bound the signing space while the sign is active (for camera framing). */
export function avatarExtent(frames: AvatarFrame[]): V3[] {
  const pts: V3[] = [];
  const active = frames.filter((fr) => {
    const sh = (fr.body[L_SH][1] + fr.body[R_SH][1]) / 2, hip = (fr.body[L_HIP][1] + fr.body[R_HIP][1]) / 2;
    return Math.max(fr.body[L_WR][1], fr.body[R_WR][1]) > hip + 0.35 * (sh - hip);
  });
  for (const fr of active.length ? active : frames) {
    const head = vec.scale(vec.add(fr.body[L_EAR], fr.body[R_EAR]), 0.5);
    pts.push(vec.add(head, [0, 0.16, 0]), fr.body[L_SH], fr.body[R_SH], fr.body[L_EL], fr.body[R_EL], ...fr.left, ...fr.right);
    const chest = vec.scale(vec.add(vec.add(fr.body[L_SH], fr.body[R_SH]), vec.add(fr.body[L_HIP], fr.body[R_HIP])), 0.25);
    pts.push(chest);
  }
  return pts;
}

interface Props {
  frames: AvatarFrame[];
  fps: number;
  speed: number;
  playId: number;
  onEnded?: () => void;
  loop?: boolean;
}

export function AvatarScene({ frames, fps, speed, playId, onEnded, loop = true }: Props) {
  const grad = toonGradient();
  const left = useRef<V3[] | null>(frames[0].left);
  const right = useRef<V3[] | null>(frames[0].right);
  const st = useRef({ x: 0, pause: 0, play: -1, ended: false });
  const torso = useRef<THREE.Mesh>(null);
  const limbs = useRef<(THREE.Mesh | null)[]>([]);
  const head = useRef<THREE.Group>(null);
  const browL = useRef<THREE.Mesh>(null), browR = useRef<THREE.Mesh>(null), mouth = useRef<THREE.Mesh>(null);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), m: new THREE.Matrix4() }), []);

  const setLimb = (mesh: THREE.Mesh | null, a: V3, b: V3, r: number) => {
    if (!mesh) return;
    tmp.a.set(...a); tmp.b.set(...b);
    const d = tmp.b.clone().sub(tmp.a);
    mesh.position.addVectors(tmp.a, tmp.b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(tmp.up, d.clone().normalize());
    setGeometry(mesh, capsuleGeometry(r, d.length()));
  };

  useFrame((_, dt) => {
    const s = st.current;
    if (s.play !== playId) { s.play = playId; s.x = 0; s.pause = 0; s.ended = false; }
    if (s.pause > 0) {
      s.pause -= dt;
      if (s.pause <= 0 && loop) s.x = 0;
    } else {
      s.x += dt * fps * speed;
      if (s.x >= frames.length - 1) {
        s.x = frames.length - 1;
        s.pause = 0.8;
        if (!s.ended) { s.ended = true; onEnded?.(); }
        if (loop) s.ended = false;
      }
    }
    const fr = frameAt(frames, s.x);
    const b = fr.body;
    left.current = fr.left;
    right.current = fr.right;

    // torso: convex hull of shoulders and hips with some depth
    if (torso.current) {
      const pts: THREE.Vector3[] = [];
      for (const [i, out] of [[L_SH, 0.035], [R_SH, -0.035], [L_HIP, 0.0], [R_HIP, 0.0]] as const) {
        for (const z of [0.07, -0.07]) pts.push(new THREE.Vector3(b[i][0] + out, b[i][1] - (i === L_SH || i === R_SH ? 0.02 : 0), b[i][2] + z));
      }
      const old = torso.current.geometry;
      setGeometry(torso.current, new ConvexGeometry(pts));
      if (old !== PLACEHOLDER) old?.dispose();
    }
    const shMid = vec.scale(vec.add(b[L_SH], b[R_SH]), 0.5);
    const headC = vec.add(vec.scale(vec.add(b[L_EAR], b[R_EAR]), 0.5), [0, 0.01, 0]);
    setLimb(limbs.current[0], b[L_SH], b[L_EL], 0.045);
    setLimb(limbs.current[1], b[L_EL], b[L_WR], 0.038);
    setLimb(limbs.current[2], b[R_SH], b[R_EL], 0.045);
    setLimb(limbs.current[3], b[R_EL], b[R_WR], 0.038);
    setLimb(limbs.current[4], shMid, vec.add(headC, [0, -0.08, 0]), 0.058);

    // head orientation from ears (right axis) and nose (forward)
    if (head.current) {
      // x = signer's left (ears), z = forward (nose), y = up
      const xAxis = new THREE.Vector3(...vec.sub(b[L_EAR], b[R_EAR])).normalize();
      const f0 = new THREE.Vector3(...vec.sub(b[NOSE], headC));
      const zAxis = f0.sub(xAxis.clone().multiplyScalar(f0.dot(xAxis))).normalize();
      const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
      tmp.m.makeBasis(xAxis, yAxis, zAxis);
      head.current.position.set(...headC);
      head.current.quaternion.setFromRotationMatrix(tmp.m);
      const r = Math.max(0.085, vec.len(vec.sub(b[L_EAR], b[R_EAR])) * 0.78);
      head.current.scale.setScalar(r);
      // non-manual markers (exaggerated for teaching)
      const [inner, downL, downR, outerL, outerR, jaw] = fr.face;
      const raise = Math.max(-1, Math.min(1, 1.8 * (inner * 0.6 + (outerL + outerR) * 0.2) - 1.6 * ((downL + downR) / 2)));
      if (browL.current && browR.current) {
        browL.current.position.y = 0.32 + raise * 0.13;
        browR.current.position.y = 0.32 + raise * 0.13;
        const furrow = Math.max(0, (downL + downR) / 2) * 0.9;
        // the inner ends (towards the nose) go down when frowning, up with browInnerUp
        browL.current.rotation.z = furrow - Math.max(0, inner) * 0.3;
        browR.current.rotation.z = -furrow + Math.max(0, inner) * 0.3;
      }
      if (mouth.current) mouth.current.scale.y = 0.04 + Math.min(1, jaw * 2.2) * 0.14;
    }
  });

  const OUT = <mesh geometry={PLACEHOLDER} material={outlineMaterial(OUTLINE)} />;
  const headGeo = useMemo(() => new THREE.SphereGeometry(1, 32, 24), []);
  return (
    <group>
      <mesh ref={torso} geometry={PLACEHOLDER}>
        <meshToonMaterial color={SHIRT} gradientMap={grad} />
        {OUT}
      </mesh>
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} ref={(m) => { limbs.current[k] = m; }} geometry={PLACEHOLDER}>
          <meshToonMaterial color={SHIRT} gradientMap={grad} />
          {OUT}
        </mesh>
      ))}
      <mesh ref={(m) => { limbs.current[4] = m; }} geometry={PLACEHOLDER}>
        <meshToonMaterial color={SKIN} gradientMap={grad} />
      </mesh>
      {/* head in a unit frame: x = signer's left, y = up, z = towards the viewer */}
      <group ref={head}>
        <mesh geometry={headGeo}>
          <meshToonMaterial color={SKIN} gradientMap={grad} />
          <mesh geometry={headGeo} material={outlineMaterial(OUTLINE)} />
        </mesh>
        <mesh position={[0, 0.25, -0.12]} scale={[1.04, 0.92, 1.0]}>
          <sphereGeometry args={[1, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshToonMaterial color={HAIR} gradientMap={grad} side={THREE.DoubleSide} />
        </mesh>
        {[-0.36, 0.36].map((x) => (
          <mesh key={x} position={[x, 0.08, 0.9]} scale={[0.11, 0.15, 0.08]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshBasicMaterial color="#2a1a12" />
          </mesh>
        ))}
        <mesh ref={browL} position={[0.36, 0.32, 0.9]} scale={[0.26, 0.055, 0.06]}>
          <sphereGeometry args={[1, 16, 8]} />
          <meshBasicMaterial color={HAIR} />
        </mesh>
        <mesh ref={browR} position={[-0.36, 0.32, 0.9]} scale={[0.26, 0.055, 0.06]}>
          <sphereGeometry args={[1, 16, 8]} />
          <meshBasicMaterial color={HAIR} />
        </mesh>
        <mesh ref={mouth} position={[0, -0.42, 0.88]} scale={[0.22, 0.05, 0.06]}>
          <sphereGeometry args={[1, 16, 8]} />
          <meshBasicMaterial color="#7a2e2e" />
        </mesh>
      </group>
      <HandMesh joints={left} side="left" forearm={false} />
      <HandMesh joints={right} side="right" forearm={false} />
    </group>
  );
}
