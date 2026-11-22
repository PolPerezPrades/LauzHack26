/**
 * The common frame of a learning task inside a card: a badge and the task's own progress (for
 * multi-step cards, SPEC §3.2: it lives here, not in the feed header), the prompt, the task body
 * (which takes the free height, so cards never scroll) and a footer for the task's buttons.
 */
import type { ReactNode } from "react";
import { useT } from "../../i18n";
import "./ui.css";

export interface TaskProgressValue {
  /** 1-based step being done now */
  step: number;
  of: number;
}

interface Props {
  className?: string;
  badge?: ReactNode;
  /** "review" tints the badge (relearn lessons) */
  badgeTone?: "new" | "review" | "check";
  progress?: TaskProgressValue;
  prompt: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

export function TaskFrame({ className = "", badge, badgeTone = "new", progress, prompt, sub, children, footer }: Props) {
  return (
    <div className={`task tf ${className}`}>
      {(badge || (progress && progress.of > 1)) && (
        <div className="tf-top">
          {badge && <span className={`tf-badge tf-badge-${badgeTone}`}>{badge}</span>}
          {progress && progress.of > 1 && <TaskProgress {...progress} />}
        </div>
      )}
      <h2 className="task-prompt">{prompt}</h2>
      {sub && <p className="tf-sub">{sub}</p>}
      <div className="tf-body">{children}</div>
      {footer && <div className="tf-footer">{footer}</div>}
    </div>
  );
}

export function TaskProgress({ step, of }: TaskProgressValue) {
  const t = useT();
  return (
    <span className="tf-progress">
      <span className="sr-only">{t.learning.progress(step, of)}</span>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} aria-hidden="true" className={i < step ? "on" : ""} />
      ))}
    </span>
  );
}
