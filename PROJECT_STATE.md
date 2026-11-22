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

**Parallel parts (SPEC §9.0)** — since 2026-11-22, parts are built by three streams on different machines at the same time, and an integrator merges them. If you are doing one of those parts (A2, A3, B, C, D, E, F1, F2, H):

- your state file is **`docs/parts/<part>.md`**: tick its checklist, record decisions, questions and risks there with your part's prefix (`D-B01`, `Q-B01`, `R-B01`), add a log entry at the top of its log, and write the handoff for the integrator;
- read this file for context (§2, §4, §5, §6), but **don't edit it**: the integrator folds your part file in when it merges your branch. Ignore the end-of-session steps below that write here; your part file's status and handoff replace them;
- edit only the files your part owns (SPEC §9.0.3) and keep contracts additive (SPEC §9.0.4).

Only the integrator (Pablo's laptop, SPEC §9.0.5) edits this file, `docs/SPEC.md`, `AGENTS.md` and the READMEs.

**Style rules**

- Be brief and factual. Use absolute dates (`YYYY-MM-DD`), file paths and commit hashes (when the user has committed), never "today" or "recently".
- §2 is overwritten every session; §4 and §7 are append-only (mark superseded decisions as `superseded by D-0xx` instead of deleting them).
- When §7 grows past ~30 entries, move the oldest ones to `docs/state-archive.md` and link it.
- Don't paste long logs, secrets or personal data. Link files instead.
- Never commit or push (see `AGENTS.md`). Note in §7 that the user still needs to commit.

---

## 2. Snapshot

- **Last updated:** 2026-11-22
- **Phase:** parallel delivery (SPEC §9.0, D-041). Part A is done (real-device checks still open, R-016). **Part 0, the parallel scaffolding, is done**: the learner-query contract and its stub, per-part registries, i18n modules and dev panels, `.gitattributes`, the part files and the plan. **Wave 1 is ready to start**: C (S1, Ashlie), B (S2, Pol), A2 then H (S3, Max), and A3 (the integrator, on this laptop).
- **Branch:** `gesture_learning`. Part A is `5d99806`; Part 0 is the commit after it ("Part 0: parallel plan and scaffolding"). Each part is built on its own branch (`part-<id>`, SPEC §9.0.1) and merged here by the integrator.
- **What works now:** as after Part A. `/` opens the vertical feed: the gesture tutorial on first launch, then quiz-choice cards that walk the curriculum in order. The four exits work by swipe (touch, mouse), by the action-bar buttons and by the arrow keys; Next only works after completion. Feedback appears inside the card: a correct answer auto-advances after 1.2 s, a wrong one waits (Part A2 changes both). Sounds are synthesised, with a mute toggle. Event log v2. `#dev` is dev mode v1, `#dev/play` the forced feed, `#lab` the sign lab. EN | ES switch. New in Part 0, with no visible change: card sources get the log in `FeedContext.events` and build learner queries with `createLearnerQueries()` (a stub until Part C).
- **Quality gates (2026-11-22, after Part 0):** `npm run typecheck` ✓; `npm test` ✓ (12 files, 84 tests); `npm run build` ✓ (the R-015 chunk-size warning). Real-time headless Chrome 157 check over the DevTools protocol against `npm run dev`: the tutorial first, the quiz card after ←, dev mode renders, no console errors.
- **Toolchain:** four machines (SPEC §9.0.6). This laptop (the spec machine, integrator) has Node 22.23.5 and npm 10.9.9 in `~/.local/bin`, the MX Brio and the Android phone. Pol's laptop may have no Node (R-013); Max's Mac and Ashlie's Windows PC install Node 22.18 or newer. Every machine installs with `npm ci` (D-050).
- **Next step:**
  1. Start wave 1 on the three machines: setup steps and the prompt for each agent are in [`docs/parts/README.md`](docs/parts/README.md).
  2. The integrator does **Part A3** on this laptop (it needs the MX Brio) and the Part A manual checks (R-016), then merges the wave-1 branches as they arrive (SPEC §9.0.5).
  3. Wave 2 (D, E, F1) starts per stream once the parts it needs are merged.

| Part | Title | Wave | Stream · machine | Branch | Status | State file |
|---|---|---|---|---|---|---|
| A | Feed foundation | — | — | `gesture_learning` | done with known gaps (R-016) | §3 below |
| 0 | Parallel scaffolding | 0 | integrator | `gesture_learning` | done | §7 (2026-11-22) |
| A2 | Feed feedback follow-ups | 1 | S3 · Max (macOS) | `part-a2` | not started | [`docs/parts/A2.md`](docs/parts/A2.md) |
| A3 | MX Brio defaults | 1 | integrator · Pablo | `part-a3` | not started | [`docs/parts/A3.md`](docs/parts/A3.md) |
| B | Learning task formats | 1 | S2 · Pol (Ubuntu) | `part-b` | not started | [`docs/parts/B.md`](docs/parts/B.md) |
| C | Learner model v2 | 1 | S1 · Ashlie (Windows) | `part-c` | not started | [`docs/parts/C.md`](docs/parts/C.md) |
| H | Hand and avatar quality | 1 (after A2) | S3 · Max (macOS) | `part-h` | not started | [`docs/parts/H.md`](docs/parts/H.md) |
| D | Recommender | 2 | S1 · Ashlie (Windows) | `part-d` | not started (needs C) | [`docs/parts/D.md`](docs/parts/D.md) |
| E | Minigames | 2 | S2 · Pol (Ubuntu) | `part-e` | not started (needs B) | [`docs/parts/E.md`](docs/parts/E.md) |
| F1 | Settings sheet and PWA | 2 | S3 · Max (macOS) | `part-f1` | not started (needs C, A2) | [`docs/parts/F1.md`](docs/parts/F1.md) |
| F2 | Final polish and cleanup | 3 | integrator + free streams | `part-f2` | not started (needs all) | [`docs/parts/F2.md`](docs/parts/F2.md) |
| G | Optional extensions | later | — | — | not planned | §3 below |

Status values: `not started` · `in progress` · `done` (merged) · `done with known gaps (see §6)` · `blocked (see §5)`. A part counts as done once it is merged into `gesture_learning`.

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
    - [x] 2026-11-22: Pablo tested Part A on the Android phone, and it works.

### Parts built in parallel (A2, A3, B, C, D, E, F1, F2, H)

Their checklists live in their part files, ticked by the agent doing the part (SPEC §9.0.4): [A2](docs/parts/A2.md) · [A3](docs/parts/A3.md) · [B](docs/parts/B.md) · [C](docs/parts/C.md) · [D](docs/parts/D.md) · [E](docs/parts/E.md) · [F1](docs/parts/F1.md) · [F2](docs/parts/F2.md) · [H](docs/parts/H.md). The B–F checklists that were here moved there on 2026-11-22 (Part F's items are split between F1 and F2).

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
- **D-019 · 2026-11-21 · Part order A → B → C → D → E → F; G optional.** C may go before B on request. — *Each part leaves a working app.* — superseded by D-041
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
  - Starting a drag cancels the auto-advance, and it does not restart. — active, except the last two points: superseded by D-045 (no Next button; a spring-back restarts the countdown)
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

- **D-041 · 2026-11-22 · Parallel delivery** (SPEC §9.0): three streams, one per machine, plus an integrator.
  - S1 "learner brain" C → D, S2 "tasks" B → E, S3 "look and feel" A2 → H → F1; the integrator does A3, the merges and the device checks; F2 in wave 3.
  - One branch per part (`part-<id>`), started from `gesture_learning` once the parts it needs are merged, and merged back with `--no-ff` by the integrator.
  - *Why:* the user wants three people working at once, with merges that stay easy. The streams follow the dependency chains (C → D, B → E) and keep each area on one machine. — active (supersedes D-019)
- **D-042 · 2026-11-22 · Part 0 froze the learner-query contract.**
  - `LearnerQueries` lists (`frontier`, `practice`, `relearn`, `probes`, `pool`, `eligiblePhrases`, `confusions`, `status`, `pKnown`; `nextItems` kept for Part A) and `ItemStatus` in `core/types.ts`; `FeedContext.events`.
  - `learner/queries.ts`: `createLearnerQueries(events, opts)`, a stub fold of the v2 log until Part C replaces its internals; `withContent()` answers every list with the content chosen in dev forced mode; `learner/testing.ts` has `fakeQueries()` for generator tests.
  - The simple picker keeps Part A's curriculum walk for `nextItems`, so the feed behaves as before.
  - Generators choose items only through the lists, never by filtering statuses themselves, so forced mode can feed them any content.
  - *Why:* B and E write generators while C writes the learner model; one shared provider makes the swap a change inside `learner/`. — active
- **D-043 · 2026-11-22 · Files that several parts would edit are split per part.**
  - Format registry: `tasks/learningFormats.ts` + `learningViews.tsx` (B) and `tasks/gameFormats.ts` + `gameViews.tsx` (E), composed by `registry.ts` and `views.tsx`.
  - Strings: one module per later part in `i18n/parts/` (`learning`, `learner`, `recommender`, `games`, `settings`), with English and Spanish side by side and typed against each other (`definePart`), mounted as `t.<name>`, with format titles merged into `t.formats`.
  - Dev inspectors go into the `dev/panels.ts` slot.
  - `.gitattributes` makes text LF on every OS.
  - *Why:* without the split, every pair of parallel parts would conflict at the end of the same lists and objects. — active
- **D-044 · 2026-11-22 · Parallel parts keep their state in `docs/parts/<part>.md`,** with prefixed ids (`D-B01`, `Q-C02`, `R-H01`). Only the integrator edits this file, the spec, `AGENTS.md` and the READMEs; at merge it adds an index line to §4 and folds questions, risks and the log in. Part-file decisions are as binding as the ones here. — *Why:* three agents rewriting §2 and appending to §4 and §7 would conflict at every merge, and would also collide on decision numbers. — active
- **D-045 · 2026-11-22 · Part A2: every result auto-advances, and the Next button goes.** The user asked for it after testing Part A.
  - Wrong answers show the banner (what was wrong, the answer) with a countdown, like correct ones.
  - Correct answers wait 0.6 s instead of 1.2 s ("twice as fast"). The 280 ms exit animation stays shared by every exit (Q-009).
  - The wrong-answer wait follows the length of the correction: `clamp(2000 + 30 × characters, 2500, 5000)` ms.
  - Press and hold pauses the countdown, and a spring-back restarts it, so a card can't get stuck without a button.
  - ↑, Enter and Space skip the wait; the tutorial still accepts any exit.
  - *Why:* user request; a button that is pressed after every card adds nothing once cards leave on their own. — active
- **D-046 · 2026-11-22 · Part A3: the MX Brio is reset to its default zoom, pan and tilt when the app opens it,** through the PTZ constraints, requested only for the Brio. Other cameras are untouched. — *Why:* the user saw the Brio zoomed in. The setting lives in the device (the Python prototype can leave it changed), and `view_cam.sh` already resets it the same way. Only the spec machine has a Brio, so the integrator does this part. — active
- **D-047 · 2026-11-22 · New Part H, "Hand and avatar quality",** in wave 1. It changes the inside of `src/viewer/`, the motion pipeline and the `render` blocks of sign files; the `SignViewer` props only change additively. It is accepted by the user's look at a fixed review set, plus measured smoothness. — *Why:* the user finds the hand and the avatar poor; the work is independent of the feed and the learner model. — active
- **D-048 · 2026-11-22 · Part F is split into F1 (settings sheet, PWA, lazy libraries; wave 2) and F2 (performance with the games, accessibility, deleting the old app, READMEs, device checks; wave 3).** Every deletion of old modules (`activities/`, `activityCatalog`, `orchestrator`, `profile`) moves to F2. — *Why:* the old modules import each other, so a parallel part deleting one would break another part's build. F1 doesn't need the games, so it can run in wave 2. — active
- **D-049 · 2026-11-22 · Machines:** S1 on Ashlie's Windows 11 PC (pure TypeScript, so nothing OS-specific), S2 on Pol's Ubuntu laptop (camera work in the same browser as the integrator's), S3 on Max's Mac (visual work, Safari checks, Python for motion), the integrator on Pablo's Ubuntu laptop (the MX Brio and the Android phone). — *Why:* each part's hardware and OS needs (SPEC §9.0.6). — active
- **D-050 · 2026-11-22 · Every machine installs with `npm ci`, never `npm install`.** Node 22.18 or newer, so that `npm start` can strip types; npm 10 or 11. — *Why:* `npm ci` leaves the lockfile alone whatever the npm version (Q-007), and lockfile changes would conflict between branches. It refines D-036. — active

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
- **Q-007** Which npm do you use? AGENTS.md says npm 10, but `package-lock.json` has fields written by npm 11 or later, and npm 10 removes them on every install. — *Default: npm 11.21.2 (D-036). If you use npm 10, expect a lockfile diff of removed `libc` lines.* *On the spec machine (npm 10.9.9), `npm ci` installs from the lockfile without rewriting it (checked 2026-11-21).*

- **Q-009** "Twice as fast" for a correct answer: Part A2 halves the wait before the card leaves (1.2 s → 0.6 s) and keeps the 280 ms fly-out animation that every exit shares. Did you also mean the fly-out itself? — *Default: only the wait (D-045). Both are constants in `feed/config.ts`.*
- **Q-010** Should Pablo's laptop also run a fourth stream (for example F1, or a share of E's games) instead of only integrating? — *Default: no. The integrator does A3, the merges, the device checks and its share of F2 (SPEC §9.0).*

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
- **R-010** Local Node is v22.23.5; `npm start` runs `server/index.ts` directly through Node's type stripping. Check it on this version. — *Resolved 2026-11-21: `npm start` serves the build and `/api` on Node 22.23.5. But see R-013: the Part A machine has no Node at all.*
- **R-011** Camera and Web Audio need a secure context: testing on a real phone needs HTTPS (local certificate or tunnel), and embedded WebViews need host-side permission and inline-media settings (SPEC §1.4, Part F). — *An Android phone on USB needs no HTTPS: with USB debugging on, `adb reverse tcp:5173 tcp:5173` lets the phone open `http://localhost:5173`, which is a secure context (port 8787 for `npm start`). `chrome://inspect/#devices` on the desktop shows the phone tab's console. A plain-HTTP LAN address has no `getUserMedia`, and `vite --host` would expose the dev server to the whole network; note that `npm start` already listens on every interface. iPhones still need HTTPS.*
- **R-012** Browser autoplay policies: sounds only play after the first user gesture; iOS may also silence Web Audio when the hardware mute switch is on.
- **R-013** The machine used for Part A has **no Node.js installed**, although AGENTS.md mentions v22.23.5. The Part A sessions ran Node 22.23.5 and npm 11.21.2 from a temporary scratch folder. Install Node 22 or later there to run `npm run dev`. The spec machine has Node (§2 Toolchain).
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

- **R-022** Parallel parts build against a stub and frozen contracts. When Part C's real learner queries replace the stub, Part B's generators may find other content, or none, for some formats. Mitigation: generators only use the query lists (D-042) and are tested with `fakeQueries()`; each part lists its integration checks, which the integrator runs after the merge.
- **R-023** Machine differences: macOS and Windows file systems ignore case, so a wrong-case import passes there and fails the Linux build; Windows editors may write CRLF; Pol's laptop may lack Node (R-013). Mitigation: `.gitattributes` (LF), SPEC §9.0.4 rule 7, `npm ci` everywhere, and the integrator's gates on Linux after every merge.
- **R-024** MX Brio reset (Part A3): Chrome asks a second permission ("use and move your camera") for pan-tilt-zoom; Firefox and Safari expose no PTZ, so the reset can't happen there; the Brio's field-of-view setting (65°/78°/90°) isn't reachable from a web page at all. Manual reset: `./view_cam.sh`, or `python3 camctl.py <device> zoom_absolute=100 pan_absolute=0 tilt_absolute=0`.
- **R-025** Part H is open-ended and judged by eye. Mitigation: a fixed review set and a measured smoothness target (SPEC Part H); timebox it and let the user approve the before/after set.
- **R-026** Conflicts can still happen on the few lines that two parts of the same wave may touch: `app/App.tsx`, the `<FeedTop …/>` line in `FeedScreen.tsx` (D and F1), additive changes to `core/types.ts`. Each part lists its cross-part edits; the integrator resolves them.

---

## 7. Session log

Newest first. One entry per session: date · part · what was done · verification · next step.

- **2026-11-22 · Part 0 — parallel plan and scaffolding** (integrator, at the user's request)
  - *Plan (docs):* SPEC §9.0, the parallel plan: three streams plus an integrator, waves, branches, file ownership, rules for parallel parts, the integrator protocol and the four machines. New parts A2 (feed feedback follow-ups), A3 (MX Brio defaults) and H (hand and avatar quality); Part F split into F1 and F2; parts B, C, D and E adjusted for parallel work. The user's requests after testing Part A are in SPEC §3.3–§3.5 (every result auto-advances, no Next button, correct answers twice as fast) and §5.6 (the Brio reset). §8.2 and §8.3 describe the new layout and contracts. `AGENTS.md` covers parallel work. One state file per part in `docs/parts/` (the B–F checklists moved there), plus `docs/parts/README.md` with the setup steps and the agent prompts.
  - *Code (behaviour-neutral):* the learner-query contract in `core/types.ts`, its stub `learner/queries.ts` (with `withContent()` for forced mode and tests) and `learner/testing.ts` (`fakeQueries()`); `FeedContext.events`; the simple picker and the forced source build their queries there. Per-part registries (`tasks/learningFormats.ts`, `gameFormats.ts`, `learningViews.tsx`, `gameViews.tsx`, `viewTypes.ts`), per-part i18n modules (`i18n/parts/`), the `dev/panels.ts` slot, and `.gitattributes`.
  - *Recorded:* D-041–D-050 (D-019 superseded, D-029 partly superseded), Q-009, Q-010, R-022–R-026.
  - *Verification:* typecheck, test (12 files, 84 tests) and build green. Real-time headless Chrome 157 check over the DevTools protocol against `npm run dev`: the tutorial first, the quiz card after ←, dev mode renders, no console errors.
  - *Git:* committed and pushed to `origin/gesture_learning` because the user asked for it explicitly this time (AGENTS.md rule 1 otherwise holds).
  - *Next:* wave 1 on the three machines; the integrator does Part A3 and the Part A manual checks, then merges the branches as they arrive.

- **2026-11-21 · Part A manual-test setup on the spec machine (no part)**
  - *Done:* no code changes. On the spec machine: `npm ci` (npm 10.9.9; the lockfile is unchanged) and `npm run setup:media` (98/98 clips, the MediaPipe runtime and the hand model). Gave the user the steps for the manual Part A checks on the desktop (MX Brio) and on the Android phone over USB (R-011). Corrected §2 and R-013: Part A is committed (`5d99806`), and only the Part A machine lacks Node.
  - *Verification:* typecheck, test (11 files, 78 tests) and build green. Headless Chrome 157 over the DevTools protocol against `npm run dev`: the first launch shows the tutorial with a quiz-choice preview behind; ← brings the quiz card forward with a new preview behind; no console errors (only the R-014 `THREE.Clock` warning, plus WebGL software-rendering notices because headless Chrome has no GPU). The real camera was not opened.
  - *Next:* unchanged: the user's manual checks, then Part B.

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
