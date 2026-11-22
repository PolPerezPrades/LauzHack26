import type { ExitKind } from "../core/types";
import { useT } from "../i18n";

export type BarExit = Exclude<ExitKind, "next" | "camera_off">;

// Left and right sit on their swipe sides, down in the middle. Next has no button since Part A2:
// every result leaves on its own, and a swipe up, ↑, Enter or Space skips the wait.
const BUTTONS: { exit: BarExit; icon: string }[] = [
  { exit: "too_easy", icon: "←" },
  { exit: "dislike_format", icon: "↓" },
  { exit: "too_hard", icon: "→" },
];

/** One visible button per swipe (SPEC §3.3), before and after the task is completed. */
export function ActionBar({ disabled, highlight, onExit }: { disabled: boolean; highlight: boolean; onExit: (exit: BarExit) => void }) {
  const t = useT();
  return (
    <nav className={`action-bar ${highlight ? "action-bar-highlight" : ""}`} aria-label={t.feed.actionsLabel}>
      {BUTTONS.map((b) => {
        const text = t.feed.actions[b.exit];
        return (
          <button key={b.exit} type="button" className={`act act-${b.exit}`} disabled={disabled} aria-label={text.aria} title={text.aria} onClick={() => onExit(b.exit)}>
            <span className="act-icon" aria-hidden="true">{b.icon}</span>
            <span className="act-label">{text.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
