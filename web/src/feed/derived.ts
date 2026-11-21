/**
 * Small pure views of the log for the feed: card history (for card sources), XP and streak (the
 * overlay chip) and the sound preference. Interim: Part C's learner state replaces XP and streak.
 */
import type { CardPlan, CardRef } from "../core/types";
import type { LearningEvent } from "../data/events";

/** Cards shown in the log (with their exit, once they left), plus the feed's queue marked as planned. */
export function cardHistory(events: readonly LearningEvent[], queued: readonly (CardPlan | null | undefined)[] = []): CardRef[] {
  const byId = new Map<string, CardRef>();
  const order: CardRef[] = [];
  for (const e of events) {
    if (e.type === "card.shown") {
      const ref: CardRef = { cardId: e.cardId, format: e.format, items: e.items };
      byId.set(e.cardId, ref);
      order.push(ref);
    } else if (e.type === "card.exit") {
      const ref = byId.get(e.cardId);
      if (ref) ref.exit = e.exit;
    }
  }
  for (const plan of queued) {
    if (!plan) continue;
    const ref = byId.get(plan.cardId);
    if (ref) ref.planned = true;
    else order.push({ cardId: plan.cardId, format: plan.format, items: plan.items, planned: true });
  }
  return order;
}

export function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** XP = sum of card results; streak = consecutive local days with a completed card, ending today or yesterday. */
export function feedStats(events: readonly LearningEvent[], now: number): { xp: number; streak: number } {
  let xp = 0;
  const days = new Set<string>();
  for (const e of events) {
    if (e.type !== "card.result") continue;
    xp += e.xp;
    days.add(dayKey(e.ts));
  }
  // walk calendar days at local noon, so DST changes never skip or repeat a day
  const day = new Date(now);
  day.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(day.getTime()))) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(day.getTime()))) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return { xp, streak };
}

export function soundMuted(events: readonly LearningEvent[]): boolean {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === "settings.set" && e.soundMuted !== undefined) return e.soundMuted;
  }
  return false;
}
