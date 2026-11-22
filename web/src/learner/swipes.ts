/**
 * What a card's exit does to the learner (SPEC §7.4–§7.6). Applied once per card, when it leaves:
 *   1. success → challenge level and accuracy (completed cards with retrievals);
 *   2. one FSRS review per (item, skill) answered, graded by the exit (Again / Hard / Good / Easy);
 *   3. the swipe rules of §7.5 for the target items, the challenge and the format's preference;
 *   4. counters, mutes, clamps, and the units that open.
 * A card closed without an exit (crash, closed tab, next card shown) takes the default column,
 * like Next.
 */
import { PHRASES } from "../content/curriculum";
import type { ExitKind, FormatId, Skill } from "../core/types";
import { breakRuns, refreshUnits, registerClaim } from "./curriculum";
import {
  clamp, isMet, raise, updateFormat, updateItem, updateSkill, withP, without,
  type Draft, type ItemSkillState, type OpenCard, type Retrieval,
} from "./model";
import {
  ACCURACY_ALPHA, CHALLENGE_MAX, CHALLENGE_MIN, COMPLETED_ALPHA, COOLDOWN_CARDS, DISLIKE_BETA, MUTE_COMPLETIONS_FACTOR,
  MUTE_MIN_DISLIKES, PREF_DECAY, SUCCESS_GAIN, SUCCESS_TARGET, SWIPE, formatSkills, isLearningFormat,
} from "./params";
import { Rating, gradeAtExit, review } from "./schedule";

/** The retrievals of one (item, skill) on a card, collapsed to one review (§7.4). */
export interface Collapsed {
  readonly itemId: string;
  readonly skill: Skill;
  /** wrong if any retrieval was wrong */
  readonly correct: boolean;
  /** every retrieval was self-graded */
  readonly selfGraded: boolean;
  /** time of the last one */
  readonly ts: number;
}

export function collapse(retrievals: readonly Retrieval[]): Collapsed[] {
  const out = new Map<string, Collapsed>();
  for (const r of retrievals) {
    const key = `${r.itemId}|${r.skill}`;
    const prev = out.get(key);
    out.set(key, prev
      ? { ...prev, correct: prev.correct && r.correct, selfGraded: prev.selfGraded && r.selfGraded, ts: Math.max(prev.ts, r.ts) }
      : { itemId: r.itemId, skill: r.skill, correct: r.correct, selfGraded: r.selfGraded, ts: r.ts });
  }
  return [...out.values()];
}

/** Skills of a target item on this card: those it got evidence for, else the ones its format trains. */
const cardSkills = (card: OpenCard, id: string): readonly Skill[] => {
  const touched = card.evidenceSkills.get(id);
  return touched?.size ? [...touched] : formatSkills(card.format);
};

function shiftChallenge(d: Draft, format: FormatId, step: { readonly c: number; readonly cf: number }) {
  d.c = clamp(d.c + step.c, CHALLENGE_MIN, CHALLENGE_MAX);
  updateFormat(d, format, (f) => ({ ...f, cf: clamp(f.cf + step.cf, CHALLENGE_MIN, CHALLENGE_MAX) }));
}

/** After each card, every preference relaxes towards neutral (§7.5); mutes don't decay. */
function decayPreferences(d: Draft) {
  for (const [id, f] of d.formats) {
    if (f.alpha !== 1 || f.beta !== 1) d.formats.set(id, { ...f, alpha: 1 + (f.alpha - 1) * PREF_DECAY, beta: 1 + (f.beta - 1) * PREF_DECAY });
  }
}

const touchedOnly = (rec: ItemSkillState) => rec.evidence !== "none";

// ── the rows of §7.5 ───────────────────────────────────────────────────────────────────────────

/** Too easy after completing: FSRS Easy (graded above) and pKnown ≥ 0.90 for the items answered correctly. */
function tooEasyDone(d: Draft, card: OpenCard, answered: readonly Collapsed[]) {
  for (const a of answered) {
    if (a.correct) updateSkill(d, a.itemId, a.skill, (rec) => withP(rec, Math.max(rec.pKnown, SWIPE.tooEasyDone.pKnownFloor)));
  }
  for (const id of card.items) for (const s of cardSkills(card, id)) updateSkill(d, id, s, (rec) => ({ ...rec, tooEasy: rec.tooEasy + 1 }));
  shiftChallenge(d, card.format, SWIPE.tooEasyDone);
}

/** Too easy before completing: a claim for new items, a self-graded Easy for met ones. */
function tooEasyBefore(d: Draft, card: OpenCard, ts: number) {
  const fresh = card.items.filter((id) => !isMet(d.items.get(id)));
  for (const id of card.items) {
    const skills = formatSkills(card.format);
    if (fresh.includes(id)) {
      for (const s of skills) {
        updateSkill(d, id, s, (rec) => ({ ...withP(raise(rec, "claimed"), Math.max(rec.pKnown, SWIPE.tooEasyNew.pKnownFloor)), tooEasy: rec.tooEasy + 1 }));
      }
      updateItem(d, id, (item) => ({ ...item, probeSince: card.index }));
      registerClaim(d, id, card.index);
    } else {
      for (const s of skills) {
        updateSkill(d, id, s, (rec) => ({
          ...withP(rec, Math.max(rec.pKnown, SWIPE.tooEasyMet.pKnownFloor)),
          card: review(rec.card, ts, Rating.Easy),
          tooEasy: rec.tooEasy + 1,
          lastTs: Math.max(rec.lastTs, ts),
        }));
      }
    }
  }
  // games have no target items: only the challenge rule applies to them
  shiftChallenge(d, card.format, fresh.length ? SWIPE.tooEasyNew : SWIPE.tooEasyMet);
}

