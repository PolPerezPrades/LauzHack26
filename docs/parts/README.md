# Parts built in parallel

One state file per part that is built in parallel (SPEC §9.0): [A2](A2.md) · [A3](A3.md) · [B](B.md) · [C](C.md) · [H](H.md) · [B2](B2.md) · [D](D.md) · [E](E.md) · [F1](F1.md) · [F2](F2.md). The current wave is the demo sprint, below.

The agent doing a part keeps its file current: status, checklist, decisions, questions, risks, log and the handoff. The integrator reads the file when it merges the part's branch and folds it into `PROJECT_STATE.md`. Agents in a parallel part don't edit `PROJECT_STATE.md`, `docs/SPEC.md`, `AGENTS.md` or the READMEs.

## Conventions

- **Status** (top of the file): `not started` · `in progress` · `ready to merge` · `merged in <commit>`.
- **Ids** carry the part: decisions `D-B01`, questions `Q-B01`, risks `R-B01`. No renumbering at merge.
- **Contract changes** and **cross-part edits** are listed in their own sections, so the integrator can expect conflicts.
- Absolute dates (`YYYY-MM-DD`), file paths, no long logs or secrets.

## Starting a part (for the humans)

Once per machine:

```bash
git clone git@github.com:PolPerezPrades/LauzHack26.git   # Windows: use a fresh clone made after Part 0 (LF endings)
cd LauzHack26
git checkout gesture_learning
```

For each part:

```bash
git checkout gesture_learning && git pull
git checkout -b part-c            # the part's branch (SPEC §9.0.1)
# start the coding agent at the repository root and paste the part's prompt (below)
# when the agent reports green gates and an updated part file:
git add -A
git commit -m "Part C: learner model v2"
git push -u origin part-c
# then tell the integrator (Pablo)
```

A wave-2 part starts from `gesture_learning` once the integrator says the parts it needs are merged. If you are ready earlier, you MAY branch from your own finished branch instead (`git checkout part-c && git checkout -b part-d`); never rebase a branch you have pushed.

## Demo sprint prompts (2026-11-22, 10:10–11:10)

The demo is at about 11:30. Max's Mac is out (D-051). Three streams run at once, each from the new `gesture_learning` (with Part H merged): **B2** on Pol's laptop, **D1** on Ashlie's PC, **E1** on Pablo's laptop in a second agent session. Timeline: first working push by **10:45**, last push by **11:00**, integrator freeze at **11:10**, then only demo fixes. Push small and often: every push must build and pass the gates. After the demo, the same branches continue with their "Later increments".

Pol's laptop (B2):

```bash
git checkout gesture_learning && git pull && git checkout -b part-b2
```

Ashlie's PC (D1), over HTTPS. If `part-d` already has work, keep it and take the new base: `git checkout part-d && git fetch origin && git merge origin/gesture_learning`. Otherwise:

```bash
git checkout gesture_learning && git pull && git checkout -b part-d
```

Pablo's laptop (E1), in its own worktree so the integrator's checkout stays free:

```bash
cd ~/LauzHack26 && git worktree add -b part-e ../LauzHack26-e gesture_learning
cd ../LauzHack26-e/web && npm ci && cp -a ../../LauzHack26/web/public/media ../../LauzHack26/web/public/mediapipe public/
# start the second agent session in ~/LauzHack26-e; its dev server: npm run dev -- --port 5174
```

Every machine, at each increment: `git add -A && git commit -m "Part <id>: <increment>" && git push -u origin <branch>`, then tell the integrator.

### S2 · Pol's laptop · Part B2 "Hands-free practice", branch `part-b2`

