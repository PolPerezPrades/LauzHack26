import { useMemo, useRef, useState } from "react";
import { SIGNS, getSign, letterId } from "../content/curriculum";
import { DIALOGUES, scriptedDialogue, type Expectation } from "../content/scenarios";
import { shuffle, type Answer } from "../lib/engine";
import { SignViewer } from "../viewer/SignViewer";

interface Turn { who: "partner" | "me"; signs: string[]; es?: string; narration?: string }

/**
 * Guided conversation (productive): the partner signs a question; the learner answers by building
 * the reply sign by sign IN ASL ORDER, sees it played back to imitate it, and sends it. Replies are
 * checked against a scripted dialogue tree (scriptedDialogue) — the seam where an LLM partner will
 * plug in for phase 3. Used for the story mode too (dialogue with narration and a setting).
 */
export function Conversation({ dialogueId, onAnswer, locked }: { dialogueId: string; onAnswer: (a: Answer) => void; locked: boolean }) {
  const d = DIALOGUES.get(dialogueId)!;
  const [nodeId, setNodeId] = useState(d.start);
  const [reply, setReply] = useState<string[]>([]);
  const [history, setHistory] = useState<Turn[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [nameStep, setNameStep] = useState<{ next: string } | null>(null);
  const [name, setName] = useState("");
  const [spelled, setSpelled] = useState<string[] | null>(null);
  const results = useRef<Answer["items"]>([]);
  const t0 = useRef(performance.now());
  const node = d.nodes[nodeId];

  // sign bank: every sign that would be a valid reply here + a few distractors
  const bank = useMemo(() => {
    const valid = [...new Set((node.expect ?? []).flatMap((e) => e.signs))];
    const pool = [...SIGNS.values()].filter((s) => s.kind === "word" && !valid.includes(s.id)).map((s) => s.id);
    return shuffle([...valid, ...shuffle(pool).slice(0, Math.max(3, 8 - valid.length))]);
  }, [nodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = (exp: Expectation, ok: boolean) => {
    const ms = Math.round(performance.now() - t0.current);
    for (const id of exp.signs) results.current.push({ id, correct: ok, modality: "productive", ms: Math.round(ms / exp.signs.length) });
    setHistory((h) => [...h, { who: "partner", signs: node.partner, es: node.es, narration: node.narration }, { who: "me", signs: exp.signs }]);
    setReply([]); setFeedback(null); setTries(0); t0.current = performance.now();
    if (exp.fingerspellName) setNameStep({ next: exp.next });
    else go(exp.next);
  };
  const go = (next: string) => {
    setNodeId(next);
    if (d.nodes[next]?.end) {
      const n = results.current.length;
      const good = results.current.filter((r) => r.correct).length;
      setTimeout(() => onAnswer({ correct: good >= n * 0.7, items: results.current, xp: good * 3 + 10 }), 1800);
    }
  };

  const send = () => {
    if (locked || !reply.length) return;
    const r = scriptedDialogue.evaluate(dialogueId, nodeId, reply);
    if (r.accepted && r.expectation) return advance(r.expectation, tries === 0);
    setTries(tries + 1);
    if (tries + 1 >= 2) {
      // after two attempts, show a correct reply and move on (counts as not yet mastered)
      const model = node.expect![0];
      setFeedback(`Una respuesta posible: ${model.signs.map((id) => getSign(id)?.en.toUpperCase()).join(" ")}`);
      setTimeout(() => advance(model, false), 2600);
    } else setFeedback(r.feedback ?? "Prueba otra respuesta.");
  };

  const ended = !!node.end;
  return (
    <div className={`activity convo ${d.story ? "convo-story" : ""}`}>
      <div className="badge">{d.story ? "📚 Modo historia" : "💬 Conversación"} · {d.title}</div>
      <div className="convo-setting">{d.setting}</div>
      <div className="convo-log">
        {history.slice(-4).map((t, k) => (
          <div key={k} className={`bubble bubble-${t.who}`}>
            {t.who === "partner" ? `${d.partner.emoji} ` : "🙋 "}{t.signs.map((id) => getSign(id)?.en.toUpperCase()).join(" ")}{t.es ? <span className="muted"> · {t.es}</span> : null}
          </div>
        ))}
      </div>

      {node.narration && <div className="narration">{node.narration}</div>}
      {node.partner.length > 0 && (
        <div className="partner">
          <div className="partner-name">{d.partner.emoji} {d.partner.name} signa:</div>
          <SignViewer key={nodeId} ids={node.partner} size="md" credit={false} />
          {node.es && <div className="muted small center">{node.es}</div>}
        </div>
      )}

      {ended ? (
        <div className="card center"><b>¡Conversación completada!</b></div>
      ) : nameStep ? (
        <div className="card">
          <b>Ahora deletrea tu nombre.</b> Escríbelo y la mano te lo deletrea: imítala.
          <form className="spell-form" onSubmit={(e) => { e.preventDefault(); const ids = name.toUpperCase().replace(/[^A-Z]/g, "").split("").map(letterId).filter((id) => SIGNS.has(id)); if (ids.length) setSpelled(ids); }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" maxLength={12} />
            <button className="btn btn-secondary">Deletrear</button>
          </form>
          {spelled && <SignViewer key={spelled.join()} ids={spelled} size="md" credit={false} letterHoldMs={900} />}
          <button className="btn btn-primary btn-wide" disabled={!spelled} onClick={() => { const n = nameStep.next; setNameStep(null); setSpelled(null); go(n); }}>Ya lo he signado</button>
        </div>
      ) : (
        <>
          <div className="reply">
            <div className="reply-label">Tu respuesta (orden ASL):</div>
            <div className="reply-slots">
              {reply.length ? reply.map((id, k) => (
                <button key={k} className="tile-sign tile-sign-on" onClick={() => setReply(reply.filter((_, j) => j !== k))}>{getSign(id)?.en.toUpperCase()}</button>
              )) : <span className="muted small">Toca los signos de abajo para construirla</span>}
            </div>
            {reply.length > 0 && (
              <details className="small"><summary>Ver cómo se signa tu respuesta</summary>
                <SignViewer key={reply.join()} ids={reply} size="md" credit={false} />
              </details>
            )}
          </div>
          <div className="bank">
            {bank.map((id) => (
              <button key={id} className="tile-sign" onClick={() => setReply([...reply, id])} disabled={locked}>
                <b>{getSign(id)?.en.toUpperCase()}</b><span className="muted small">{getSign(id)?.es}</span>
              </button>
            ))}
          </div>
          {feedback && <div className="convo-feedback">💡 {feedback}</div>}
          <div className="row-between">
            <button className="link" onClick={() => setFeedback(node.hint ?? null)}>Pista</button>
            <button className="btn btn-primary" disabled={!reply.length || locked} onClick={send}>Signar respuesta</button>
          </div>
        </>
      )}
    </div>
  );
}
