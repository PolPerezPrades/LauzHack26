import { useState } from "react";
import { useCameraState } from "../../camera";
import { isUsable } from "../../camera/cameraSession";
import { checkModeFor } from "../../camera/checkMode";
import type { TaskViewProps } from "../../core/types";
import { useLang, useT } from "../../i18n";
import { SignViewer } from "../../viewer/SignViewer";
import { issueText } from "../ui/handHints";
import { glossHint, itemName, signDescription } from "../ui/labels";
import { ProductiveTry, type TryOutcome } from "../ui/ProductiveTry";
import { TaskFrame } from "../ui/TaskFrame";
import { lessonResult } from "./result";
import type { LessonParams } from "./spec";

/** Watch → try → result (SPEC §4.3). The camera opens only in the try step, never while watching. */
export function LessonView({ plan, active, camera, report }: TaskViewProps<LessonParams>) {
  const t = useT();
  const lang = useLang();
  const item = plan.items[0];
  const relearn = plan.params.variant === "relearn";
  // camera-optional: with the camera off (or denied mid-try) the try switches to self-grading
  const mode = checkModeFor(item, "productive", isUsable(useCameraState()));
  const [phase, setPhase] = useState<"watch" | "try" | "done">("watch");

  const name = itemName(item, t, lang);
  const gloss = glossHint(item, lang);
  const desc = signDescription(item, lang);
  const frame = {
    className: "lesson",
    badge: relearn ? t.learning.lesson.badgeRelearn : t.learning.lesson.badgeNew,
    badgeTone: relearn ? "review" : "new",
  } as const;

  const finish = (o: TryOutcome) => {
    if (phase === "done") return;
    setPhase("done");
    const note = o.correct ? undefined
      : o.confusedWith ? t.learning.camera.looksLike(o.confusedWith.replace(/^L-/, ""))
      : o.issue ? issueText(o.issue, t)
      : undefined;
    report(lessonResult(item, { ...o, ...(note ? { note } : {}) }, t, lang));
  };

  if (phase === "watch") {
    return (
      <TaskFrame
        {...frame}
        progress={{ step: 1, of: 2 }}
        prompt={name}
        sub={gloss ?? t.learning.lesson.watch}
        footer={<button type="button" className="btn btn-primary" disabled={!active} onClick={() => setPhase("try")}>{t.learning.lesson.nowYou}</button>}
      >
        <div className="task-media"><SignViewer ids={[item]} orbit={false} /></div>
        {desc && <p className="desc" lang={desc.lang}><b>{t.learning.description}:</b> {desc.text}</p>}
      </TaskFrame>
    );
  }

  return (
    <TaskFrame {...frame} progress={{ step: 2, of: 2 }} prompt={`${t.learning.lesson.nowYou}: ${name}`}>
      {phase === "try" ? (
        <ProductiveTry style="lesson" mode={mode} session={camera} active={active} item={item} reference={[item]} onDone={finish} />
      ) : (
        <div className="task-media"><SignViewer ids={[item]} orbit={false} /></div>
      )}
    </TaskFrame>
  );
}
