/**
 * The curriculum as the learner model sees it (SPEC §7.7): tracks of ordered units, which units are
 * open, the frontier of new items, self-placement by test-out, and new-item pacing.
 * Units and their items come from the content (content/curriculum.ts); this module adds the order
 * between units and the rules that open them.
 */
import { PHRASES, UNITS, curriculumOrder, itemKindOf, unitOrder } from "../content/curriculum";
import type { ItemKind } from "../core/types";
import {
  NUMBERS_UNLOCK_MET, OVERDUE_CAP, PACING_BASE, PACING_PER_C, PHRASE_KNOWN_SHARE, TEST_OUT_P, TEST_OUT_PROBES,
  TEST_OUT_TRACK, TEST_OUT_UNIT, UNLOCK_PKNOWN, UNLOCK_SHARE,
} from "./params";
import {
  SKILLS, evidenceAtLeast, isMet, maxPKnown, raise, skillOf, updateItem, updateSkill, withP,
  type Draft, type ItemSkillState, type LearnerState,
} from "./model";
import { isDue } from "./schedule";

/** How the first unit of a track opens; every later unit opens from the one before it. */
export type TrackStart = { kind: "initial" } | { kind: "met"; unit: string; share: number } | { kind: "phrase" };

export interface Track {
  readonly id: string;
  readonly units: readonly string[];
  readonly start: TrackStart;
}

export const TRACKS: readonly Track[] = [
  { id: "fingerspelling", units: ["abc1", "abc2", "abc3"], start: { kind: "initial" } },
  { id: "numbers", units: ["numbers"], start: { kind: "met", unit: "abc1", share: NUMBERS_UNLOCK_MET } },
  { id: "vocabulary", units: ["greetings", "family", "colors", "food", "core"], start: { kind: "initial" } },
  // phrases are never taught by a lesson; their unit opens once one of them is eligible (D-C10)
  { id: "phrases", units: ["phrases"], start: { kind: "phrase" } },
];

export const INITIAL_UNITS: readonly string[] = TRACKS.filter((t) => t.start.kind === "initial").map((t) => t.units[0]);

const TRACK_OF_UNIT = new Map(TRACKS.flatMap((t) => t.units.map((u) => [u, t.id] as const)));
export const trackOf = (unit: string): string | undefined => TRACK_OF_UNIT.get(unit);

/** Unit of an item (phrases registered later included). */
export function unitOf(id: string): string | undefined {
  if (PHRASES.has(id)) return "phrases";
  return UNITS.find((u) => u.items.includes(id))?.id;
}

const share = (ids: readonly string[], ok: (id: string) => boolean) => (ids.length ? ids.filter(ok).length / ids.length : 0);

/**
 * Items of a unit in teaching order, cached: the unlock rules read them after every card. The cache
 * follows the unit's size, because registerPhrases() can grow the phrases unit at run time.
 */
const unitCache = new Map<string, { size: number; items: readonly string[] }>();
function teachingOrder(unit: string): readonly string[] {
  const size = UNITS.find((u) => u.id === unit)?.items.length ?? 0;
  const hit = unitCache.get(unit);
  if (hit && hit.size === size) return hit.items;
  const items = unitOrder(unit);
  unitCache.set(unit, { size, items });
  return items;
}

// ── knowledge words used by the curriculum rules ───────────────────────────────────────────────

/** Status known or due: the latch is set and the knowledge isn't a mere claim. */
export const isKnown = (rec: ItemSkillState | undefined): boolean =>
  !!rec && rec.known && evidenceAtLeast(rec.evidence, "exposed") && rec.evidence !== "claimed";

/** A phrase is eligible when all its signs are met and ≥ 70 % of them are known (receptive) (§4.6, §7.7). */
export function phraseEligible(state: Pick<LearnerState, "items">, phraseId: string): boolean {
  const phrase = PHRASES.get(phraseId);
  if (!phrase || !phrase.signs.every((s) => isMet(state.items.get(s)))) return false;
  return share(phrase.signs, (s) => isKnown(skillOf(state, s, "receptive"))) >= PHRASE_KNOWN_SHARE;
}

