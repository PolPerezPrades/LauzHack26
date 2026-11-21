import { useRef, useState } from "react";
import { label } from "../content/curriculum";
import { shuffle, type Answer } from "../lib/engine";
import { SignViewer } from "../viewer/SignViewer";

interface Card { key: string; id: string; face: "sign" | "word" }

/** Memory: flip two cards, find each sign's meaning. Spaced recall + visual discrimination. */
export function Memory({ items, onAnswer, locked }: { items: string[]; onAnswer: (a: Answer) => void; locked: boolean }) {
  const [cards] = useState<Card[]>(() => shuffle(items.flatMap((id) => [{ key: `${id}-s`, id, face: "sign" as const }, { key: `${id}-w`, id, face: "word" as const }])));
  const [open, setOpen] = useState<string[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const misses = useRef<Record<string, number>>({});
  const t0 = useRef(performance.now());

  const flip = (c: Card) => {
    if (locked || open.length === 2 || open.includes(c.key) || found.includes(c.id)) return;
    const next = [...open, c.key];
    setOpen(next);
    if (next.length < 2) return;
    setMoves((m) => m + 1);
    const [a, b] = next.map((k) => cards.find((x) => x.key === k)!);
    if (a.id === b.id) {
      const f = [...found, a.id];
      setTimeout(() => {
        setFound(f);
        setOpen([]);
        if (f.length === items.length) {
          const res = items.map((id) => ({ id, correct: (misses.current[id] ?? 0) <= 1, ms: Math.round((performance.now() - t0.current) / items.length) }));
          const good = res.filter((r) => r.correct).length;
          onAnswer({ correct: good >= items.length - 1, items: res, xp: good * 3 + 4 });
        }
      }, 500);
    } else {
      for (const x of [a, b]) misses.current[x.id] = (misses.current[x.id] ?? 0) + 1;
      setTimeout(() => setOpen([]), 1200);
    }
  };

  return (
    <div className="activity">
      <h2 className="prompt">🃏 Memory: encuentra cada signo y su significado</h2>
      <div className="muted small">Movimientos: {moves}</div>
      <div className="memory-grid">
        {cards.map((c) => {
          const shown = open.includes(c.key) || found.includes(c.id);
          return (
            <button key={c.key} className={`memory-card ${shown ? "memory-open" : ""} ${found.includes(c.id) ? "memory-found" : ""}`} onClick={() => flip(c)} disabled={locked}>
              {!shown ? <span className="memory-back">🤟</span> : c.face === "sign"
                ? <SignViewer ids={[c.id]} size="sm" controls={false} credit={false} />
                : <span className="memory-word">{label(c.id)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