```text
Do Part B2 (Hands-free practice) of Signa, and only that part. You are stream S2 on an Ubuntu laptop, branch part-b2, started from gesture_learning with Parts B and H merged (you built both). The demo is at 11:30: push a first working increment by 10:45 and the last by 11:00. Speed over completeness.

1. Read AGENTS.md, PROJECT_STATE.md §2 and decisions D-051–D-056 (§4), docs/SPEC.md §9.0.7, and docs/parts/B2.md (your state file and checklist). Skim B.md §10 for your own handoff.
2. Goal: the feed never asks the learner to record a clip or grade themselves. Hide the viewer's chips and credit line on feed cards (SignViewer controls={false} credit={false}, looping; #lab keeps them). Lessons move from watch to try by themselves. A camera try passes as soon as the hand holds the letter, or ends after tooLateMs (~8 s) as wrong with "Too late!" and the answer; A2's banner moves it on. Items with no detector rule (words, J, Z, numbers) get watch-only lessons and are never asked productively; their generators decline. Mirror and self-check stay for #dev only.
3. Edit only B2's files (B2.md §1). The feed, recommender, app, data and games belong to other agents working now (D1: Ashlie; E1: Pablo's laptop). New strings in web/src/i18n/parts/learning.ts (English and Spanish).
4. Check it in the browser with this laptop's webcam: a letter passes hands-free; a wrong hand shows "Too late!"; the camera-off path has no camera prompts.
5. Keep docs/parts/B2.md current (checklist, decisions D-B201…, risks, log, handoff). Don't edit PROJECT_STATE.md, the spec, AGENTS.md or the READMEs. Don't commit or push; I will.

At each increment: typecheck, test and build green, then tell me what changed, how you checked it, and what to test by hand.
```

### S1 · Ashlie's PC · Part D1 "Simple recommender", branch `part-d`

```text
Do Part D1 (Simple recommender) of Signa, and only that. You are stream S1 on a Windows 11 PC, branch part-d, on top of gesture_learning with Parts B, C (yours), A2, A3 and H merged. The demo is at 11:30: push a first working increment by 10:45 and the last by 11:00. Speed over completeness: rules, not the full scoring model.

1. Read AGENTS.md, PROJECT_STATE.md §2 and decisions D-051–D-056 (§4), docs/SPEC.md §9.0.7 and §7.9 (reasons), and docs/parts/D.md §0 (the D1 checklist; the rest of the file is for later). Your C.md handoff lists the learner API.
2. Build a rule-based card source in web/src/recommender/ and use it for the learner feed (app/): a fresh learner log per browser session (sessionStorage marker, D-054); teach before testing (a non-lesson card uses only items met in a lesson); at most one new item every 3 cards and none while recent accuracy is low; no same format twice in a row, no same item within 4 cards, failed items back after 2–3 cards; about 1 card in 5 a game from GAME_FORMATS when one is eligible (Part E1 fills that list right now); a fallback so the feed never stalls when generators decline (Part B2 makes them refuse words for productive cards). Every pick carries Reason[]. Constants in recommender/config.ts. Unit tests with learner/testLog.ts, including a learner who always fails.
3. Edit only D's files (D.md §1 and §0, plus src/data/** for the fresh profile). Tasks, viewer and games belong to the other agents working now (B2: Pol; E1: Pablo's laptop). Touch feed/FeedScreen.tsx only if unavoidable, minimally, keeping A2's countdown wiring. New strings in web/src/i18n/parts/recommender.ts. Run the gates from PowerShell (R-C01).
4. Check 20 cards by hand in the browser: no repeats, nothing asked before it was taught, a fresh profile in a new browser window.
5. Keep docs/parts/D.md current (checklist, decisions D-D01…, risks, log, handoff). Don't edit PROJECT_STATE.md, the spec, AGENTS.md or the READMEs. Don't commit or push; I will.

At each increment: typecheck, test and build green, then tell me what changed, how you checked it, and what to test by hand.
```

### S3 · Pablo's laptop (worktree `~/LauzHack26-e`) · Part E1 "Two quick games", branch `part-e`