// ── units ──────────────────────────────────────────────────────────────────────────────────────

function opens(d: Draft, track: Track, i: number): boolean {
  if (i > 0) {
    const prev = track.units[i - 1];
    return d.testedOut.has(prev) || share(teachingOrder(prev), (id) => maxPKnown(d.items.get(id)) >= UNLOCK_PKNOWN) >= UNLOCK_SHARE;
  }
  switch (track.start.kind) {
    case "initial":
      return true;
    case "met":
      return share(teachingOrder(track.start.unit), (id) => isMet(d.items.get(id))) >= track.start.share;
    case "phrase":
      return [...PHRASES.keys()].some((id) => phraseEligible(d, id));
  }
}

/** Opens every unit whose rule now holds. A unit never closes again once open (D-C10). */
export function refreshUnits(d: Draft) {
  for (const track of TRACKS) {
    track.units.forEach((unit, i) => {
      if (!d.openUnits.has(unit) && opens(d, track, i)) d.openUnits.add(unit);
    });
  }
}

// ── self-placement (§7.7) ──────────────────────────────────────────────────────────────────────

/** Up to k items spread over the list (first, last, evenly between), in list order. */
export function spread<T>(list: readonly T[], k: number): T[] {
  if (list.length <= k) return [...list];
  if (k <= 1) return list.slice(0, k);
  const picks = new Set(Array.from({ length: k }, (_, i) => Math.round((i * (list.length - 1)) / (k - 1))));
  return [...picks].sort((a, b) => a - b).map((i) => list[i]);
}

/**
 * Test-out: the unit's remaining new items become claims (pKnown 0.60), the unit counts as passed
 * (so the next one in its track opens), and one verification probe covers 3 of the new claims.
 */
export function testOut(d: Draft, unit: string, cardIndex: number) {
  d.testedOut.add(unit);
  d.openUnits.add(unit);
  const remaining = teachingOrder(unit).filter((id) => !isMet(d.items.get(id)));
  for (const id of remaining) {
    for (const skill of SKILLS) updateSkill(d, id, skill, (rec) => withP(raise(rec, "claimed"), Math.max(rec.pKnown, TEST_OUT_P)));
  }
  for (const id of spread(remaining, TEST_OUT_PROBES)) updateItem(d, id, (item) => ({ ...item, probeSince: cardIndex }));
  resetRuns(d, unit);
  refreshUnits(d);
}

function resetRuns(d: Draft, unit: string) {
  d.unitRuns.delete(unit);
  const track = trackOf(unit);
  if (track) d.trackRuns.delete(track);
}

/**
 * A "too easy" claim on a new item. Claims in a row count per unit and per track: claims on other
 * units in between don't break a run, an ordinary exit on a new item of the same unit does (D-C09).
 */
export function registerClaim(d: Draft, itemId: string, cardIndex: number) {
  const unit = unitOf(itemId);
  if (!unit || d.testedOut.has(unit)) return;
  const track = trackOf(unit);
  const inUnit = (d.unitRuns.get(unit) ?? 0) + 1;
  const inTrack = track ? (d.trackRuns.get(track) ?? 0) + 1 : 0;
  d.unitRuns.set(unit, inUnit);
  if (track) d.trackRuns.set(track, inTrack);
  if (inUnit >= TEST_OUT_UNIT || inTrack >= TEST_OUT_TRACK) testOut(d, unit, cardIndex);
}

/** A new item left by an ordinary exit (completed and moved on, or "too hard") breaks its runs. */
export function breakRuns(d: Draft, itemId: string) {
  const unit = unitOf(itemId);
  if (unit) resetRuns(d, unit);
}

// ── frontier ───────────────────────────────────────────────────────────────────────────────────

/** Which items a list may return, and in which order inside a unit. */
export interface Scope {
  readonly kinds: readonly ItemKind[];
  readonly avoid: ReadonlySet<string>;
  /** restricts the lists to these items and orders them (tests pass their own); else the curriculum order */
  readonly rank?: ReadonlyMap<string, number>;
}

