import * as THREE from "three";

let grad: THREE.DataTexture | null = null;
/** 3-step gradient for MeshToonMaterial: flat cel-shaded look. */
export function toonGradient() {
  if (!grad) {
    grad = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    grad.minFilter = THREE.NearestFilter;
    grad.magFilter = THREE.NearestFilter;
    grad.generateMipmaps = false;
    grad.needsUpdate = true;
  }
  return grad;
}

const capsuleCache = new Map<string, THREE.CapsuleGeometry>();
/** Capsule of radius r whose straight part equals `length` (quantised to 2% so it can be cached). */
export function capsuleGeometry(r: number, length: number) {
  const L = Math.max(0.005, Math.round(length * 50) / 50);
  const key = `${r}:${L}`;
  let g = capsuleCache.get(key);
  if (!g) capsuleCache.set(key, (g = new THREE.CapsuleGeometry(r, L, 6, 14)));
  return g;
}

// ---- outlines (inverted hull, constant thickness in pixels) ------------------------------------
const outlineMats = new Map<string, THREE.ShaderMaterial>();
export function outlineMaterial(color = "#3d2516", thicknessPx = 2.2) {
  const key = `${color}:${thicknessPx}`;
  let m = outlineMats.get(key);
  if (!m) {
    m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { color: { value: new THREE.Color(color) }, thickness: { value: thicknessPx }, resolution: { value: new THREE.Vector2(800, 600) } },
      vertexShader: /* glsl */ `
        uniform float thickness; uniform vec2 resolution;
        void main() {
          vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vec3 n = normalize(normalMatrix * normal);
          vec2 dir = (projectionMatrix * vec4(n, 0.0)).xy;
          float l = length(dir);
          if (l > 1e-5) clip.xy += dir / l * thickness / resolution * 2.0 * clip.w;
          gl_Position = clip;
        }`,
      fragmentShader: /* glsl */ `uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }`,
    });
    outlineMats.set(key, m);
  }
  return m;
}
/** Keep outline thickness in pixels whatever the canvas size. */
export function setOutlineResolution(w: number, h: number) {
  for (const m of outlineMats.values()) m.uniforms.resolution.value.set(w, h);
}
/** Swap a mesh's geometry and keep its outline child (first child mesh) in sync. */
export function setGeometry(mesh: THREE.Mesh, g: THREE.BufferGeometry) {
  if (mesh.geometry === g) return;
  mesh.geometry = g;
  const child = mesh.children[0] as THREE.Mesh | undefined;
  if (child?.isMesh) child.geometry = g;
}

const taperCache = new Map<string, THREE.LatheGeometry>();
/**
 * Tapered capsule along +y, centred at the origin: the hull of a sphere of radius r0 at the bottom
 * and r1 at the top, `length` apart (quantised to 2 % so it can be cached).
 */
export function taperedCapsuleGeometry(r0: number, r1: number, length: number) {
  const L = Math.max(0.005, Math.round(length * 50) / 50);
  const key = `${r0}:${r1}:${L}`;
  let g = taperCache.get(key);
  if (!g) {
    const phi = Math.asin(Math.max(-0.95, Math.min(0.95, (r0 - r1) / L)));
    const pts: THREE.Vector2[] = [];
    const turn = Math.PI / 2 - phi;
    for (let i = 0; i <= 6; i++) { const th = Math.PI - (i * (Math.PI - turn)) / 6; pts.push(new THREE.Vector2(Math.max(1e-4, r0 * Math.sin(th)), -L / 2 + r0 * Math.cos(th))); }
    for (let i = 0; i <= 6; i++) { const th = turn - (i * turn) / 6; pts.push(new THREE.Vector2(Math.max(1e-4, r1 * Math.sin(th)), L / 2 + r1 * Math.cos(th))); }
    taperCache.set(key, (g = new THREE.LatheGeometry(pts, 16)));
  }
  return g;
}
