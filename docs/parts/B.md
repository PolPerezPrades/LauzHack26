# Part B — Learning task formats

- **Status:** not started
- **Stream:** S2 "tasks" · Pol's laptop (Ubuntu 26.04) · wave 1 · branch `part-b`
- **Needs merged first:** Part 0 · **Better after:** A2 (every result auto-advances)
- **Spec:** [SPEC §9, Part B](../SPEC.md#part-b--learning-task-formats), plus §4.1–§4.6, §5, §8.3; the parallel rules in [§9.0](../SPEC.md#90-parallel-plan)
- **Built at the same time as:** C (learner model, Ashlie: owns `learner/`, the simple picker and the forced source), A2 then H (feed and viewer, Max), A3 (integrator)

This is the part's state file (SPEC §9.0.4). Keep it current while you work. The integrator reads it when merging the branch and folds it into `PROJECT_STATE.md`; don't edit that file, the spec, `AGENTS.md` or the READMEs.

## 1. Files this part owns

From SPEC §9.0.3; new files in these folders are fine too.

- `web/src/tasks/learningFormats.ts`, `learningViews.tsx`, `web/src/tasks/ui/**` (except `GameFrame*`), `web/src/tasks/{lesson,question,quiz-choice,quiz-build}/`
- `web/src/camera/checkMode.ts` (new), `web/src/camera/cameraSession.ts` (only if needed)
- `web/src/lib/handshapes.ts`, `web/src/lib/engine.ts`, `web/src/components/CameraView.tsx`
- `web/content/signs/*.json` (`description`, `translations` only), `web/content/curriculum.json`, `web/src/content/curriculum.ts`
- `web/src/i18n/parts/learning.ts`, and the core `quiz` section of `en.ts`/`es.ts`

Not yours in this wave: the feed and the tutorial (A2), `src/viewer/` and the `render` block of sign files (H), `src/learner/`, `feed/simplePicker.ts`, `dev/forcedSource.ts` (C).

## 2. Checklist

Tick an item only when it is implemented **and** verified.

- [ ] Shared UI in `tasks/ui/`: TaskFrame (with task progress), ChoiceGrid, TileBank, SelfCheck, MirrorCompare
- [ ] `checkModeFor()` in `camera/checkMode.ts` + tests
- [ ] `lesson` (camera / mirror / self, relearn variant)
- [ ] `question`: sign-term, sign-sentence, spell-word (all modes)
- [ ] `quiz-choice` polish: all content kinds, similarity and confusion distractors, replay and slow-motion params; items from `probes`, then `practice`
- [ ] `quiz-build` (gloss mode; translation mode optional, only with authored `tokens`)
- [ ] Generators use only the `LearnerQueries` lists (Part 0 stub); tests with `fakeQueries()`
- [ ] Every result carries `feedback`
- [ ] Evidence mapping tests (skill, check mode, `selfGraded`, items)
- [ ] English for the letter descriptions (`description.en`, faithful) and the handshape hints (moved to i18n) (R-020)
- [ ] Formats registered in `learningFormats.ts` / `learningViews.tsx`; strings in `i18n/parts/learning.ts`
- [ ] Manual checks in dev mode, every content kind, camera on and off; mirror clips never persisted and released on exit
- [ ] The simple picker rotates through all formats
- [ ] Gates green

## 3. Contract changes

Additive changes to `core/types.ts`, the learner queries, the `SignViewer` props, `feed/derived.ts` or the dev panel slot (SPEC §9.0.4, rule 2). None yet.

## 4. Cross-part edits

Edits outside the files above, kept minimal, so the integrator can expect the conflict. None yet.

## 5. Decisions

Format: `D-BNN · YYYY-MM-DD · decision` — *why* — status. None yet.

## 6. Open questions

Format: `Q-BNN` question — *Default: what you assumed meanwhile.* None yet.

## 7. Risks, known issues and stubs

Format: `R-BNN` description. None yet.

## 8. Integration checks (for the integrator)

- [ ] With A2: the banner and auto-advance after every format's result.
- [ ] With C: the formats still find content with the real queries, in the feed and in dev forced mode.
- [ ] With H: the new viewer fits the lesson, question and quiz layouts on a 320 × 568 screen.

## 9. Session log

Newest first: date · what was done · verification · next step.

## 10. Handoff to the integrator

Written at the end of the part: what the branch contains, how it was verified (gates, browsers, devices), what needs the spec machine (MX Brio, Android phone), and follow-ups for other parts.
