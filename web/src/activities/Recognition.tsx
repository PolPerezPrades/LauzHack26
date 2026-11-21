import { useState } from "react";
import { NON_MANUAL_LABEL, PHRASES, getSign, label } from "../content/curriculum";
import type { Answer, Exercise } from "../lib/engine";
import { SignViewer } from "../viewer/SignViewer";

type Ex = Extract<Exercise, { kind: "recognize" | "phrase" }>;

/** Watch a real sign video (or a phrase = sequence of signs) and pick its meaning. */
export function Recognition({ ex, onAnswer, locked }: { ex: Ex; onAnswer: (a: Answer) => void; locked: boolean }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const isPhrase = ex.kind === "phrase";
  const target = isPhrase ? ex.phraseId : ex.signId;
  const phrase = isPhrase ? PHRASES.get(ex.phraseId) : undefined;
  const sign = !isPhrase ? getSign(ex.signId) : undefined;
  const ids = phrase ? phrase.signs : [ex.kind === "recognize" ? ex.signId : ""];

  const title = phrase ? "¿Qué significa esta frase?" : sign?.kind === "letter" ? "¿Qué letra es?" : sign?.kind === "number" ? "¿Qué número es?" : "¿Qué significa este signo?";

  const choose = (id: string) => {
    if (locked || chosen) return;
    setChosen(id);
    const correct = id === target;
    onAnswer({ correct, items: [{ id: target, correct, confusedWith: correct ? undefined : id }] });
  };

  return (
    <div className="activity">
      <h2 className="prompt">{title}</h2>
      {phrase?.ai && <div className="badge badge-ai">✨ Frase generada por IA · signos reales de WLASL</div>}
      <SignViewer ids={ids} />
      <div className={`options ${sign?.kind === "letter" ? "options-letters" : ""}`}>
        {ex.options.map((id) => {
          const state = !chosen ? "" : id === target ? "opt-correct" : id === chosen ? "opt-wrong" : "opt-dim";
          const s = getSign(id);
          return (
            <button key={id} className={`option ${state}`} onClick={() => choose(id)} disabled={!!chosen || locked}>
              <span className="opt-main">{label(id)}</span>
              {s && s.kind === "word" && <span className="opt-sub">{s.en.toUpperCase()}</span>}
            </button>
          );
        })}
      </div>
      {phrase && chosen && (
        <div className="grammar">
          <div className="grammar-gloss">{phrase.signs.map((x) => getSign(x)?.en.toUpperCase()).join(" · ")}</div>
          <div><b>{NON_MANUAL_LABEL[phrase.nonManual] ?? phrase.nonManual}</b></div>
          <div>{phrase.note}</div>
        </div>
      )}
    </div>
  );
}

/** "New sign" card shown before a sign is first tested. */
export function Intro({ signId, onDone }: { signId: string; onDone: () => void }) {
  const s = getSign(signId)!;
  return (
    <div className="activity">
      <div className="badge">Nuevo signo</div>
      <h2 className="prompt intro-word">{s.kind === "letter" ? `Letra ${s.en}` : s.es}</h2>
      {s.kind !== "letter" && <div className="intro-gloss">ASL: {s.en.toUpperCase()}</div>}
      <SignViewer ids={[signId]} />
      <p className="hint">Míralo un par de veces e imítalo con tu mano dominante.</p>
      <button className="btn btn-primary btn-wide" onClick={onDone}>Entendido</button>
    </div>
  );
}
