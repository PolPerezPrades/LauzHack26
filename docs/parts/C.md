# Part C — Learner model v2

- **Status:** not started
- **Stream:** S1 "learner brain" · Ashlie's PC (Windows 11) · wave 1 · branch `part-c`
- **Needs merged first:** Part 0 · **Better after:** —
- **Spec:** [SPEC §9, Part C](../SPEC.md#part-c--learner-model-v2), plus §7 (all of it), §8.3, §8.4; the parallel rules in [§9.0](../SPEC.md#90-parallel-plan)
- **Built at the same time as:** B (learning formats, Pol: its generators call `createLearnerQueries()`), A2 then H (feed and viewer, Max), A3 (integrator)

This is the part's state file (SPEC §9.0.4). Keep it current while you work. The integrator reads it when merging the branch and folds it into `PROJECT_STATE.md`; don't edit that file, the spec, `AGENTS.md` or the READMEs.

## 1. Files this part owns

From SPEC §9.0.3; new files in these folders are fine too.

- `web/src/learner/**` (replace the Part 0 stub in `queries.ts`; keep `testing.ts` in step with the contract)
- `web/src/feed/derived.ts`, `web/src/feed/simplePicker.ts`, `web/src/dev/forcedSource.ts`, `web/src/dev/devConfig.ts`
- `web/src/dev/panels.ts` and the new inspector file(s)
- `web/src/data/**`
- `web/src/i18n/parts/learner.ts`

Not yours in this wave: `feed/FeedScreen.tsx` and the rest of the feed (A2), `src/tasks/` (B), `src/viewer/` (H), `learning/profile.ts` (stays until F2).

## 2. Checklist

Tick an item only when it is implemented **and** verified.

- [ ] `learner/params.ts` with every constant from SPEC §7.11
- [ ] BKT update + tests (all check modes)
- [ ] FSRS grade-at-exit + tests (incl. missing `card.exit`)
- [ ] Swipe rules (every row of SPEC §7.5) + tests
- [ ] Evidence ladder, `verified`, statuses with hysteresis + tests
- [ ] Tracks, unlocking, frontier, pacing, test-out + tests
- [ ] `createLearnerQueries()` answers every `LearnerQueries` list from the real state (stub replaced, `withContent()` kept) + tests of every list
- [ ] Selectors for D (predicted success, due reviews, inFlight and overdue counts, format preferences and mutes, `c`/`cf`/`ce`, target success, relearn and probe windows) and for F1 (XP, streak, cards today, per-unit receptive and productive progress, muted formats)
- [ ] v1 upcast folding; export → import equality test; incremental or memoised fold
- [ ] `feed/derived.ts` takes XP and streak from the state (same functions); the picker passes the learner's `ce`; dev "auto" challenge reads the sandbox state
- [ ] Dev learner-state inspector in the `dev/panels.ts` slot
- [ ] Strings in `i18n/parts/learner.ts`
- [ ] Gates green

## 3. Contract changes

Additive changes to `core/types.ts`, the learner queries, the `SignViewer` props, `feed/derived.ts` or the dev panel slot (SPEC §9.0.4, rule 2). None yet.

## 4. Cross-part edits

Edits outside the files above, kept minimal, so the integrator can expect the conflict. None yet.

## 5. Decisions

Format: `D-CNN · YYYY-MM-DD · decision` — *why* — status. None yet.

## 6. Open questions

Format: `Q-CNN` question — *Default: what you assumed meanwhile.* None yet.

## 7. Risks, known issues and stubs

Format: `R-CNN` description. None yet.

## 8. Integration checks (for the integrator)

- [ ] With B merged: dev mode plays every format with chosen content, and the feed finds content for each format.
- [ ] The XP and streak chip shows the same numbers as before on an existing log.

## 9. Session log

Newest first: date · what was done · verification · next step.

## 10. Handoff to the integrator

Written at the end of the part: what the branch contains, how it was verified (gates, browsers, devices), what needs the spec machine (MX Brio, Android phone), and follow-ups for other parts.
