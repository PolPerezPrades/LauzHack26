import type { ExitKind } from "../core/types";
import { useT } from "../i18n";

type BarExit = Exclude<ExitKind, "camera_off">;

// Left and right sit on their swipe sides; down and Next in the middle.
const BUTTONS: { exit: BarExit; icon: string }[] = [
  { exit: "too_easy", icon: "←" },
  { exit: "dislike_format", icon: "↓" },
  { exit: "next", icon: "↑" },
  { exit: "too_hard", icon: "→" },
];

/** One visible button per gesture (SPEC §3.3). Next unlocks once the task is completed. */
export function ActionBar({ canNext, disabled, highlight, onExit }: { canNext: boolean; disabled: boolean; highlight: boolean; onExit: (exit: BarExit) => void }) {
  const t = useT();
  return (
    <nav className={`action-bar ${highlight ? "action-bar-highlight" : ""}`} aria-label={t.feed.actionsLabel}>
      {BUTTONS.map((b) => {
        const text = t.feed.actions[b.exit];
        const locked = b.exit === "next" && !canNext;
        return (
          <button
            key={b.exit}
            type="button"
            className={`act act-${b.exit}`}
            disabled={disabled || locked}
            aria-label={text.aria}
            title={locked ? t.feed.actions.next.locked : text.aria}
            onClick={() => onExit(b.exit)}
          >
            <span className="act-icon" aria-hidden="true">{b.icon}</span>
            <span className="act-label">{text.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