```text
Do Part E1 (Two quick games) of Signa, and only that. You are stream S3 on an Ubuntu laptop, in the git worktree ~/LauzHack26-e on branch part-e, from gesture_learning with Parts B, C, A2, A3 and H merged. The integrator works in ~/LauzHack26 at the same time; don't touch that folder. Use the dev server on port 5174. The demo is at 11:30: push a first working increment by 10:45 and the last by 11:00. Speed over completeness.

1. Read AGENTS.md, PROJECT_STATE.md §2 and decisions D-051–D-056 (§4), docs/SPEC.md §9.0.7 and §4.7, docs/parts/B.md §10 (what you can reuse), and docs/parts/E.md §0 (the E1 checklist; the rest is for later). The old web/src/activities/SignRain.tsx and Matching.tsx are the references for the ports.
2. Build a minimal GameFrame (3-2-1 start on its own, HUD, end screen ~2 s, then the card's result, which A2's banner moves on) and game-rain (receptive, ~30 s, 3 misses), registered in GAME_FORMATS and playable from #dev. Items only from LearnerQueries (pool, confusions), with a fallback to the first curriculum unit when the learner knows fewer than 4 items. Evidence per item and a game.score. Then, if time allows, game-match (video or one shared viewer, not one 3D canvas per tile).
3. Edit only E1's files (E.md §0). Lessons, viewer, recommender, feed and data belong to the other agents working now (B2: Pol; D1: Ashlie; Part D1 picks games from GAME_FORMATS by itself). New strings in web/src/i18n/parts/games.ts (English and Spanish).
4. Play each game by hand at phone width, with the camera off too.
5. Keep docs/parts/E.md current (checklist, decisions D-E01…, risks, log, handoff). Don't edit PROJECT_STATE.md, the spec, AGENTS.md or the READMEs. Don't commit or push; I will.

At each increment: typecheck, test and build green, then tell me what changed, how you checked it, and what to test by hand.
```

## Wave 1 prompts

### S1 · Ashlie's PC (Windows 11) · Part C, branch `part-c`

```text
Do Part C (Learner model v2) of Signa, and only that part. You are stream S1 of a parallel plan, on a Windows 11 PC, on the git branch part-c.

1. Read AGENTS.md, PROJECT_STATE.md (§1 first), docs/SPEC.md §1–§2, §7, §8.3 and §9 (start with §9.0, then the Part C entry), and docs/parts/C.md, which is your state file.
2. Setup in web/: `node -v` must be 22.18 or newer. Then `npm ci` (never `npm install`) and `npm run setup:media`.
3. Other agents are building Part B (learning formats) and Parts A2 and H (feed, viewer) at the same time on other machines. Edit only the files Part C owns (SPEC §9.0.3) and keep every contract additive (§9.0.4). The stub in web/src/learner/queries.ts is yours to replace: keep createLearnerQueries(events, opts) and withContent() working, because Part B's generators call them.
4. Record everything in docs/parts/C.md: checklist, decisions D-C01…, questions, risks, log and handoff. Don't edit PROJECT_STATE.md, docs/SPEC.md, AGENTS.md or the READMEs.
5. Don't commit, push or create branches; I will.

Finish with typecheck, test and build green. Then tell me what you did, how you verified it, what I should test by hand, and what the integrator must know.
```

### S2 · Pol's laptop (Ubuntu 26.04) · Part B, branch `part-b`

```text
Do Part B (Learning task formats) of Signa, and only that part. You are stream S2 of a parallel plan, on an Ubuntu 26.04 laptop, on the git branch part-b.

1. Read AGENTS.md, PROJECT_STATE.md (§1 first), docs/SPEC.md §1–§2, §4.1–§4.6, §5, §8.3 and §9 (start with §9.0, then the Part B entry), and docs/parts/B.md, which is your state file. The old activities in web/src/activities/ are the references for the ports.
2. Setup: if `node -v` fails or is older than 22.18, install Node 22.23.5 in user space without sudo (the official linux-x64 tarball from https://nodejs.org/dist/v22.23.5/, unpacked under ~/.local, with its bin/ first on PATH). Then in web/: `npm ci` (never `npm install`) and `npm run setup:media`.
3. Other agents are building Part C (learner model) and Parts A2 and H (feed, viewer) at the same time on other machines. Edit only the files Part B owns (SPEC §9.0.3) and keep contracts additive (§9.0.4). In particular: pick items only through the LearnerQueries lists (a stub answers them until Part C lands; don't write another one), test generators with fakeQueries(), always report feedback in results (Part A2 makes every result auto-advance), use SignViewer as it is, and put new strings in web/src/i18n/parts/learning.ts.
4. Test the camera, mirror and self modes with this laptop's webcam (or Chrome's fake camera fed with a hand clip), and with the camera off.
5. Record everything in docs/parts/B.md: checklist, decisions D-B01…, questions, risks, log and handoff. Don't edit PROJECT_STATE.md, docs/SPEC.md, AGENTS.md or the READMEs.
6. Don't commit, push or create branches; I will.

Finish with typecheck, test and build green. Then tell me what you did, how you verified it, what I should test by hand, and what the integrator must know.
```