/** Too hard after completing: FSRS Hard / Again (graded above), and the items get relearn priority. */
function tooHardDone(d: Draft, card: OpenCard) {
  for (const id of card.items) {
    for (const s of cardSkills(card, id)) {
      updateSkill(d, id, s, (rec) => (touchedOnly(rec) ? { ...rec, relearnSince: card.index, tooHard: rec.tooHard + 1 } : { ...rec, tooHard: rec.tooHard + 1 }));
    }
  }
  shiftChallenge(d, card.format, SWIPE.tooHardDone);
}

/** Too hard before completing: a cooldown for new items (and their missing signs first, for a phrase); a relearn for met ones. */
function tooHardBefore(d: Draft, card: OpenCard, ts: number) {
  const fresh = card.items.filter((id) => !isMet(d.items.get(id)));
  for (const id of card.items) {
    const skills = formatSkills(card.format);
    if (fresh.includes(id)) {
      for (const s of skills) updateSkill(d, id, s, (rec) => ({ ...rec, cooldownUntilCard: card.index + COOLDOWN_CARDS, tooHard: rec.tooHard + 1 }));
      for (const sign of PHRASES.get(id)?.signs ?? []) {
        if (!isMet(d.items.get(sign))) updateItem(d, sign, (item) => ({ ...item, prereqSince: card.index }));
      }
    } else {
      for (const s of skills) {
        updateSkill(d, id, s, (rec) => {
          const next = withP({
            ...rec,
            card: review(rec.card, ts, Rating.Again),
            relearnSince: card.index,
            tooHard: rec.tooHard + 1,
            lastTs: Math.max(rec.lastTs, ts),
          }, rec.pKnown * SWIPE.tooHardMet.pKnownFactor);
          // "too hard" on a claim is a failed verification
          return next.evidence === "claimed" ? { ...next, evidence: "exposed" } : next;
        });
      }
      updateItem(d, id, (item) => (item.probeSince === undefined ? item : without(item, "probeSince")));
    }
  }
  shiftChallenge(d, card.format, fresh.length ? SWIPE.tooHardNew : SWIPE.tooHardMet);
}

/** Not this format: the content comes back soon in another format; the format's preference drops. */
function dislike(d: Draft, card: OpenCard) {
  for (const id of card.items) updateItem(d, id, (item) => ({ ...item, dislikedCard: card.index }));
  updateFormat(d, card.format, (f) => ({ ...f, beta: f.beta + DISLIKE_BETA, dislikes: f.dislikes + 1 }));
}

const addAlpha = (d: Draft, format: FormatId) => updateFormat(d, format, (f) => ({ ...f, alpha: f.alpha + COMPLETED_ALPHA }));

// ── closing a card ─────────────────────────────────────────────────────────────────────────────

/**
 * Closes a card: `exit` is the logged exit, or null when the card was closed without one.
 * `ts` is when it left (the exit's time, or the card's last event).
 */
export function closeCard(d: Draft, card: OpenCard, exit: ExitKind | null, completed: boolean, ts: number) {
  d.open.delete(card.cardId);
  // the tutorial and dev probes teach nothing: their exits change no learner state
  if (!isLearningFormat(card.format)) return;
  decayPreferences(d);

  // 1. success → challenge (§7.6) and accuracy, on completed cards with retrievals
  if (completed && card.retrievals.length) {
    const success = card.retrievals.filter((r) => r.correct).length / card.retrievals.length;
    d.c = clamp(d.c + SUCCESS_GAIN * (success - SUCCESS_TARGET), CHALLENGE_MIN, CHALLENGE_MAX);
    for (const r of card.retrievals) d.accuracy += ACCURACY_ALPHA * ((r.correct ? 1 : 0) - d.accuracy);
  }

  // 2. memory: one review per (item, skill) answered, graded by the exit (§7.4)
  const answered = collapse(card.retrievals);
  for (const a of answered) updateSkill(d, a.itemId, a.skill, (rec) => ({ ...rec, card: review(rec.card, a.ts, gradeAtExit(a, exit)) }));

  // 3. the swipe rules (§7.5)
  switch (exit) {
    case "too_easy":
      if (completed) {
        tooEasyDone(d, card, answered);
        addAlpha(d, card.format);
      } else tooEasyBefore(d, card, ts);
      break;
    case "too_hard":
      if (completed) {
        tooHardDone(d, card);
        addAlpha(d, card.format);
      } else tooHardBefore(d, card, ts);
      for (const id of card.newItems) breakRuns(d, id);
      break;
    case "dislike_format":
      dislike(d, card);
      break;
    case "next":
    case null:
      if (completed) addAlpha(d, card.format);
      if (exit === "next") for (const id of card.newItems) breakRuns(d, id);
      break;
    case "camera_off":
      break;
  }

  // 4. counters and the mute rule (after this card's completion counts)
  if (completed) updateFormat(d, card.format, (f) => ({ ...f, completed: f.completed + 1 }));
  if (exit === "dislike_format") {
    updateFormat(d, card.format, (f) => ({
      ...f,
      muted: f.muted || (f.dislikes >= MUTE_MIN_DISLIKES && f.dislikes > MUTE_COMPLETIONS_FACTOR * f.completed),
    }));
  }
  refreshUnits(d);
}