export const inScope = (id: string, scope: Scope): boolean => {
  const kind = itemKindOf(id);
  return kind !== undefined && scope.kinds.includes(kind) && !scope.avoid.has(id) && (!scope.rank || scope.rank.has(id));
};

/** Items of a unit in teaching order (or the scope's order), restricted to the scope. */
export function unitItems(unit: string, scope: Scope): string[] {
  const items = teachingOrder(unit).filter((id) => inScope(id, scope));
  const rank = scope.rank;
  return rank ? items.sort((a, b) => rank.get(a)! - rank.get(b)!) : items;
}

/** Position of every item in the curriculum order (phrases registered later included). */
const curriculumPosition = () => new Map(curriculumOrder().map((id, i) => [id, i]));

/** Index of the card that will be chosen now: cards shown so far + 1 (cooldowns count in cards). */
export const nextCardIndex = (state: Pick<LearnerState, "cards">) => state.cards + 1;

export const inCooldown = (state: Pick<LearnerState, "items" | "cards">, id: string): boolean =>
  SKILLS.some((s) => (skillOf(state, id, s)?.cooldownUntilCard ?? 0) > nextCardIndex(state));

/**
 * The frontier (§7.7): signs a phrase asked for first ("prerequisites first", most recent ask
 * first), then the first new items of every open unit, round-robin over the units in curriculum
 * order, so that the first entries give one item per open unit (§7.8.1, D-C08). Items in cooldown
 * are skipped; phrases only once eligible.
 */
export function frontierItems(state: LearnerState, scope: Scope, n: number): string[] {
  const out: string[] = [];
  const fresh = (id: string) =>
    !out.includes(id) && inScope(id, scope) && !isMet(state.items.get(id)) && !inCooldown(state, id) &&
    (!PHRASES.has(id) || phraseEligible(state, id));
  const order = curriculumPosition();
  const prereq = [...state.items.values()]
    .filter((item) => item.prereqSince !== undefined)
    .sort((a, b) => b.prereqSince! - a.prereqSince! || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((item) => item.id);
  for (const id of prereq) if (out.length < n && fresh(id)) out.push(id);
  const queues = UNITS.filter((u) => state.openUnits.has(u.id)).map((u) => unitItems(u.id, scope).filter(fresh));
  for (let i = 0; out.length < n && queues.some((q) => i < q.length); i++) {
    for (const q of queues) if (i < q.length && out.length < n && !out.includes(q[i])) out.push(q[i]);
  }
  return out;
}

// ── pacing (§7.7) ──────────────────────────────────────────────────────────────────────────────

export const maxInFlight = (c: number) => Math.round(PACING_BASE + PACING_PER_C * c);

/**
 * Items being learned, counted once per item: some skill was watched or answered and isn't known.
 * Claims don't count: they wait for a probe, and counting them would let a test-out block the
 * lessons that self-placement is meant to speed up (D-C05).
 */
export function inFlightItems(state: Pick<LearnerState, "items">): string[] {
  return [...state.items.values()]
    .filter((item) => SKILLS.some((s) => {
      const rec = item[s];
      return !!rec && rec.evidence !== "none" && rec.evidence !== "claimed" && !rec.known;
    }))
    .map((item) => item.id);
}

/** (item, skill) pairs known and due for review now. */
export function overdueCount(state: Pick<LearnerState, "items">, now: number): number {
  let n = 0;
  for (const item of state.items.values()) for (const s of SKILLS) if (isKnown(item[s]) && isDue(item[s]!.card, now)) n++;
  return n;
}

export interface Pacing {
  inFlight: number;
  maxInFlight: number;
  overdue: number;
  /** new lessons only while inFlight < maxInFlight and fewer than 8 reviews are overdue */
  allowsNew: boolean;
}

export function pacing(state: LearnerState, now: number): Pacing {
  const inFlight = inFlightItems(state).length;
  const max = maxInFlight(state.c);
  const overdue = overdueCount(state, now);
  return { inFlight, maxInFlight: max, overdue, allowsNew: inFlight < max && overdue < OVERDUE_CAP };
}
