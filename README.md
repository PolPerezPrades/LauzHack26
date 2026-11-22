# Signa 🤟

**Learn American Sign Language (ASL) by scrolling.** Signa is a web app that turns ASL practice into a vertical feed of short cards: a lesson, a quiz, a sign checked by your camera, a minigame. Every card takes seconds, and the next one is already waiting. Built at LauzHack 2026.

The interface is in English (default) and Spanish. It runs in any modern browser, on desktop with a webcam or on a phone with the front camera, always in a phone-shaped vertical layout.

## The idea

There's no menu and no lesson list: opening the app shows a task. You answer it, or swipe it away, and that swipe is feedback.

| Gesture | Key | Meaning |
|---|---|---|
| Finish the card | ↑ / Enter / Space | Done; the next card arrives on its own after the result |
| Swipe left | ← | Too easy for me |
| Swipe right | → | Too hard for me |
| Swipe down | ↓ | I don't like this kind of task |

Every gesture also has a button. Each swipe and each result has its own sound, and the app respects reduced-motion settings.

## Cards

| Card | What you do | How it's checked |
|---|---|---|
| **Quick lesson** | A new sign plays in the corner and you copy it in front of the camera | Camera (letters) |
| **Pick the meaning** | Watch a sign, choose its meaning among 2–4 options | Your choice |
| **Your turn** | Sign a letter, a word, or spell a word, without seeing it first | Camera (letters) |
| **Build the sentence** | Watch a signed sentence and put its signs in order | Your order |
| 🌧 **Sign rain** (game) | Letter signs fall; tap the matching letter before they land. The longer you survive, the faster they fall | 10 s clock: hits add time, mistakes cost time |
| 🔳 **Sign grid** (game) | A 3×3 board of signs: find one letter at a time. The board reshuffles after every hit | Same clock |
| 🔎 **Word search** (game) | Up to three words, hidden in a 5×5 board of signs; tap the signs that spell them | 30 s clock: found words add time |

Signs are shown by a 3D hand (letters), a 3D avatar (words) or the original video.

## How the camera check works

Hand tracking runs **in the browser** with MediaPipe Hand Landmarker: 21 landmarks per hand, per frame. Signa compares those landmarks against hand-written rules for each of the **24 static letters** (finger extension, thumb position, palm direction). A sign passes once the correct shape is held for about 0.4 s, and close misses report what was wrong ("looks like an S"). Letters with movement (J, Z) and words can't be checked automatically yet: the app falls back to a mirror view and a self-check.

The camera is optional. "Can't use the camera now" turns it off for the session, and only cards that don't need it are shown.

## How it decides what comes next

### Learner model

Every interaction is appended to an **event log** in the browser (IndexedDB). The learner's state is never stored; it is recomputed from the log as a pure function. For each sign and each skill (*receptive*: understanding it; *productive*: signing it), the model tracks:

- **Knowledge**, with Bayesian knowledge tracing (BKT). A camera-checked sign counts more than a guessable 4-option quiz, because each check type has its own guess and slip rates.
- **Memory**, with FSRS spaced repetition (`ts-fsrs`). The card's exit sets the grade, like Anki's four buttons: wrong → *Again*, correct → *Good*, correct + "too easy" → *Easy*, correct + "too hard" → *Hard*.
- **Challenge level**, per format: raised by success and "too easy", lowered by failure and "too hard". It sets the difficulty knobs, such as the number of options, similar-looking distractors, and replay or slow motion.
- **Format preferences**, from "don't like this" swipes, which decay over time.
- **Confusions**: which signs you mix up. These become the distractors in later quizzes.

### Card picker

The current card source is a small, rule-based picker on top of that model:

1. **Tutorial first**, then the formats in rotation, each fed by the learner's own lists (new items, items to practise, items to relearn).
2. **Teach before testing:** quizzes and questions use signs you've met; new signs arrive as lessons.
3. **"Too hard" steps back:** the next two cards are review lessons of signs you already know (the best known first), and the hard sign stays out for six cards.
4. **No loops:** signs from the last three cards are kept out.
5. **Games as a treat:** at most one game every four cards, the least recently played first.

