# Part E — Minigames

- **Status:** not started · demo cut E1 first (§0)
- **Stream:** S3 · **Pablo's laptop (Ubuntu 26.04), second agent session in the worktree `~/LauzHack26-e`** (was S2 · Pol, D-051) · demo sprint · branch `part-e`
- **Needs merged first:** B · **Better after:** C (real queries for the pools)
- **Spec:** [SPEC §9, Part E](../SPEC.md#part-e--minigames), plus §4.7, §3.7 (game sounds), §8.3; the parallel rules in [§9.0](../SPEC.md#90-parallel-plan)
- **Built at the same time as:** D (recommender, Ashlie), F1 (settings sheet and PWA, Max)

## 0. Demo cut: E1 "two quick games" (2026-11-22, D-056)

E moves to **Pablo's laptop** (stream S3, a second agent session in its own worktree, D-051), because Pol takes B2. The demo is on 2026-11-22 at about 11:30 (SPEC §9.0.7). Push a first working increment by **10:45** and the last by **11:00**; the integrator freezes `gesture_learning` at 11:10. The full checklist below becomes later increments E2+.

Owned for E1: `src/tasks/gameFormats.ts`, `gameViews.tsx`, `src/tasks/game-*/`, `src/tasks/ui/GameFrame*`, `src/sound/effects.ts`, `src/i18n/parts/games.ts`. **Not** in E1: `lib/handshapes.ts` and `camera/checkMode.ts` (the number rules move to B2's later increments), `dev/DevScreen.tsx`, the content files (story and dialogue are later).

**Update 10:40 (integrator):** `game-rain` is already built on `gesture_learning` (`web/src/tasks/game-rain/`: letter signs fall, tap the letter, a 10 s clock that hits extend and wrong taps cut, faster with survival), and so is `game-grid` (`web/src/tasks/game-grid/`: a 3×3 board of letter signs, find one letter at a time, same clock); and `game-wordsearch` (two modes: a word in letters on a 3×3 board of signs, or a fingerspelled word on a 5×5 board of letters); all registered in `GAME_FORMATS`, and the picker allows at most one game in 4 cards. Merge `gesture_learning` into `part-e` first, don't rebuild it: start with `game-match`, and reuse `game-rain`'s pattern.

**First increment (by 10:45)**

- [ ] `GameFrame`: a 3-2-1 start that runs on its own, a HUD (score, time left), an end screen with the score for about 2 s, then the card's result, which A2's banner moves on. No start button. Game sounds in `sound/effects.ts` (reuse the existing synth).
- [ ] `game-rain` (from the old `activities/SignRain.tsx`): signs fall, the learner taps the matching word; receptive, no camera; about 30 s, at most 3 misses.
- [ ] Registered in `GAME_FORMATS`, playable from `#dev` (forced format), reports evidence for every item and a `game.score`, ends within its time limit, works with the camera off.
- [ ] Items only from `LearnerQueries` (`pool()` of known items, `confusions()` for wrong options), with a small fallback set (the first curriculum unit) when the learner knows fewer than 4 items, so a fresh profile can still play. Generator tests with `fakeQueries()`.
- [ ] Gates green; played by hand in the browser at phone width.

**Second increment (by 11:00, if the first is in)**

- [ ] `game-match` (from `activities/Matching.tsx`): pair 4 signs with 4 words against the clock. Use video or one shared viewer, not one 3D canvas per tile (WebGL context budget, §8).

**Later increments (after the demo):** a camera game (spell sprint, using B2's hands-free check), memory, the rest of §2.

This is the part's state file (SPEC §9.0.4). Keep it current while you work. The integrator reads it when merging the branch and folds it into `PROJECT_STATE.md`; don't edit that file, the spec, `AGENTS.md` or the READMEs.

## 1. Files this part owns

From SPEC §9.0.3; new files in these folders are fine too.

- `web/src/tasks/gameFormats.ts`, `gameViews.tsx`, `web/src/tasks/game-*/`, `web/src/tasks/ui/GameFrame*`; reuse of `tasks/ui/` (e.g. `TileBank`)
- `web/src/camera/checkMode.ts` (numbers → camera), `web/src/lib/handshapes.ts` (number rules), `web/src/lib/engine.ts`, `web/src/components/CameraView.tsx`
- `web/src/sound/effects.ts` (game sounds)
- `web/content/comprehension.json`, `web/content/dialogues.json`, `web/src/content/scenarios.ts`
- `web/src/dev/DevScreen.tsx` (content picker for passages and dialogues), `web/src/dev/forcedSource.ts` and `devConfig.ts` (forced content)
- `web/src/i18n/parts/games.ts`; a new calibration script in `web/scripts/` (run with `node`, no `package.json` change)

Not yours in this wave: `src/recommender/`, `app/`, the feed (D); `sound/engine.ts`, `FeedTop.tsx` (F1); the old `activities/` (read-only, F2 deletes them).

## 2. Checklist

Tick an item only when it is implemented **and** verified.

- [ ] GameFrame (intro, countdown, HUD, end screen, personal best) + game sounds in `sound/effects.ts`
- [ ] English for `comprehension.json` and `dialogues.json` before story and dialogue are ported (R-020)
- [ ] Ported: rain, memory, match, spell-read, spell-sprint, story, dialogue (dialogue with Part B's TileBank)
- [ ] Number handshape rules (1–9), calibrated on `public/motion/num-*.json` with a Node script, limits documented; `checkModeFor` returns `camera` for them
- [ ] New: count-up, abc-run
- [ ] At least two backlog games (`game-minimal-pairs` recommended)
- [ ] Dev mode: content picker for passages and dialogues; forced content
- [ ] Every game playable from dev mode, ends within its time limit, reports evidence and `game.score`, respects the camera gate
- [ ] Gates green

## 3. Contract changes

Additive changes to `core/types.ts`, the learner queries, the `SignViewer` props, `feed/derived.ts` or the dev panel slot (SPEC §9.0.4, rule 2). None yet.

## 4. Cross-part edits

Edits outside the files above, kept minimal, so the integrator can expect the conflict. None yet.

## 5. Decisions

Format: `D-ENN · YYYY-MM-DD · decision` — *why* — status. None yet.

## 6. Open questions

Format: `Q-ENN` question — *Default: what you assumed meanwhile.* None yet.

## 7. Risks, known issues and stubs

Format: `R-ENN` description. None yet.

## 8. Integration checks (for the integrator)

- [ ] With D merged: simulation metric 6 still passes and metric 4 runs with `game-rain`; the recommender offers games by cadence and eligibility.
- [ ] WebGL context count on the memory and match boards (F2 checks the budget on the phone).

## 9. Session log

Newest first: date · what was done · verification · next step.

## 10. Handoff to the integrator

Written at the end of the part: what the branch contains, how it was verified (gates, browsers, devices), what needs the spec machine (MX Brio, Android phone), and follow-ups for other parts.
