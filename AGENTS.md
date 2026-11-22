# AGENTS.md — working on Signa

Signa is a web app that teaches **American Sign Language (ASL)** to English and Spanish speakers (English UI by default, Spanish from the language switch). It is being redesigned into a **vertical, swipeable feed of short tasks** (TikTok / Tinder / Duolingo-like): lessons, questions, quizzes and minigames, chosen by a small per-learner recommender, with sound effects on every swipe and result. Several camera tasks check the learner's handshapes in the browser with MediaPipe. One build serves three targets, always in a vertical layout: a desktop website (webcam), a mobile website (front camera), and an installed or embedded mobile web app (front camera). See SPEC §1.4.

**Parts are built in parallel.** Since 2026-11-22, three agents on three machines each build one part at a time, on its own branch, and an integrator merges them (SPEC §9.0). Each parallel part owns some files and keeps its own state file in `docs/parts/`. Read SPEC §9.0 before you start.

> **Demo sprint (SPEC §9.0.7):** Max's Mac is out. Pol builds B2 (hands-free practice), Ashlie D1 (simple recommender), and a second agent session on Pablo's laptop E1 (two quick games, worktree `~/LauzHack26-e`); push working increments by 10:45 and 11:00.
>
> **Hackathon deadline: 2026-11-22 at 11:30 (local time).** Signa is a LauzHack project. Until then, a working demo on `gesture_learning` beats a complete checklist: keep the app building and running, cut optional and MAY items, make small changes that merge cleanly, and record what you skipped in your part file.

## Key documents

| File | What it is | When to read it |
|---|---|---|
| [`PROJECT_STATE.md`](PROJECT_STATE.md) | Progress, decisions, open questions, risks, session log, next step. **The project's memory.** | Every session, first, and update it before you finish. |
| [`docs/SPEC.md`](docs/SPEC.md) | The requirements spec: feed UX, task formats, camera policy, dev mode, learner model, recommender, architecture, and the delivery plan: the **parallel plan** (§9.0) and the parts. | Every session: §1–§2, §9.0, plus the sections your part needs. |
| [`docs/parts/<part>.md`](docs/parts/) | The state of one part built in parallel: owned files, checklist, decisions, risks, log, handoff to the integrator. [`docs/parts/README.md`](docs/parts/README.md) has the setup steps and the prompt for each machine. | Every session of that part, first and last. |
| [`docs/fase2.md`](docs/fase2.md) | Design notes from the previous phase (Spanish): sign rendering, FSRS engine, activities, sources. | When you touch the viewer, content or old activities. |
| [`web/README.md`](web/README.md) | Human overview of the pre-redesign app (Spanish). | For context on existing features. |
| [`README.md`](README.md) | Short overview for humans. | Rarely. Keep it current in Part F. |

## Session protocol

**Start**

1. Read `PROJECT_STATE.md` (§1 tells you how to use it), then SPEC §1–§2 and §9.0, then your part's file `docs/parts/<part>.md`, then the spec sections your part needs.
2. Do **only the part the user asked for** (e.g. "do part C"). Never start the next part on your own. Small fixes to earlier parts are fine if your part needs them; record them (in a parallel part, as a cross-part edit).
3. Run `git status` and `git branch --show-current` to see where you start: a parallel part runs on its own branch (`part-<id>`, SPEC §9.0.1), created by the human. Don't discard changes you didn't make.

**During**

- Follow the spec. Where it is ambiguous or wrong, choose the most reasonable option, implement it, and record it as a decision: in your part file (`D-<part>NN`) for a parallel part, else in `PROJECT_STATE.md` §4. Ask the user only when the choice really matters and can't be undone cheaply. Then record the question and your assumed default (`Q-<part>NN`, or `PROJECT_STATE.md` §5).
- Keep your state current: tick checklist items once they are verified; record decisions, risks and stubs as they happen. A parallel part writes only its part file; only the integrator edits `PROJECT_STATE.md`, the spec, this file and the READMEs.
- In a parallel part, edit only the files your part owns (SPEC §9.0.3), keep contracts additive (§9.0.4), and list contract changes and cross-part edits in your part file.

