/** Pieces of a card: header, lightweight preview, feedback panel, and a guard against task crashes. */
import { Component, useState, type ReactNode } from "react";
import { itemLabel } from "../content/curriculum";
import { seedFrom } from "../core/rng";
import type { CardPlan, TaskResult, TaskSpec } from "../core/types";
import { useLang, useT, type Messages } from "../i18n";
import type { CountdownView } from "./autoAdvance";
import { wrongChoice } from "./feedback";

export const formatTitle = (spec: TaskSpec | undefined, fallback: string, t: Messages) => (spec && t.formats[spec.i18nKey]?.title) || fallback;

/** Format chip (and, on camera tasks, the "can't use the camera now" button). */
export function CardHeader({ plan, spec, onCameraOff }: { plan: CardPlan; spec?: TaskSpec; onCameraOff?: () => void }) {
  const t = useT();
  return (
    <div className="feed-card-head">
      <span className="fmt-chip">
        <span aria-hidden="true">{spec?.icon ?? "❔"}</span>
        {formatTitle(spec, plan.format, t)}
      </span>
      {onCameraOff && (
        <button type="button" className="cam-off" onClick={onCameraOff}>
          <span aria-hidden="true">🚫</span> {t.camera.offButton}
        </button>
      )}
    </div>
  );
}

/**
 * What the card behind shows: the header and the prompt text. No camera, timers, video or WebGL;
 * the full task mounts only when the card becomes current (D-010).
 */
export function CardPreview({ plan, spec }: { plan: CardPlan; spec?: TaskSpec }) {
  const t = useT();
  return (
    <>
      <CardHeader plan={plan} spec={spec} />
      <div className="feed-card-body feed-card-preview">
        <p className="task-prompt">{spec?.preview(plan, t) ?? ""}</p>
        <div className="preview-art" aria-hidden="true">{spec?.icon}</div>
      </div>
    </>
  );
}

/**
 * Result banner inside the card (SPEC §3.4): correct or not; after a mistake, what the learner chose
 * instead and the correct answer; the note; XP; and the countdown bar until the card leaves on its
 * own. The bar stops while the countdown is held, and starts full again when the countdown restarts.
 */
export function FeedbackPanel({ cardId, result, countdown }: { cardId: string; result: TaskResult; countdown: CountdownView | null }) {
  const t = useT();
  const lang = useLang();
  // like the task's own answer and note, it keeps the language it was first shown in (D-040)
  const [chose] = useState(() => {
    const id = wrongChoice(result);
    return id === undefined ? undefined : itemLabel(id, lang);
  });
  const f = result.feedback;
  if (!f) return null;
  const praise = t.feed.praise[seedFrom(cardId) % t.feed.praise.length];
  return (
    <div className={`feedback ${f.correct ? "feedback-ok" : "feedback-bad"}`}>
      <div className="feedback-title">{f.correct ? praise : t.feed.incorrect}</div>
      {!f.correct && chose && <div className="feedback-chose">{t.feed.chose(chose)}</div>}
      {f.correct
        ? result.xp > 0 && <div className="feedback-sub">{t.feed.xp(result.xp)}</div>
        : f.answer && <div className="feedback-sub">{t.feed.answer(f.answer)}</div>}
      {f.note && <div className="feedback-note">{f.note}</div>}
      {!f.correct && <div className="feedback-hint">{t.feed.holdToRead}</div>}
      {countdown && (
        <div key={countdown.run} className={`feedback-timer${countdown.held ? " is-held" : ""}`} style={{ animationDuration: `${countdown.ms}ms` }} />
      )}
    </div>
  );
}

export function TaskFailed() {
  const t = useT();
  return <p className="task-error">{t.feed.taskError}</p>;
}

/** A crashing task must not take the feed down: the card stays and can still be swiped away. */
export class TaskErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[feed] task crashed", error);
  }
  render() {
    return this.state.failed ? <TaskFailed /> : this.props.children;
  }
}
