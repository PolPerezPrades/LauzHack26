# Part D — Recommender

- **Status:** not started
- **Stream:** S1 "learner brain" · Ashlie's PC (Windows 11) · wave 2 · branch `part-d`
- **Needs merged first:** C · **Better after:** B (the cold-start metric needs lessons)
- **Spec:** [SPEC §9, Part D](../SPEC.md#part-d--recommender), plus §7.8–§7.12, §3.4 (queue), §8.3; the parallel rules in [§9.0](../SPEC.md#90-parallel-plan)
- **Built at the same time as:** E (minigames, Pol), F1 (settings sheet and PWA, Max)

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