**End** (mandatory)

1. Run the quality gates (below) and fix failures. If something can't be fixed, record it in `PROJECT_STATE.md` §6 and tell the user.
2. Update your state: for a parallel part, its part file (status, checklist, handoff for the integrator, a new log entry at the top); otherwise `PROJECT_STATE.md` (§2 Snapshot with the exact next step, checklists, a new entry at the top of §7).
3. Reply to the user with: what was done, how it was verified, what they should test by hand, and any open questions.

## Golden rules

1. **Never commit, push, amend, rebase or create branches.** The user does all git operations: in parallel work, the human of each machine commits and pushes the part's branch, and the integrator merges it. Leave changes in the working tree.
2. **One part per session**, and the app must build and run at the end of it.
3. **The event log is the only source of truth.** Learner state is a pure fold over it. Never store derived state as truth.
4. **Pure logic stays pure and tested.** The learner model, recommender, swipe decisions, evidence mapping and generators don't import React or the DOM, and have Vitest tests.
5. **Never invent signs, sign descriptions or sign media.** Use only content in `web/content/` and the media it references. Phrases and dialogues may only use existing sign ids.
6. **Camera privacy:** frames are processed on the device, nothing is uploaded, mirror clips live only in memory. Respect the camera opt-out (SPEC §5) everywhere.
7. **Dependencies:** avoid new ones. If you need one, use an exact version released before the `before=` date in `web/.npmrc`, and record the reason in `PROJECT_STATE.md` §4. Python follows the same rule via `exclude-newer` in `pyproject.toml`.
8. **Every gesture has a button and a keyboard alternative.** The one exception is Next (swipe up): from Part A2 on it has no button, because it happens on its own after every result; ↑, Enter and Space skip the wait. Respect `prefers-reduced-motion`.
9. **UI text comes from `web/src/i18n/`, in English (default) and Spanish.** Every new string goes in both languages, and the build fails if one is missing: in `en.ts` and `es.ts` for the core sections, or in your part's module `src/i18n/parts/<name>.ts`, which holds both. Content is shown in its translation for the current language (SPEC §8.6). Code, comments and agent docs are in English.
10. **Don't touch unrelated code:** the Python perception prototype at the root (`perception/`, `camctl.py`, `view_cam.sh`, `pyproject.toml`, `uv.lock`) and untracked folders (`cuberec/`, `.cuberec/`, `recordings/`, `models/`). Keep `#lab` (sign lab) working.
11. **Stay in your lane when parts run in parallel.** Edit only the files your part owns (SPEC §9.0.3). Contracts (`core/types.ts`, the learner queries, the `SignViewer` props, `feed/derived.ts`, the dev panel slot) change only additively. Install with `npm ci`, never `npm install`, and leave `package-lock.json` alone. Keep LF line endings and exact-case import paths: macOS and Windows hide case mistakes that break the Linux build.

## Repository map

