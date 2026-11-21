# AGENTS.md — working on Signa

Signa is a web app that teaches **American Sign Language (ASL)** to Spanish speakers. It is being redesigned into a **vertical, swipeable feed of short tasks** (TikTok / Tinder / Duolingo-like): lessons, questions, quizzes and minigames, chosen by a small per-learner recommender, with sound effects on every swipe and result. Several camera tasks check the learner's handshapes in the browser with MediaPipe. One build serves three targets, always in a vertical layout: a desktop website (webcam), a mobile website (front camera), and an installed or embedded mobile web app (front camera). See SPEC §1.4.

## Key documents

| File | What it is | When to read it |
|---|---|---|
| [`PROJECT_STATE.md`](PROJECT_STATE.md) | Progress, decisions, open questions, risks, session log, next step. **The project's memory.** | Every session, first, and update it before you finish. |
| [`docs/SPEC.md`](docs/SPEC.md) | The requirements spec: feed UX, task formats, camera policy, dev mode, learner model, recommender, architecture, and the delivery plan in **parts A–G**. | Every session: §1–§2, plus the sections your part needs. |
| [`docs/fase2.md`](docs/fase2.md) | Design notes from the previous phase (Spanish): sign rendering, FSRS engine, activities, sources. | When you touch the viewer, content or old activities. |
| [`web/README.md`](web/README.md) | Human overview of the pre-redesign app (Spanish). | For context on existing features. |
| [`README.md`](README.md) | Short overview for humans. | Rarely. Keep it current in Part F. |

## Session protocol

**Start**

1. Read `PROJECT_STATE.md` (§1 tells you how to use it), then the spec sections for the requested part.
2. Do **only the part the user asked for** (e.g. "do part A"). Never start the next part on your own. Small fixes to earlier parts are fine if your part needs them; record them.
3. Run `git status` to see where you start. Don't discard changes you didn't make.

**During**

- Follow the spec. Where it is ambiguous or wrong, choose the most reasonable option, implement it, and record it as a decision in `PROJECT_STATE.md` §4. Ask the user only when the choice really matters and can't be undone cheaply. Then record the question and your assumed default in §5.
- Keep `PROJECT_STATE.md` current: tick checklist items once they are verified; record decisions, risks and stubs as they happen.

**End** (mandatory)

1. Run the quality gates (below) and fix failures. If something can't be fixed, record it in `PROJECT_STATE.md` §6 and tell the user.
2. Update `PROJECT_STATE.md`: §2 Snapshot (including the exact next step), checklists, and a new entry at the top of §7.
3. Reply to the user with: what was done, how it was verified, what they should test by hand, and any open questions.

## Golden rules

1. **Never commit, push, amend, rebase or create branches.** The user does all git operations. Leave changes in the working tree.
2. **One part per session**, and the app must build and run at the end of it.
3. **The event log is the only source of truth.** Learner state is a pure fold over it. Never store derived state as truth.
4. **Pure logic stays pure and tested.** The learner model, recommender, swipe decisions, evidence mapping and generators don't import React or the DOM, and have Vitest tests.
5. **Never invent signs, sign descriptions or sign media.** Use only content in `web/content/` and the media it references. Phrases and dialogues may only use existing sign ids.
6. **Camera privacy:** frames are processed on the device, nothing is uploaded, mirror clips live only in memory. Respect the camera opt-out (SPEC §5) everywhere.
7. **Dependencies:** avoid new ones. If you need one, use an exact version released before the `before=` date in `web/.npmrc`, and record the reason in `PROJECT_STATE.md` §4. Python follows the same rule via `exclude-newer` in `pyproject.toml`.
8. **Every gesture has a button and a keyboard alternative.** Respect `prefers-reduced-motion`.
9. **UI text is Spanish, from `web/src/i18n/es.ts`** (once Part A creates it). Code, comments and agent docs are in English.
10. **Don't touch unrelated code:** the Python perception prototype at the root (`perception/`, `camctl.py`, `view_cam.sh`, `pyproject.toml`, `uv.lock`) and untracked folders (`cuberec/`, `.cuberec/`, `recordings/`, `models/`). Keep `#lab` (sign lab) working.

## Repository map

```text
.
├── AGENTS.md, CLAUDE.md, README.md, PROJECT_STATE.md
├── docs/                 SPEC.md (redesign spec), fase2.md (previous phase notes)
├── web/                  THE APP (all redesign work happens here)
│   ├── content/          signs/<id>.json (103 signs, schema sign/1), curriculum.json (units, phrases),
│   │                     comprehension.json, dialogues.json, reference/letter-poses.json
│   ├── public/motion/    avatar motion per word (tracked); public/media/ and public/mediapipe/ are downloaded, gitignored
│   ├── scripts/          fetch-media.mjs (setup:media), extract_motion.py, fit-letters.ts, verify-letters.ts
│   ├── server/           api.ts (/api/health, /api/coach, /api/phrases with Claude, local fallbacks), index.ts (prod server)
│   └── src/
│       ├── viewer/       SignViewer: 3D toon hand (letters), avatar (words), video fallback — reuse
│       ├── lib/          camera.ts (shared stream + hand landmarker), handshapes.ts (letter rules), engine.ts (distractors…)
│       ├── components/   CameraView.tsx
│       ├── content/      loaders and validation for signs, curriculum, scenarios
│       ├── data/         event log (Dexie), versioned events, export/import
│       ├── learning/     OLD profile + orchestrator (replaced in parts C and D), extensions.ts (LLM hooks)
│       ├── activities/   OLD activities (ported to tasks in parts A, B and E, then deleted)
│       └── screens/      OLD screens (removed in part A) + Lab.tsx (kept)
└── perception/ …         unrelated Python prototype (don't touch)
```

The target layout for new code (`app/`, `feed/`, `core/`, `tasks/`, `learner/`, `recommender/`, `camera/`, `dev/`, `i18n/`) is in SPEC §8.2.

## Commands

Run from `web/` unless noted. Node 22+ (local: v22.23.5) and npm 10.

```bash
npm install            # first time in a checkout (node_modules is not committed)
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

- `npm run typecheck`, `npm test` and `npm run build` pass in `web/`.
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
