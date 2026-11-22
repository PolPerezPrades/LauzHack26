/**
 * Stylised (toon) hand drawn from 21 joint positions in MediaPipe order: one generated surface for
 * the whole hand (handGeometry.ts: tapered phalanges, a palm shaped from the wrist and the
 * knuckles, the thumb web, an optional forearm), with a lighter palm side and nails on the back of
 * each fingertip, so palm vs back reads at a glance, plus a bold outline of constant pixel width.
 * Joints are read from a ref every frame, so the same component serves static letters, animated
 * letters and the avatar (real MediaPipe data). Four draw calls per hand.
 */
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildHand, buildNails, handIndices, handVertexCount, NAIL_VERTS, nailIndices, type Finger, type RGB } from "./handGeometry";
import type { V3 } from "./kinematics";
import { outlineMaterial, toonGradient } from "./toon";

/** tiny placeholder so meshes (and their outlines) always have a geometry before the first update */
export const PLACEHOLDER = new THREE.SphereGeometry(0.001, 4, 2);

export type PartState = "error" | "ok" | undefined;
export type Highlight = Partial<Record<"thumb" | "index" | "middle" | "ring" | "pinky", PartState>>;

/** back of the hand (and the default skin of the avatar) */
export const SKIN = "#f2bd94";
/** palm side: lighter and a little pinker */
export const PALM = "#fcdcc4";
export const OUTLINE = "#3d2516";
const NAIL = "#fff1ea";
const COLORS = { error: "#ff5a5a", ok: "#6bd94a" };

const linear = (hex: string): RGB => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const SKIN_L = linear(SKIN), PALM_L = linear(PALM);
const STATE_L = { error: linear(COLORS.error), ok: linear(COLORS.ok) };
const FINGERS: Finger[] = ["thumb", "index", "middle", "ring", "pinky"];

interface Props {
  joints: React.MutableRefObject<V3[] | null>;
  side?: "right" | "left";
  highlight?: Highlight;
  forearm?: boolean;
  /** @deprecated kept for compatibility: the forearm is bare now */
  sleeve?: string;
}

function makeGeometry(count: number, index: Uint32Array, colours: boolean) {
  const g = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const nrm = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute("position", pos);
  g.setAttribute("normal", nrm);
  if (colours) g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  return g;
}

export function HandMesh({ joints, side = "right", highlight, forearm = true }: Props) {
  const grad = toonGradient();
  const skin = useMemo(() => makeGeometry(handVertexCount(forearm), handIndices(forearm), true), [forearm]);
  const nails = useMemo(() => makeGeometry(NAIL_VERTS, nailIndices(), false), []);
  useLayoutEffect(() => () => { skin.dispose(); nails.dispose(); }, [skin, nails]);
  const lastKey = useRef("");
  const look = useMemo(() => {
    const fingers: Partial<Record<Finger, RGB>> = {};
    for (const f of FINGERS) { const st = highlight?.[f]; if (st) fingers[f] = STATE_L[st]; }
    return { side, forearm, back: SKIN_L, palm: PALM_L, fingers };
  }, [side, forearm, highlight?.thumb, highlight?.index, highlight?.middle, highlight?.ring, highlight?.pinky]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = () => {
    const j = joints.current;
    if (!j) return;
    const key = `${j[0].join(",")}|${j[4].join(",")}|${j[8].join(",")}|${j[12].join(",")}|${j[20].join(",")}|${JSON.stringify(look.fingers)}`;
    if (key === lastKey.current) return; // unchanged since last frame
    lastKey.current = key;
    const p = skin.attributes.position as THREE.BufferAttribute, n = skin.attributes.normal as THREE.BufferAttribute, c = skin.attributes.color as THREE.BufferAttribute;
    buildHand(j, look, p.array as Float32Array, n.array as Float32Array, c.array as Float32Array);
    p.needsUpdate = n.needsUpdate = c.needsUpdate = true;
    const np = nails.attributes.position as THREE.BufferAttribute, nn = nails.attributes.normal as THREE.BufferAttribute;
    buildNails(j, side, np.array as Float32Array, nn.array as Float32Array);
    np.needsUpdate = nn.needsUpdate = true;
  };

  useLayoutEffect(update);
  useFrame(update);

  return (
    <group>
      <mesh geometry={skin} frustumCulled={false}>
        <meshToonMaterial vertexColors gradientMap={grad} />
      </mesh>
      <mesh geometry={skin} material={outlineMaterial(OUTLINE)} frustumCulled={false} />
      <mesh geometry={nails} frustumCulled={false}>
        <meshToonMaterial color={NAIL} gradientMap={grad} />
      </mesh>
      <mesh geometry={nails} material={outlineMaterial(OUTLINE, 1.1)} frustumCulled={false} />
    </group>
  );
}
