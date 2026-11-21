# Part E — Minigames

- **Status:** not started
- **Stream:** S2 "tasks" · Pol's laptop (Ubuntu 26.04) · wave 2 · branch `part-e`
- **Needs merged first:** B · **Better after:** C (real queries for the pools)
- **Spec:** [SPEC §9, Part E](../SPEC.md#part-e--minigames), plus §4.7, §3.7 (game sounds), §8.3; the parallel rules in [§9.0](../SPEC.md#90-parallel-plan)
- **Built at the same time as:** D (recommender, Ashlie), F1 (settings sheet and PWA, Max)

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
