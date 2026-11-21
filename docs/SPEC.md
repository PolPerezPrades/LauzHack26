# Signa redesign — requirements specification

> **Audience:** coding agents working on this repository. **Status:** approved plan, implemented part by part.
> **Companion files:** [`../AGENTS.md`](../AGENTS.md) (how to work here) and [`../PROJECT_STATE.md`](../PROJECT_STATE.md) (progress, decisions, handoff).

## Contents

0. [How to use this document](#0-how-to-use-this-document)
1. [Vision, goals and non-goals](#1-vision-goals-and-non-goals)
2. [Baseline: what exists today](#2-baseline-what-exists-today)
3. [Experience requirements: the feed](#3-experience-requirements-the-feed)
4. [Task formats](#4-task-formats)
5. [Camera policy](#5-camera-policy)
6. [Developer mode](#6-developer-mode)
7. [Learner model and recommender](#7-learner-model-and-recommender)
8. [Architecture](#8-architecture)
9. [Delivery plan: parts A–G](#9-delivery-plan-parts-ag)
10. [Glossary](#10-glossary)
11. [Sources](#11-sources)

---

## 0. How to use this document

- The work is split into **parts A–G** (§9). An agent implements **one part per session**, only when asked, and never starts the next part on its own.
- Before coding a part, read §1–§2, the sections that part references, and its entry in §9. Read [`PROJECT_STATE.md`](../PROJECT_STATE.md) first: it may record decisions that override this document.
- Words: **MUST** = required for the part to be accepted. **SHOULD** = expected unless there is a recorded reason not to. **MAY** = optional.
- Numbers marked *(default)* are starting values. They live in one config module and may be tuned. Record every tuning that changes behaviour as a decision in `PROJECT_STATE.md`.
- If the spec is wrong, ambiguous or impossible, don't silently diverge. Pick the most reasonable option, implement it, and record it under **Decisions** (or **Open questions** if the user must choose) in `PROJECT_STATE.md`.

## 1. Vision, goals and non-goals

### 1.1 Vision

Signa teaches **American Sign Language (ASL)** to English and Spanish speakers (English UI by default, Spanish from the language switch; §8.6). The redesign turns it into a **vertical, swipeable feed of short tasks**, in the spirit of TikTok (endless vertical feed), Tinder (a card stack you swipe away) and Duolingo (short exercises, gentle gamification).

There is no home screen and no lesson menu. **Opening the app shows a task.** Every task is a card. When the card leaves the screen, the next card is already waiting behind it. What comes next is chosen by a small recommender that learns from three things: what the learner knows, how they swipe, and how they perform.

### 1.2 Goals

| # | Goal | Measured by |
|---|---|---|
| G1 | Zero-friction start: a task on screen right after the app loads, on first launch and every later launch. | Part A acceptance |
| G2 | Four card exits with one shared animation style: **completed** (card flows up), **too easy** (left), **too hard** (right), **don't like this format** (down). The next card is visible behind the current one. | Part A acceptance |
| G3 | Task families: quick lesson, short question, quiz (choose / build), minigames. | Parts B and E |
| G4 | Camera tasks have a "can't use the camera now" button; after it, no camera use until the next app session. | Parts A and B |
| G5 | Learner knowledge is stored durably (local event log) and drives the choice of tasks, together with the swipe signals and performance. | Parts C and D |
| G6 | The recommender works for **one learner, from the first card**: no population data, no heavy models. | Part D simulations |
| G7 | A developer mode lets the developer play any task format with chosen content and inspect the learner model and recommender. | Parts A, C, D |
| G8 | One website, three ways to open it (§1.4), always in a vertical layout. | Parts A and F |
| G9 | Sounds for swipes, animations and results make the feed feel alive (§3.7). | Parts A and E |

### 1.3 Non-goals

- No collaborative filtering, server-side user accounts, sync or leaderboards.
- No new sign media made by generative AI, and no invented signs or sign descriptions (see §8.5).
- No other sign language than ASL in this redesign.
- No automatic camera recognition of signs with movement (words, sentences) in the core parts. Part G may explore it as an experiment.
- No native app. It stays a web app (PWA in Part F).

### 1.4 Delivery targets

The same build MUST work in all three:

| Target | How it's opened | Input | Camera (§5.6) |
|---|---|---|---|
| **Desktop website** | a desktop browser | mouse, trackpad, keyboard | the webcam |
| **Mobile website** | a phone browser | touch | the **front** camera |
| **Mobile web app** | installed to the home screen (PWA, `display: standalone`), or embedded in a native WebView shell | touch | the **front** camera |

- The layout is **always vertical**. On desktop and in landscape, the app shows the same phone-shaped column, centred (§3.2). There is no landscape or desktop-specific layout.
- Feature detection, not user-agent sniffing, decides behaviour (`pointer: coarse`, `display-mode: standalone`, `mediaDevices`), with a user-agent hint only as a fallback for the camera choice.
- **Embedded WebViews:** the app must not rely on browser chrome (no back-button navigation inside the feed, no reliance on new tabs or pop-ups). It must degrade gracefully when the host blocks the camera or audio (§5.3). Host-side requirements are documented in Part F: camera permission, inline media playback, and HTTPS or localhost for `getUserMedia`.

## 2. Baseline: what exists today

Code lives in `web/` (React 19, Vite 8, TypeScript 7, Dexie 4, ts-fsrs 5, MediaPipe tasks-vision, three.js + react-three-fiber). Design notes from the previous phase: [`docs/fase2.md`](fase2.md) (Spanish). Human-oriented overview of the pre-redesign app: [`web/README.md`](../web/README.md).

### 2.1 Content (keep)

| Content | Where | Notes |
|---|---|---|
| 103 signs: 26 letters, 10 numbers, 67 words | `web/content/signs/<id>.json` (schema `sign/1`) | Letters render as a procedural 3D toon hand. 41 words render as a toon avatar replaying motion extracted from real WLASL clips (`web/public/motion/*.json`). 26 words and the 10 numbers fall back to the cropped original video. |
| Units (abc1, abc2, abc3, numbers, greetings, family, colors, food, core, phrases) | `web/content/curriculum.json` | Levels 1–3. Unit order is the curriculum order. |
| 14 phrases (2–4 signs, ASL order, non-manual marker, grammar note) | `curriculum.json` → `phrases` | Validated at load: every sign must exist. |
| 4 comprehension passages, 2 dialogues (one is the "café" story) | `web/content/comprehension.json`, `web/content/dialogues.json` | Only use existing signs. |
| Real letter poses for 21 letters | `web/content/reference/letter-poses.json` | Used by the lab and the detector calibration. |

Media (WLASL clips, MediaPipe WASM and hand model) are **not in git**. `npm run setup:media` downloads them into `web/public/media/` and `web/public/mediapipe/`.

### 2.2 Code: reuse, port or replace

| Module | Today | In the redesign |
|---|---|---|
| `src/viewer/*` (`SignViewer`, 3D hand, avatar, video) | Shows any sign or sign sequence. | **Reuse.** Add what the feed needs (no orbit in the feed, an inactive/paused mode, preloading). |
| `src/lib/camera.ts`, `src/components/CameraView.tsx` | Shared webcam stream + MediaPipe Hand Landmarker. | **Reuse**, behind the camera session gate (§5). |
| `src/lib/handshapes.ts` | Rule-based checker for 24 static letters (not J, Z), per-finger hints, `matchingLetters` for confusions. | **Reuse.** Part E adds static number handshapes. |
| `src/content/*` | Loaders and validation for signs, curriculum, scenarios. | **Reuse.** Part C adds tracks and unlock rules on top. |
| `src/data/*` | Append-only event log in IndexedDB (Dexie), versioned events, upcaster, export/import. | **Reuse and extend** to event schema v2 (§8.4). |
| `src/learning/profile.ts` | Profile = pure fold over the log; FSRS card per item and modality; accuracy EMA. | **Replace** with the learner model v2 (§7), keeping the "pure fold over the log" principle. |
| `src/learning/orchestrator.ts` | Builds a fixed multi-step session plan with explanations. | **Replace** with the next-card recommender (§7.8). Its scoring ideas (due reviews, weak points, scenario readiness, game choice by behaviour) are inputs to §7. |
| `src/learning/activityCatalog.ts`, `src/activities/*` | 13 activities with a common metadata format. | **Port** to the task contract (§8.3): `recognize`/`quiz` → quiz-choice; `intro` + `imitate` → lesson; `conversation` tile bank → quiz-build and dialogue game; games → minigames (§4.7). Delete the old files once ported (Part F). |
| `src/screens/Home, Session, Onboarding, Placement, Results` | Home with daily plan, session runner, onboarding, placement test, results. | **Remove** (Part A). The feed replaces them; swipe-based self-placement replaces the placement test (§7.7). |
| `src/screens/Lab.tsx` (`#lab`) | Side-by-side sign verification lab. | **Keep** working. |
| `src/learning/extensions.ts`, `server/api.ts` | LLM extension points; `/api/coach`, `/api/phrases` with Claude. | **Keep untouched** in core parts. Part G may use them. |
| Repository root: `perception/`, `camctl.py`, `view_cam.sh`, `pyproject.toml` | Separate Python webcam-perception prototype (MX Brio). `web/scripts/extract_motion.py` runs in the same uv environment. | **Out of scope.** Don't modify. |

## 3. Experience requirements: the feed

### 3.1 Principles

1. **Task first.** No menus between the learner and practice. Settings and progress live in a small sheet opened from a corner icon.
2. **One card, one short task.** Typical card: 10–60 s. Games: at most 90 s. Longer formats are split or left out.
3. **Every exit teaches the system something** (§7.5). Exits are cheap and fast.
4. **Honest feedback.** Show the correct answer after a mistake. Never claim that the camera verified something it can't verify (§4.2).
5. **Vertical first.** Designed for a phone held upright. On desktop, the feed is a centred phone-shaped column.

### 3.2 Layout and card stack

- The feed fills the viewport (`100dvh`), respecting safe-area insets. On wide screens, the column is centred, max width ~480 px, with a 9:16 aspect when height allows. It stays vertical on desktop and in landscape (§1.4).
- **Stack:** the current card on top and the **next card behind it**, slightly smaller (scale ~0.95), offset ~10 px down and dimmed, so its edges and header show. Only these two cards are mounted.
- The card behind shows a **lightweight preview**: format icon and name, the prompt text and, if cheap, a static thumbnail. It MUST NOT start the camera, timers, video or WebGL loops. The full task mounts when the card becomes current.
- **Card anatomy** (top to bottom): header (format chip, task progress for multi-step tasks, an optional "why this card" button ℹ, and the camera-off button on camera tasks), task body, and a footer area for task controls. Cards MUST NOT scroll vertically. Content is designed to fit. A region that really must scroll is marked as a no-swipe zone (§3.3).
- **Feed overlay**, outside the cards: a small chip with streak and XP, and a settings button that opens the sheet (§3.6). Both stay out of the swipe area.

### 3.3 Exits, gestures and animations

| Exit | Gesture | Also by | Allowed when | Meaning (model effects in §7.5) | Animation |
|---|---|---|---|---|---|
| **Next** | swipe up | "Continuar" button, Enter/Space, ↑ | only after the task is completed | Completed, no extra opinion | card flies up |
| **Too easy** | swipe left | ⟵ button, ← | always (before or after completing) | The **content** is too easy for me | card flies left |
| **Too hard** | swipe right | ⟶ button, → | always | The **content** is too hard for me | card flies right |
| **Not this format** | swipe down | ⤓ button, ↓ | always | I don't like this **format** (this game, quiz type…) | card flies down |
| **Camera off** | "no camera now" button | — | camera tasks only | Can't use the camera now (§5) | card flies up |

Requirements:

- **One animation style for every exit.** Same duration *(default 280 ms)*, same easing (ease-in), the card leaves the viewport completely; horizontal exits add a slight rotation (±15°, Tinder-like). While the card leaves, the card behind grows into place (scale 0.95 → 1, ease-out, same duration). Releasing below the threshold springs the card back *(default 220 ms)*.
- **Drag feedback:** the card follows the pointer. Horizontal drag rotates it slightly. A label ("stamp") fades in with the drag distance: left "Muy fácil", right "Muy difícil", down "No me gusta este formato". An upward drag before completion does nothing (rubber band).
- **Commit thresholds** *(default)*: horizontal when |dx| ≥ 28 % of card width, or |dx| ≥ 40 px with speed ≥ 0.6 px/ms; down when dy ≥ 22 % of card height, or dy ≥ 40 px with speed ≥ 0.6 px/ms. The dominant axis decides. The decision function is pure and unit-tested.
- **Swipes after completion are allowed.** Between the result and the exit, a left/right/down swipe adds the learner's opinion to the completed task ("I got it right, and it was too easy"). §7.4 uses this to grade memory like Anki's Again/Hard/Good/Easy.
- **Taps vs drags:** inside a card, all task interactions are taps (choices, tiles, buttons). A pointer movement under ~8 px is a tap. A longer drag anywhere on the card is a swipe, unless it starts inside an element marked `data-noswipe` (text inputs, scroll areas, sliders). The 3D viewer's orbit control is **disabled in the feed** (it stays in `#lab` and dev mode).
- **Mobile browser guards:** cards use `touch-action: none`. The page uses `overscroll-behavior: none` so a swipe down never triggers pull-to-refresh. Keep side margins so edge-swipe navigation gestures are less likely to fire.
- **Accessibility:** every gesture has a visible button (a compact action bar) and a keyboard shortcut. Keyboard shortcuts are ignored while focus is in a text input. With `prefers-reduced-motion`, exits become a short fade plus a small translate in the same direction. Results are announced in an ARIA live region.
- The next card MUST be ready when the current one exits. No loading gap. Media for the next card is prefetched (§8.6).

### 3.4 Card lifecycle

1. **Queued:** the recommender (or, before Part D, a simple picker) chooses the next card, which renders as a preview behind the current one.
2. **Active:** the card becomes current; `card.shown` is logged; the task mounts. Timers start only after the enter animation.
3. **Result:** the task reports a `TaskResult` (§8.3). Evidence and `card.result` are logged. A feedback overlay shows inside the card: correct or incorrect, the correct answer, XP.
   - Correct: auto-advance (exit **Next**) after *(default)* 1.2 s, unless the learner swipes first.
   - Incorrect: no auto-advance. The learner reads the correction, then taps "Continuar" or swipes.
   - Game end screens: show score and best, auto-advance after *(default)* 2.5 s.
4. **Exit:** one of the exits in §3.3. `card.exit` is logged. If the exit invalidates the queued card, it is replaced before it is revealed (§7.8.6).

### 3.5 First launch and session start

- **First launch:** the first card is a **gesture tutorial card**: what the four exits mean, with the action buttons highlighted. Any exit dismisses it, and it is never scored. An optional second card explains that camera tasks process video on the device only. Then real tasks start.
- **Every launch:** a new app session starts (`app.open` event), and the feed shows a task immediately. No onboarding questions and no placement test. The learner's level is found by self-placement (§7.7): "too easy" swipes skip ahead fast.
- Camera permission is requested only when the first camera task becomes active, never up front.

### 3.6 Settings and progress sheet (Part F)

A bottom sheet opened from the overlay button:

- streak, XP, daily goal (cards per day, *(default)* 15) with a progress ring;
- progress per unit (receptive and productive mastery);
- formats the learner muted (§7.5), each with an "unmute" button;
- camera: state for this session, with a button to turn it back on, and the camera picker when there are several (§5.6);
- sound: on/off and volume (§3.7);
- data: export / import / reset (the event log as JSON, reusing `src/data/repository.ts`);
- about: content sources and credits (WLASL, MediaPipe, FSRS), as in today's footer;
- a hidden developer-mode entry (tap the version label 5 times) in addition to `#dev`.

### 3.7 Sound and haptics

Short sound effects make the feed engaging. They are part of every animation, not an afterthought.

| Moment | Sound (short, < 400 ms unless noted) |
|---|---|
| Drag past the commit threshold | a soft "tick" (once per drag) |
| Exit **Next** / completed | an upward "whoosh" |
| Exit **Too easy** / **Too hard** | a sideways "swish", pitched slightly differently per side |
| Exit **Not this format** | a downward "thud-swish" |
| Spring-back | a subtle "boing" |
| New card settles in front | a light "pop" |
| Correct answer / wrong answer | a bright two-note chime / a soft low tone (never harsh) |
| Combo, streak, daily goal reached | a short rising arpeggio (≤ 1 s) |
| Camera check holding / passed | a rising hum while holding the pose; a chime when it passes |
| Games | countdown beeps, hit, miss, life lost, game over, new personal best (Part E) |

Requirements:

- **No audio files and no dependencies by default:** a small sound engine (`src/sound/`) synthesises every effect with the Web Audio API (oscillators, noise, envelopes). This avoids licensing and download size. Recorded assets MAY be added later only with a clear licence (CC0) and a recorded decision.
- **Autoplay rules:** the `AudioContext` is created or resumed on the first user gesture (tap, key or drag). Before that, effects are silently skipped. No errors.
- **Control:** a mute toggle in the feed overlay (Part A) and sound settings in the sheet (Part F). Default: on, volume ~60 %. The preference is kept in the log via `settings.set`.
- Respect `prefers-reduced-motion` with quieter, shorter effects (not silence). Sounds are **never the only feedback**: every sound has a visual counterpart.
- Effects must be fire-and-forget (no blocking or awaiting in gesture handlers), must not overlap into noise on fast swiping (limit to one exit sound at a time), and must stop when the page is hidden.
- **Haptics (MAY):** short vibration patterns on exits and on wrong answers where `navigator.vibrate` exists (Android). Muting sound doesn't disable haptics; settings has a separate toggle.

## 4. Task formats

### 4.1 Common rules

- A **format** is a task type (one quiz type, one minigame…). Each format has a stable id (e.g. `quiz-choice`, `game-rain`) and belongs to a **family**: `lesson`, `question`, `quiz`, `game`, or `system` (tutorial and other non-learning cards).
- Every format implements the task contract (§8.3): pure metadata + a candidate generator + a React view. The view receives a **card plan** (format, target items, parameters) and reports exactly one `TaskResult`.
- Every format declares: required capabilities (camera), item kinds it accepts, the skill it trains (`receptive` = understand a sign, `productive` = produce it), its check mode (§4.2), typical duration, and how the challenge level maps to its parameters.
- Every format MUST be playable from developer mode with chosen content (§6).
- Every format MUST work, or be marked ineligible, without a camera.
- UI text comes from the i18n module, in both UI languages (English and Spanish, §8.6), and content is shown in its translation for the current language.

### 4.2 Check modes: how an answer is verified

| Mode | How the answer is checked | Evidence strength | Used by |
|---|---|---|---|
| `choice` | pick one of *n* options | weak, guessable (1/*n*) | quiz-choice, choice games |
| `build` | order tiles into a sequence | strong | quiz-build |
| `typed` | type the answer | strong | spell-reading |
| `camera` | automatic check with the hand detector (`handshapes.ts`) | strong (detector errors exist) | static letters; numbers after Part E |
| `mirror` | the learner signs while seeing themselves on camera, then sees the reference next to a replay of their own attempt, and grades themselves | weak, self-graded | words, sentences, J and Z, anything without detector rules |
| `self` | no camera: the learner signs from memory, reveals the reference, and grades themselves | weakest, self-graded | every productive task without camera |
| `game` | per-item results inside a game | weak to medium | minigames |
| `none` | exposure only, nothing tested | — | watching a lesson |

- A helper `checkModeFor(itemId, skill, cameraUsable)` decides between `camera`, `mirror` and `self` for productive tasks. When Part E adds number rules, number tasks switch to `camera` with no change in the formats.
- **Mirror recordings** use `MediaRecorder` on the existing stream, keep only the last ~4 s in memory, and are discarded when the card exits. They are never stored or uploaded.
- Self-graded results are logged as self-graded. §7.4 weights them less.

### 4.3 Quick lesson (`lesson`)

Teaches one **new** sign (letter, number or word).

1. **Watch:** `SignViewer` (3D hand / avatar / video), the meaning in the UI language and the gloss, replay and slow-motion buttons, the "real video" toggle when a clip exists, and the content's `description` when it exists. Never invent a description.
2. **Try it:** "Now you." With the camera: `camera` mode (live per-finger feedback as in today's `Imitate.tsx`, with "that looks like an N" confusions) or `mirror` mode. Without the camera: `self` mode ("Do it now", then "I did it" / "Show it again").
3. **Result:** an `exposure` evidence for the receptive skill, plus a productive `retrieval` evidence from the try (strength depends on the mode). Then the card completes.

Variants: a **relearn lesson** for an item the learner failed or found too hard (same flow, labelled "repaso").

### 4.4 Short question (`question`)

Like a lesson but **without showing how to do it first**. Only for items the learner has already met. Variants (params `variant`):

| Variant | Prompt | Check |
|---|---|---|
| `sign-term` | "Signa: *gracias*" (or a letter or number) | `camera` / `mirror` / `self`, then the reference is shown |
| `sign-sentence` | a sentence from `curriculum.json` phrases, in the UI language; the learner signs it **in ASL order** | `mirror` / `self`; then the avatar sentence, the gloss and the grammar note are shown |
| `spell-word` | "Deletrea: *CASA*" (fingerspelling) | `camera` letter by letter, as in today's `SignSprint.tsx` (J and Z are confirmed by the learner); `self` without camera |

Productive evidence per item. For `spell-word`: one evidence per distinct letter.

### 4.5 Quiz: choose (`quiz-choice`)

The avatar (or video, or 3D hand) signs something, and the learner picks its meaning from **n** options (*(default)* 4; 2–4 depending on the challenge level).

- Targets: a letter, number, word or phrase.
- Distractors: same unit or same kind first. At higher challenge, use the learner's **real confusions** first (today's `signOptions` in `lib/engine.ts`) and visually similar letters (e.g. M/N, A/S/T/E).
- Params: options count, distractor similarity, replay allowed, slow motion allowed.
- Receptive evidence: correct or wrong, with `confusedWith` when wrong.

### 4.6 Quiz: build (`quiz-build`)

Duolingo-style word bank. The avatar signs a **phrase**, and the learner rebuilds it by tapping tiles **in order**.

- Default tiles: the meanings of the signs in the UI language, in the signed (ASL) order, plus distractor tiles (*(default)* 2–4, depending on the challenge level). Tapping a placed tile removes it. "Comprobar" checks the order.
- Optional "translation" mode (MAY): tiles are the words of a natural translation in the UI language, when a phrase has an authored token list for that language (`tokens: { es, en }`, new optional field in `curriculum.json`).
- Feedback: the correct order, the gloss line (e.g. `YO GUSTAR PIZZA`), the non-manual marker and the grammar note. If the signs are right but the order isn't, say so (as `scriptedDialogue` does today).
- Evidence: receptive, one per sign of the phrase, plus one for the phrase id.
- Eligibility: a phrase is eligible when the learner knows ≥ 70 % of its signs (receptive) and has met all of them (§7.7).

### 4.7 Minigames (`game-*`)

Shared shell (Part E): an intro overlay with one-line rules, a 3-2-1 countdown, a HUD (time, score, lives), and an end screen with score and personal best. A game is a card: it ends by reporting a `TaskResult` with per-item evidence and a `game.score`. Max duration *(default)* 90 s. Challenge level maps to speed, lives, time and pool size. A game MAY also adapt inside a round (e.g. rain speeds up after each hit).

**Port from the current app (required):**

| Id | From | Skill | Camera | Mechanic |
|---|---|---|---|---|
| `game-rain` | `SignRain.tsx` | receptive | no | Signs fall faster and faster; pick the meaning before they land; 3 lives. |
| `game-memory` | `Memory.tsx` | receptive | no | Flip cards, pair each sign with its meaning. |
| `game-match` | `Matching.tsx` | receptive | no | Match signs and meanings against the clock; mistakes cost time. |
| `game-spell-read` | `FingerspellRead.tsx` | receptive | no | The hand fingerspells a word, faster at each replay; type it. |
| `game-spell-sprint` | `SignSprint.tsx` | productive | yes | Fingerspell as many words as possible in 60 s. |
| `game-story` | `Comprehension.tsx` | receptive | no | A short signed story, then 2–3 questions. Cut to fit 90 s. |
| `game-dialogue` | `Conversation.tsx` (+ café story) | productive | no | Answer a signed question by building the reply in ASL order. One or two exchanges per card. |

**New (required, from the product brief):**

| Id | Skill | Camera | Mechanic |
|---|---|---|---|
| `game-count-up` | productive | yes | "Count as high as you can": sign 1, 2, 3… in order within *(default)* 30 s; each number is detected before moving on. Needs number handshape rules (Part E adds them for the static numbers; 10 has movement and is learner-confirmed). |
| `game-abc-run` | productive | yes | "As many letters of the alphabet as you can": sign A→Z in order within *(default)* 60 s; J and Z are learner-confirmed; a hint appears after a few seconds stuck. |

**Backlog (implement at least two in Part E; more MAY follow):**

| Id | Skill | Camera | Mechanic |
|---|---|---|---|
| `game-true-false` | receptive | no | A sign and a word: same meaning or not? Fast taps, streak multiplier. |
| `game-minimal-pairs` | receptive | no | Tell two confusable signs apart (M/N, A/S…), fed by the learner's confusions. |
| `game-odd-one-out` | receptive | no | Four signs, one doesn't belong to the category (colour, family, food…). |
| `game-simon` | receptive (or productive with camera) | optional | The avatar signs a growing sequence; repeat it with tiles (or with the hand, for letters). |
| `game-whack-letter` | productive | yes | Letters pop up; sign each before it disappears. |
| `game-spell-name` | productive | yes | Fingerspell your own name (typed once, kept only in memory). |

## 5. Camera policy

1. **Camera session state** (one store, used by everything): `unknown` → `available` (a device exists and permission was granted or not asked yet) → `in-use`, or `off-this-session`, `denied` or `unavailable`.
2. **"No puedo usar la cámara ahora"** — a small button in the header of every camera task. Pressing it:
   - immediately stops every camera track and the hand landmarker loop;
   - sets the state to `off-this-session`, kept in memory and in `sessionStorage`, so an accidental reload of the same tab keeps it, while a new app launch (new tab or app start) clears it;
   - logs `camera.off` and exits the card with the **Camera off** exit (§3.3), which is neither a swipe nor a failure;
   - makes every camera-requiring format ineligible until the next app session. The queued card is replaced if it needs the camera.
   - The settings sheet (§3.6) can turn the camera back on for this session.
3. **Permission denied, or no camera:** same effect as `off-this-session`, with reason `denied` or `unavailable`. No repeated permission prompts within a session.
4. **Formats with optional camera** (lesson, question) don't disappear. They switch to `self` mode.
5. **Privacy:** frames are processed in the browser (MediaPipe). Nothing is uploaded. Mirror clips live in memory only (§4.2). This is stated in the first-launch camera card and in settings.
6. **Which camera** (`src/lib/camera.ts`, behind the camera session):
   - **Phone or tablet** (mobile website or installed/embedded web app; detected by `pointer: coarse` plus a touch-capable device, with a user-agent hint as a fallback): request the **front (selfie) camera** with `facingMode: "user"` as an ideal constraint. If that fails, fall back to any camera.
   - **Desktop/laptop:** use the **webcam**. Keep today's logic: the camera saved by the learner first, then a Logitech MX Brio if present, then the browser default.
   - The preview is **mirrored** for front cameras and webcams (as today). Hand features already work for either hand.
   - A camera switcher stays available when there are several cameras (as in today's `CameraView`). A manual choice is remembered per device (`localStorage`, as today).
   - Use resolution constraints suited to the device: ideal 1280×720 on desktop, ideal 640×480 to 1280×720 on phones (battery and heat). Always use `playsInline` and muted video (iOS).

## 6. Developer mode

Reached at `#dev` (and from the settings sheet, Part F). It is a tool for the developer; it can be plain-looking.

- **Play a format:** pick any registered format (including dev-only ones), optionally pick the content (items, phrase, passage, dialogue, unit) and the parameters (challenge level, options count, timers…), and choose camera on/off. "Play" opens the feed in **forced mode**: every card comes from that format, again and again, so a minigame can be tested repeatedly. Exits and results work exactly as in the real feed.
- **Sandbox by default:** dev mode writes to a separate event log (IndexedDB database `signa-dev`), so testing never pollutes the real learner model. A switch "use my real profile" is off by default. Buttons: reset sandbox, copy the real log into the sandbox, export or import the sandbox log, and load preset personas (empty, knows the alphabet, intermediate) built from synthetic events.
- **Inspectors** (added as parts land): event log (last 100 events, filterable) — Part A; learner state table (per item: status, pKnown, retrievability, due date, evidence level; per format: preference, mutes; challenge level) — Part C; recommender (top candidates for the next card with the feature breakdown from §7.8, a "force this one" button, a seeded RNG, and "simulate N cards with persona X" with summary metrics) — Part D.
- `#lab` (sign lab) stays as it is.

## 7. Learner model and recommender

### 7.1 What we looked at, and what we take

| Source | Key idea | What we take | What we leave |
|---|---|---|---|
| **Tutor MCP** (open-source MCP tutoring server) | Keeps **estimated** knowledge (BKT), **retained** memory (FSRS-5) and **demonstrated** mastery (passed checks) separate. Routing threshold 0.85, maintenance hysteresis (enter ≥ 0.85, leave < 0.70). Instruction score `relevance × (1 − estimate) × (1 + 1.5 × started)`. A `ZPD_DRIFT` alert after 3 failures lowers the difficulty target by 0.2. At most one spaced recall per two instruction activities. Removed IRT because item parameters were never calibrated. Auditable decisions. | The three-way split; the 0.85 / 0.70 thresholds; favouring already-started items; backing off after failures; a reason attached to every decision. | MCP/LLM plumbing, rubrics, affect surveys. |
| **LearnHarness** (h4ksclaw) | FSRS + BKT + concept graph per learner; weak < 50 %, mastered > 80 %. | Confirms FSRS + BKT as a light, per-learner pair. | Server, chat channels, LLM-built graphs. |
| **learning.harness** (mgersty) | "Tools own the structure, the LLM owns the content": a deterministic state machine on disk; levels from stats (mastery ≥ 80 % over ≥ 4 attempts); a prior is only trusted until there are 2 data points. | Deterministic, testable selection; evidence overrides priors. | Lesson/unit quizzes as fixed phases. |
| **learning-harness** (zytzrh) | Strict evidence ladder: AI replies can only move a concept to "exposed"; self-explanations count as "self_reported". | The evidence ladder (exposed → claimed → practiced → verified). "Too easy" is a claim, not proof. | — |
| **ZPDES** (Clément et al., 2015) | Bandit over activities inside the learner's zone of proximal development, bootstrapped by expert ordering. It beat the expert sequence in classroom studies, with few interactions and no population data. | Expert curriculum order + exploration among nearby options. Thompson sampling for formats. | Learning-progress rewards (too noisy with few cards). |
| **Elo / IRT for adaptive practice** (Pelánek, 2016) | Learner–item "matches"; cheap online updates. | Logistic intuition for predicted success. | Item-difficulty calibration needs a population; we use curriculum priors instead. |
| **85 % rule** (Wilson et al., 2019) | Learning is fastest around ~85 % accuracy (proved for two-choice tasks). The current app already targets 80–85 %. | Target success ≈ 0.80, moved by the challenge knob (§7.6). | — |
| **Response times** (Pelánek, 2018; Papoušek et al., 2015) | For correct answers, response time adds little over correctness; wrong answers carry more information. | Correctness + confusions as evidence; response time is logged only (§7.10). | Response time as knowledge evidence. |
| **Duolingo** (Birdbrain, "Can't listen now") | Difficulty fitted to the learner; a per-lesson opt-out for listening and speaking exercises. | Per-session camera opt-out (§5). | Population-trained models. |
| **Anki / FSRS** (`ts-fsrs`, already used) | Again / Hard / Good / Easy grades schedule reviews. | Card exits map onto these four grades (§7.4). | — |

### 7.2 Decision

A **transparent, rule-and-score policy over a small per-learner state**, recomputed by a pure fold over the event log:

1. **Knowledge** per (item, skill): BKT probability `pKnown`, with guess and slip depending on how the answer was checked. Light, per learner, and it weights a guessable 4-option quiz less than a camera-verified production.
2. **Memory** per (item, skill): an FSRS card (`ts-fsrs`) for review timing and retrievability.
3. **Evidence ladder** per (item, skill): what kind of proof exists.
4. **Challenge level** `c`: one global knob (plus a per-format offset), moved by success and by "too easy" / "too hard" swipes.
5. **Format preference**: one Beta distribution per format, moved by completions and "not this format" swipes, sampled with Thompson sampling.
6. **Next card** = generate candidates per format → score them with weighted, explainable features → pick among the best with seeded randomness, under hard variety constraints.

No collaborative filtering, no trained model, no calibration data. Every number is a documented constant (§7.11). Behaviour is checked with simulated learners (§7.12).

### 7.3 Learner state

**Items and skills.**

- An **item** is a sign id (`L-A`, `num-3`, `w-hello`) or a phrase id (`ph-name`).
- **Skills:** `receptive` (understand it when seen) and `productive` (sign it). Phrases only have meaningful receptive state in the core parts (productive sentence questions also log evidence on each sign).

**Per (item, skill) state** — `ItemSkillState`:

| Field | Meaning |
|---|---|
| `pKnown` | BKT probability that it is learned. Starts at `P0` *(default 0.10)* when first touched. Clamped to [0.01, 0.99]. |
| `card?` | FSRS card. Created at the first **retrieval** (not at exposure). |
| `evidence` | `none` → `exposed` (watched a lesson) → `claimed` (said "too easy" without proof) → `practiced` (≥ 1 correct retrieval) → `verified` (§ below). It only moves up, except `claimed`, which drops to `exposed` if a verification probe fails. |
| `attempts`, `correct`, `streak`, `lastTs`, `correctDays` | Counters; `correctDays` = distinct days with a correct answer. |
| `errorTs[]`, `confusions{}` | Last errors (max 10) and "confused with X" counts, as today. |
| `tooEasy`, `tooHard`, `cooldownUntilCard` | Swipe counters and a "don't offer as new before card #N" marker. |

`verified` = `pKnown ≥ 0.85` AND (one correct answer checked by `camera`, `typed` or `build`, OR correct answers on ≥ 2 distinct days).

**Status** (derived, used for selection):

- `new`: evidence `none`.
- `learning`: met but not yet known.
- `known`: `pKnown ≥ 0.85`. It stays known until `pKnown < 0.70` (hysteresis).
- `due`: known, and FSRS says it's due (retrievability below the target retention *(default 0.90)*).
- `claimed` items count as `learning`, flagged for a verification probe.

**Per format:** `alpha`, `beta` (Beta preference, both start at 1), `shown`, `completed`, `dislikes`, `muted`, and a challenge offset `cf` (starts at 0).

**Global:** challenge `c` (∈ [−1, 1], starts at 0), accuracy EMA (as today), XP, streak, daily counts, and the open units and frontier per track (§7.7).

**Session (not persisted as learner state):** session id, camera state, the list of cards shown this session (format, items, exit) for variety and spacing.

### 7.4 Updating from evidence

**BKT update** for a retrieval with check mode `m` (guess `g`, slip `s`, learn `T` from the table):

```text
correct: post = p·(1−s) / ( p·(1−s) + (1−p)·g )
wrong:   post = p·s     / ( p·s     + (1−p)·(1−g) )
then:    p'   = post + (1 − post)·T
exposure (lesson watch, no answer): p' = p + (1 − p)·T_expose
```

| Check mode | guess `g` | slip `s` | learn `T` |
|---|---|---|---|
| `choice` with *n* options | 1/*n* | 0.10 (+0.05 when distractors are high-similarity) | 0.15 |
| `build` | 0.05 | 0.10 | 0.15 |
| `typed` | 0.02 | 0.10 | 0.15 |
| `camera` | 0.05 | 0.15 | 0.20 |
| `mirror` (self-graded) | 0.30 | 0.10 | 0.20 |
| `self` (self-graded) | 0.35 | 0.10 | 0.15 |
| `game` | game-defined (1/*n* for choice games) | 0.20 | 0.10 |
| exposure | — | — | `T_expose` = 0.50 |

**FSRS update — applied when the card exits**, so the exit can refine the grade:

| Item result on this card | Exit **Next** / **Not this format** | Exit **Too easy** | Exit **Too hard** |
|---|---|---|---|
| wrong | Again | Again | Again |
| correct | Good | **Easy** | **Hard** |

- If the log ends, or the next `card.shown` arrives, without a `card.exit` (crash, closed tab), the card is closed with the default column.
- Exposure never creates or updates an FSRS card.
- Several retrievals of the same item on one card (e.g. a game) collapse into one FSRS review: wrong if any wrong, else correct.
- Self-graded "correct" (`mirror`, `self`) maps to Good at most (never Easy from the self-grade alone; the Too easy column still applies).

Accuracy EMA and the challenge level (§7.6) use retrieval correctness on every completed card. Confusions are recorded as today.

### 7.5 Swipe semantics

"Target items" are the items a card is about: 1 for lessons, questions and quiz-choice; the phrase and its signs for quiz-build. Games have a pool and no target items, so item-level rules don't apply to them; only the challenge and format rules do.

| Exit | Card completed? | Effect on target items | Challenge | Format preference |
|---|---|---|---|---|
| Next | yes | FSRS per §7.4 | via success (§7.6) | `alpha += 1` |
| Too easy | yes | FSRS Easy for correct items; `pKnown = max(pKnown, 0.90)` for correct items | `c += 0.10`, `cf += 0.10` | `alpha += 1` |
| Too easy | no, item `new` | **claim**: `pKnown = max(pKnown, 0.75)`, evidence `claimed`, queue a verification probe; count towards test-out (§7.7) | `c += 0.15`, `cf += 0.10` | — |
| Too easy | no, item met | FSRS Easy (treated as a self-graded retrieval); `pKnown = max(pKnown, 0.85)` | `c += 0.15`, `cf += 0.10` | — |
| Too hard | yes | FSRS Hard for correct items, Again for wrong ones; items get relearn priority | `c −= 0.20`, `cf −= 0.15` | `alpha += 1` |
| Too hard | no, item `new` | `cooldownUntilCard = now + 10`; for a phrase, its unmet signs get lesson priority ("prerequisites first") | `c −= 0.25`, `cf −= 0.15` | — |
| Too hard | no, item met | FSRS Again; `pKnown *= 0.6`; relearn lesson within ~3 cards | `c −= 0.25`, `cf −= 0.15` | — |
| Not this format | any | none (evidence from a completed task still counts). The content gets a small boost so it comes back soon **in another format** | — | `beta += 2`, `dislikes += 1`; **mute** when `dislikes ≥ 3` and `dislikes > 2 × completed` |
| Camera off | no | none | — | — (camera formats become ineligible this session, §5) |

- **Muted** formats are excluded from candidates, unless no other candidate exists. Only the learner unmutes them (settings sheet).
- **Preference decay:** after each card, `alpha` and `beta` relax towards 1 (`x ← 1 + (x − 1)·0.99`), so one bad moment is forgotten over time. Mutes don't decay.

### 7.6 Challenge level and target success

- After each completed card with retrievals: `c ← c + 0.30·(success − 0.80)`, where `success` is the share of correct retrievals on the card. Swipes adjust `c` as in §7.5. Clamp to [−1, 1].
- Effective challenge for a format: `ce = clamp(c + cf, −1, 1)`. Each format maps `ce` to its parameters (options 2→4, distractor similarity, sentence length, word length, timers, game speed, pool size, lives).
- **Target success:** `target = clamp(0.80 − 0.10·c, 0.65, 0.92)`. "Too easy" swipes make the recommender aim at harder cards, and "too hard" swipes at easier ones.
- **Back-off** (Tutor MCP's `ZPD_DRIFT`): 3 wrong retrievals in a row → `c −= 0.20`, and the next card is a relearn lesson or an easier format for the failed item.

### 7.7 Curriculum, unlocking, frontier and self-placement

- **Tracks** (ordered units): `fingerspelling` = abc1 → abc2 → abc3; `numbers` = numbers; `vocabulary` = greetings → family → colors → food → core; `phrases` = phrases.
- **Initially open:** abc1 and greetings. Numbers open when abc1 is ≥ 60 % met. A unit opens when the previous unit in its track has ≥ 60 % of its items with `pKnown ≥ 0.5`, or the learner tested out of it.
- **Frontier:** the first `new` items, in unit order, of every open unit (skipping items in cooldown).
- **New-item pacing:** `inFlight` = items in status `learning` (counted once per item). New lessons are only offered when `inFlight < maxInFlight = round(4 + 2·c)` and fewer than 8 reviews are overdue.
- **Phrases** (quiz-build, sign-sentence): eligible when ≥ 70 % of their signs are known (receptive) and all have been met.
- **Self-placement / test-out** (replaces the placement test): 2 consecutive "too easy" exits on **new** items of the same unit (or 3 in the same track) mark the unit's remaining new items as `claimed` (`pKnown = 0.60`), open the next unit, and queue **one verification probe**: a quiz-choice over 3 claimed items (or a camera question for letters, when available). Probe results go through the normal BKT update, so a failed probe brings items back to learning.
- **Verification probes** for claimed items are due within *(default)* 5–10 cards.

### 7.8 Next-card algorithm

`recommend(state, ctx, rng) → CardPlan` is a pure function (no React, no I/O). It must run in well under 10 ms.

**7.8.1 Candidate generation.** Each eligible format's `generate()` proposes up to ~5 concrete candidates (format + target items or pool + params from `ce`). Eligibility: not muted; camera available if required; enough content of the right kind and status (e.g. `game-rain` needs ≥ 6 items known or learning with `pKnown ≥ 0.5`; `game-memory` ≥ 4; `game-abc-run` ≥ 5 letters met; quiz-build needs an eligible phrase). Typical sources:

- lesson: frontier items (one per open unit, up to 3) and relearn items;
- question: learning and due items for the productive skill; phrases for `sign-sentence`; words made of met letters for `spell-word`;
- quiz-choice: learning and due receptive items; verification probes;
- quiz-build: eligible phrases;
- games: a pool of met items of the right kinds, weakest first.

**7.8.2 Predicted success.** For a tested (item, skill) with check mode `m`:

```text
R          = FSRS retrievability now (1 if no FSRS card yet)
pRecall    = pKnown · R
pCorrect   = g_m + (1 − g_m − s_m) · pRecall
p̂(card)    = pCorrect for single-item cards; the product over signs for quiz-build (all must be right);
             the mean over the pool for games
```

**7.8.3 Features** (each in [0, 1]):

| Feature | Definition |
|---|---|
| `need` | Max over target items (mean over a game's pool): relearn window (failed 3–6 cards ago) 0.9 · verification probe 0.8 · due review `0.6 + 0.4·(1 − R)` · learning `0.5 + 0.1·recentErrors` (cap 1) · new item at the frontier 0.7 if pacing allows, else 0 (+0.2 while fewer than 3 items were ever introduced) · known, not due 0.15 |
| `fit` | `exp(−((p̂ − target)/0.20)²)`. Lessons of frontier items: 1. |
| `pref` | A Thompson sample from Beta(`alpha`, `beta`) of the format. |
| `variety` | 1, minus 0.5 if the same format as the previous card, minus 0.25 if the same as two cards ago, minus 0.5 if a target item was on one of the last 2 cards (except the relearn window). Floor 0. |
| `cadence` | Games only: `min(1, cardsSinceLastGame / 6)`; 0 if a game was in the last 3 cards. |
| `balance` | Productive tasks when the camera is usable and productive mastery lags receptive mastery on the target items: up to 1. |

**7.8.4 Score and selection.**

```text
score = 0.40·need + 0.25·fit + 0.15·pref + 0.12·variety + 0.08·max(cadence, balance)
```

Then pick by softmax over the top 5 scores (temperature *(default)* 0.05) with a **seeded RNG**: the same state, context and seed give the same card.

**7.8.5 Hard constraints** (applied before scoring):

- never the same format 3 times in a row (unless it is the only eligible one, or dev forced mode);
- never the same format + target items twice in a row;
- no quiz or question on an item that is still `new` (only lessons and probes for claimed items);
- no camera format when the camera is not usable;
- at most one spaced review per two new-item lessons while `inFlight` is low (Tutor MCP's recall ratio), so beginners keep moving;
- cold start (empty state): the first real card is a lesson from abc1 or greetings.

**7.8.6 Queue and invalidation.** The feed holds `current` and `next`. `next` is chosen when `current` becomes active (one card of lag is accepted). On exit, `next` is **replaced before the reveal** if it is now invalid: its format was just disliked or muted; it needs the camera and the camera is off; its target items were just claimed "too easy" (for lessons); or the same item failed and needs spacing. After the reveal, a new `next` is chosen from the updated state.

### 7.9 Explanations

Every candidate carries machine-readable reasons (e.g. `{ code: "due_review", item: "w-hello", r: 0.72 }`, `{ code: "format_pref", alpha: 3, beta: 1 }`) and its feature breakdown. Reasons are rendered in the UI language by the i18n module for the ℹ button ("Repaso: hace días que no ves *hola*"), and shown raw in dev mode. `card.shown` logs the reasons and the score.

### 7.10 Speed and correctness: decision

- **Correctness: used.** It is the core evidence, weighted by check mode (guess and slip), with confusions kept for distractors and minimal-pair games.
- **Response time: logged but NOT used** for knowledge, scheduling or challenge. Reasons: (1) here it mostly measures non-knowledge time (sign and video length, avatar playback, camera detector latency and hold time, animations, device speed); (2) one learner gives too few samples per format to normalise it; (3) research finds response times add little over correctness for correct answers; (4) the "too easy" swipe is a direct, stronger signal for the same thing.
- **Exception:** inside timed minigames, speed is part of the game itself (score, speed-ups), and a game MAY adapt its own speed within a round.
- Times stay in the log, so a later part can revisit this with data.

### 7.11 Constants (defaults)

All constants in one module (e.g. `src/learner/params.ts` and `src/recommender/config.ts`): `P0 = 0.10`; the check-mode table (§7.4); `T_expose = 0.50`; known ≥ 0.85, leave < 0.70; target retention 0.90; challenge step `0.30·(success − 0.80)`; swipe steps (§7.5); target success `0.80 − 0.10·c` in [0.65, 0.92]; `maxInFlight = round(4 + 2·c)`; overdue cap 8; cooldown 10 cards; relearn window 3–6 cards; probe window 5–10 cards; preference decay 0.99; mute rule 3 dislikes and > 2 × completions; score weights 0.40 / 0.25 / 0.15 / 0.12 / 0.08; fit width 0.20; top-5 softmax with temperature 0.05.

### 7.12 Simulation and acceptance metrics

A simulation harness (Part D) runs the real `recommend()` and the real state fold against **simulated learners**. Each simulated learner has a hidden true-knowledge model (e.g. logistic in "true ability − item difficulty" with learning and forgetting), answers according to it, and swipes according to a persona. It MUST pass (seeded runs, 300 cards unless stated otherwise):

1. **Cold start:** in the first 10 cards, ≥ 3 lessons, and no question or quiz on a never-introduced item.
2. **Fluent learner** (knows letters, numbers and greetings; swipes "too easy" on known content): the frontier leaves the alphabet and the numbers within 25 cards, and ≥ 1 verification probe is shown.
3. **Struggling learner** (~50 % correct, swipes "too hard" often): after warm-up, ≤ 1 new item per 8 cards, and relearn cards appear.
4. **Format hater** (always swipes "not this format" on `game-rain`): after its 3rd dislike, `game-rain` appears 0 times in the next 100 cards, and the content keeps flowing in other formats.
5. **No camera:** after camera off, zero camera-requiring cards for the rest of the session; camera formats come back in a new simulated session.
6. **Variety:** never 3 cards of the same format in a row; never the same card twice in a row.
7. **Spacing:** a failed item reappears within 3–10 cards; a due review is shown within 15 cards while it is the most overdue item.
8. **Success band:** for an average simulated learner, mean success on scored cards between 0.70 and 0.90 after the first 30 cards.
9. **Determinism:** same log + same seed → same next card.
10. **Speed:** state fold + `recommend()` take < 10 ms per card on a 2,000-event log (Node, CI-class machine).

## 8. Architecture

### 8.1 Stack and constraints

- Keep the stack in `web/`: React 19, Vite 8, TypeScript (strict), Dexie (IndexedDB), ts-fsrs, MediaPipe tasks-vision, three.js / react-three-fiber.
- **Dependencies:** prefer none. Any new package needs a reason in `PROJECT_STATE.md`, an **exact** version, and a release older than the `before=` date in `web/.npmrc` (supply-chain rule; Python has the same rule via `exclude-newer` in `pyproject.toml`). Expected additions: Vitest (Part A); Playwright MAY come in Part F.
- Gestures and animations use Pointer Events + CSS transforms / Web Animations API. No gesture or animation library unless a recorded decision justifies it.
- **Pure logic stays pure:** learner model, recommender, swipe decisions, evidence mapping and format generators import no React or DOM, so they run in Node tests.

### 8.2 Target module layout (`web/src/`)

Existing folders (`viewer/`, `content/`, `data/`, `lib/`, `components/`) stay where they are. New code goes into:

```text
app/          App shell, routing (#dev, #lab, feed), providers (repository, learner state, camera session)
feed/         FeedScreen, CardStack, swipe.ts (pure decision), useSwipe hook, ActionBar, FeedbackOverlay, CardPreview
core/         contracts: types.ts (TaskSpec, CardPlan, TaskResult, Evidence, Exit…), rng.ts (seeded), ids
tasks/        registry.ts (pure metadata), views.tsx (format → component), ui/ (TaskFrame, ChoiceGrid, TileBank,
              SelfCheck, MirrorCompare, GameFrame), one folder per format: <format>/spec.ts + View.tsx
learner/      state.ts (fold), bkt.ts, schedule.ts (FSRS wrapper), swipes.ts, curriculum.ts (tracks, frontier),
              queries.ts, params.ts
recommender/  candidates.ts, features.ts, select.ts, explain.ts, config.ts, index.ts (recommend), sim/ (personas, harness)
camera/       cameraSession.ts (state store + opt-out), checkMode.ts
sound/        Web Audio engine: synthesised effects, unlock on first gesture, mute/volume, optional haptics
dev/          DevScreen and inspectors
i18n/         en.ts (reference shape) + es.ts: all user-facing strings; the language store (useT) and the switch
```

### 8.3 Contracts (sketch, refine in Part A)

```ts
type Skill = "receptive" | "productive";
type CheckMode = "choice" | "build" | "typed" | "camera" | "mirror" | "self" | "game" | "none";
type Family = "lesson" | "question" | "quiz" | "game" | "system";
type ExitKind = "next" | "too_easy" | "too_hard" | "dislike_format" | "camera_off";

/** Pure metadata + generator. No React. One per format. */
interface TaskSpec<P extends object = object> {
  id: FormatId;                         // "lesson", "question", "quiz-choice", "quiz-build", "game-rain", …
  family: Family;
  icon: string;                         // emoji
  i18nKey: string;                      // title and one-line rules come from i18n
  requires: { camera: "required" | "optional" | "none"; itemKinds: ItemKind[] };
  trains: Skill[];
  seconds: number;                      // typical duration
  devOnly?: boolean;
  params(ce: number, ctx: GenContext): P;                      // challenge level → concrete parameters
  generate(q: LearnerQueries, ctx: GenContext): CandidateDraft<P>[];  // Part A may return simple drafts
}

interface CardPlan<P extends object = object> {
  cardId: string; format: FormatId; items: string[]; pool?: string[]; content?: string; // passage/dialogue id
  params: P; reasons: Reason[]; score?: ScoreBreakdown;
}

/** React side: views.tsx maps FormatId → component with these props. */
interface TaskViewProps<P extends object = object> {
  plan: CardPlan<P>;
  active: boolean;                       // false = preview behind the current card: no camera, timers or loops
  camera: CameraSession;                 // state + optOut() + acquire/release helpers
  report(result: TaskResult): void;      // call exactly once
}

interface TaskResult {
  success: number;                       // 0..1 share of correct retrievals (1 for pure lessons)
  evidence: EvidenceDraft[];
  score?: number;                        // games
  xp: number;
  feedback?: { correct: boolean; answer?: string; note?: string };
}

interface EvidenceDraft {
  itemId: string; skill: Skill; kind: "retrieval" | "exposure";
  correct?: boolean; check: CheckMode; options?: number; similarity?: "low" | "high";
  selfGraded?: boolean; hints?: number; ms?: number; confusedWith?: string;
}

/** The feed asks a CardSource for cards: a simple picker in Part A, the recommender from Part D, forced mode in dev. */
interface CardSource { next(ctx: FeedContext, avoid?: { formats?: FormatId[]; items?: string[] }): CardPlan | null }
```

### 8.4 Event log v2

The log stays append-only, in IndexedDB (Dexie). `EVENT_SCHEMA_VERSION = 2`. The learner state is **always** a pure fold over the log, and nothing derived is stored as truth (a memoised or incremental fold is fine).

| Event | Fields (besides `id`, `seq`, `ts`, `v`) |
|---|---|
| `app.open` | `sessionId`, `device`, `cameraAvailable`, `appVersion` |
| `card.shown` | `sessionId`, `cardId`, `format`, `items`, `pool?`, `content?`, `params`, `reasons`, `score?`, `source: "picker" \| "recommender" \| "dev"` |
| `evidence` | `sessionId`, `cardId`, `format`, + all `EvidenceDraft` fields |
| `card.result` | `sessionId`, `cardId`, `format`, `success`, `xp`, `ms` |
| `card.exit` | `sessionId`, `cardId`, `format`, `exit: ExitKind`, `completed`, `msVisible` |
| `game.score` | `sessionId`, `cardId`, `format`, `score`, `params` |
| `camera.off` | `sessionId`, `reason: "user" \| "denied" \| "unavailable" \| "error"` |
| `format.unmute` | `format` |
| `settings.set` | partial settings (daily goal, camera preference, …) |

Upcasting v1 logs, best effort: v1 `answer` → `evidence` (`check` derived from the activity: recognize/quiz/rain/match/memory → `choice` with 4 options; imitate/camera/sprint → `camera`; spell → `typed`; conversation/story → `build`), closed with a synthetic default exit. Other v1 events are ignored. Export and import keep the current bundle format, with `schemaVersion` 2.

### 8.5 Content, privacy and honesty rules

- Never invent signs, sign descriptions or media. A sign's "how to" text comes only from its content file (`description`, `phonology`). Phrases and dialogues may only use existing sign ids, and are validated at load (as today).
- WLASL clips are under the *Computational Use of Data Agreement* (academic, non-commercial). Keep the credits visible (settings → about, and `SignViewer` credits where they exist today).
- Camera frames are processed on the device and never sent anywhere. Mirror clips are memory-only (§4.2). The event log stays in the browser, unless the learner exports it.
- Content review status (`review.status`) is shown in dev mode. Content stays `auto-checked` until a fluent signer reviews it.

### 8.6 Non-functional requirements

- **Performance:** swipe tracking at 60 fps on a mid-range phone (transform-only animations). At most 2 cards mounted. At most ~6 live WebGL contexts at a time (multi-viewer games share or reuse canvases, or use video thumbnails). The next card's media (motion JSON, video) is prefetched. Heavy modules (three.js, MediaPipe) load lazily.
- **Offline (Part F):** after the first load, the app shell and content JSON work offline (service worker). Large media MAY stay network-only.
- **Targets and browsers:** the three targets in §1.4, in current Chrome/Edge, Firefox and Safari (iOS ≥ 17) on mobile and desktop, in standalone PWA mode, and in an embedded WebView (Android WebView, iOS WKWebView). The camera and the sound engine need HTTPS or localhost. To test on a phone during development, use the Vite dev server with `--host` over HTTPS (e.g. a local certificate or a tunnel).
- **i18n:** two UI languages, English (the default) and Spanish, chosen with the EN | ES switch in the feed overlay, dev mode and the lab. The choice is a device preference kept in localStorage, not learner state, so it is not logged. User-facing strings live in `src/i18n/en.ts` (the reference shape) and `src/i18n/es.ts` (typed against it, so a missing string fails the build); components read them with `useT()`. Content keys its translations by language code (`translations`, unit `title`, phrase `note`: `{ es, en }`); text that exists only in Spanish (letter descriptions, curator notes) is shown as is, marked `lang="es"`. Spanish examples in this spec (prompts, tiles, reason strings) stand for the text in the current UI language. Code, comments and agent docs are in English.
- **Accessibility:** §3.3; contrast ≥ 4.5:1 for text; every icon button has an accessible name.
- **Quality gates for every part:** `npm run typecheck`, `npm test`, `npm run build` pass; no new console errors in the dev server; the part's manual checks pass.

## 9. Delivery plan: parts A–G

Rules for every part:

- Do **only** the requested part. Leave later parts' features out, even small ones. Stubs that later parts will replace are fine.
- The app MUST build and run at the end of every part (no half-migrated state).
- Tick the part's checklist in `PROJECT_STATE.md`, record decisions and deviations, and write the handoff note.
- Acceptance = every MUST item of the part works, plus the quality gates in §8.6.

Dependency order: **A → B → C → D → E → F**, with G optional. B and C both depend only on A. If the user asks, C may be done before B.

### Part A — Feed foundation

**Goal:** opening the app shows a task card inside the new vertical feed; all exits, animations, events, the camera opt-out and a first dev mode work end to end, with one real task format.

Scope:

1. **Test tooling:** add Vitest (pinned per §8.1) and `npm test`. Pure modules get colocated `*.test.ts` files.
2. **Contracts** (`src/core/`): the types from §8.3, a seeded RNG, id helpers.
3. **Event log v2** (`src/data/events.ts`): the event types from §8.4, schema version 2, the v1 upcaster. Unit tests: makeEvent, upcast, export → import round trip.
4. **Feed shell** (`src/feed/`): the full-viewport layout, the two-card stack with the preview behind, `swipe.ts` (pure commit decision, unit-tested), the `useSwipe` hook, the four exits with one shared animation style and the spring-back, drag stamps, the action bar, keyboard shortcuts, reduced-motion handling, the feedback overlay with auto-advance rules (§3.4), mobile guards (§3.3), and `card.shown` / `evidence` / `card.result` / `card.exit` logging.
5. **Camera session** (`src/camera/cameraSession.ts`): the state machine from §5, `sessionStorage` persistence, a shared "no camera now" header button, stopping tracks on opt-out, `camera.off` logging, filtering of camera-required formats, and **camera selection** (§5.6): front camera on phones, webcam on desktop.
6. **Task registry** (`src/tasks/`) with:
   - `system-tutorial`: the first-launch gesture tutorial card (§3.5);
   - `quiz-choice`: ported from `Recognition.tsx` / `Quiz.tsx`, with options count from params (§4.5);
   - `dev-camera-probe` (dev-only): shows the camera preview and completes once a hand is detected for ~1 s, to test the camera gate and permissions.
7. **Interim card source** `simplePicker`: alternates eligible non-dev formats, walks the curriculum order for content, and skips camera formats when the camera isn't usable. Part D replaces it.
8. **Dev mode v1** (`#dev`, §6): format picker, content picker, params, camera on/off simulation, forced-mode play, sandbox database `signa-dev` with reset, and the event-log inspector.
9. **Routing and cleanup:** the feed is the default route; `#lab` still works; `#dev` opens dev mode. Delete the five old screens (`Home`, `Session`, `Onboarding`, `Placement`, `Results`). Keep `learning/`, `activities/`, `lib/` and `server/` even if some of their exports become unused: later parts port or remove them.
10. **i18n:** create `src/i18n/` and use it for all new UI text. (Follow-up after Part A: English default plus Spanish, with a language switch; D-038.)
11. **Sound engine** (`src/sound/`, §3.7): synthesised effects for the threshold tick, the four exits, spring-back, card settle, and correct/wrong; unlock on first gesture; a mute toggle in the feed overlay (persisted with `settings.set`); optional haptics.
12. **Targets** (§1.4): the vertical layout works on desktop (mouse, keyboard), in mobile browsers (touch) and in standalone display mode. A minimal web manifest is fine here; the full PWA is Part F.

Acceptance (MUST):

- [ ] Loading `/` shows the tutorial card on first launch, then a quiz-choice card. Every later launch shows a task immediately. No home, onboarding or placement screen.
- [ ] The next card's preview is visible behind the current card at all times.
- [ ] Left, right and down swipes work with touch (mobile emulation), mouse drag, the action-bar buttons and the keyboard. Up/Next works only after completion. All exits share the same animation; below-threshold drags spring back.
- [ ] A correct quiz answer shows feedback and auto-advances upward; a wrong one waits for "Continuar" or a swipe; swiping after completion is possible.
- [ ] Every card writes `card.shown`, and every exit writes `card.exit`; completions write `evidence` and `card.result` (checked in the dev log inspector).
- [ ] In `dev-camera-probe`, "no camera now" stops the camera (the browser's camera indicator turns off), logs `camera.off`, exits the card, and no camera card appears again until a new tab; a reload of the same tab keeps it off.
- [ ] Dev mode can force any format with chosen content, plays it repeatedly, and writes only to `signa-dev`.
- [ ] Each exit, spring-back, card settle and correct/wrong answer plays its sound after the first interaction; the mute toggle silences everything; no console errors before the first gesture.
- [ ] On a phone (or with mobile emulation plus a fake camera), the camera request asks for the front camera (`facingMode: "user"`); on desktop the webcam is used, keeping the saved-choice and MX Brio preference.
- [ ] The feed is a vertical column on a desktop browser (including a landscape window) and full-screen on a phone.
- [ ] Unit tests: swipe decision, event upcast, picker camera filtering. `typecheck`, `test` and `build` pass.

Out of scope: the other formats, the learner model v2, the recommender, the settings sheet, the PWA.

### Part B — Learning task formats

**Goal:** the four core learning formats work in the feed and in dev mode, with and without a camera.

Scope:

1. **Shared task UI** (`src/tasks/ui/`): `TaskFrame`, `ChoiceGrid`, `TileBank`, `SelfCheck` (reveal + self-grade), `MirrorCompare` (live mirror, last ~4 s recorded in memory, side-by-side replay with the reference, self-grade).
2. **`checkModeFor()`** (`src/camera/checkMode.ts`), §4.2, with tests.
3. **`lesson`** (§4.3): watch → try → result, including the relearn variant. Camera mode reuses the `Imitate.tsx` logic (per-finger highlights, "looks like an N" confusions).
4. **`question`** (§4.4): `sign-term`, `sign-sentence`, `spell-word`, each in its camera, mirror and self modes.
5. **`quiz-choice` polish** (§4.5): letters, numbers, words and phrases; similarity-based and confusion-based distractors; replay and slow-motion params.
6. **`quiz-build`** (§4.6): gloss mode (MUST); translation mode (MAY, only with `es_tokens`).
7. **Generators:** each format's `generate()` returns sensible drafts from a minimal query interface. The full `LearnerQueries` arrives in Part C; until then, use a small stub (e.g. the items met so far, read from v2 `evidence` events, plus the curriculum order). Don't extend the old `learning/profile.ts`: it only understands v1 events.
8. **Evidence mapping tests:** given a result, the evidence drafts have the right skill, check mode, `selfGraded` flag and items.

Acceptance (MUST):

- [ ] Each format is playable from dev mode for every content kind it supports, with the camera on and off.
- [ ] With the camera off, no format requests the camera; camera-optional formats run in `self` mode.
- [ ] Mirror clips are never persisted (no IndexedDB, Cache or network writes), and are released on card exit.
- [ ] quiz-build reports "right signs, wrong order" distinctly.
- [ ] The simple picker now rotates through all formats. `typecheck`, `test` and `build` pass.

Out of scope: the learner model v2, the recommender, minigames.

### Part C — Learner model v2

**Goal:** a pure, tested learner state built from the v2 log, exactly as in §7.3–§7.7, plus its dev inspector.

Scope:

1. `src/learner/`: the fold (`state.ts`), BKT (`bkt.ts`), the FSRS wrapper with grade-at-exit (`schedule.ts`), swipe rules (`swipes.ts`), tracks, unlocking, frontier and test-out (`curriculum.ts`), queries for the recommender (`queries.ts`: `predictSuccess`, `status`, `due`, `learning`, `frontier`, `knownPool`, `formatPref`, `challenge`…), and every constant in `params.ts`.
2. The v1 upcast path folds old `answer` events.
3. Incremental or memoised fold so appending one event doesn't refold everything on each card.
4. Dev inspector: learner state table, format preferences and mutes, challenge level, open units and frontier.
5. Make the formats' generators use the real queries (replace the Part B stub adapter), and remove `learning/profile.ts` when nothing uses it.

Acceptance (MUST): unit tests cover every row of the tables in §7.4 and §7.5, the BKT formulas, hysteresis, the evidence ladder and `verified`, test-out, unlock rules, the grade-at-exit rule including a missing `card.exit`, determinism, and fold equality after export → import. `typecheck`, `test` and `build` pass.

Out of scope: the recommender (keep the simple picker running).

### Part D — Recommender

**Goal:** the feed is driven by `recommend()` (§7.8), proven by the simulation metrics (§7.12).

Scope:

1. `src/recommender/`: candidates, features, scoring, hard constraints, seeded softmax selection, explanations, config.
2. `CardSource` implementation backed by the recommender, with queue invalidation (§7.8.6); `card.shown` logs reasons and score.
3. The ℹ "why this card" button, with reason strings in both UI languages.
4. Simulation harness (`recommender/sim/`): ground-truth learner model, personas (novice, fluent, struggling, format hater, no camera, random swiper), and a script `npm run simulate` printing the §7.12 metrics; the metrics also run as Vitest tests.
5. Dev inspector: top candidates with the feature breakdown, force-next, seed control, and "simulate N cards with persona X".
6. Remove `learning/orchestrator.ts` and the simple picker from the default route (the picker MAY stay for dev).

Acceptance (MUST): all 10 metrics of §7.12 pass in tests. A manual run in the browser feels varied, and the ℹ reasons make sense. `typecheck`, `test` and `build` pass.

Out of scope: new formats (Part E).

### Part E — Minigames

**Goal:** the game shell, the ported games and the new camera games (§4.7).

Scope:

1. `GameFrame` (intro, countdown, HUD, end screen, personal best from `game.score`), with game sounds (§3.7: countdown, hit, miss, life lost, game over, new best).
2. Port: `game-rain`, `game-memory`, `game-match`, `game-spell-read`, `game-spell-sprint`, `game-story`, `game-dialogue` (each ≤ 90 s, with params from `ce`, a generator, per-item evidence, and dev-mode play).
3. Number handshape rules (static 1–9) in `lib/handshapes.ts`, calibrated on reference poses taken from the existing number clips or motion files with the existing pipeline. Document their limits. `checkModeFor` then returns `camera` for those numbers.
4. New: `game-count-up` and `game-abc-run`.
5. At least two backlog games (§4.7); `game-minimal-pairs` is recommended.
6. Delete the old `activities/` files that were ported, and `learning/activityCatalog.ts` if unused.

Acceptance (MUST): every game is playable from dev mode, ends within its time limit, reports evidence and `game.score`, and respects the camera gate; the recommender picks games according to cadence and eligibility (simulation metric 6 still passes); `typecheck`, `test` and `build` pass.

### Part F — Product polish and cleanup

1. Settings and progress sheet (§3.6), including unmute, camera re-enable, the camera picker, and sound/haptics settings.
2. PWA: manifest, icons, portrait orientation, `display: standalone`, installability, offline shell and content (§8.6). Test the three targets of §1.4 on real devices (desktop webcam, phone browser with the front camera, installed app). Write `docs/embedding.md` for hosts that embed the app in a WebView: granting camera permission (the microphone is never needed), inline media playback, HTTPS, and no pop-ups.
3. Performance pass (§8.6): WebGL context budget, prefetching, lazy chunks, a 60 fps swipe check on a real phone.
4. Accessibility pass (§3.3, §8.6).
5. Cleanup: remove dead code and CSS from the old app. Rewrite `web/README.md` for the new app. Update `README.md`.
6. MAY: Playwright smoke tests (load, swipe each direction, camera-off flow with a fake camera).

Acceptance (MUST): Lighthouse PWA installable; no dead modules; the README matches reality; all gates pass.

### Part G — Optional extensions (only when asked, one at a time)

- **G1 — Experimental word-sign check:** compare the learner's hand trajectories (MediaPipe hands, or holistic) with the reference motion files using DTW over normalised features. Show it as "beta" feedback only; never as a hard failure. Record precision on a small labelled set.
- **G2 — LLM features:** wire `src/learning/extensions.ts` to `server/api.ts` (coach summaries every N cards; generated practice phrases validated against existing signs only).
- **G3 — Content growth:** more WLASL signs through `scripts/extract_motion.py`; ASL-LEX phonology import; `es_tokens` for phrases; review by a fluent signer.

## 10. Glossary

| Term | Meaning |
|---|---|
| Card | One task on screen, in the feed. |
| Format | A task type with its own id (`quiz-choice`, `game-rain`…). |
| Family | Group of formats: lesson, question, quiz, game, system. |
| Exit | How a card leaves: next, too easy, too hard, not this format, camera off. |
| Item | A sign (letter, number, word) or a phrase. |
| Skill | `receptive` (understand) or `productive` (sign it). |
| Check mode | How an answer is verified (§4.2). |
| Evidence | One logged observation about an item and skill (retrieval or exposure). |
| `pKnown` | BKT probability that an item and skill are learned. |
| Retrievability (R) | FSRS probability of recalling it now. |
| Challenge (`c`, `cf`, `ce`) | Global and per-format difficulty knobs, and their clamped sum. |
| Frontier | The next new items of each open unit. |
| Claim | "Too easy" on new content: assumed known until a probe verifies it. |
| Probe | A short check that verifies claimed items. |
| Sandbox | The dev-mode event log (`signa-dev`), separate from the real one. |

## 11. Sources

- Tutor MCP — repository: <https://github.com/ArnaudGuiovanna/tutor-mcp> · algorithms: <https://github.com/ArnaudGuiovanna/tutor-mcp/blob/main/docs/algorithms.md> · site: <https://tutor-mcp.dev/>
- LearnHarness (h4ksclaw): <https://github.com/h4ksclaw/learnharness> · architecture: <https://github.com/h4ksclaw/learnharness/blob/main/docs/ARCHITECTURE.md>
- learning.harness (mgersty): <https://github.com/mgersty/learning.harness>
- learning-harness (zytzrh): <https://github.com/zytzrh/learning-harness>
- Clément, Roy, Oudeyer, Lopes (2015). *Multi-Armed Bandits for Intelligent Tutoring Systems.* JEDM 7(2). <https://arxiv.org/abs/1310.3174>
- Pelánek (2016). *Applications of the Elo rating system in adaptive educational systems.* Computers & Education 98. <https://www.fi.muni.cz/~xpelanek/publications/CAE-elo.pdf>
- Pelánek (2018). *Exploring the utility of response times and wrong answers for adaptive learning.* L@S '18. <https://www.fi.muni.cz/~xpelanek/publications/las18-observational-data.pdf>
- Wilson, Shenhav, Straccia, Cohen (2019). *The Eighty Five Percent Rule for optimal learning.* Nature Communications 10, 4646. <https://www.nature.com/articles/s41467-019-12552-4>
- Corbett & Anderson (1994). *Knowledge tracing: modeling the acquisition of procedural knowledge* (BKT). User Modeling and User-Adapted Interaction 4.
- FSRS / ts-fsrs: <https://github.com/open-spaced-repetition/ts-fsrs>
- Duolingo, "Can't listen now" / exercise opt-outs: <https://blog.duolingo.com/learning-with-hearing-aids/> · Birdbrain: <https://blog.duolingo.com/learning-how-to-help-you-learn-introducing-birdbrain>
- Previous phase (design decisions, content sources, gamification research): [`docs/fase2.md`](fase2.md)