Every card carries machine-readable reasons ("frontier", "relearn", "review after too hard"…), visible in developer mode. A fuller recommender (candidate scoring, softmax selection, simulated learners) is specified in [`docs/SPEC.md` §7.8–§7.12](docs/SPEC.md) and is being built.

## Where the content comes from

| Content | Source |
|---|---|
| **103 signs**: 26 letters, 10 numbers, 67 everyday words, grouped in 10 units (alphabet, numbers, greetings, family, colours, food…) plus phrases | Curated in [`web/content/`](web/content/). Every sign has an English and Spanish description and its sources |
| Sign videos (98 of 103) | [WLASL v0.3](https://dxli94.github.io/WLASL/), the Word-Level ASL dataset (clips from asldeafined, startasl, aslbrick, signschool); academic, non-commercial use |
| 3D hand poses for letters | Fitted to MediaPipe landmarks extracted from the real letter clips, then verified against the written descriptions ([`web/scripts/`](web/scripts/)) |
| Avatar motion for words and numbers | Extracted from the WLASL clips with MediaPipe ([`extract_motion.py`](web/scripts/extract_motion.py)), smoothed and compacted |
| Letter illustrations (in the sign lab) | Wikimedia Commons, public domain |
| Handshape descriptions | Cross-checked with [Lifeprint](https://www.lifeprint.com/asl101/fingerspelling/abc.htm) (ASL University) |

No sign, description or media is generated by AI. Phrases and dialogues only combine existing signs. The signs are checked automatically and still need review by a fluent ASL signer.

## Privacy

- Camera frames are processed on the device and never uploaded. Mirror clips live only in memory.
- Learning data stays in the browser's IndexedDB (export and import are available). There are no accounts and no tracking.
- An optional server endpoint can use Claude for coaching tips and phrase generation when an `ANTHROPIC_API_KEY` is set; the app works fully without it.

## Architecture

| Layer | Technology |
|---|---|
| UI | React 19, TypeScript (strict), Vite, plain CSS |
| 3D | three.js, React Three Fiber (toon-shaded hand and avatar) |
| Vision | MediaPipe Tasks Vision (WASM, on-device) |
| Storage | Dexie on IndexedDB (versioned event log) |
| Memory model | ts-fsrs |
| Tests | Vitest (pure logic: learner model, picker, generators, games) |

```text
web/src/
├── feed/       the swipeable card stack, gestures, result banner, card picker
├── tasks/      one folder per card format and game (spec.ts = pure logic, View.tsx = UI)
├── learner/    learner model: BKT, FSRS schedule, swipe rules, queries (pure, tested)
├── camera/     camera session, opt-out, check modes
├── lib/        hand tracking and handshape rules
├── viewer/     3D hand, avatar, video, cached sign pictures
├── data/       event log (IndexedDB), export/import
├── dev/        developer mode
├── i18n/       English and Spanish strings
└── sound/      synthesised sound effects
```

## Run it

You need Node.js 22.18 or newer.

```bash
cd web
npm ci                # exact dependency versions from package-lock.json
npm run setup:media   # downloads the sign videos and the hand-tracking model (once)
npm run dev           # http://localhost:5173
```

| URL | What |
|---|---|
| `http://localhost:5173` | the feed |
| `http://localhost:5173/#dev` | developer mode: play any format with chosen content, inspect the learner model (separate test database) |
| `http://localhost:5173/#lab` | sign lab: every sign in 3D next to its real video |

`npm test` runs the test suite. `npm run build && npm start` serves the production build on `http://localhost:8787`. On an Android phone over USB, run `adb reverse tcp:5173 tcp:5173` and open `localhost:5173` on the phone (the camera needs localhost or HTTPS).

## Project documents

- [`docs/SPEC.md`](docs/SPEC.md): the full specification (feed UX, formats, camera policy, learner model, recommender, delivery plan).
- [`PROJECT_STATE.md`](PROJECT_STATE.md): progress, decisions and risks.
- [`docs/parts/`](docs/parts/): the parts built in parallel by the team.

## Credits

Sign videos: [WLASL](https://dxli94.github.io/WLASL/) (Li et al., WACV 2020). Hand tracking: [MediaPipe](https://ai.google.dev/edge/mediapipe). Spaced repetition: [FSRS](https://github.com/open-spaced-repetition). Illustrations: Wikimedia Commons.
