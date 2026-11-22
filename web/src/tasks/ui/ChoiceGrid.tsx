/**
 * A grid of answer options (quiz-choice; reusable by choice games). Taps only. Once an option is
 * chosen, the right one turns green, the chosen wrong one red, and the rest dim.
 */
import "./ui.css";

export interface ChoiceOption {
  id: string;
  main: string;
  /** a second line (the ASL gloss of a word), when it adds something */
  sub?: string | null;
}

interface Props {
  options: readonly ChoiceOption[];
  correct: string;
  chosen: string | null;
  disabled?: boolean;
  /** letters sit in one row of big glyphs; phrases get smaller text */
  layout?: "letters" | "phrase" | "default";
  onChoose(id: string): void;
}

export function ChoiceGrid({ options, correct, chosen, disabled = false, layout = "default", onChoose }: Props) {
  const layoutClass = layout === "letters" ? "choices-letters" : layout === "phrase" ? "choices-phrase" : "";
  return (
    <div className={`choices choices-n${options.length} ${layoutClass}`}>
      {options.map((o) => {
        const state = !chosen ? "" : o.id === correct ? "opt-correct" : o.id === chosen ? "opt-wrong" : "opt-dim";
        return (
          <button key={o.id} type="button" className={`option ${state}`} disabled={!!chosen || disabled} onClick={() => onChoose(o.id)}>
            <span className="opt-main">{o.main}</span>
            {o.sub && <span className="opt-sub">{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}
