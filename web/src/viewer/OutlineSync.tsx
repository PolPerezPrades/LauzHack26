import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { setOutlineResolution } from "./toon";

const v = new THREE.Vector2();
/** Mount once per Canvas: outline thickness stays constant in screen pixels. */
export function OutlineSync() {
  useFrame(({ gl }) => {
    gl.getDrawingBufferSize(v);
    setOutlineResolution(v.x, v.y);
  }, -1);
  return null;
}
