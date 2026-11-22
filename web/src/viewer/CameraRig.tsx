import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { V3 } from "./kinematics";

const DEFAULT_VIEW: V3 = [0.22, 0.12, 1];

/**
 * Frames ALL the points a sign goes through: projects them on the camera plane and picks the
 * closest distance at which none falls outside the frustum (for the current aspect ratio).
 * Optional orbit: rotate to read the handshape from other angles; never zoom/pan away.
 */
export function CameraRig({ points, resetKey, interactive, view: viewProp, margin = 1.08, pad = 0.16 }: {
  points: V3[]; resetKey: number; interactive: boolean; view?: V3; margin?: number;
  /** extra room around every point (finger thickness + outline), in scene units */
  pad?: number;
}) {
  const { camera, size } = useThree();
  const view = viewProp ?? DEFAULT_VIEW;
  const controls = useRef<OrbitControlsImpl>(null);

  const fit = useMemo(() => {
    const box = new THREE.Box3();
    for (const p of points) box.expandByPoint(new THREE.Vector3(...p));
    const center = box.getCenter(new THREE.Vector3());
    return { center, rel: points.map((p) => new THREE.Vector3(...p).sub(center)) };
  }, [points]);

  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const dirv = new THREE.Vector3(...view).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dirv).normalize();
    const up = new THREE.Vector3().crossVectors(dirv, right).normalize();
    const vf = (cam.fov * Math.PI) / 180;
    const tv = Math.tan(vf / 2);
    const th = tv * (size.width / Math.max(1, size.height));
    let d = 0;
    for (const p of fit.rel) {
      const pz = p.dot(dirv);
      d = Math.max(d, pz + pad + (Math.abs(p.dot(right)) + pad) / th, pz + pad + (Math.abs(p.dot(up)) + pad) / tv);
    }
    d *= margin;
    cam.position.copy(fit.center).addScaledVector(dirv, d);
    cam.near = d / 50;
    cam.far = d * 20;
    cam.lookAt(fit.center);
    cam.updateProjectionMatrix();
    if (controls.current) {
      controls.current.target.copy(fit.center);
      controls.current.update();
    }
  }, [fit, resetKey, size.width, size.height, camera, view[0], view[1], view[2], margin, pad]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!interactive) return null;
  return (
    <OrbitControls
      ref={controls}
      target={fit.center}
      enablePan={false}
      enableZoom={false}
      enableDamping
      minAzimuthAngle={-Math.PI * 0.45}
      maxAzimuthAngle={Math.PI * 0.45}
      minPolarAngle={Math.PI * 0.25}
      maxPolarAngle={Math.PI * 0.7}
    />
  );
}
