/** One-time migration of the v1 progress (localStorage "signa:v1") into the event log. */
import { makeEvent, type LegacyProgress } from "./events";
import type { LearningRepository } from "./repository";

const LEGACY_KEY = "signa:v1";

export async function migrateLegacy(repo: LearningRepository): Promise<boolean> {
  if (await repo.getMeta<boolean>("legacyMigrated")) return false;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LEGACY_KEY);
  } catch {
    /* storage blocked */
  }
  await repo.setMeta("legacyMigrated", true);
  if (!raw) return false;
  try {
    const old = JSON.parse(raw);
    const p = old.progress ?? {};
    const data: LegacyProgress = {
      profile: old.profile ?? null,
      xp: p.xp ?? 0, streak: p.streak ?? 0, bestStreak: p.bestStreak ?? 0, lastActiveDay: p.lastActiveDay ?? null,
      sessions: p.sessions ?? 0, sprintBest: p.sprintBest ?? 0, items: p.items ?? {},
    };
    if ((await repo.all()).length === 0) await repo.append(makeEvent({ type: "legacy.import", data }));
    return true;
  } catch {
    return false;
  }
}
