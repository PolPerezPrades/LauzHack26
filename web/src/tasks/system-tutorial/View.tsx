import { useT } from "../../i18n";

/** The tutorial only informs: it never reports a result (the feed lets any exit dismiss it). */
export function TutorialView() {
  const t = useT();
  return (
    <div className="task tutorial">
      <h2 className="task-prompt">{t.tutorial.title}</h2>
      <p className="tutorial-intro">{t.tutorial.intro}</p>
      <ul className="tutorial-rows">
        {t.tutorial.rows.map((r) => (
          <li key={r.exit} className={`tutorial-row tutorial-${r.exit}`}>
            <span className="tutorial-icon" aria-hidden="true">{r.icon}</span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
      <p className="tutorial-note">{t.tutorial.buttons}</p>
      <p className="tutorial-try">{t.tutorial.tryIt}</p>
    </div>
  );
}
