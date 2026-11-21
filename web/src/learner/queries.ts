/**
 * Learner queries (SPEC §8.3): what formats may ask about the learner when they propose cards.
 *
 * PART 0 STUB. A rough fold over the v2 log, so the learning formats (Part B) and the minigames
 * (Part E) can be written while the learner model (Part C) is built in parallel. Part C replaces
 * the internals with the real learner state (SPEC §7) and keeps `createLearnerQueries(events, opts)`
 * and `withContent()`: card sources call nothing else, so the swap stays inside `learner/`.
 *
 * Stub rules (deliberately simple, NOT SPEC §7):
 *   new      = no evidence for the skill and never claimed;
 *   claimed  = a card about the item left "too easy" (both skills);
 *   known    = claimed, or ≥ 2 correct retrievals with the last one correct; never "due";
 *   pKnown   = 0 new · 0.9 known · 0.8 × (correct + 1) / (attempts + 2) learning;
 *   frontier = items new for both skills, in curriculum order.
 */
import { PHRASES, curriculumOrder, itemKindOf } from "../content/curriculum";
import type { ItemKind, ItemStatus, LearnerQueries, Skill } from "../core/types";
import type { LearningEvent } from "../data/events";

const SKILLS: readonly Skill[] = ["receptive", "productive"];

interface Tally {
  attempts: number;
  correct: number;
  exposures: number;
  /** correctness of the last retrieval */
  last?: boolean;
  /** position in the log of the last retrieval (recency) */
  lastAt: number;
  claimed: boolean;
}

export interface QueryOptions {
  /** items no list may return (e.g. the items of the card queued right now) */
  avoid?: readonly string[];
  /** the curriculum order to walk (tests pass their own) */
  order?: readonly string[];
}

const ofKinds = (ids: readonly string[], kinds: readonly ItemKind[]) => ids.filter((id) => {
  const kind = itemKindOf(id);
  return kind !== undefined && kinds.includes(kind);
});

