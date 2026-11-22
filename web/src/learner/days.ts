/**
 * Calendar days in local time, for streaks, daily counts and "correct on ≥ 2 distinct days".
 * Deterministic for a given time zone (the fold runs where the learner lives).
 */

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Consecutive days in `days` ending today or yesterday (today doesn't break a streak before it ends). */
export function streakFrom(days: { has(day: string): boolean }, now: number): number {
  // walk calendar days at local noon, so DST changes never skip or repeat a day
  const day = new Date(now);
  day.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(day.getTime()))) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(day.getTime()))) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}
