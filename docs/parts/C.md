# Part C — Learner model v2

- **Status:** merged in `0e2fc81` (2026-11-22)
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

What the branch adds or changes (all under `web/src/`):

| File | What |
|---|---|
| `learner/params.ts` | every learner-model constant (§7.3–§7.7, §7.11) |
| `learner/bkt.ts` | BKT: check-mode table, retrieval and exposure updates |
| `learner/schedule.ts` | FSRS wrapper (ts-fsrs), grade at exit, retrievability |
| `learner/model.ts` | state types (`LearnerState`, `ItemState`, `ItemSkillState`, `FormatState`) and record helpers |
| `learner/curriculum.ts` | tracks, unlocking, frontier, test-out, pacing |
| `learner/swipes.ts` | what a card's exit does (§7.4–§7.6), `closeCard()` |
| `learner/state.ts` | the fold, open cards, snapshots, memoised incremental `learnerStateOf()` |
| `learner/selectors.ts` | read-only views for D and F1 |
| `learner/queries.ts` | the stub replaced: `createLearnerQueries()`, `queriesFor()`, `withContent()`, `walk()` |
| `learner/days.ts` | local day keys and streaks |
| `learner/testLog.ts` | log builder for tests (test support, not imported by the app) |
| `learner/*.test.ts` | 7 test files, 124 tests |
| `feed/derived.ts`, `feed/simplePicker.ts` | XP and streak from the state; the picker passes the learner's `ce` |
| `dev/forcedSource.ts`, `dev/devConfig.ts` | `autoCe`: forced play at the sandbox learner's `ce` |
| `dev/LearnerInspector.tsx`, `dev/learnerInspector.css`, `dev/ChallengeControl.tsx`, `dev/useLogEvents.ts`, `dev/panels.ts` | the learner-state inspector in the panel slot; the auto-challenge row |
| `i18n/parts/learner.ts` | the inspector's strings, English and Spanish |

## 2. Checklist

Tick an item only when it is implemented **and** verified.

- [x] `learner/params.ts` with every constant from SPEC §7.11 (the learner model's; the recommender's scoring constants go to `recommender/config.ts`, D-C02)
- [x] BKT update + tests (all check modes)
- [x] FSRS grade-at-exit + tests (incl. missing `card.exit`)
- [x] Swipe rules (every row of SPEC §7.5) + tests
- [x] Evidence ladder, `verified`, statuses with hysteresis + tests
- [x] Tracks, unlocking, frontier, pacing, test-out + tests
- [x] `createLearnerQueries()` answers every `LearnerQueries` list from the real state (stub replaced, `withContent()` kept) + tests of every list
- [x] Selectors for D (predicted success, due reviews, inFlight and overdue counts, format preferences and mutes, `c`/`cf`/`ce`, target success, relearn and probe windows) and for F1 (XP, streak, cards today, per-unit receptive and productive progress, muted formats)
- [x] v1 upcast folding; export → import equality test; incremental or memoised fold
- [x] `feed/derived.ts` takes XP and streak from the state (same functions); the picker passes the learner's `ce`; dev "auto" challenge reads the sandbox state
- [x] Dev learner-state inspector in the `dev/panels.ts` slot
- [x] Strings in `i18n/parts/learner.ts`
- [x] Gates green (2026-11-22, Windows 11, Node 26.13.1, npm 11.20.0): typecheck ✓, test ✓ (18 files, 206 tests), build ✓ (R-015 chunk warning only)

## 3. Contract changes

Additive changes to `core/types.ts`, the learner queries, the `SignViewer` props, `feed/derived.ts` or the dev panel slot (SPEC §9.0.4, rule 2).

1. **`LearnerQueries`: no new method, no signature change.** The lists now follow SPEC §7 (see the header of `learner/queries.ts`). Two comments in `core/types.ts` changed: `frontier` is round-robin across the open units (D-C08), and `GenContext.ce` now comes from the learner state.
2. **`learner/queries.ts`:** `createLearnerQueries(events, opts)`, `withContent()` and `walk()` keep their signatures. New: `QueryOptions.now?: number` (D-C12) and `queriesFor(state, opts)` (queries over a state the caller already holds, for D).
3. **New learner API for D and F1** (no existing contract touched): `learnerStateOf(events)` (memoised), `foldLearnerState(events)`, `createFold()` in `learner/state.ts`; the selectors in `learner/selectors.ts`; the types in `learner/model.ts`; `TRACKS`, `pacing()` and friends in `learner/curriculum.ts`.
4. **`feed/derived.ts`:** `cardHistory`, `feedStats` and `soundMuted` are unchanged; `dayKey` is now re-exported from `learner/days.ts`.
5. **Dev panel slot:** `DEV_PANELS` now holds `{ id: "learner" }`; D appends its own line.
6. **`dev/forcedSource.ts`:** `ForcedConfig.autoCe?: boolean` and `forcedCe(cfg, events)`; `dev/devConfig.ts` exports `sanitizeDevConfig` (for tests).
7. `learner/testing.ts`: unchanged (comment only), since no query method was added.