### S3 · Max's Mac (macOS) · Part A2, branch `part-a2`

```text
Do Part A2 (Feed feedback follow-ups) of Signa, and only that part. You are stream S3 of a parallel plan, on a Mac, on the git branch part-a2.

1. Read AGENTS.md, PROJECT_STATE.md (§1 first), docs/SPEC.md §1–§2, §3.3–§3.5 and §9 (start with §9.0, then the Part A2 entry), and docs/parts/A2.md, which is your state file.
2. Setup in web/: `node -v` must be 22.18 or newer (install Node 22 LTS if it isn't). Then `npm ci` (never `npm install`) and `npm run setup:media`.
3. Other agents are building Part B (learning formats) and Part C (learner model) at the same time on other machines. Edit only the files Part A2 owns (SPEC §9.0.3): the feed, the tutorial, and the core `feed` and `tutorial` strings.
4. Check the result in Chrome (desktop mouse and keyboard, phone emulation with touch, reduced motion) and in Safari.
5. Record everything in docs/parts/A2.md: checklist, decisions D-A201…, questions, risks, log and handoff. Don't edit PROJECT_STATE.md, docs/SPEC.md, AGENTS.md or the READMEs.
6. Don't commit, push or create branches; I will.

Finish with typecheck, test and build green. Then tell me what you did, how you verified it, what I should test by hand, and what the integrator must know.
```

### S3 · Max's Mac (macOS) · Part H, branch `part-h` (A2, B and C merged 2026-11-22)

Start from the new `gesture_learning` (`git checkout gesture_learning && git pull`, then `git checkout -b part-h`). If `part-h` already exists from an older base, merge `gesture_learning` into it instead (never a rebase, SPEC §9.0.2).

```text
Do Part H (Hand and avatar quality) of Signa, and only that part. You are stream S3 of a parallel plan, on a Mac, on the git branch part-h. It starts from gesture_learning with Parts A2 (yours), B, C and A3 merged.

1. Read AGENTS.md, PROJECT_STATE.md (§1 first), docs/SPEC.md §1–§2, §8.5–§8.6 and §9 (start with §9.0, then the Part H entry), docs/fase2.md (how the hand and the avatar are built today), docs/parts/B.md §10 (how Part B's task layouts use SignViewer), and docs/parts/H.md, which is your state file.
2. Setup in web/: `npm ci` and `npm run setup:media` (the clips are needed for the real-video comparison). To re-extract motion, install uv and run `uv run python web/scripts/extract_motion.py words` from the repository root.
3. Other agents are building Part D (recommender) and Part E (minigames) at the same time on other machines. Edit only the files Part H owns (SPEC §9.0.3): web/src/viewer/, the lab, the motion scripts and files, and only the `render` block of the sign files. SignViewer's props change only additively. Part B's task layouts rely on the .sv, .sv-stage, .sv-controls and .sv-credit class names: keep them, and check that the lesson, question and quiz cards still fit on a 320 × 568 screen, with the result banner showing too.
4. Start with the baseline: record the review set in #lab before changing anything. Show me before and after, side by side with the real video; I decide whether it looks good enough. Check Chrome and Safari, and keep 60 fps.
5. Record everything in docs/parts/H.md: checklist, decisions D-H01…, questions, risks, log and handoff. Don't edit PROJECT_STATE.md, docs/SPEC.md, AGENTS.md or the READMEs.
6. Don't commit, push or create branches; I will.

Finish with typecheck, test and build green. Then tell me what you did, how you verified it, what I should test by hand, and what the integrator must know.
```

