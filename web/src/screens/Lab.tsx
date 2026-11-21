/**
 * Sign lab (#lab): side-by-side verification of every sign rendering.
 *   letters: 3D hand | the REAL signer's hand (MediaPipe landmarks drawn with the same mesh) | real clip
 *   words:   avatar (motion from the clip) | real clip
 * Meant for reviewing the content with a fluent signer before marking it "verified".
 */
import { Canvas } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { SIGN_SPECS } from "../content/signs";
import { useLang, useT } from "../i18n";
import { LangSwitch } from "../i18n/LangSwitch";
import refPoses from "../../content/reference/letter-poses.json";
import { OutlineSync } from "../viewer/OutlineSync";
import { CameraRig } from "../viewer/CameraRig";
import { HandMesh } from "../viewer/HandMesh";
import type { V3 } from "../viewer/kinematics";
import { SignViewer } from "../viewer/SignViewer";

const REF = refPoses as Record<string, { world: number[]; video: string }>;

function RealHand({ letter }: { letter: string }) {
  const t = useT();
  const joints = useMemo(() => {
    const w = REF[letter]?.world;
    if (!w) return null;
    const pts: V3[] = Array.from({ length: 21 }, (_, i) => [w[i * 3], -w[i * 3 + 1], -w[i * 3 + 2]]);
    const palm = Math.hypot(...pts[9].map((v, k) => v - pts[0][k])) || 1;
    return pts.map((p) => p.map((v, k) => (v - pts[0][k]) / palm) as V3);
  }, [letter]);
  const ref = useRef<V3[] | null>(joints);
  ref.current = joints;
  if (!joints) return <div className="sv-loading">{t.lab.noRealRef}</div>;
  return (
    <Canvas flat camera={{ fov: 30 }}>
      <ambientLight intensity={1.1} />
      <directionalLight position={[2, 3, 4]} intensity={2.2} />
            <OutlineSync />
      <CameraRig points={joints} resetKey={0} interactive />
      <HandMesh joints={ref} side="right" />
    </Canvas>
  );
}

export function Lab({ onExit }: { onExit: () => void }) {
  const t = useT();
  const lang = useLang();
  const letters = [...SIGN_SPECS.values()].filter((s) => s.type === "letter").sort((a, b) => a.gloss.localeCompare(b.gloss));
  const words = [...SIGN_SPECS.values()].filter((s) => s.type !== "letter").sort((a, b) => a.id.localeCompare(b.id));
  const [sel, setSel] = useState(letters[0]?.id ?? "");
  const spec = SIGN_SPECS.get(sel)!;
  const isLetter = spec.type === "letter";

  return (
    <div className="screen lab">
      <div className="row-between">
        <h2>🔬 {t.lab.title}</h2>
        <div className="head-actions">
          <LangSwitch />
          <button className="btn btn-ghost" onClick={onExit}>{t.lab.back}</button>
        </div>
      </div>
      <div className="lab-picker">
        {letters.map((s) => <button key={s.id} data-id={s.id} className={`chip ${sel === s.id ? "chip-on" : ""}`} onClick={() => setSel(s.id)}>{s.gloss}</button>)}
      </div>
      <div className="lab-picker">
        {words.map((s) => (
          <button key={s.id} data-id={s.id} className={`chip ${sel === s.id ? "chip-on" : ""}`} onClick={() => setSel(s.id)}>
            {s.render.type === "avatar" ? "🧍" : "🎥"} {s.translations[lang]}
          </button>
        ))}
      </div>
      <div className="card lab-meta">
        <b>{spec.gloss}</b> · {spec.translations[lang]} · {t.lab.render}: {spec.render.type} · {t.lab.review}: {spec.review.status}
        {/* descriptions and curator notes are authored in Spanish; an English description is optional */}
        {spec.description && <div className="muted" lang={spec.description[lang] ? lang : "es"}>{spec.description[lang] ?? spec.description.es}</div>}
        {spec.phonology && <div className="muted small">{t.lab.handshape} {spec.phonology.handshape} · {t.lab.palm} {spec.phonology.orientation.palm} · {t.lab.fingers} {spec.phonology.orientation.fingers}{spec.phonology.movement ? ` · ${t.lab.movement} ${spec.phonology.movement.shape}` : ""}</div>}
        {spec.review.note && <div className="muted small" lang="es">{spec.review.note}</div>}
      </div>
      <div className="lab-grid">
        <div>
          <h3>{isLetter ? t.lab.hand3d : spec.render.type === "avatar" ? t.lab.avatar : t.lab.video}</h3>
          <SignViewer key={sel} ids={[sel]} size="md" />
        </div>
        {isLetter && (
          <div>
            <h3>{t.lab.realHand}</h3>
            <div className="sv sv-md"><div className="sv-stage sv-stage-hand"><RealHand letter={spec.gloss} /></div></div>
          </div>
        )}
        <div>
          <h3>{t.lab.reference}</h3>
          {spec.video ? <SignViewer key={`v-${sel}`} ids={[sel]} size="md" preferVideo credit /> : null}
          {spec.references.filter((r) => r.image).map((r) => <img key={r.url} className="lab-ill" src={r.image} alt={t.lab.illustration} />)}
          <ul className="small">{spec.references.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer">{r.label}</a></li>)}</ul>
        </div>
      </div>
    </div>
  );
}
