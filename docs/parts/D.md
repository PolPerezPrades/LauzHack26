# Part D — Recommender

- **Status:** not started · demo cut D1 first (§0)
- **Stream:** S1 "learner brain" · Ashlie's PC (Windows 11) · wave 2 · branch `part-d`
- **Needs merged first:** C · **Better after:** B (the cold-start metric needs lessons)
- **Spec:** [SPEC §9, Part D](../SPEC.md#part-d--recommender), plus §7.8–§7.12, §3.4 (queue), §8.3; the parallel rules in [§9.0](../SPEC.md#90-parallel-plan)
- **Built at the same time as:** E (minigames, Pol), F1 (settings sheet and PWA, Max)

## 0. Demo cut: D1 "simple recommender" (2026-11-22, D-055)

The demo is on 2026-11-22 at about 11:30 (SPEC §9.0.7). Push a first working increment by **10:45** and the last by **11:00**; the integrator freezes `gesture_learning` at 11:10. The full Part D below (§7.8–§7.12: scores, softmax, simulations, ℹ, inspector) becomes later increments D2+. If `part-d` already holds Part D work, keep it, but ship D1 first.

Owned for D1, on top of §1: `web/src/data/**` (the fresh profile; F1 is deferred). Not yours: `src/tasks/**` (B2 and E1), `src/viewer/**` (B2).

**First increment (by 10:45)**

- [ ] **Fresh profile per browser session:** when the browser (tab session) opens the learner feed, it starts from an empty learner log; reloading the page keeps the session's progress. A `sessionStorage` marker decides it: no marker → clear the learner log (the `signa` events store; leave `signa-dev` alone), then set the marker. The first card is the gesture tutorial again (D-054).
- [ ] **Teach before testing:** a non-lesson card only uses items the learner has met in a lesson (status not `new`); a new item always comes first as a lesson. Quiz distractors may be any item.
- [ ] **Pace:** at most one new item every 3 cards; no new item while recent accuracy (last 5 answers) is under 60 %; a "too hard" swipe slows new items, "too easy" speeds them up.
- [ ] **Variety:** never the same format twice in a row, nor the same item within the last 4 cards; a failed item comes back after 2–3 other cards, not right away (fixes R-028 and R-B01).
- [ ] **Games:** when `GAME_FORMATS` (`tasks/gameFormats.ts`, filled by E1) has an eligible game, about 1 card in 5 is a game. Works with an empty list.
- [ ] **Never stall:** when every candidate declines (e.g. B2's generators refuse words for productive cards), fall back to a lesson of the next item, then a quiz-choice.
- [ ] Every pick carries machine-readable reasons (`Reason[]`, SPEC §7.9) for the later ℹ button; constants in `recommender/config.ts`; the rules unit-tested on `learner/testLog.ts` logs, including a learner who always fails.
- [ ] The learner feed uses it (`app/`); the old picker may stay for `#dev`. Gates green; 20 cards checked by hand in the browser.

**Later increments (after the demo):** the full checklist in §2.

This is the part's state file (SPEC §9.0.4). Keep it current while you work. The integrator reads it when merging the branch and folds it into `PROJECT_STATE.md`; don't edit that file, the spec, `AGENTS.md` or the READMEs.

## 1. Files this part owns

From SPEC §9.0.3; new files in these folders are fine too.

- `web/src/recommender/**`
- `web/src/learner/**` (new queries or selectors, if needed)
- `web/src/app/**` (the learner feed's card source)
- `web/src/feed/FeedScreen.tsx` (queue and invalidation), `feed/CardParts.tsx` (ℹ in `CardHeader`), `feed/simplePicker.ts`, `feed/derived.ts`
- `web/src/dev/panels.ts` and the new inspector file
- `web/src/i18n/parts/recommender.ts`; the `simulate` script in `web/package.json`

Not yours in this wave: the `<FeedTop …/>` line and `FeedTop.tsx` (F1), `src/tasks/` (E), `learning/orchestrator.ts` (F2 deletes it).

## 2. Checklist

Tick an item only when it is implemented **and** verified.

- [ ] Candidates, features, score, hard constraints, seeded softmax selection
- [ ] Explanations + ℹ button with reasons in both languages (`i18n/parts/recommender.ts`)
- [ ] Recommender `CardSource` + queue invalidation (optional `CardSource.stillValid`, listed as a contract change)
- [ ] Simulation harness + personas + `npm run simulate`
- [ ] All 10 metrics of SPEC §7.12 pass as tests (the format hater hates `game-rain` if registered, else `quiz-choice`)
- [ ] Dev recommender inspector in `dev/panels.ts` (breakdown, force next, seed, simulate)
- [ ] The learner feed uses the recommender (`app/App.tsx`); the picker may stay for dev
- [ ] Gates green; manual feel check

## 3. Contract changes

Additive changes to `core/types.ts`, the learner queries, the `SignViewer` props, `feed/derived.ts` or the dev panel slot (SPEC §9.0.4, rule 2). None yet.

## 4. Cross-part edits

Edits outside the files above, kept minimal, so the integrator can expect the conflict. None yet.

## 5. Decisions

Format: `D-DNN · YYYY-MM-DD · decision` — *why* — status. None yet.

## 6. Open questions

Format: `Q-DNN` question — *Default: what you assumed meanwhile.* None yet.

## 7. Risks, known issues and stubs

Format: `R-DNN` description. None yet.

## 8. Integration checks (for the integrator)

- [ ] With E merged: metrics 4 and 6 with the real games (`game-rain` hated); the recommender picks games by cadence and eligibility.
- [ ] With F1 merged: unmuting a format in the settings sheet brings it back into the candidates.

## 9. Session log

Newest first: date · what was done · verification · next step.

## 10. Handoff to the integrator

Written at the end of the part: what the branch contains, how it was verified (gates, browsers, devices), what needs the spec machine (MX Brio, Android phone), and follow-ups for other parts.
