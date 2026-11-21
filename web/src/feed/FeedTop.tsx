import { useT } from "../i18n";
import { LangSwitch } from "../i18n/LangSwitch";

/** Feed overlay outside the cards (SPEC §3.2): streak and XP, the language switch, the mute toggle, and in dev forced mode a way back. */
export function FeedTop({ streak, xp, muted, onToggleMute, forcedLabel, onBackToDev }: {
  streak: number;
  xp: number;
  muted: boolean;
  onToggleMute: () => void;
  forcedLabel?: string;
  onBackToDev?: () => void;
}) {
  const t = useT();
  return (
    <header className="feed-top">
      <div className="feed-stats" role="status" aria-label={t.feed.statsLabel(streak, xp)}>
        <span aria-hidden="true">🔥 {streak}</span>
        <span aria-hidden="true">⭐ {xp}</span>
      </div>
      {forcedLabel && (
        <button type="button" className="feed-forced" onClick={onBackToDev} title={t.feed.backToDev}>
          ⚙ {t.feed.forced(forcedLabel)}
        </button>
      )}
      <LangSwitch className="feed-lang" />
      <button type="button" className="feed-icon-btn" onClick={onToggleMute} aria-label={muted ? t.feed.unmute : t.feed.mute} title={muted ? t.feed.unmute : t.feed.mute}>
        <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
      </button>
    </header>
  );
}
