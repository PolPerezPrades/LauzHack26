/**
 * Small pure views of the log for the feed: card history (for card sources), XP and streak (the
 * overlay chip, read from the learner state since Part C) and the sound preference.
 */
import type { CardPlan, CardRef } from "../core/types";
import type { LearningEvent } from "../data/events";
import { streakOf, xpOf } from "../learner/selectors";
import { learnerStateOf } from "../learner/state";

export { dayKey } from "../learner/days";

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

/** XP = sum of card results; streak = consecutive local days with a completed card, ending today or yesterday. */
export function feedStats(events: readonly LearningEvent[], now: number): { xp: number; streak: number } {
  const state = learnerStateOf(events);
  return { xp: xpOf(state), streak: streakOf(state, now) };
}

export function soundMuted(events: readonly LearningEvent[]): boolean {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === "settings.set" && e.soundMuted !== undefined) return e.soundMuted;
  }
  return false;
}
