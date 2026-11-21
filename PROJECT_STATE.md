# PROJECT_STATE — Signa redesign

Living record of progress, decisions and handoffs for the redesign described in [`docs/SPEC.md`](docs/SPEC.md). It exists so that context survives between agent sessions.

## Index

1. [Instructions for agents (read first)](#1-instructions-for-agents-read-first)
2. [Snapshot](#2-snapshot)
3. [Part checklists](#3-part-checklists)
4. [Decisions](#4-decisions)
5. [Open questions for the user](#5-open-questions-for-the-user)
6. [Risks, known issues and tech debt](#6-risks-known-issues-and-tech-debt)
7. [Session log](#7-session-log)

---

## 1. Instructions for agents (read first)

You are continuing a multi-session project. **This file is the project's memory.** Anything not written here is lost when your session ends. Keep it accurate and up to date as the project advances.

**At the start of a session**

1. Read [`AGENTS.md`](AGENTS.md), then this file (at least §2 Snapshot, the checklist of the part you were asked to do, §4 Decisions and §5 Open questions), then the relevant sections of [`docs/SPEC.md`](docs/SPEC.md).
2. If this file and the spec disagree, this file wins (decisions here are newer). If the user's request disagrees with both, the user wins: record the change as a decision.
3. Work only on the part the user asked for.

**While working** — update this file when something happens that a future session must know, not only at the end:

- tick a checklist item (`- [x]`) as soon as it is done *and verified*; add sub-items if a task turned out bigger;
- add a decision to §4 when you choose between options, deviate from the spec, tune a constant, or add a dependency;
- add to §5 any question only the user can answer, with the default you assumed meanwhile;
- add to §6 risks, bugs you found but didn't fix, shortcuts and temporary stubs.

**At the end of a session (mandatory, before your final reply)**

1. Run the quality gates (`npm run typecheck`, `npm test`, `npm run build` in `web/`) and record the result in §2.
2. Rewrite §2 Snapshot: current part and status, what works now, and **the exact next step**.
3. Add one entry at the **top** of §7 Session log.
4. Tell the user what you did, what's left, and anything they must decide or test by hand.

**Style rules**

- Be brief and factual. Use absolute dates (`YYYY-MM-DD`), file paths and commit hashes (when the user has committed), never "today" or "recently".
- §2 is overwritten every session; §4 and §7 are append-only (mark superseded decisions as `superseded by D-0xx` instead of deleting them).
- When §7 grows past ~30 entries, move the oldest ones to `docs/state-archive.md` and link it.
- Don't paste long logs, secrets or personal data. Link files instead.
- Never commit or push (see `AGENTS.md`). Note in §7 that the user still needs to commit.

---

## 2. Snapshot

- **Last updated:** 2026-11-21
- **Active part:** Part A — Feed foundation, **implemented**, plus a follow-up at the user's request: the UI is now **English by default, with Spanish from an EN | ES switch** (D-038). Every automated acceptance check passes. The checks on real devices (phone, installed app, desktop webcam) are still open (§3 Part A, R-016).
- **Branch:** `gesture_learning`. The last commit is `487b451` ("spec"). Part A is **not committed**: it is in the working tree for the user to review and commit.
- **What works now:** `/` opens the vertical feed. The first launch shows the gesture tutorial, then quiz-choice cards that walk the curriculum in order. The four exits work by swipe (touch, mouse), by the action-bar buttons and by the arrow keys; Next only works after completion. All exits share one animation; short drags spring back; stamps show the drag direction; reduced motion gets fades. Feedback appears inside the card: a correct answer auto-advances after 1.2 s, a wrong one waits. Sounds are synthesised, with a mute toggle. Event log v2 records `app.open`, `card.shown`, `evidence`, `card.result`, `card.exit`, `camera.off` and `settings.set`. `#dev` is dev mode v1 (forced play into `signa-dev`, camera on/off, params, event-log inspector); `#dev/play` is the forced feed; `#lab` works as before. The EN | ES switch sits in the feed overlay, dev mode and the lab; the choice is saved per device and applies at once, without logging anything or changing the current card.
- **Quality gates (2026-11-21):**
  - `npm run typecheck` ✓; `npm test` ✓ (11 files, 78 tests); `npm run build` ✓ (one chunk-size warning, R-015); `npm start` ✓ on Node 22.23.5.
  - 166 browser checks pass in headless Chromium (Playwright, run from the session scratchpad, not kept in the repo): desktop mouse and keyboard, phone touch emulation, a fake camera, a real hand clip through MediaPipe, reduced motion, 4 screen sizes, and the language switch (50 checks: default English, live switch, persistence, keyboard, word and phrase labels, dev mode, lab, top bar at 320 px). The whole suite was rerun in English after the switch was added.
  - No console errors. The only warnings come from libraries (R-014).
- **Toolchain:** this machine has no Node.js (R-013). The session used a temporary Node 22.23.5 with npm 11.21.2 (D-036, Q-007).
- **Next step:**
  1. The user tests Part A by hand (see the open items of §3 Part A), including the language switch, and commits.
  2. Then implement **Part B — Learning task formats** ([`docs/SPEC.md` §9](docs/SPEC.md#part-b--learning-task-formats)). Start with the shared task UI in `src/tasks/ui/` and `checkModeFor()` in `src/camera/checkMode.ts`, both on top of the contracts in `src/core/types.ts`.

| Part | Title | Status |
|---|---|---|
| A | Feed foundation | done with known gaps (see §6: R-016, real-device checks) |
| B | Learning task formats | not started |
| C | Learner model v2 | not started |
| D | Recommender | not started |
| E | Minigames | not started |
| F | Product polish and cleanup | not started |
| G | Optional extensions | not planned |

Status values: `not started` · `in progress` · `done` · `done with known gaps (see §6)` · `blocked (see §5)`.

---

## 3. Part checklists

Tick items only when they are implemented **and** verified. The acceptance criteria are in the spec. These lists track the work.

### Part A — Feed foundation

- [x] `npm install` done; Vitest added (exact version, older than the `.npmrc` cutoff) with an `npm test` script (Vitest 5.1.0, D-023)
- [x] `src/core/` contracts (TaskSpec, CardPlan, TaskViewProps, TaskResult, EvidenceDraft, CardSource) + seeded RNG (D-024)
- [x] Event log v2: new event types, `EVENT_SCHEMA_VERSION = 2`, v1 upcaster, tests (D-025)
- [x] Feed shell: viewport layout, two-card stack with preview behind
- [x] `swipe.ts` pure decision + tests; `useSwipe` hook (touch, mouse) (D-031)
- [x] Four exits with one shared animation; spring-back; drag stamps; reduced motion
- [x] Action bar buttons + keyboard shortcuts (ignored in text inputs)
- [x] Feedback overlay + auto-advance rules; swipes after completion (D-029)
- [x] Mobile guards (touch-action, overscroll, margins)
- [x] Event logging: `app.open`, `card.shown`, `evidence`, `card.result`, `card.exit`
- [x] Camera session store + "no camera now" button + `camera.off` + sessionStorage + filtering (D-032)
- [x] Formats: `system-tutorial`, `quiz-choice`, `dev-camera-probe` (D-030)
- [x] `simplePicker` card source (+ camera filtering test)
- [x] Dev mode v1 (`#dev`): format/content/params pickers, camera simulation, forced mode, sandbox DB `signa-dev`, event-log inspector (D-034)
- [x] Routing (feed default, `#lab`, `#dev`); old screens deleted
- [x] `src/i18n/` used by all new UI
  - [x] follow-up: English (default) and Spanish, with an EN | ES switch in the feed overlay, dev mode and the lab; content titles and grammar notes in both languages (D-038–D-040)
- [x] Sound engine (`src/sound/`): exit, threshold, spring-back, settle, correct/wrong sounds; unlock on first gesture; mute toggle
- [x] Camera selection: front camera on phones, webcam on desktop (saved choice, MX Brio preference). Checked with emulation and a fake camera. The MX Brio branch is unchanged code and was not tested (no Brio attached).
- [ ] Vertical layout checked on desktop (incl. landscape window), phone browser and standalone mode
  - [x] desktop windows 1920×1080, 1280×800, 1024×600 and 700×900 (Playwright)
  - [x] phone emulation 320×568, 375×667 and 412×915 (Pixel 7), with touch
  - [ ] real phone browser and installed app (standalone), by hand (R-016)
- [ ] Gates green; manual acceptance checks from the spec done
  - [x] typecheck, test and build; the automated acceptance checks in Chromium (2026-11-21)
  - [ ] manual checks on a real phone (front camera, touch feel, sounds) and on the desktop webcam (camera indicator light, MX Brio)

### Part B — Learning task formats

- [ ] Shared UI: TaskFrame, ChoiceGrid, TileBank, SelfCheck, MirrorCompare
- [ ] `checkModeFor()` + tests
- [ ] `lesson` (camera / mirror / self, relearn variant)
- [ ] `question`: sign-term, sign-sentence, spell-word (all modes)
- [ ] `quiz-choice` polish (all content kinds, distractor rules, params)
- [ ] `quiz-build` (gloss mode; translation mode optional)
- [ ] Generators with a stub query adapter
- [ ] Evidence mapping tests
- [ ] English for the content Part B shows: letter descriptions (`description.en`) and the handshape hints of `lib/handshapes.ts` (R-020)
- [ ] Gates green; manual checks with camera on and off

### Part C — Learner model v2

- [ ] `learner/params.ts` with every constant from SPEC §7.11
- [ ] BKT update + tests (all check modes)
- [ ] FSRS grade-at-exit + tests (incl. missing `card.exit`)
- [ ] Swipe rules (every row of SPEC §7.5) + tests
- [ ] Evidence ladder, `verified`, statuses with hysteresis + tests
- [ ] Tracks, unlocking, frontier, pacing, test-out + tests
- [ ] Queries for the recommender
- [ ] v1 upcast folding; export → import equality test; incremental fold
- [ ] Generators switched to real queries; `learning/profile.ts` removed if unused
- [ ] Dev learner-state inspector
- [ ] Gates green

### Part D — Recommender

- [ ] Candidates, features, score, hard constraints, seeded softmax selection
- [ ] Explanations + ℹ button with Spanish reasons
- [ ] Recommender `CardSource` + queue invalidation
- [ ] Simulation harness + personas + `npm run simulate`
- [ ] All 10 metrics of SPEC §7.12 pass as tests
- [ ] Dev recommender inspector (breakdown, force next, seed, simulate)
- [ ] `learning/orchestrator.ts` removed
- [ ] Gates green; manual feel check

### Part E — Minigames

- [ ] GameFrame (intro, countdown, HUD, end screen, personal best) + game sounds
- [ ] Ported: rain, memory, match, spell-read, spell-sprint, story, dialogue
- [ ] English for `comprehension.json` and `dialogues.json` before story and dialogue are ported (R-020)
- [ ] Number handshape rules (1–9) + documented limits
- [ ] New: count-up, abc-run
- [ ] At least two backlog games
- [ ] Old `activities/` and `activityCatalog.ts` removed
- [ ] Gates green; every game playable from dev mode

### Part F — Product polish and cleanup

- [ ] Settings and progress sheet (unmute, camera re-enable and picker, sound/haptics, data, about, dev entry)
- [ ] PWA (manifest, icons, standalone, offline shell and content)
- [ ] Real-device check of the three targets (desktop webcam, phone browser front camera, installed app) + `docs/embedding.md`
- [ ] Performance pass (WebGL budget, prefetch, lazy chunks, 60 fps check)
- [ ] Accessibility pass
- [ ] Dead code and CSS removed; `web/README.md` and `README.md` updated
- [ ] (optional) Playwright smoke tests
- [ ] Gates green

### Part G — Optional extensions

- [ ] G1 experimental word-sign check (only if asked)
- [ ] G2 LLM features (only if asked)
- [ ] G3 content growth (only if asked)

---

## 4. Decisions

Format: `D-NNN · date · decision` — *why* — status. Newest at the bottom. Don't delete; mark as superseded instead.

- **D-001 · 2026-11-21 · Redesign in place in `web/`, keeping the stack** (React 19, Vite, TS, Dexie, ts-fsrs, MediaPipe, three.js). — *The viewer, detector, content pipeline and event log are solid and reusable.* — active
- **D-002 · 2026-11-21 · The feed replaces Home, Session, Onboarding, Placement and Results.** The app opens on a task; swipe-based self-placement replaces the placement test. — *Product brief: tasks immediately, no menus.* — active
- **D-003 · 2026-11-21 · The event log stays the only source of truth** (schema v2). The learner state is a pure fold. v1 `answer` events are upcast best effort; other v1 events are ignored. — *Reproducible, testable, export/import for free.* — active
- **D-004 · 2026-11-21 · Learner model = BKT (guess/slip by check mode) + FSRS + evidence ladder + challenge level + Beta format preferences.** No collaborative filtering, IRT calibration or trained models. — *Works for one learner from the first card; inspired by Tutor MCP, LearnHarness, learning(-)harness and ZPDES (SPEC §7.1).* — active
- **D-005 · 2026-11-21 · Recommender = per-format candidates → weighted explainable features → seeded softmax over the top 5, under hard variety constraints.** Every card carries reasons. — *Transparent, deterministic in tests, cheap.* — active
- **D-006 · 2026-11-21 · Response time is logged but not used for knowledge, scheduling or challenge** (only inside timed games). Correctness is used, weighted by check mode. — *Time here mostly measures playback, detector latency and UI; one learner gives too few samples; research shows small value for correct answers; the "too easy" swipe is a better signal (SPEC §7.10).* — active
- **D-007 · 2026-11-21 · The FSRS grade is decided at card exit:** wrong → Again; correct + too hard → Hard; correct → Good; correct + too easy → Easy. — *Turns the swipes into Anki-style grades without extra UI.* — active
- **D-008 · 2026-11-21 · Camera opt-out lasts for the app session:** in memory + `sessionStorage` (a reload of the same tab keeps it; a new launch clears it); it can be turned back on in settings. Permission denied has the same effect. — *Brief: "until the next session/reboot"; avoids repeated permission prompts after accidental reloads.* — active
- **D-009 · 2026-11-21 · Gestures with Pointer Events + CSS/WAAPI, no library.** Task interactions are taps; drags are swipes; `data-noswipe` opts out; 3D orbit disabled in the feed. — *No dependency, fewer gesture conflicts.* — active
- **D-010 · 2026-11-21 · The card behind is a lightweight preview** (no camera, timers or WebGL). The full task mounts when it becomes current. One card of lag in the recommender, with invalidation before reveal. — *Performance and WebGL context limits.* — active
- **D-011 · 2026-11-21 · Swipes are allowed after a task is completed,** to add an opinion ("correct but too easy"). — *More signal at no cost; feeds D-007.* — active
- **D-012 · 2026-11-21 · The UI stays in Spanish, through `src/i18n/es.ts`;** code, comments and agent docs are in English. — *Current audience is Spanish speakers; i18n-ready.* — superseded by D-038
- **D-013 · 2026-11-21 · Dev mode at `#dev`, writing to a sandbox IndexedDB (`signa-dev`) by default.** — *Testing must not pollute the real learner model.* — active
- **D-014 · 2026-11-21 · Words and sentences are checked by mirror or self-check only** (no automatic recognition) in parts A–F. Automatic checks: static letters now, static numbers from Part E. Word recognition is an optional experiment (G1). — *Honesty: the detector can't verify signs with movement.* — active
- **D-015 · 2026-11-21 · Tests: Vitest for pure logic and simulations; Playwright optional in Part F.** — *Nothing exists today; the recommender needs simulation tests.* — active
- **D-016 · 2026-11-21 · New dependencies need a reason here, an exact version, and a release older than `before=` in `web/.npmrc`.** — *Existing supply-chain rule of the repo.* — active
- **D-017 · 2026-11-21 · A format is muted after ≥ 3 dislikes and more dislikes than 2 × completions; only the learner can unmute it.** Preferences otherwise decay back towards neutral. — *Respect the explicit "don't like this format" signal without over-reacting to one swipe.* — active
- **D-018 · 2026-11-21 · Light gamification:** XP, streak, daily goal in cards; no leaderboards. — *Phase-2 research: leaderboards help habit more than learning and can distract.* — active
- **D-019 · 2026-11-21 · Part order A → B → C → D → E → F; G optional.** C may go before B on request. — *Each part leaves a working app.* — active
- **D-020 · 2026-11-21 · One build, three targets: desktop website, mobile website, mobile web app (installed PWA or embedded WebView); always a vertical layout** (SPEC §1.4). — *User requirement.* — active
- **D-021 · 2026-11-21 · Sound effects for swipes, animations and results, synthesised with the Web Audio API** (no audio files, no dependency), unlocked on the first gesture, with a mute toggle; optional haptics (SPEC §3.7). — *User requirement (engagement); synthesis avoids licensing and download size.* — active
- **D-022 · 2026-11-21 · Camera choice: the front camera (`facingMode: "user"`) on phones and tablets; the webcam on desktop** (saved choice → MX Brio → default); mirrored preview (SPEC §5.6). — *User requirement.* — active
- **D-023 · 2026-11-21 · Vitest 5.1.0** (exact version; released 2026-11-02, before `before=2026-11-07`). It is configured in `web/vitest.config.ts` (Node environment, `src/**/*.test.ts`), apart from `vite.config.ts`, so tests don't load the dev-server API plugin. — *Part A test tooling (D-015, D-016).* — active
- **D-024 · 2026-11-21 · Refinements of the SPEC §8.3 contract sketch** (`src/core/types.ts`):
  - `FormatId` is a plain string, because logs may hold ids of retired formats or v1 activities.
  - `generate(q, ctx, params?)` takes optional explicit params (dev overrides). `GenContext` is `{ rng, ce, cameraUsable }`.
  - `TaskSpec` adds `preview(plan)` (the preview text), `nextAnytime` (Next before completion, used by the tutorial) and `devParams` (the dev params picker).
  - In Part A, `LearnerQueries` only has `nextItems(kinds, n)`.
  - `CardSource.kind` fills `card.shown.source`, which also accepts `"v1"`. `FeedContext` is `{ history: CardRef[], cameraUsable, rng }`. `CameraSession` includes `optOut()`.
  - *Why:* the spec calls the contract a sketch to refine in Part A. — active
- **D-025 · 2026-11-21 · v1 upcast: one synthetic card per v1 `answer`.**
  - The card is `card.shown` (source `v1`) → `evidence` (keeps the v1 id) → `card.result` (0 XP) → `card.exit` (`next`, completed). Ids are deterministic; ts and seq are copied.
  - v1 activity → v2 format: recognize/phrase/quiz/placement → quiz-choice; imitate/camera → lesson; games → `game-*`; unknown activities → `v1-<activity>`.
  - Check modes follow SPEC §8.4, plus phrase/placement/comprehension → choice with 4 options, and unknown → choice.
  - The frozen v1 types live in `src/data/eventsV1.ts` for the old modules.
  - *Why:* one uniform card lifecycle keeps the Part C fold free of special cases. — active
- **D-026 · 2026-11-21 · Removed `src/data/legacy.ts`** (the one-time import of localStorage "signa:v1"). Its only output was a v1 `legacy.import` event, which v2 drops (Q-006 default). — active
- **D-027 · 2026-11-21 · `LogStore` (`src/data/logStore.ts`).** `emit` appends to the in-memory log at once and writes to IndexedDB in order in the background. React reads it with `useSyncExternalStore`. — *Card sources must see an exit the moment it is logged; with async state the tutorial could be picked twice.* — active
- **D-028 · 2026-11-21 · The app session is the tab session.** The session id lives in sessionStorage: a reload keeps the session (no new `app.open`; the camera opt-out stays, D-008), and a new tab starts a new one. `app.open` is written after the camera probe and before the first card. — active
- **D-029 · 2026-11-21 · Tutorial and feedback details.**
  - The tutorial never reports a result: no `evidence`, no `card.result`, and its `card.exit` has `completed: false`.
  - The optional second "camera privacy" card is not shown; the privacy sentence is on camera cards instead.
  - The feedback panel sits in the card's layout under the task, not on top of it, so the options and the sign stay visible.
  - "Continuar" exists once, in the action bar.
  - Starting a drag cancels the auto-advance, and it does not restart. — active
- **D-030 · 2026-11-21 · quiz-choice builds its options in `generate()`** and logs them in `card.shown.params.choices`.
  - `optionsFor(ce)`: 4 options when ce > −0.2, 3 down to −0.6, else 2.
  - XP: 10 for a sign, 12 for a phrase.
  - Distractors: same unit first, then same kind; option labels are unique.
  - *Why:* the log shows exactly what was asked; Part B adds similarity and confusion distractors in the same place. — active
- **D-031 · 2026-11-21 · Gesture details.**
  - Up uses the same thresholds as down.
  - The release velocity is measured over the last 100 ms of moves. The lift counts only if the finger moved, and a rest of more than 100 ms before lifting is not a flick.
  - Only the stack's own `lostpointercapture` cancels a drag (touch pointers are first captured implicitly by the element under the finger).
  - Cards rotate up to 12° while dragged and 15° on horizontal exits.
  - *Why:* found while testing touch input and slow main threads. — active
- **D-032 · 2026-11-21 · Camera session details.**
  - `camera.off` is logged for an opt-out and for acquisition failures only. "No camera found" from the probe is carried by `app.open.cameraAvailable`; it is not persisted and is probed again on reload.
  - A camera picked by hand (localStorage) is tried first on every device.
  - Concurrent acquisitions share one `getUserMedia` request: before this, a second stream leaked under React StrictMode and kept running after an opt-out. — active
- **D-033 · 2026-11-21 · The feed overlay in Part A is the XP/streak chip and the mute toggle.** There is no settings button until the sheet exists (Part F). XP and streak come from a small interim fold in `src/feed/derived.ts`; the learner state replaces it in Part C. — active
- **D-034 · 2026-11-21 · Dev mode v1 scope = SPEC §9 Part A item 8.**
  - Included: format, content and params pickers; camera on/off (it drives the real camera session: opt-out or re-enable); forced play (`#dev/play`); sandbox reset; the event-log inspector (sandbox log, or the real log read-only).
  - The dev config lives in localStorage, so a new tab replays it.
  - Left out until a part needs them: copy the real log, sandbox export/import, personas, and "use my real profile" (SPEC §6). — active
- **D-035 · 2026-11-21 · Layout details.**
  - New CSS classes are prefixed (`feed-card`, `feed-stack`), because `.card` and `.stack` already exist in the old `styles.css`.
  - New UI colours keep a contrast of at least 4.5:1; Continuar uses a darker green, `#237a00`.
  - On screens up to 700 px tall, the viewer credit keeps only its source link and the type is more compact. Up to 600 px tall, the viewer controls hide while feedback shows.
  - Cards never scroll; as a last resort the card body clips. — active
- **D-036 · 2026-11-21 · Installs use npm 11.21.2** (the newest npm before the cutoff). `package-lock.json` was written by npm 11 or later, and npm 10.9 (bundled with Node 22) strips its `libc` fields. — *This keeps the lockfile diff limited to Vitest.* — active (see Q-007)
- **D-037 · 2026-11-21 · Prefetch = the avatar motion JSON of the queued card.** Video clips are not prefetched: a parallel fetch may not be reused by `<video>`, and it could download every clip twice on mobile data. Letters are procedural and need nothing. — active
- **D-038 · 2026-11-21 · Two UI languages: English (the default) and Spanish, with an EN | ES switch** in the feed overlay, dev mode and the lab.
  - `src/i18n/en.ts` is the reference shape (`Messages`). `es.ts` is typed against it, so a missing or extra string fails the build.
  - Components read strings with `useT()`. Callbacks and timers read `currentMessages()`.
  - The choice is a device preference in localStorage (`signa:lang`), like the chosen camera. It is not learner state, so it is not logged, and it applies to the real feed, the dev sandbox and the lab alike.
  - The first visit is English whatever the browser language (Q-008). `<html lang>` and the tab title follow the choice; `index.html` and the manifest default to English.
  - Two buttons rather than a menu: one tap, and no doubt whether a label means "current" or "switch to".
  - *Why:* the user asked for English before testing ("drop Spanish or add a language selector"). The switch keeps the original Spanish-speaking audience; the cost is writing every string twice (R-021). — active
- **D-039 · 2026-11-21 · Content keys its translations by language code** (`curriculum.json` is now `curriculum/2`).
  - A unit `title` and a phrase grammar `note` are `{ es, en }`, like a sign's `translations`.
  - The English titles and notes are translations of the Spanish ones: the ASL facts are unchanged, and glosses are written as ASL glosses (MY FAMILY, ME LOVE).
  - `itemLabel(id, lang)` replaces `label(id)` in new code; `label(id)` stays as the Spanish label for the old modules.
  - The label maps for non-manual markers moved from `content/curriculum.ts` to i18n (`content.nonManual`), and the unused `LEVEL_NAMES` was removed.
  - `description.en` is optional. Text that exists only in Spanish is shown as is with `lang="es"` (R-020).
  - Old modules only needed `.es` added (`learning/orchestrator.ts`, `activities/Recognition.tsx`).
  - *Why:* the same shape as the signs, one lookup for every language, and no runtime overlay to keep in sync. — active
- **D-040 · 2026-11-21 · A card does not depend on the UI language.**
  - `buildChoices` keeps option labels unique in every UI language (case-insensitive). The options logged in `card.shown` therefore work in either language, and switching mid-card changes only the text: nothing is logged and the card stays.
  - `TaskSpec.preview(plan, t)` receives the strings, so specs stay free of global state (it refines D-024).
  - A word's ASL gloss is shown under its meaning only when it adds something: Spanish "negro" · BLACK, English "black" alone.
  - Feedback already on screen keeps the language it was given in until the card leaves.
  - Camera errors are kept as data and rendered in the current language. — active

---

## 5. Open questions for the user

Each question has the default that agents use until the user answers. When answered, record the answer as a decision and mark it here.

- **Q-001** UI language: Spanish only, or also English? — *Answered 2026-11-21: English by default, Spanish from a switch (D-038).*
- **Q-002** Should the camera opt-out survive a reload of the same tab? — *Default: yes (D-008).*
- **Q-003** Daily goal unit: cards per day or minutes? — *Default: 15 cards per day.*
- **Q-004** quiz-build tiles: sign meanings in ASL order, or a natural translation in the UI language (needs authored tokens per language)? — *Default: meanings in ASL order; translation optional.*
- **Q-005** Swipe up before completing a task (a neutral "skip"): allowed? — *Default: no; only the four exits from the brief, plus camera off.*
- **Q-006** Keep progress from old (v1) logs? — *Default: best effort (D-003); no one depends on it.*
- **Q-008** Should a first visit follow the browser language (a Spanish browser opens in Spanish)? — *Default: no. Every first visit opens in English until the switch is used (D-038), because you asked for English. It is a one-line change in `src/i18n/index.ts`.*
- **Q-007** Which npm do you use? AGENTS.md says npm 10, but `package-lock.json` has fields written by npm 11 or later, and npm 10 removes them on every install. — *Default: npm 11.21.2 (D-036). If you use npm 10, expect a lockfile diff of removed `libc` lines.*

---

## 6. Risks, known issues and tech debt

- **R-001** Mobile browser gestures (iOS edge-swipe back, pull-to-refresh) can fight the card swipes. Mitigation in SPEC §3.3; test on real devices in Part A and Part F. — *Part A: cards use `touch-action: none`, the page uses `overscroll-behavior: none`, and the card stack keeps 16 px side margins. Real-device check still pending (R-016).*
- **R-002** WebGL context limits: multi-viewer games (memory, match) create one canvas per sign. Budget in SPEC §8.6.
- **R-003** Letter detector reliability: fist letters (A, E, M, N, S, T) and side-view letters (C, G, O, P, Q, X) still need review by a fluent signer (from `docs/fase2.md`).
- **R-004** Self-graded evidence (mirror, self) may overstate knowledge. Mitigated by high guess values and the `verified` rule (SPEC §7.3–§7.4).
- **R-005** Media is not in git. Videos (26 words, 10 numbers) and the MediaPipe hand model need `npm run setup:media` (network). Avatar motion files are tracked.
- **R-006** There are no automated tests before Part A. — *Resolved 2026-11-21: Vitest, 65 tests.*
- **R-007** WLASL clips are licensed for academic, non-commercial use only.
- **R-008** Recommender constants are untuned first guesses; the simulations are only as good as the simulated learners.
- **R-009** TypeScript 7.0.2 (native compiler) with Vitest is untested in this repo. — *Resolved 2026-11-21: Vitest transpiles through Vite, and `tsc` 7.0.2 runs separately; both work.*
- **R-010** Local Node is v22.23.5; `npm start` runs `server/index.ts` directly through Node's type stripping. Check it on this version. — *Resolved 2026-11-21: `npm start` serves the build and `/api` on Node 22.23.5. But see R-013: this machine has no Node at all.*
- **R-011** Camera and Web Audio need a secure context: testing on a real phone needs HTTPS (local certificate or tunnel), and embedded WebViews need host-side permission and inline-media settings (SPEC §1.4, Part F).
- **R-012** Browser autoplay policies: sounds only play after the first user gesture; iOS may also silence Web Audio when the hardware mute switch is on.
- **R-013** This machine (the user's Linux desktop) has **no Node.js installed**, although AGENTS.md mentions v22.23.5. The 2026-11-21 session ran Node 22.23.5 and npm 11.21.2 from a temporary scratch folder. Install Node 22 or later to run `npm run dev`.
- **R-014** The browser console shows warnings from libraries, not errors, and they also appear without the new code:
  - a `THREE.Clock` deprecation notice from @react-three/fiber on every 3D canvas mount;
  - MediaPipe WASM logs ("OpenGL error checking is disabled", "NORM_RECT without IMAGE_DIMENSIONS") while the hand landmarker runs.
- **R-015** The build is one 1.66 MB JS chunk (462 kB gzip), because three.js, MediaPipe and all content load eagerly. Lazy chunks are planned in Part F.
- **R-016** Headless tests could not verify these, so the user must check them by hand:
  - installed or standalone mode (display-mode emulation had no effect);
  - the real touch feel and 60 fps;
  - the camera indicator light of a real camera (the tests checked that tracks reach `ended`);
  - the MX Brio branch;
  - whether the sounds are audible and pleasant (the tests checked when each one is synthesised).
  - Also, the harness check where a real hand clip completes the camera probe is timing-sensitive in headless Chromium: once it timed out after 45 s and passed on the rerun.
- **R-017** Viewports under about 480 px tall (phones in landscape) clip card content. The app is portrait-first (the manifest says `orientation: portrait`).
- **R-018** Interim stubs that later parts replace:
  - `src/feed/simplePicker.ts` walks the curriculum blindly (Part D);
  - the XP/streak fold in `src/feed/derived.ts` (Part C);
  - `ce` is fixed at 0 in the feed (Part C);
  - quiz-choice distractors use neither similarity nor confusions (Part B).
- **R-019** Two tabs of the real feed keep separate in-memory logs, though both append to IndexedDB. Until a reload, the picker may repeat items across tabs.
- **R-020** Some content is authored only in Spanish. Each part that shows it in the UI must add the English first, translated faithfully (rule 5):
  - letter descriptions (`description`, 26 signs): shown in the lab now (marked `lang="es"`), and on lesson cards from Part B;
  - curator notes (`review.note`) and reference labels: lab only;
  - handshape hints in `lib/handshapes.ts`: camera checks in Part B;
  - `comprehension.json` and `dialogues.json`: game-story and game-dialogue in Part E;
  - the `/api` prompts in `server/api.ts` (coach, phrase generation): not used by the feed yet. AI phrases need a `note` in both languages before `registerPhrases` uses them again.
- **R-021** Two UI languages double the string work. The build checks that every string exists in both files, not that it reads well. Wording should get a review by a native speaker of each language.

---

## 7. Session log

Newest first. One entry per session: date · part · what was done · verification · next step.

- **2026-11-21 · Part A follow-up — English UI and language switch** (asked by the user before the manual tests)
  - *Done:*
    - `src/i18n/`: the English dictionary `en.ts` (reference shape), `es.ts` typed against it, the language store with `useT()`, and the EN | ES switch in the feed overlay, dev mode and the lab;
    - every new-UI string, the `SignViewer` controls and credits, and the lab now go through i18n;
    - content: English unit titles and phrase grammar notes (`curriculum/2`);
    - quiz options, prompts and feedback follow the language; `<html lang>`, the title and the manifest default to English; repository errors in English;
    - fixed a pre-existing overflow of the dev-mode format select on phones.
  - *Docs:* AGENTS.md (intro, rule 9); SPEC §1.1, §4.1, §4.3, §4.4, §4.6, §7.9, §8.2, §8.6, Part A item 10 and Part C item 3; README.
  - *Recorded:* D-038–D-040 (D-012 superseded), Q-001 answered, Q-004 reworded, Q-008, R-020, R-021.
  - *Verification:* typecheck, test (11 files, 78 tests) and build green. 50 new language checks in headless Chromium, plus the whole Part A suite rerun in English (desktop 61, mobile 20, camera and dev 32, typing 3) and the 4 layout sizes: 166 checks in all, no new console errors. The real-hand probe check timed out once and passed on the rerun (R-016).
  - *Next:* unchanged: the user's manual checks and commit (the user still needs to commit), then Part B.

- **2026-11-21 · Part A — Feed foundation**
  - *Done:* all of SPEC §9 Part A:
    - contracts and seeded RNG (`src/core/`);
    - event log v2, the v1 upcaster and `LogStore` (`src/data/`);
    - the feed (`src/feed/`): stack, pure swipe decision, Pointer Events gestures, the four exits plus camera off, stamps, action bar, keys, feedback and auto-advance, mobile guards, logging;
    - camera session and camera choice (`src/camera/`, `src/lib/camera.ts`);
    - the `system-tutorial`, `quiz-choice` and `dev-camera-probe` formats (`src/tasks/`), and the `simplePicker`;
    - dev mode v1 (`src/dev/`), routing (`src/app/`), `src/i18n/es.ts`, the sound engine (`src/sound/`), and a minimal manifest.
  - *Deleted:* the 5 old screens, the old `src/App.tsx` and `src/data/legacy.ts`.
  - *Fixed on the way:* a camera stream that leaked on concurrent acquisition; touch drags cancelled by implicit pointer capture; flick velocity on slow main threads; layout on small screens.
  - *Recorded:* decisions D-023–D-037, Q-007, R-013–R-019.
  - *Verification:* typecheck, test (65) and build green. 116 Playwright checks in headless Chromium: desktop, phone emulation, fake camera, a real hand clip through MediaPipe, reduced motion, 4 sizes. No console errors. `npm start` OK.
  - *Not verified:* real devices and standalone mode (R-016).
  - *Next:* the user's manual checks and commit (the user still needs to commit), then Part B.

- **2026-11-21 · Planning, addendum (no part)** · Added to the spec at the user's request: the three delivery targets (desktop website, mobile website, installed or embedded mobile web app; always vertical), synthesised sound effects for swipes, animations and results, and the camera choice (front camera on phones, webcam on desktop). Decisions D-020–D-022; Part A, E and F checklists extended. · Verification: n/a (documentation only). · Next: Part A.

- **2026-11-21 · Planning (no part)** · Researched Tutor MCP, LearnHarness, learning.harness, learning-harness, ZPDES, the Elo/IRT literature, the 85 % rule, response-time studies, and Duolingo's exercise opt-outs. Wrote `docs/SPEC.md` (requirements, learner model, recommender, parts A–G), this file, `AGENTS.md`, `CLAUDE.md` (imports `AGENTS.md`) and `README.md`. No code changes. · Verification: n/a (documentation only). · Next: Part A. The user still needs to commit these files.
