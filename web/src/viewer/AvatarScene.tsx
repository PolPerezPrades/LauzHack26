/**
 * Half-body toon avatar replaying motion extracted OFFLINE from a real signer's video
 * (scripts/extract_motion.py, MediaPipe Holistic), cleaned by motion.ts: smooth 60 fps frames,
 * constant bone lengths, hands attached to the wrists, crossfades where a hand was not tracked.
 * Body: a shaped torso with rounded shoulders, sleeves on the upper arms, bare forearms and the
 * toon hands (drawn 1.3× life, scaled about the knuckles so contacts stay where the signer's are).
 * Face: eyes, eyebrows and mouth follow the clip's blendshapes (non-manual markers are grammar);
 * the eyes widen or narrow with the brows, the mouth opens and smiles.
 * Every mesh keeps its geometry; a frame only moves and rotates them (no allocation per frame).
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { HandMesh, OUTLINE, PLACEHOLDER, SKIN } from "./HandMesh";
import type { V3 } from "./kinematics";
import { avatarExtent, blendFrames, frameAt, POSE, prepareMotion, type AvatarFrame, type Motion, type PreparedMotion } from "./motion";
import { AVATAR } from "./params";
import { capsuleGeometry, outlineMaterial, setGeometry, taperedCapsuleGeometry, toonGradient } from "./toon";

export type { AvatarFrame, Motion, PreparedMotion };
export { avatarExtent, prepareMotion };

const cache = new Map<string, Promise<Motion>>();
export function loadMotion(url: string): Promise<Motion> {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`motion ${r.status}`); return r.json(); }));
  return cache.get(url)!;
}
const prepared = new Map<string, PreparedMotion>();
/** Load and clean a clip once per URL (the clean-up takes a few milliseconds). */
export async function loadPreparedMotion(url: string): Promise<PreparedMotion> {
  const hit = prepared.get(url);
  if (hit) return hit;
  const p = prepareMotion(await loadMotion(url));
  prepared.set(url, p);
  return p;
}

const SHIRT = "#355c8c";
const HAIR = "#3a2a20";
const EYE = "#2a1a12";
const MOUTH = "#7a2e2e";
const LIP = "#9b4a3f";

/** Unit torso along +y (0 = hip line, 1 = shoulder line): waist, chest, rounded shoulders, neck base. */
function torsoGeometry() {
  const prof: [number, number][] = [[0.001, -0.12], [0.62, -0.08], [0.72, 0], [0.68, 0.25], [0.8, 0.55], [0.95, 0.8], [1, 0.93], [0.9, 1.02], [0.6, 1.08], [0.28, 1.11], [0.001, 1.12]];
  return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 24);
}

interface Props {
  motion: PreparedMotion;
  speed: number;
  playId: number;
  onEnded?: () => void;
  loop?: boolean;
}

const v = (p: V3, out: THREE.Vector3) => out.set(p[0], p[1], p[2]);
const smoothstep = (u: number) => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x); };