### Integrator · Pablo's laptop · Part A3, branch `part-a3`

Done on the spec machine, because it needs the MX Brio. Same template as above, with SPEC §5.6 and the Part A3 entry, and `docs/parts/A3.md`.

## Wave 2 and later

Same template: the part, its stream and machine, the spec sections it lists, its part file, the parts working at the same time, and the files it owns. The integrator writes each prompt once the parts it needs are merged.

### S1 · Ashlie's PC (Windows 11) · Part D, branch `part-d` (Part C merged 2026-11-22)

Start from the new `gesture_learning` (`git checkout gesture_learning && git pull`, then `git checkout -b part-d`). This PC has no SSH key for `origin`, so pull and push over HTTPS, as for `part-c` (C.md §9).

**Update 2026-11-22: Parts B and A2 are merged.** Before D's edits in `feed/FeedScreen.tsx` and `feed/CardParts.tsx`, merge `gesture_learning` into `part-d` (`git checkout part-d && git fetch origin && git merge origin/gesture_learning`, never a rebase; R-027), then tell the agent:

```text
Parts B (learning formats) and A2 (feed feedback) are now merged into part-d. Before you edit feed/FeedScreen.tsx and feed/CardParts.tsx, read docs/parts/A2.md (§3 and §8) and docs/parts/B.md (§7 and §10). Keep A2's countdown wiring: countdown.start in report, countdown.cancel in exit, hold/release from onPress, onPressEnd and onRelease, and the visibility effect; CardStack no longer has onDragStart. Two Part B risks are yours. R-B01: the picker queues the same lesson twice at a cold start, so the card source must avoid the items of the queued cards. R-B02: show the "can't use the camera now" header button only while the camera is usable. Since Part B, the real formats take their items from the learner lists, and only lessons find content at a cold start. Record what you change in docs/parts/D.md.
```

```text
Do Part D (Recommender) of Signa, and only that part. You are stream S1 of a parallel plan, on a Windows 11 PC, on the git branch part-d. It starts from gesture_learning with Part C (the learner model you built) and Part A3 merged.

1. Read AGENTS.md, PROJECT_STATE.md (§1 first), docs/SPEC.md §1–§2, §3.4, §7.8–§7.12, §8.3 and §9 (start with §9.0, then the Part D entry), docs/parts/C.md (its handoff lists the learner API for you), and docs/parts/D.md, which is your state file.
2. Setup in web/: `npm ci` (never `npm install`). Run the gates from PowerShell, not Git Bash (R-C01).
3. Other agents are building Part B (learning formats) and Parts A2, then H (feed, viewer), at the same time on other machines. Edit only the files Part D owns (SPEC §9.0.3, docs/parts/D.md §1) and keep contracts additive (§9.0.4). Part A2 owns feed/FeedScreen.tsx and feed/CardParts.tsx until it is merged (R-027). Build the recommender, the simulations and the inspector first, and make your edits in those two files last and small. If gesture_learning has Part A2 by then, tell me, and I will merge it into part-d before you start them.
4. Take the learner state with learnerStateOf(ctx.events), and build generator queries with queriesFor(state, opts). Scoring constants go to recommender/config.ts (D-C02). New strings go to web/src/i18n/parts/recommender.ts. The only package.json change is the simulate script.
5. Record everything in docs/parts/D.md: checklist, decisions D-D01…, questions, risks, log and handoff. Don't edit PROJECT_STATE.md, docs/SPEC.md, AGENTS.md or the READMEs.
6. Don't commit, push or create branches; I will.

Finish with typecheck, test and build green. Then tell me what you did, how you verified it, what I should test by hand, and what the integrator must know.
```

### S2 · Pol's laptop (Ubuntu 26.04) · Part E, branch `part-e` (Part B merged 2026-11-22)

Start from the new `gesture_learning` (`git checkout gesture_learning && git pull`, then `git checkout -b part-e`).