```text
.
├── AGENTS.md, CLAUDE.md, README.md, PROJECT_STATE.md
├── docs/                 SPEC.md (redesign spec), fase2.md (previous phase notes), parts/ (one state file per parallel part)
├── web/                  THE APP (all redesign work happens here)
│   ├── content/          signs/<id>.json (103 signs, schema sign/1), curriculum.json (units, phrases),
│   │                     comprehension.json, dialogues.json, reference/letter-poses.json
│   ├── public/motion/    avatar motion per word (tracked); public/media/ and public/mediapipe/ are downloaded, gitignored
│   ├── scripts/          fetch-media.mjs (setup:media), extract_motion.py, fit-letters.ts, verify-letters.ts
│   ├── server/           api.ts (/api/health, /api/coach, /api/phrases with Claude, local fallbacks), index.ts (prod server)
│   └── src/
│       ├── core/         contracts (types.ts: TaskSpec, CardPlan, LearnerQueries…), seeded rng
│       ├── feed/         the feed: stack, swipes, action bar, result banner and countdown (autoAdvance.ts,
│       │                 feedback.ts, Part A2), simple picker (interim card source)
│       ├── tasks/        formats: registry.ts + views.tsx compose learningFormats/learningViews (Part B)
│       │                 and gameFormats/gameViews (Part E); one folder per format (lesson, question,
│       │                 quiz-choice, quiz-build); ui/ (TaskFrame, ChoiceGrid, TileBank, SelfCheck,
│       │                 MirrorCompare, CameraCheck…); learningConfig.ts (B's constants); testing.ts
│       ├── learner/      learner model v2 (Part C): state.ts (memoised fold), selectors.ts, queries.ts (LearnerQueries),
│       │                 params.ts (constants), bkt/schedule/swipes/curriculum.ts, testing.ts (fakeQueries)
│       ├── camera/       camera session (opt-out, state), checkMode.ts (camera, mirror or self, Part B)
│       ├── dev/          dev mode; panels.ts is the inspector slot (Part C's learner inspector, then Part D's)
│       ├── i18n/         en.ts, es.ts (core strings); parts/<name>.ts (each later part's strings, both languages)
│       ├── sound/        synthesised sound effects
│       ├── viewer/       SignViewer: 3D toon hand (letters), avatar (words), video fallback — reuse
│       ├── lib/          camera.ts (shared stream + hand landmarker), cameraDefaults.ts (MX Brio reset, Part A3),
│       │                 handshapes.ts (letter rules, issues as codes), engine.ts (distractors, SPELL_WORDS…)
│       ├── components/   CameraView.tsx
│       ├── content/      loaders and validation for signs, curriculum, scenarios
│       ├── data/         event log (Dexie), versioned events, export/import
│       ├── learning/     OLD profile + orchestrator (replaced in parts C and D, deleted in F2), extensions.ts (LLM hooks)
│       ├── activities/   OLD activities (read-only references for the ports in parts B and E; deleted in F2)
│       ├── app/          shell, routing (#dev, #lab, feed), log providers
│       └── screens/      Lab.tsx (the sign lab, kept)
└── perception/ …         unrelated Python prototype (don't touch)
```

The full target layout (with `recommender/` from Part D and `settings/` from Part F1) is in SPEC §8.2.

## Commands

Run from `web/` unless noted. Node 22.18 or newer (the spec machine has v22.23.5) and npm 10 or 11. The other machines are listed in SPEC §9.0.6.

```bash
npm ci                 # first time in a checkout (node_modules is not committed); never `npm install`
npm run setup:media    # downloads WLASL clips + MediaPipe wasm/model into public/ (needs network; idempotent)
npm run dev            # http://localhost:5173   (#dev = developer mode, #lab = sign lab)
npm run typecheck      # tsc --noEmit
npm test               # vitest (exists from Part A on)
npm run build          # typecheck + production build
npm start              # serves dist/ + /api on http://localhost:8787 (after build)

# content tooling, from the repo root (Python via uv)
uv run python web/scripts/extract_motion.py words|letters
node web/scripts/verify-letters.ts
```

Optional: `web/.env` with `ANTHROPIC_API_KEY` enables the Claude-backed `/api` endpoints. The app works without it.

## Quality gates (definition of done for any change)

- `npm run typecheck`, `npm test` and `npm run build` pass in `web/`, on your machine. The integrator runs them again on Linux after every merge.
- No new errors in the browser console on the dev server.
- The part's acceptance checks in SPEC §9 pass. Check UI behaviour in the browser (mobile emulation for touch). If you can't run a browser, say so explicitly and list what the user must check by hand.

## Conventions

- TypeScript strict, ES modules, React function components and hooks. No `any` in contracts.
- Small modules with one job. Colocated tests: `foo.ts` → `foo.test.ts`.
- Deterministic logic: inject `now` and a seeded RNG instead of calling `Date.now()` and `Math.random()` inside pure modules.
- Constants that tune behaviour live in one config module per area (`learner/params.ts`, `recommender/config.ts`), never scattered.
- Keep explanations: recommender decisions carry machine-readable reasons (SPEC §7.9).
- CSS: plain CSS files (as today), CSS variables for the palette, transform/opacity-only animations.
- Comments explain *why*, not what. Keep the existing header-comment style of modules.