export function AvatarScene({ motion, speed, playId, onEnded, loop = true }: Props) {
  const grad = toonGradient();
  const { frames, fps, sizes } = motion;
  const left = useRef<V3[] | null>(frames[0].left);
  const right = useRef<V3[] | null>(frames[0].right);
  const st = useRef({ x: 0, hold: -1, play: -1, ended: false });
  const torso = useRef<THREE.Mesh>(null);
  const parts = useRef<Record<string, THREE.Mesh | null>>({});
  const head = useRef<THREE.Group>(null);
  const face = useRef<Record<string, THREE.Object3D | null>>({});
  const tmp = useMemo(() => ({
    a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(),
    x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), m: new THREE.Matrix4(),
  }), []);
  const geo = useMemo(() => ({
    torso: torsoGeometry(),
    sphere: new THREE.SphereGeometry(1, 20, 14),
    hair: new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    lip: new THREE.TorusGeometry(1, 0.16, 6, 16, Math.PI * 0.62),
    upper: [capsuleGeometry(0.047, sizes.upperArm[0]), capsuleGeometry(0.047, sizes.upperArm[1])],
    fore: [taperedCapsuleGeometry(0.04, 0.031, sizes.forearm[0]), taperedCapsuleGeometry(0.04, 0.031, sizes.forearm[1])],
  }), [sizes.upperArm[0], sizes.upperArm[1], sizes.forearm[0], sizes.forearm[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // head size from the clip (ears apart), a little larger than life for the face to read
  const H = useMemo(() => { const rx = Math.max(0.065, (sizes.head / 2) * 1.12); return { rx, ry: rx * 1.32, rz: rx * 1.2 }; }, [sizes.head]);

  /** a mesh from a to b along its +y axis (capsules are centred) */
  const along = (mesh: THREE.Mesh | null, a: V3, b: V3) => {
    if (!mesh) return;
    v(a, tmp.a); v(b, tmp.b);
    mesh.position.addVectors(tmp.a, tmp.b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(tmp.up, tmp.c.subVectors(tmp.b, tmp.a).normalize());
  };

  useFrame((_, dt) => {
    const s = st.current;
    const N = frames.length;
    if (s.play !== playId) { s.play = playId; s.x = 0; s.hold = -1; s.ended = false; }
    if (s.hold >= 0) {
      s.hold += dt;
      if (loop && s.hold >= AVATAR.loopHold) { s.hold = -1; s.x = 0; }
    } else {
      s.x += dt * fps * speed;
      if (s.x >= N - 1) {
        s.x = N - 1;
        s.hold = 0;
        if (!s.ended) { s.ended = true; onEnded?.(); }
        if (loop) s.ended = false;
      }
    }
    let fr: AvatarFrame = frameAt(frames, s.x);
    // a loop does not jump: the last pose blends back into the first one before replaying
    if (loop && s.hold >= 0) fr = blendFrames(frames[N - 1], frames[0], smoothstep((s.hold - (AVATAR.loopHold - AVATAR.loopBlend)) / AVATAR.loopBlend));
    const b = fr.body;
    left.current = fr.left;
    right.current = fr.right;

    // torso: hips → shoulders, oriented by the shoulder line
    const hipC = tmp.a.set(...b[POSE.L_HIP]).add(tmp.b.set(...b[POSE.R_HIP])).multiplyScalar(0.5);
    const shC = tmp.c.set(...b[POSE.L_SH]).add(tmp.b.set(...b[POSE.R_SH])).multiplyScalar(0.5);
    const spine = shC.distanceTo(hipC);
    const shW = tmp.b.set(...b[POSE.L_SH]).distanceTo(tmp.d.set(...b[POSE.R_SH]));
    tmp.y.subVectors(shC, hipC).normalize();
    tmp.x.set(...b[POSE.L_SH]).sub(tmp.d.set(...b[POSE.R_SH]));
    tmp.x.addScaledVector(tmp.y, -tmp.x.dot(tmp.y)).normalize();
    tmp.z.crossVectors(tmp.x, tmp.y);
    if (torso.current) {
      torso.current.position.copy(hipC);
      torso.current.quaternion.setFromRotationMatrix(tmp.m.makeBasis(tmp.x, tmp.y, tmp.z));
      torso.current.scale.set((shW / 2) * 1.12, spine, (shW / 2) * 0.56);
    }
    const shoulderMid: V3 = [shC.x, shC.y, shC.z];
    const torsoUp: V3 = [tmp.y.x, tmp.y.y, tmp.y.z];

    // arms: shoulders (rounded), sleeved upper arms, bare forearms; lengths are constant per clip
    const P = parts.current;
    for (const [k, i] of [["shL", POSE.L_SH], ["shR", POSE.R_SH]] as const) P[k]?.position.set(...b[i]);
    along(P.upL ?? null, b[POSE.L_SH], b[POSE.L_EL]);
    along(P.upR ?? null, b[POSE.R_SH], b[POSE.R_EL]);
    along(P.foL ?? null, b[POSE.L_EL], b[POSE.L_WR]);
    along(P.foR ?? null, b[POSE.R_EL], b[POSE.R_WR]);

    // head: centre between the ears, a little up and forward; x = signer's left, z = towards the nose
    const ears: V3 = [(b[POSE.L_EAR][0] + b[POSE.R_EAR][0]) / 2, (b[POSE.L_EAR][1] + b[POSE.R_EAR][1]) / 2, (b[POSE.L_EAR][2] + b[POSE.R_EAR][2]) / 2];
    const hx = tmp.x.set(...b[POSE.L_EAR]).sub(tmp.d.set(...b[POSE.R_EAR])).normalize();
    const f0 = tmp.z.set(...b[POSE.NOSE]).sub(tmp.d.set(...ears));
    const hz = f0.addScaledVector(hx, -f0.dot(hx)).normalize();
    const hy = tmp.y.crossVectors(hz, hx).normalize();
    if (head.current) {
      head.current.position.set(...ears).addScaledVector(hy, H.ry * 0.12).addScaledVector(hz, H.rz * 0.06);
      head.current.quaternion.setFromRotationMatrix(tmp.m.makeBasis(hx, hy, hz));
    }
    // neck: from the shoulders up to under the jaw
    if (P.neck && head.current) {
      const top = tmp.a.copy(head.current.position).addScaledVector(hy, -H.ry * 0.55).addScaledVector(hz, -H.rz * 0.15);
      const bot: V3 = [shoulderMid[0] + torsoUp[0] * 0.02, shoulderMid[1] + torsoUp[1] * 0.02, shoulderMid[2] + torsoUp[2] * 0.02];
      setGeometry(P.neck, capsuleGeometry(0.046, Math.max(0.02, top.distanceTo(tmp.b.set(...bot)))));
      along(P.neck, bot, [top.x, top.y, top.z]);
    }

    // non-manual markers (exaggerated a little for teaching); the clip's left = the signer's left (+x)
    const [inner, downL, downR, outerL, outerR, jaw, smileL, smileR] = fr.face;
    const F = face.current;
    const brow = (side: 1 | -1, down: number, outer: number) => {
      const raise = Math.max(-1, Math.min(1, 1.6 * (inner * 0.55 + outer * 0.45) - 1.5 * down));
      const m = F[side > 0 ? "browL" : "browR"];
      if (m) {
        m.position.y = H.ry * (0.36 + raise * 0.1);
        // the inner end (towards the nose) drops when frowning and lifts with browInnerUp
        m.rotation.z = side * (Math.max(0, down) * 0.55 - Math.max(0, inner) * 0.3);
      }
      const e = F[side > 0 ? "eyeL" : "eyeR"], p = F[side > 0 ? "pupilL" : "pupilR"];
      const open = Math.max(0.55, Math.min(1.25, 1 + raise * 0.22));
      if (e) e.scale.y = H.rx * 0.2 * open;
      if (p) p.scale.y = H.rx * 0.105 * Math.min(1, open);
    };
    brow(1, downL, outerL);
    brow(-1, downR, outerR);
    const smile = Math.min(1, ((smileL + smileR) / 2) * 1.8);
    if (F.mouth) { F.mouth.scale.y = H.rx * (0.025 + Math.min(1, jaw * 2.2) * 0.16); F.mouth.scale.x = H.rx * (0.2 + smile * 0.06); }
    if (F.lip) { F.lip.scale.set(H.rx * (0.2 + smile * 0.05), H.rx * (0.04 + smile * 0.16), H.rx * 0.2); F.lip.position.y = -H.ry * (0.45 - smile * 0.03); }
  });

  const OUT = <mesh geometry={PLACEHOLDER} material={outlineMaterial(OUTLINE)} />;
  const ref = (k: string) => (m: THREE.Mesh | null) => { parts.current[k] = m; };
  const fref = (k: string) => (m: THREE.Object3D | null) => { face.current[k] = m; };
  const skinMat = <meshToonMaterial color={SKIN} gradientMap={grad} />;
  const shirtMat = <meshToonMaterial color={SHIRT} gradientMap={grad} />;
  const withOutline = (g: THREE.BufferGeometry, thick = 2.2) => <mesh geometry={g} material={outlineMaterial(OUTLINE, thick)} />;
  const { rx, ry, rz } = H;
  // eyes sit on the front of the head ellipsoid
  const eyeZ = rz * Math.sqrt(Math.max(0, 1 - 0.36 ** 2 - 0.06 ** 2)) * 0.97;
  return (
    <group>
      <mesh ref={torso} geometry={geo.torso}>
        {shirtMat}
        {withOutline(geo.torso)}
      </mesh>
      {(["shL", "shR"] as const).map((k) => (
        <mesh key={k} ref={ref(k)} geometry={geo.sphere} scale={0.056}>
          {shirtMat}
          {withOutline(geo.sphere)}
        </mesh>
      ))}
      <mesh ref={ref("upL")} geometry={geo.upper[0]}>{shirtMat}{withOutline(geo.upper[0])}</mesh>
      <mesh ref={ref("upR")} geometry={geo.upper[1]}>{shirtMat}{withOutline(geo.upper[1])}</mesh>
      <mesh ref={ref("foL")} geometry={geo.fore[0]}>{skinMat}{withOutline(geo.fore[0])}</mesh>
      <mesh ref={ref("foR")} geometry={geo.fore[1]}>{skinMat}{withOutline(geo.fore[1])}</mesh>
      <mesh ref={ref("neck")} geometry={PLACEHOLDER}>{skinMat}{OUT}</mesh>
      {/* head in its own frame: x = signer's left, y = up, z = towards the viewer */}
      <group ref={head}>
        <mesh geometry={geo.sphere} scale={[rx, ry, rz]}>{skinMat}{withOutline(geo.sphere)}</mesh>
        <mesh geometry={geo.hair} scale={[rx * 1.05, ry * 1.04, rz * 1.06]} rotation={[-0.72, 0, 0]} position={[0, ry * 0.05, -rz * 0.04]}>
          <meshToonMaterial color={HAIR} gradientMap={grad} side={THREE.DoubleSide} />
          {withOutline(geo.hair)}
        </mesh>
        {[1, -1].map((sx) => (
          <mesh key={`ear${sx}`} geometry={geo.sphere} position={[sx * rx * 0.97, -ry * 0.06, -rz * 0.05]} scale={[rx * 0.16, rx * 0.3, rx * 0.12]}>
            {skinMat}{withOutline(geo.sphere)}
          </mesh>
        ))}
        <mesh geometry={geo.sphere} position={[0, -ry * 0.1, rz * 0.98]} scale={[rx * 0.12, rx * 0.17, rx * 0.13]}>
          {skinMat}{withOutline(geo.sphere, 1.6)}
        </mesh>
        {[1, -1].map((sx) => (
          <group key={`eye${sx}`} position={[sx * rx * 0.36, ry * 0.06, eyeZ]} rotation={[0, sx * 0.36, 0]}>
            <mesh ref={fref(sx > 0 ? "eyeL" : "eyeR")} geometry={geo.sphere} scale={[rx * 0.17, rx * 0.2, rx * 0.06]}>
              <meshBasicMaterial color="#ffffff" />
              {withOutline(geo.sphere, 1.4)}
            </mesh>
            <mesh ref={fref(sx > 0 ? "pupilL" : "pupilR")} geometry={geo.sphere} position={[0, -rx * 0.01, rx * 0.05]} scale={[rx * 0.09, rx * 0.105, rx * 0.04]}>
              <meshBasicMaterial color={EYE} />
            </mesh>
          </group>
        ))}
        {[1, -1].map((sx) => (
          <mesh key={`brow${sx}`} ref={fref(sx > 0 ? "browL" : "browR")} geometry={geo.sphere} position={[sx * rx * 0.37, ry * 0.36, rz * 0.9]} scale={[rx * 0.21, rx * 0.055, rx * 0.06]}>
            <meshBasicMaterial color={HAIR} />
          </mesh>
        ))}
        <mesh ref={fref("mouth")} geometry={geo.sphere} position={[0, -ry * 0.45, rz * 0.9]} scale={[rx * 0.2, rx * 0.03, rx * 0.05]}>
          <meshBasicMaterial color={MOUTH} />
        </mesh>
        {/* upper lip line: flat when neutral, curved up at the corners when smiling */}
        <mesh ref={fref("lip")} geometry={geo.lip} position={[0, -ry * 0.45, rz * 0.91]} rotation={[0, 0, Math.PI * 1.19]}>
          <meshBasicMaterial color={LIP} />
        </mesh>
      </group>
      <HandMesh joints={left} side="left" forearm={false} />
      <HandMesh joints={right} side="right" forearm={false} />
    </group>
  );
}