export function createLearnerQueries(events: readonly LearningEvent[], opts: QueryOptions = {}): LearnerQueries {
  const avoid = new Set(opts.avoid ?? []);
  const order = (opts.order ?? curriculumOrder()).filter((id) => !avoid.has(id));
  const tallies = new Map<string, Tally>();
  const confused = new Map<string, Map<string, number>>();
  const cardItems = new Map<string, readonly string[]>();

  const tally = (id: string, skill: Skill): Tally => {
    const key = `${skill}|${id}`;
    let t = tallies.get(key);
    if (!t) tallies.set(key, (t = { attempts: 0, correct: 0, exposures: 0, lastAt: -1, claimed: false }));
    return t;
  };
  const peek = (id: string, skill: Skill) => tallies.get(`${skill}|${id}`);

  events.forEach((e, at) => {
    if (e.type === "card.shown") cardItems.set(e.cardId, e.items);
    else if (e.type === "evidence") {
      const t = tally(e.itemId, e.skill);
      if (e.kind === "exposure") t.exposures++;
      else {
        t.attempts++;
        if (e.correct) t.correct++;
        t.last = !!e.correct;
        t.lastAt = at;
      }
      if (e.confusedWith) {
        const m = confused.get(e.itemId) ?? new Map<string, number>();
        m.set(e.confusedWith, (m.get(e.confusedWith) ?? 0) + 1);
        confused.set(e.itemId, m);
      }
    } else if (e.type === "card.exit" && e.exit === "too_easy") {
      for (const id of cardItems.get(e.cardId) ?? []) for (const s of SKILLS) tally(id, s).claimed = true;
    }
  });

  const status = (id: string, skill: Skill): ItemStatus => {
    const t = peek(id, skill);
    if (!t || (t.attempts === 0 && t.exposures === 0 && !t.claimed)) return "new";
    if (t.claimed || (t.correct >= 2 && t.last === true)) return "known";
    return "learning";
  };
  const pKnown = (id: string, skill: Skill): number => {
    const s = status(id, skill);
    if (s === "new") return 0;
    if (s === "known" || s === "due") return 0.9;
    const t = peek(id, skill)!;
    return (0.8 * (t.correct + 1)) / (t.attempts + 2);
  };
  const isNew = (id: string) => SKILLS.every((s) => status(id, s) === "new");
  const lastWrong = (id: string, skill: Skill) => peek(id, skill)?.last === false;
  const recency = (id: string, skill: Skill) => peek(id, skill)?.lastAt ?? -1;

  const frontier = (kinds: readonly ItemKind[], n: number) => ofKinds(order, kinds).filter(isNew).slice(0, n);
  const practice = (skill: Skill, kinds: readonly ItemKind[], n: number) => {
    const rank = (id: string) => (lastWrong(id, skill) ? 0 : status(id, skill) === "learning" ? 1 : 2);
    return ofKinds(order, kinds)
      .filter((id) => status(id, skill) !== "new")
      .sort((a, b) => rank(a) - rank(b) || pKnown(a, skill) - pKnown(b, skill) || recency(a, skill) - recency(b, skill))
      .slice(0, n);
  };

  return {
    nextItems: (kinds, n) => [...new Set([...frontier(kinds, n), ...practice("receptive", kinds, n)])].slice(0, n),
    frontier,
    practice,
    relearn: (kinds, n) => {
      const latest = (id: string) => Math.max(...SKILLS.map((s) => (lastWrong(id, s) ? recency(id, s) : -1)));
      return ofKinds(order, kinds).filter((id) => latest(id) >= 0).sort((a, b) => latest(b) - latest(a)).slice(0, n);
    },
    probes: (kinds, n) => ofKinds(order, kinds).filter((id) => SKILLS.some((s) => peek(id, s)?.claimed && peek(id, s)?.attempts === 0)).slice(0, n),
    pool: (skill, kinds, n, minPKnown = 0) => ofKinds(order, kinds)
      .filter((id) => status(id, skill) !== "new" && pKnown(id, skill) >= minPKnown)
      .sort((a, b) => pKnown(a, skill) - pKnown(b, skill))
      .slice(0, n),
    eligiblePhrases: (n) => ofKinds(order, ["phrase"])
      .filter((id) => PHRASES.get(id)?.signs.every((sign) => status(sign, "receptive") !== "new"))
      .slice(0, n),
    confusions: (id) => [...(confused.get(id) ?? new Map<string, number>())].sort((a, b) => b[1] - a[1]).map(([other]) => other),
    status,
    pKnown,
  };
}

/** Items of the kinds in `content`, starting at position `start` and wrapping around (distinct while n ≤ pool). */
export function walk(content: readonly string[], start: number, kinds: readonly ItemKind[], n: number): string[] {
  const pool = ofKinds(content, kinds);
  return Array.from({ length: Math.min(n, pool.length) }, (_, i) => pool[(start + i) % pool.length]);
}

/**
 * Dev forced mode: every list answers with the content the developer picked (walked from `start`),
 * while statuses, estimates and confusions stay those of the log. Delegates explicitly, so it works
 * whatever object or class Part C returns from createLearnerQueries().
 */
export function withContent(base: LearnerQueries, content: readonly string[], start: number): LearnerQueries {
  const items = (kinds: readonly ItemKind[], n: number) => walk(content, start, kinds, n);
  return {
    nextItems: items,
    frontier: items,
    practice: (_skill, kinds, n) => items(kinds, n),
    relearn: items,
    probes: items,
    pool: (_skill, kinds, n) => items(kinds, n),
    eligiblePhrases: (n) => items(["phrase"], n),
    confusions: (id) => base.confusions(id),
    status: (id, skill) => base.status(id, skill),
    pKnown: (id, skill) => base.pKnown(id, skill),
  };
}