```text
Do Part E (Minigames) of Signa, and only that part. You are stream S2 of a parallel plan, on an Ubuntu 26.04 laptop, on the git branch part-e. It starts from gesture_learning with Part B (the learning formats you built), Part C (the learner model), Part A2 (feed feedback) and Part A3 merged.

1. Read AGENTS.md, PROJECT_STATE.md (§1 first), docs/SPEC.md §1–§2, §3.7, §4.7, §8.3 and §9 (start with §9.0, then the Part E entry), docs/parts/B.md §10 (what Part E can reuse), docs/parts/C.md §8, and docs/parts/E.md, which is your state file. The old activities in web/src/activities/ are the references for the ports.
2. Setup in web/: `npm ci` (never `npm install`) and `npm run setup:media`.
3. Other agents are building Part D (recommender) and Parts H, then F1 (viewer; settings sheet and PWA), at the same time on other machines. Edit only the files Part E owns (SPEC §9.0.3, docs/parts/E.md §1) and keep contracts additive (§9.0.4). As in Part B: pick items only through the LearnerQueries lists (pool() and confusions() for the games), test generators with fakeQueries() and tasks/testing.ts, and reuse tasks/ui/. Put the number rules behind hasCameraRule(), evaluateSign() and matchingSigns() in lib/handshapes.ts. A game's end result carries its score and feedback: the feed waits 2.5 s on it, then moves on. When you edit dev/DevScreen.tsx, keep ParamsPicker's sandbox prop, useForcedCe() and <ChallengeControl> (Part C). New strings go to web/src/i18n/parts/games.ts.
4. Test the camera games with this laptop's webcam (or Chrome's fake camera fed with a hand clip), and with the camera off.
5. Record everything in docs/parts/E.md: checklist, decisions D-E01…, questions, risks, log and handoff. Don't edit PROJECT_STATE.md, docs/SPEC.md, AGENTS.md or the READMEs.
6. Don't commit, push or create branches; I will.

Finish with typecheck, test and build green. Then tell me what you did, how you verified it, what I should test by hand, and what the integrator must know.
```

### S3 · Max's Mac (macOS) · Part F1, branch `part-f1` (after Part H; C and A2 merged 2026-11-22)

Start from `gesture_learning` once Part H is committed and pushed (ideally merged), as for H.

```text
Do Part F1 (Settings sheet and PWA) of Signa, and only that part. You are stream S3 of a parallel plan, on a Mac, on the git branch part-f1. It starts from gesture_learning with Parts C, A2, A3 and B merged, and Part H once it is.

1. Read AGENTS.md, PROJECT_STATE.md (§1 first), docs/SPEC.md §1–§2, §1.4, §3.6, §3.7, §8.6 and §9 (start with §9.0, then the Part F1 entry), docs/parts/C.md §10 (the learner API for the progress sheet), docs/parts/A3.md §8, and docs/parts/F1.md, which is your state file.
2. Setup in web/: `npm ci` (never `npm install`) and `npm run setup:media`.
3. Other agents are building Part D (recommender) and Part E (minigames) at the same time on other machines. Edit only the files Part F1 owns (SPEC §9.0.3, docs/parts/F1.md §1) and keep contracts additive (§9.0.4). In feed/FeedScreen.tsx, change only the <FeedTop …/> line: Part D owns the rest. A camera picker must open cameras through switchCamera() or acquireCamera() in lib/camera.ts, never a raw getUserMedia, and lib/camera.test.ts must keep passing (Part A3). Read the learner state through learnerStateOf() and the selectors (Part C). New strings go to web/src/i18n/parts/settings.ts.
4. Check the sheet and installing the app in Chrome and Safari.
5. Record everything in docs/parts/F1.md: checklist, decisions D-F101…, questions, risks, log and handoff. Don't edit PROJECT_STATE.md, docs/SPEC.md, AGENTS.md or the READMEs.
6. Don't commit, push or create branches; I will.

Finish with typecheck, test and build green. Then tell me what you did, how you verified it, what I should test by hand, and what the integrator must know.
```
