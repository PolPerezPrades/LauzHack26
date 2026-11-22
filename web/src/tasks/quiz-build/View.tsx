import { useEffect, useRef, useState } from "react";
import { PHRASES, itemLabel } from "../../content/curriculum";
import { createRng, seedFrom } from "../../core/rng";
import type { TaskViewProps } from "../../core/types";
import { useLang, useT } from "../../i18n";
import { SignViewer } from "../../viewer/SignViewer";
import { glossHint } from "../ui/labels";
import { TaskFrame } from "../ui/TaskFrame";
import { TileBank } from "../ui/TileBank";
import { quizBuildResult } from "./result";
import type { QuizBuildParams } from "./spec";
import { buildTiles, checkBuild } from "./tiles";

export function QuizBuildView({ plan, active, report }: TaskViewProps<QuizBuildParams>) {
  const t = useT();
  const lang = useLang();
  const phraseId = plan.items[0];
  const phrase = PHRASES.get(phraseId);
  const [tiles] = useState(() => plan.params.tiles ?? buildTiles(phraseId, plan.params.distractors ?? 3, createRng(seedFrom(plan.cardId))));
  // a tile's key is its position in the bank, so the same sign twice stays two tiles
  const [answer, setAnswer] = useState<string[]>([]);
  const [marks, setMarks] = useState<("ok" | "bad")[] | undefined>(undefined);
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    if (active && startedAt.current === null) startedAt.current = performance.now();
  }, [active]);
  if (!phrase) return null;

  const built = () => answer.map((key) => tiles[Number(key)]);
  const check = () => {
    if (marks || !active || answer.length === 0) return;
    setMarks(checkBuild(phrase.signs, built()).marks);
    const ms = startedAt.current !== null ? Math.round(performance.now() - startedAt.current) : undefined;
    report(quizBuildResult(phraseId, built(), t, lang, ms));
  };

  return (
    <TaskFrame
      className="quiz-build"
      prompt={t.learning.build.prompt}
      footer={marks ? undefined : <button type="button" className="btn btn-primary" disabled={!active || answer.length === 0} onClick={check}>{t.learning.build.check}</button>}
    >
      <div className="task-media">
        <SignViewer ids={phrase.signs} orbit={false} />
      </div>
      <TileBank
        tiles={tiles.map((id, i) => ({ key: String(i), label: itemLabel(id, lang), sub: glossHint(id, lang) }))}
        answer={answer}
        emptyText={t.learning.build.empty}
        disabled={!active || !!marks}
        marks={marks}
        label={t.learning.build.prompt}
        onPlace={(key) => setAnswer((a) => [...a, key])}
        onRemove={(i) => setAnswer((a) => a.filter((_, j) => j !== i))}
      />
    </TaskFrame>
  );
}
