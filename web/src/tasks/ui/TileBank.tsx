/**
 * A Duolingo-style word bank (quiz-build; reused by game-dialogue in Part E): an answer row and a
 * bank of tiles. Tapping a bank tile appends it to the answer; tapping a placed tile takes it back.
 * Controlled: the parent owns the answer and decides when to check it. Placed tiles leave a
 * placeholder in the bank, so nothing jumps around while building; once the answer is marked, the
 * bank goes away to leave room for the feedback.
 */
import "./ui.css";

export interface Tile {
  /** unique within the bank (the same sign twice gets two keys) */
  key: string;
  label: string;
  sub?: string | null;
}

interface Props {
  tiles: readonly Tile[];
  /** keys of the placed tiles, in answer order */
  answer: readonly string[];
  /** shown in the empty answer row */
  emptyText: string;
  disabled?: boolean;
  /** after checking: right or wrong per answer slot */
  marks?: readonly ("ok" | "bad")[];
  onPlace(key: string): void;
  onRemove(index: number): void;
  label?: string;
}

export function TileBank({ tiles, answer, emptyText, disabled = false, marks, onPlace, onRemove, label }: Props) {
  const byKey = new Map(tiles.map((t) => [t.key, t]));
  const placed = new Set(answer);
  return (
    <div className="tb">
      <div className="tb-answer" aria-label={label} aria-live="polite">
        {answer.length === 0 && <span className="tb-empty">{emptyText}</span>}
        {answer.map((key, i) => {
          const tile = byKey.get(key);
          if (!tile) return null;
          const mark = marks?.[i];
          return (
            <button key={key} type="button" className={`tb-tile tb-placed ${mark ? `tb-${mark}` : ""}`} disabled={disabled} onClick={() => onRemove(i)}>
              <span className="tb-main">{tile.label}</span>
              {tile.sub && <span className="tb-sub">{tile.sub}</span>}
            </button>
          );
        })}
      </div>
      {!marks && <div className="tb-bank">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            className={`tb-tile ${placed.has(tile.key) ? "tb-ghost" : ""}`}
            disabled={disabled || placed.has(tile.key)}
            aria-hidden={placed.has(tile.key) || undefined}
            tabIndex={placed.has(tile.key) ? -1 : undefined}
            onClick={() => onPlace(tile.key)}
          >
            <span className="tb-main">{tile.label}</span>
            {tile.sub && <span className="tb-sub">{tile.sub}</span>}
          </button>
        ))}
      </div>}
    </div>
  );
}
