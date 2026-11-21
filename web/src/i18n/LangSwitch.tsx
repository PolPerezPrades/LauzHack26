import { LANGS, setLang, useLang, useT } from "./index";
import "./langSwitch.css";

/**
 * Language switch: one button per language (EN | ES), the current one pressed. Two buttons rather
 * than a menu: one tap, no ambiguity about whether a label means "current" or "switch to".
 */
export function LangSwitch({ className = "" }: { className?: string }) {
  const lang = useLang();
  const t = useT();
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label={t.lang.label}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          className={l === lang ? "on" : ""}
          aria-pressed={l === lang}
          aria-label={t.lang.names[l]}
          title={t.lang.names[l]}
          onClick={() => setLang(l)}
        >
          {t.lang.short[l]}
        </button>
      ))}
    </div>
  );
}
