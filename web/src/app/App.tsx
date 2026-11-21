/**
 * App shell: routing between the learner's feed (default), the sign lab (#lab), developer mode
 * (#dev) and the dev forced-mode feed (#dev/play). There is no home screen: the feed opens on a task.
 */
import { useMemo } from "react";
import { REAL_DB, SANDBOX_DB } from "../data/dexieRepository";
import { DevScreen } from "../dev/DevScreen";
import { loadDevConfig } from "../dev/devConfig";
import { createForcedSource } from "../dev/forcedSource";
import { formatTitle } from "../feed/CardParts";
import { FeedScreen } from "../feed/FeedScreen";
import { createSimplePicker } from "../feed/simplePicker";
import { useT } from "../i18n";
import { Lab } from "../screens/Lab";
import { getFormat } from "../tasks/registry";
import { go, useRoute } from "./routes";
import { SESSION_ID } from "./session";
import { useFeedLog } from "./useLog";

export function App() {
  switch (useRoute()) {
    case "lab":
      return <Lab onExit={() => go("")} />;
    case "dev":
      return <DevScreen />;
    case "dev-play":
      return <ForcedFeed />;
    default:
      return <LearnerFeed />;
  }
}

function Loading() {
  const t = useT();
  return <div className="app-loading">{t.app.loading}</div>;
}

/** The real feed: the learner's own log, cards from the simple picker (the recommender from Part D). */
function LearnerFeed() {
  const log = useFeedLog(REAL_DB);
  const source = useMemo(() => createSimplePicker(), []);
  if (!log) return <Loading />;
  return <FeedScreen log={log} source={source} sessionId={SESSION_ID} />;
}

/** Dev forced mode: the chosen format again and again, played into the sandbox log. */
function ForcedFeed() {
  const t = useT();
  const log = useFeedLog(SANDBOX_DB);
  const config = useMemo(() => loadDevConfig(), []);
  const source = useMemo(() => createForcedSource(config), [config]);
  if (!log) return <Loading />;
  return <FeedScreen log={log} source={source} sessionId={SESSION_ID} forcedLabel={formatTitle(getFormat(config.format), config.format, t)} onBackToDev={() => go("#dev")} />;
}
