/**
 * Learner queries (SPEC §8.3): what formats may ask about the learner when they propose cards,
 * answered from the learner state (state.ts, SPEC §7). Card sources build them with
 * `createLearnerQueries(ctx.events, opts)`; dev forced mode wraps them with `withContent()`; the
 * recommender, which already holds the state, uses `queriesFor(state, opts)`.
 *
 * Every list returns at most n items of the requested kinds, never one of `opts.avoid`:
 *   frontier         new items to introduce: signs a phrase asked for first, then the first new items
 *                    of each open unit, round-robin in curriculum order (one per open unit first)
 *   practice         met items for a skill: relearn (latest first), due (lowest retrievability first),
 *                    learning (weakest first; claims and items new for this skill included), known
 *   relearn          items failed or swiped "too hard" and not answered right since, latest first
 *   probes           claims waiting for their verification probe, oldest first
 *   pool             met items with pKnown ≥ minPKnown for the skill, weakest first
 *   eligiblePhrases  all signs met and ≥ 70 % known (receptive); least known phrase first
 *   confusions       items this one was confused with, most frequent first
 * Ties keep the curriculum order. "Met" means watched, answered or claimed in either skill.
 */
import { curriculumOrder } from "../content/curriculum";
import type { ItemKind, LearnerQueries, Skill } from "../core/types";
import type { LearningEvent } from "../data/events";
import { frontierItems, inScope, phraseEligible, type Scope } from "./curriculum";
import { SKILLS, isMet, skillOf, type LearnerState } from "./model";
import { retrievability } from "./schedule";
import { pKnownOf, statusOf } from "./selectors";
import { learnerStateOf } from "./state";

export interface QueryOptions {
  /** items no list may return (e.g. the items of the card queued right now) */
  avoid?: readonly string[];
  /** restricts the lists to these items, in this order (tests pass their own); default: the curriculum */
  order?: readonly string[];
  /** "now" for due reviews (epoch ms); default: the time of the log's last event (D-C12) */
  now?: number;
}

/** Queries over the learner state of a log (memoised fold, so cheap to call on every card). */
export function createLearnerQueries(events: readonly LearningEvent[], opts: QueryOptions = {}): LearnerQueries {
  return queriesFor(learnerStateOf(events), opts);
}

export function queriesFor(state: LearnerState, opts: QueryOptions = {}): LearnerQueries {
  const now = opts.now ?? state.lastTs;
  const avoid = new Set(opts.avoid ?? []);
  const order = opts.order ?? curriculumOrder();
  const position = new Map(order.map((id, i) => [id, i]));
  const scope = (kinds: readonly ItemKind[]): Scope => ({ kinds, avoid, ...(opts.order ? { rank: position } : {}) });
  const universe = (kinds: readonly ItemKind[]) => {
    const s = scope(kinds);
    return order.filter((id) => inScope(id, s));
  };
  const pos = (id: string) => position.get(id) ?? Number.MAX_SAFE_INTEGER;
  const met = (id: string) => isMet(state.items.get(id));
  const pKnown = (id: string, skill: Skill) => pKnownOf(state, id, skill);
  /** sorts by the keys, then curriculum order */
  const ranked = (ids: string[], key: (id: string) => readonly number[], n: number) =>
    ids
      .map((id) => ({ id, k: key(id) }))
      .sort((a, b) => {
        for (let i = 0; i < a.k.length; i++) if (a.k[i] !== b.k[i]) return a.k[i] - b.k[i];
        return pos(a.id) - pos(b.id);
      })
      .slice(0, n)
      .map((x) => x.id);

  const frontier = (kinds: readonly ItemKind[], n: number) => frontierItems(state, scope(kinds), n);

  const practice = (skill: Skill, kinds: readonly ItemKind[], n: number) =>
    ranked(universe(kinds).filter(met), (id) => {
      const rec = skillOf(state, id, skill);
      if (rec?.relearnSince !== undefined) return [0, -rec.relearnSince, 0];
      switch (statusOf(rec, now)) {
        case "due":
          return [1, retrievability(rec?.card, now), 0];
        case "known":
          return [3, retrievability(rec?.card, now), 0];
        default:
          // learning, a claim, or new for this skill: weakest first, then the longest unseen
          return [2, pKnown(id, skill), rec?.lastTs ?? 0];
      }
    }, n);

  const relearnMark = (id: string) => Math.max(-1, ...SKILLS.map((s) => skillOf(state, id, s)?.relearnSince ?? -1));

  return {
    nextItems: (kinds, n) => [...new Set([...frontier(kinds, n), ...practice("receptive", kinds, n)])].slice(0, n),
    frontier,
    practice,
    relearn: (kinds, n) => ranked(universe(kinds).filter((id) => relearnMark(id) >= 0), (id) => [-relearnMark(id)], n),
    probes: (kinds, n) => ranked(
      universe(kinds).filter((id) => state.items.get(id)?.probeSince !== undefined),
      (id) => [state.items.get(id)!.probeSince!],
      n,
    ),
    pool: (skill, kinds, n, minPKnown = 0) =>
      ranked(universe(kinds).filter((id) => met(id) && pKnown(id, skill) >= minPKnown), (id) => [pKnown(id, skill)], n),
    eligiblePhrases: (n) => ranked(universe(["phrase"]).filter((id) => phraseEligible(state, id)), (id) => [pKnown(id, "receptive")], n),
    confusions: (id) => {
      const counts = new Map<string, number>();
      for (const s of SKILLS) {
        for (const [other, k] of Object.entries(skillOf(state, id, s)?.confusions ?? {})) counts.set(other, (counts.get(other) ?? 0) + k);
      }
      return [...counts].sort((a, b) => b[1] - a[1]).map(([other]) => other);
    },
    status: (id, skill) => statusOf(skillOf(state, id, skill), now),
    pKnown,
  };
}

const ofKinds = (ids: readonly string[], kinds: readonly ItemKind[]) => ids.filter((id) => inScope(id, { kinds, avoid: new Set() }));

/** Items of the kinds in `content`, starting at position `start` and wrapping around (distinct while n ≤ pool). */
export function walk(content: readonly string[], start: number, kinds: readonly ItemKind[], n: number): string[] {
  const pool = ofKinds(content, kinds);
  return Array.from({ length: Math.min(n, pool.length) }, (_, i) => pool[(start + i) % pool.length]);
}

/**
 * Dev forced mode: every list answers with the content the developer picked (walked from `start`),
 * while statuses, estimates and confusions stay those of the log. Delegates explicitly, so it works
 * whatever object createLearnerQueries() returns.
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