## 4. Cross-part edits

Edits outside the files above, kept minimal, so the integrator can expect the conflict.

- `web/src/dev/DevScreen.tsx` (no wave-1 owner; E owns it in wave 2): `ParamsPicker` receives the `sandbox` store, resolves `ce` with `useForcedCe()`, and its challenge `<label>` became `<ChallengeControl … />` (the slider plus an "auto" checkbox). About 8 lines.
- `web/src/core/types.ts`: the two comments of contract change 1.

## 5. Decisions

Format: `D-CNN · YYYY-MM-DD · decision` — *why* — status.

- **D-C01 · 2026-11-22 · The query contract stays as Part 0 froze it; D and F1 get a separate, richer API.** `learnerStateOf(events)` returns the `LearnerState`; pure selectors over it live in `learner/selectors.ts`; `queriesFor(state, opts)` builds the generator queries from it. — *B writes generators against the frozen interface, so new required methods would break its build at merge, and D's `recommend(state, ctx, rng)` takes the state anyway.* — active
- **D-C02 · 2026-11-22 · `learner/params.ts` holds every §7.11 constant that the learner model and its selectors use** (BKT table, thresholds, FSRS retention, challenge and swipe steps, target success, pacing, overdue cap, cooldown, relearn and probe windows, decay, mute rule, test-out). The recommender's scoring constants (weights 0.40/0.25/0.15/0.12/0.08, fit width 0.20, top-5 softmax at 0.05, the `need` values of §7.8.3) are left to `recommender/config.ts` (Part D). — *One config module per area (§7.11, §8.2); defining them twice invites drift; `src/recommender/**` belongs to D.* — active
- **D-C03 · 2026-11-22 · "Met" means evidence in either skill (watched, answered or claimed).** `status(id, skill)` follows §7.3 per skill (no evidence for that skill = new; a claim = learning; known and due come from the latch; due = R below 0.90). `practice(skill)` returns items met in either skill, and an item new for that skill ranks with the learning ones at pKnown 0. `pKnown()` returns 0 for a pair never met (the contract); `predictSuccess` uses the prior P0 for it. — *§4.4 asks for items "already met", and an item first met through a quiz must still reach productive practice.* — active
- **D-C04 · 2026-11-22 · `learner/` doesn't read the task registry.** A card's skills come from its evidence. For exits before any evidence, `formatSkills()` in `params.ts` decides: `lesson` → both skills, `question` → productive, any other format → receptive. Exits of formats whose id starts with `system-` or `dev-` change no learner state (a "too easy" swipe on the tutorial moves nothing). — *Formats and generators sit above `learner/`; importing the registry would create import cycles with B's specs. The convention covers B's four formats, and games have no target items.* — active
- **D-C05 · 2026-11-22 · `inFlight` counts items being learned (watched or answered, not known) once each, and leaves claims out.** Claims keep the status `learning`. — *§7.7 counts "items in status learning", and §7.3 counts claims as learning, but then a test-out (up to 7 claims at once) would block new lessons for the very learner self-placement should speed up (§7.12 metric 2).* — active (deviation from the literal spec)
- **D-C06 · 2026-11-22 · A self-graded answer weighs like a `self` check whatever mode it was logged in (`mirror` keeps its own row); a retrieval with check `none` counts as an exposure.** — *§4.2 makes self-grades the weakest evidence; e.g. J and Z confirmed by the learner inside a camera task.* — active
- **D-C07 · 2026-11-22 · FSRS settings: no fuzz, no short-term steps, request retention 0.90; cards stored as plain data (epoch ms); a review never goes back in time.** "Too easy" or "too hard" before completing, on a met item, creates the FSRS card if it is missing (§7.5 treats them as retrievals). — *Determinism; without short-term steps FSRS's own due date matches §7.3's "retrievability below 0.90".* — active
- **D-C08 · 2026-11-22 · The frontier is round-robin over the open units in curriculum order** (curriculum order inside each unit), after the signs that a "too hard" phrase asked for (latest ask first, then curriculum order, whatever their unit). Phrases appear only once eligible. — *§7.7 ("the first new items … of every open unit") and §7.8.1 ("one per open unit, up to 3"): a generator asking for 3 gets one per open unit.* — active
- **D-C09 · 2026-11-22 · Test-out counts claims in a row per unit (2) and per track (3).** A claim on another unit doesn't break a run; an ordinary exit (Next or Too hard) on a new item of the unit does; a completed lesson left "too easy" neither counts nor breaks. Three in a track test out the unit of the last claim. The verification probe flags 3 of the newly claimed items, spread over the unit (first, middle, last); the direct claims keep their own probes (Q-C01). — *With round-robin lessons, claims on two units alternate, so strictly consecutive claims would never trigger a test-out.* — active
- **D-C10 · 2026-11-22 · Units open and never close again; the phrases unit opens once a phrase is eligible; "pKnown ≥ 0.5" for unlocking takes the higher of the two skills; a test-out also opens its own unit.** — *A unit closing under a learner who started it would hide its frontier halfway; the spec gives the phrases unit no rule, and lessons never teach phrases.* — active
- **D-C11 · 2026-11-22 · The fold is incremental and memoised.** `learnerStateOf(events)` keeps the last 4 folds; when a log starts with the events of a folded one (same objects: logs are append-only), it applies only the new tail. Records are immutable; a snapshot copies the containers and closes the cards still open on the copy, with the default column. — *§8.4 allows it; measured on this PC: ~0.02 ms per appended event, against ~6 ms for refolding 2,000 events.* — active
- **D-C12 · 2026-11-22 · The queries' "now" is `opts.now`, else the time of the log's last event.** `app.open` is logged at every launch, so it is never older than the launch. — *Keeps the queries a pure function of the log (determinism, §7.12 metric 9) with no `Date.now()` inside `learner/`.* — active
- **D-C13 · 2026-11-22 · Self-graded answers never verify:** they count neither as a strong check nor as a day for "correct on 2 distinct days" (`correctDays` holds days with a checked correct answer). — *`verified` is demonstrated mastery (§7.1, Tutor MCP, learning-harness), and R-004.* — active
- **D-C14 · 2026-11-22 · Smaller rule details** (gaps in §7.4–§7.7; each is the smallest choice that keeps the rows of §7.5 true):
  - back-off fires at most once per card, and the run of wrong answers restarts after it; `state.backoff` keeps the item and card for D;
  - `cf` is clamped to [−1, 1] like `c`;
  - `format.unmute` also resets the dislikes, or the next dislike would mute the format again;
  - "too hard" before completing on a claimed item fails the claim (back to exposed, probe dropped);
  - a card closed without an exit is treated as Next (default FSRS column, alpha += 1 if completed) but doesn't break a test-out run;
  - "too easy" before completing on a met item leaves its evidence level alone (pKnown 0.85 makes it known);
  - the challenge and accuracy steps use the card's own share of correct retrievals, not `card.result.success`;
  - preferences decay at the close of each learning card, before that card's own update;
  - "cards today" counts completed cards (`card.result`) per local day (F1's daily goal, Q-003);
  - evidence that arrives outside an open card is applied at once, with the default grade. — active
- **D-C15 · 2026-11-22 · Dev "auto" challenge:** `ForcedConfig.autoCe` (kept with the dev config) makes forced play use the sandbox learner's `ce` for the forced format; the params row shows the value (`dev/ChallengeControl.tsx`, cross-part edit in `DevScreen.tsx`). — *SPEC Part C item 6.* — active

## 6. Open questions

Format: `Q-CNN` question — *Default: what you assumed meanwhile.*

- **Q-C01** SPEC §7.7 says a test-out queues "one verification probe: a quiz-choice over 3 claimed items", but a quiz-choice card has one target item. Should the probe be three quiz-choice cards, or one card that asks about 3 items? — *Default: Part C flags 3 claimed items (spread over the unit) in `probes()`; Part D shows them as probes, one quiz-choice card each, unless B or D adds a multi-item probe.*

## 7. Risks, known issues and stubs

Format: `R-CNN` description.

- **R-C01** On Windows under Git Bash, `npm test` (and `npx vitest run` without a file filter) fails at collection with "TypeError: Cannot read properties of undefined (reading 'config')" in every file, even on an untouched checkout. Single files pass there, and the whole suite passes from PowerShell or cmd. It's the environment, not the code. Run the gates from PowerShell on Windows.
- **R-C02** The model is untuned (as R-008). Productive skills checked by self-grading rise slowly (about 4 correct self-checks to reach known), and an item stays in flight until each skill it has met is known, so learners without a camera may get new lessons slowly. D's simulations should watch pacing (metrics 1, 3 and 8).
- **R-C03** `formatSkills()` (D-C04) treats any format other than `lesson*` and `question*` as receptive for swipes before evidence. A future format with target items that trains another way must be added there.
- **R-C04** A refold from scratch costs ~6 ms per 2,000 events on this PC (~150 ms for 50,000 events at app start). Hot paths must use the memoised `learnerStateOf()` / `createLearnerQueries()`, never `foldLearnerState()`. If logs grow very long, a persisted snapshot could come later.
- **R-C05** The memo relies on logs being append-only arrays of the same event objects (true for `LogStore`). Code that replaced an event in the middle of a log in place, keeping the first and last ones, would read a stale state. `replaceAll` (import, reset) creates new objects, so it is safe.
- **R-C06** The main chunk is now 1,711 kB (478 kB gzip), against R-015's 1.66 MB (462 kB gzip): ts-fsrs is bundled for the first time (before, the app only imported a type from `learning/profile.ts`), plus the learner model. F1 does the lazy loading (R-015).
- **R-C07** `learner/testLog.ts` is test support kept in `src/` (the app never imports it, so it isn't bundled). F2's dead-module cleanup should keep it.

## 8. Integration checks (for the integrator)

- [ ] With B merged: dev mode plays every format with chosen content, and the feed finds content for each format. At a cold start only lessons find content until items are met. That is expected, because questions and quizzes ask for met items (§7.8.5).
- [ ] With B merged: B's format ids fit the skill convention of D-C04 (`lesson` trains both skills, `question` productive, `quiz-*` receptive), and lessons log their exposure with `kind: "exposure"`.
- [ ] The XP and streak chip shows the same numbers as before on an existing log. A unit test compares the two folds on a varied log; look at the spec machine's real log too. — *2026-11-22, after the merge: on new logs, on desktop and phone emulation, the chip equals the old fold (the sum of `card.result` XP, streak 1). The real log in the user's Chrome profile is still to look at by hand.*
- [ ] When E edits `DevScreen.tsx` in wave 2: keep `ParamsPicker`'s `sandbox` prop, `useForcedCe()` and `<ChallengeControl>`.
- [x] Nothing to do with A2, A3 or H: Part C touched none of their files. — *Confirmed at the merge with A3: no shared file.*

## 9. Session log

Newest first: date · what was done · verification · next step.

- **2026-11-22 · Merged into `gesture_learning` as `0e2fc81`** (integrator), after `part-a3` (`725a508`). No conflicts, and every Part C file is identical to the branch.
  - Gates green on Linux (Node 22.23.5, npm 10.9.9): `npm ci` (lockfile unchanged), typecheck, test (20 files, 230 tests with A3), build.
  - Post-merge smoke check in headless Chrome 157, 44/44: the feed with every exit; the chip equal to the old fold; the learner inspector over the real log; the auto challenge (ce 0.00 on an empty sandbox); forced play writing only to `signa-dev`; no console errors.
  - *Next:* Part D (S1) starts from the new `gesture_learning`.

- **2026-11-22 · Part C — Learner model v2** (S1, Ashlie's PC, branch `part-c`)
  - *Setup:* Node 26.13.1, npm 11.20.0; `npm ci` (lockfile unchanged); `npm run setup:media` (98/98 clips, MediaPipe model; a few optional Wikimedia letter illustrations were rate-limited). Baseline from PowerShell: typecheck ✓, 84 tests ✓ (Git Bash fails, R-C01).
  - *Done:* the whole learner model of SPEC §7.3–§7.7 in `src/learner/` (params, BKT, FSRS with grade at exit, swipes, curriculum, fold, selectors), the stub queries replaced, XP and streak from the state, the picker's `ce`, dev auto challenge, the learner-state inspector, English and Spanish strings.
  - *Recorded:* D-C01–D-C15, Q-C01, R-C01–R-C07.
  - *Verification:* typecheck, test (18 files, 206 tests: 124 learner tests, replacing the 6 stub tests, plus new picker, derived and forced-source tests) and build green. 2,000-event log: full fold ~6 ms, appending ~0.02 ms per event, queries ~0.3 ms. Headless Chrome over the DevTools protocol against `npm run dev` (port 5174): tutorial, then 6 quiz cards with every exit; the XP/streak chip; the learner inspector over the real and sandbox logs at 412 px and 1100 px; the auto challenge (a sandbox at ce −0.92 gives 2 options); Spanish; no page-wide horizontal scroll; no console errors (only R-014's `THREE.Clock` warnings). 18/18 checks.
  - *Git:* the user committed the work as `ff199e2` ("part c"). At the user's request the agent pushed `part-c` to GitHub, over HTTPS with the stored Git Credential Manager login, because this PC has no SSH key for the `origin` remote (`git@github.com:…`); AGENTS.md rule 1 otherwise holds. The local branch has no upstream set; `git push origin part-c` needs an SSH key here.
  - *Next:* the integrator merges `part-c`; Part D (S1) starts from it.

## 10. Handoff to the integrator

**What the branch contains.** The learner model v2 (SPEC §7.3–§7.7) as a pure, tested fold over the v2 log, in `web/src/learner/`. The Part 0 stub queries are replaced behind the same `createLearnerQueries(events, opts)` / `withContent()` signatures. The feed's XP and streak now come from the state (same numbers). The simple picker hands each format its `ce`, and dev forced mode has an "auto" challenge. Dev mode has a learner-state inspector (sandbox, or the real log read-only). No new dependency; `package-lock.json` is untouched.

**How it was verified.** See the session log: gates green on Windows 11 (from PowerShell, R-C01), 124 learner unit tests (every row of the §7.4 and §7.5 tables, the BKT formulas, hysteresis, the ladder and `verified`, test-out, unlock rules, grade at exit with a missing `card.exit`, determinism, incremental = full fold, export → import, v1 logs, every query list), and 18 headless-Chrome checks with no console errors. Not checked: real devices (nothing device-specific changed).

**What needs the spec machine.** Nothing special. Run the gates on Linux, then the integration checks of §8, including the XP and streak chip on the real log there.

**Follow-ups for the other parts.**

- **D (recommender, S1):**
  - Take the state with `learnerStateOf(ctx.events)` (memoised; R-C04) and build generator queries with `queriesFor(state, { avoid, now })`.
  - Selectors: `predictSuccess` / `predictAll` / `predictMean`, `dueReviews`, `retrievabilityOf`, `pacing`, `inFlight`, `overdue`, `pacingAllowsNew`, `introducedCount`, `formatPreference`, `isMuted`, `mutedFormats`, `challenge`, `formatOffset`, `effectiveChallenge`, `targetSuccess`, `relearnWindow`, `probeWindow`, `errorsSince`, `dislikedSince`, `itemStatus`. `state.backoff` holds the last back-off.
  - Windows count in cards and are measured against the card being chosen (`state.cards + 1`).
  - `FeedContext` has no `now`: add one additively, or use `state.lastTs` (D-C12).
  - Scoring constants go to `recommender/config.ts` (D-C02).
  - Check D-C05 (claims don't count in flight) and Q-C01 (test-out probes) against metric 2.
- **F1 (settings sheet):** `xpOf`, `streakOf`, `cardsToday` (completed cards), `unitProgress` (receptive and productive mastery per unit, plus open and tested-out flags), `mutedFormats`, `bestScore`. Emitting `format.unmute` unmutes a format and resets its dislikes (D-C14).
- **B (learning formats):**
  - `practice(skill)` includes items met in the other skill only (D-C03).
  - `frontier()` gives one item per open unit first (D-C08).
  - Exposures should be logged as `kind: "exposure"`, and a self-confirmed answer as `selfGraded: true`, so it weighs like `self` (D-C06).
  - quiz-build evidence per sign plus the phrase id feeds both the signs and the phrase.
- **E (games):** game evidence that logs `options` gets the guess 1/n (else 0.25). `pool(skill, kinds, n, minPKnown)` returns met items, weakest first. The best `game.score` per format is in `state.gameBest` (`bestScore`).
