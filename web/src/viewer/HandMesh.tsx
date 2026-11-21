/**
 * Stylised (toon) hand drawn from 21 joint positions in MediaPipe order. Capsules per bone, a
 * convex palm, nails on the back of each fingertip (shows palm vs back at a glance), bold outlines.
 * Joints are read from a ref every frame, so the same component serves static letters,
 * animated letters and the avatar (real MediaPipe data).
 */
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import type { V3 } from "./kinematics";
import { capsuleGeometry as capsule, outlineMaterial, setGeometry, toonGradient } from "./toon";

/** tiny placeholder so meshes (and their outlines) always have a geometry before the first update */
export const PLACEHOLDER = new THREE.SphereGeometry(0.001, 4, 2);

export type PartState = "error" | "ok" | undefined;
export type Highlight = Partial<Record<"thumb" | "index" | "middle" | "ring" | "pinky", PartState>>;

export const SKIN = "#f4c29a";
export const OUTLINE = "#3d2516";
const NAIL = "#fde6d6";
const COLORS = { error: "#ff5a5a", ok: "#6bd94a" };

const FINGER_OF = ["thumb", "thumb", "thumb", "thumb", "index", "index", "index", "index", "middle", "middle", "middle", "middle", "ring", "ring", "ring", "ring", "pinky", "pinky", "pinky", "pinky"] as const;
// bones (a, b): thumb from CMC; fingers from MCP
const BONES: [number, number][] = [
  [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [9, 10], [10, 11], [11, 12], [13, 14], [14, 15], [15, 16], [17, 18], [18, 19], [19, 20],
];
const TIPS = [4, 8, 12, 16, 20];
const UP = new THREE.Vector3(0, 1, 0);


interface Props {
  joints: React.MutableRefObject<V3[] | null>;
  side?: "right" | "left";
  highlight?: Highlight;
  forearm?: boolean;
  sleeve?: string;
}

export function HandMesh({ joints, side = "right", highlight, forearm = true, sleeve = "#2f6f8f" }: Props) {
  const grad = toonGradient();
  const bones = useRef<(THREE.Mesh | null)[]>([]);
  const nails = useRef<(THREE.Mesh | null)[]>([]);
  const palm = useRef<THREE.Mesh>(null);
  const arm = useRef<THREE.Mesh>(null);
  const lastKey = useRef("");

  // shared geometries (radius as a fraction of the palm length; capsules cached per bone length
  // so the rounded caps never get squashed — meshes are scaled uniformly by the palm length)
  const geo = useMemo(() => ({
    nail: new THREE.SphereGeometry(1, 16, 10),
  }), []);

  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), d: new THREE.Vector3(), q: new THREE.Quaternion(), n: new THREE.Vector3(), l: new THREE.Vector3(), m: new THREE.Matrix4() }), []);

  const update = () => {
    const j = joints.current;
    if (!j) return;
    const key = j[4].join(",") + j[8].join(",") + j[0].join(",") + j[20].join(",");
    if (key === lastKey.current) return; // unchanged since last frame
    lastKey.current = key;
    const P = (i: number, out: THREE.Vector3) => out.set(j[i][0], j[i][1], j[i][2]);
    const palmLen = P(9, tmp.a).distanceTo(P(0, tmp.b)) || 1;
    // palm normal and lateral axis (towards the thumb side)
    const v5 = P(5, new THREE.Vector3()).sub(P(0, tmp.a));
    const v17 = P(17, new THREE.Vector3()).sub(P(0, tmp.a));
    const normal = new THREE.Vector3().crossVectors(v5, v17).normalize();
    if (side === "left") normal.negate();
    const lateral = P(5, new THREE.Vector3()).sub(P(17, tmp.a)).normalize();

    BONES.forEach(([ia, ib], k) => {
      const mesh = bones.current[k];
      if (!mesh) return;
      P(ia, tmp.a); P(ib, tmp.b);
      tmp.d.subVectors(tmp.b, tmp.a);
      const len = tmp.d.length();
      mesh.position.addVectors(tmp.a, tmp.b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(UP, tmp.d.normalize());
      const finger = FINGER_OF[ia - 1];
      const r = finger === "thumb" ? 0.115 : finger === "pinky" ? 0.082 : 0.095;
      setGeometry(mesh, capsule(r, len / palmLen));
      mesh.scale.setScalar(palmLen);
    });

    TIPS.forEach((tip, k) => {
      const mesh = nails.current[k];
      if (!mesh) return;
      P(tip, tmp.a); P(tip - 1, tmp.b);
      const dirv = tmp.d.subVectors(tmp.a, tmp.b).normalize();
      // back of the finger: perpendicular to the bone, on the side opposite the palm
      const back = new THREE.Vector3().crossVectors(dirv, lateral).multiplyScalar(side === "right" ? 1 : -1);
      if (k === 0) back.copy(normal).negate().addScaledVector(dirv, -normal.clone().negate().dot(dirv)).normalize();
      const r = (k === 0 ? 0.115 : k === 4 ? 0.082 : 0.095) * palmLen;
      mesh.position.copy(tmp.a).addScaledVector(dirv, -0.45 * r).addScaledVector(back, 0.72 * r);
      const x = new THREE.Vector3().crossVectors(dirv, back).normalize();
      tmp.m.makeBasis(x, dirv, back);
      mesh.quaternion.setFromRotationMatrix(tmp.m);
      mesh.scale.set(r * 0.72, r * 0.9, r * 0.28);
    });

    if (palm.current) {
      const th = 0.13 * palmLen;
      const pts: THREE.Vector3[] = [];
      for (const i of [0, 1, 5, 9, 13, 17]) {
        P(i, tmp.a);
        pts.push(tmp.a.clone().addScaledVector(normal, th), tmp.a.clone().addScaledVector(normal, -th));
      }
      // fleshy thumb base (thenar)
      const thenar = P(1, new THREE.Vector3()).lerp(P(2, tmp.b), 0.55);
      pts.push(thenar.clone().addScaledVector(normal, th * 0.9), thenar.clone().addScaledVector(normal, -th * 0.6));
      // wrist width
      const w0 = P(0, new THREE.Vector3());
      pts.push(w0.clone().addScaledVector(lateral, 0.2 * palmLen), w0.clone().addScaledVector(lateral, -0.2 * palmLen));
      const old = palm.current.geometry;
      setGeometry(palm.current, new ConvexGeometry(pts));
      if (old !== PLACEHOLDER) old?.dispose();
    }

    if (arm.current) {
      // forearm stub continuing from the wrist, opposite to the middle finger's metacarpal
      const w = P(0, tmp.a);
      const along = P(9, tmp.b).sub(w).normalize().negate();
      const len = 0.62 * palmLen;
      arm.current.position.copy(w).addScaledVector(along, len * 0.5 + 0.1 * palmLen);
      arm.current.quaternion.setFromUnitVectors(UP, along);
      setGeometry(arm.current, capsule(0.22, 0.62));
      arm.current.scale.setScalar(palmLen);
    }
  };

  useLayoutEffect(update);
  useFrame(update);

  const color = (finger: (typeof FINGER_OF)[number]) => {
    const st = highlight?.[finger];
    return st ? COLORS[st] : SKIN;
  };
  const OUT = <mesh geometry={PLACEHOLDER} material={outlineMaterial(OUTLINE)} />;

  return (
    <group>
      <mesh ref={palm} geometry={PLACEHOLDER}>
        <meshToonMaterial color={SKIN} gradientMap={grad} />
        {OUT}
      </mesh>
      {BONES.map(([a], k) => {
        const finger = FINGER_OF[a - 1];
        return (
          <mesh key={k} ref={(m) => { bones.current[k] = m; }} geometry={PLACEHOLDER}>
            <meshToonMaterial color={color(finger)} gradientMap={grad} />
            {OUT}
          </mesh>
        );
      })}
      {TIPS.map((_, k) => (
        <mesh key={`n${k}`} ref={(m) => { nails.current[k] = m; }} geometry={geo.nail}>
          <meshToonMaterial color={NAIL} gradientMap={grad} />
        </mesh>
      ))}
      {forearm && (
        <mesh ref={arm} geometry={PLACEHOLDER}>
          <meshToonMaterial color={sleeve} gradientMap={grad} />
          {OUT}
        </mesh>
      )}
    </group>
  );
}
