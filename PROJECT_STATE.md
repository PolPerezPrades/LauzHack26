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
- **Active part:** none. The spec is written, and **Part A is next**.
- **Branch:** `gesture_learning` (pre-redesign code, clean tree at commit `e7a9739`).
- **What works now:** the pre-redesign app (home + planned sessions + 13 activities) in `web/`. Nothing of the redesign is implemented yet.
- **Quality gates:** not run in this session (documentation only). `web/node_modules` is not installed in this checkout: run `npm install` (and `npm run setup:media` for videos and the hand model) first.
- **Next step:** implement **Part A — Feed foundation** ([`docs/SPEC.md` §9](docs/SPEC.md#part-a--feed-foundation)).

| Part | Title | Status |
|---|---|---|
| A | Feed foundation | not started |
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

- [ ] `npm install` done; Vitest added (exact version, older than the `.npmrc` cutoff) with an `npm test` script
- [ ] `src/core/` contracts (TaskSpec, CardPlan, TaskViewProps, TaskResult, EvidenceDraft, CardSource) + seeded RNG
- [ ] Event log v2: new event types, `EVENT_SCHEMA_VERSION = 2`, v1 upcaster, tests
- [ ] Feed shell: viewport layout, two-card stack with preview behind
- [ ] `swipe.ts` pure decision + tests; `useSwipe` hook (touch, mouse)
- [ ] Four exits with one shared animation; spring-back; drag stamps; reduced motion
- [ ] Action bar buttons + keyboard shortcuts (ignored in text inputs)
- [ ] Feedback overlay + auto-advance rules; swipes after completion
- [ ] Mobile guards (touch-action, overscroll, margins)
- [ ] Event logging: `app.open`, `card.shown`, `evidence`, `card.result`, `card.exit`
- [ ] Camera session store + "no camera now" button + `camera.off` + sessionStorage + filtering
- [ ] Formats: `system-tutorial`, `quiz-choice`, `dev-camera-probe`
- [ ] `simplePicker` card source (+ camera filtering test)
- [ ] Dev mode v1 (`#dev`): format/content/params pickers, camera simulation, forced mode, sandbox DB `signa-dev`, event-log inspector
- [ ] Routing (feed default, `#lab`, `#dev`); old screens deleted
- [ ] `src/i18n/es.ts` used by all new UI
- [ ] Sound engine (`src/sound/`): exit, threshold, spring-back, settle, correct/wrong sounds; unlock on first gesture; mute toggle
- [ ] Camera selection: front camera on phones, webcam on desktop (saved choice, MX Brio preference)
- [ ] Vertical layout checked on desktop (incl. landscape window), phone browser and standalone mode
- [ ] Gates green; manual acceptance checks from the spec done

### Part B — Learning task formats

- [ ] Shared UI: TaskFrame, ChoiceGrid, TileBank, SelfCheck, MirrorCompare
- [ ] `checkModeFor()` + tests
- [ ] `lesson` (camera / mirror / self, relearn variant)
- [ ] `question`: sign-term, sign-sentence, spell-word (all modes)
- [ ] `quiz-choice` polish (all content kinds, distractor rules, params)
- [ ] `quiz-build` (gloss mode; translation mode optional)
- [ ] Generators with a stub query adapter
- [ ] Evidence mapping tests
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
- **D-012 · 2026-11-21 · The UI stays in Spanish, through `src/i18n/es.ts`;** code, comments and agent docs are in English. — *Current audience is Spanish speakers; i18n-ready.* — active
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

---

## 5. Open questions for the user

Each question has the default that agents use until the user answers. When answered, record the answer as a decision and mark it here.

- **Q-001** UI language: Spanish only, or also English? — *Default: Spanish only (D-012); strings are centralised so English is cheap later.*
- **Q-002** Should the camera opt-out survive a reload of the same tab? — *Default: yes (D-008).*
- **Q-003** Daily goal unit: cards per day or minutes? — *Default: 15 cards per day.*
- **Q-004** quiz-build tiles: sign glosses in ASL order, or a natural Spanish translation (needs authored `es_tokens`)? — *Default: glosses; translation optional.*
- **Q-005** Swipe up before completing a task (a neutral "skip"): allowed? — *Default: no; only the four exits from the brief, plus camera off.*
- **Q-006** Keep progress from old (v1) logs? — *Default: best effort (D-003); no one depends on it.*

---

## 6. Risks, known issues and tech debt

- **R-001** Mobile browser gestures (iOS edge-swipe back, pull-to-refresh) can fight the card swipes. Mitigation in SPEC §3.3; test on real devices in Part A and Part F.
- **R-002** WebGL context limits: multi-viewer games (memory, match) create one canvas per sign. Budget in SPEC §8.6.
- **R-003** Letter detector reliability: fist letters (A, E, M, N, S, T) and side-view letters (C, G, O, P, Q, X) still need review by a fluent signer (from `docs/fase2.md`).
- **R-004** Self-graded evidence (mirror, self) may overstate knowledge. Mitigated by high guess values and the `verified` rule (SPEC §7.3–§7.4).
- **R-005** Media is not in git. Videos (26 words, 10 numbers) and the MediaPipe hand model need `npm run setup:media` (network). Avatar motion files are tracked.
- **R-006** There are no automated tests before Part A.
- **R-007** WLASL clips are licensed for academic, non-commercial use only.
- **R-008** Recommender constants are untuned first guesses; the simulations are only as good as the simulated learners.
- **R-009** TypeScript 7.0.2 (native compiler) with Vitest is untested in this repo.
- **R-010** Local Node is v22.23.5; `npm start` runs `server/index.ts` directly through Node's type stripping. Check it on this version.
- **R-011** Camera and Web Audio need a secure context: testing on a real phone needs HTTPS (local certificate or tunnel), and embedded WebViews need host-side permission and inline-media settings (SPEC §1.4, Part F).
- **R-012** Browser autoplay policies: sounds only play after the first user gesture; iOS may also silence Web Audio when the hardware mute switch is on.

---

## 7. Session log

Newest first. One entry per session: date · part · what was done · verification · next step.

- **2026-11-21 · Planning, addendum (no part)** · Added to the spec at the user's request: the three delivery targets (desktop website, mobile website, installed or embedded mobile web app; always vertical), synthesised sound effects for swipes, animations and results, and the camera choice (front camera on phones, webcam on desktop). Decisions D-020–D-022; Part A, E and F checklists extended. · Verification: n/a (documentation only). · Next: Part A.

- **2026-11-21 · Planning (no part)** · Researched Tutor MCP, LearnHarness, learning.harness, learning-harness, ZPDES, the Elo/IRT literature, the 85 % rule, response-time studies, and Duolingo's exercise opt-outs. Wrote `docs/SPEC.md` (requirements, learner model, recommender, parts A–G), this file, `AGENTS.md`, `CLAUDE.md` (imports `AGENTS.md`) and `README.md`. No code changes. · Verification: n/a (documentation only). · Next: Part A. The user still needs to commit these files.
