# Signa 🤟

Learn **American Sign Language (ASL)** a few seconds at a time.

Signa is a web app in English and Spanish. Open it, and a task is already waiting: learn a new letter or word, sign something in front of your camera, guess what the avatar is signing, or play a quick minigame. Then swipe to the next card:

| Swipe | Meaning |
|---|---|
| ⬆️ (or just finish the task) | Next card |
| ⬅️ | Too easy for me |
| ➡️ | Too hard for me |
| ⬇️ | I don't like this kind of task |

It works on your computer (with the webcam) and on your phone (with the front camera), in the browser or installed as an app, always in a vertical, phone-style layout, and every swipe and answer has its own sound.

Signa learns from your answers and your swipes. It brings back what you're about to forget, moves faster when things are easy, and shows less of the formats you don't enjoy. Your progress stays in your browser, and the camera video never leaves your device.

> **Status:** being redesigned into this swipeable feed. The feed, its gestures and sounds, the camera opt-out and one quiz format work today; the other formats, the learner model, the recommender and a better hand and avatar are being built in parallel by three people (plan: [`docs/SPEC.md` §9.0](docs/SPEC.md#90-parallel-plan); progress: [`PROJECT_STATE.md`](PROJECT_STATE.md) and [`docs/parts/`](docs/parts/)). [`web/README.md`](web/README.md) still describes the previous version.

## Run it

You need Node.js 22.18 or newer.

```bash
cd web
npm ci                # installs the exact versions in package-lock.json
npm run setup:media   # downloads the sign videos and the hand-tracking model (once)
npm run dev           # open http://localhost:5173
```

- `http://localhost:5173/#dev`: developer mode (play any task format on demand, with chosen content, into a separate test database).
- `http://localhost:5173/#lab`: sign lab (compare each 3D sign with the real video).

## How it's built

React + TypeScript (Vite), with signs shown as a 3D hand, an avatar animated from real signers' motion, or the original video. Hand tracking runs in the browser with MediaPipe. Spaced repetition uses FSRS. The full plan is in [`docs/SPEC.md`](docs/SPEC.md).

## Credits

Sign videos come from [WLASL](https://dxli94.github.io/WLASL/) (academic, non-commercial use). Hand tracking: [MediaPipe](https://ai.google.dev/edge/mediapipe). Spaced repetition: [FSRS](https://github.com/open-spaced-repetition). All signs are checked automatically and still need review by a fluent ASL signer.
