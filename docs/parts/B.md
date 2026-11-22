# Part B — Learning task formats

- **Status:** ready to merge
- **Stream:** S2 "tasks" · Pol's laptop (Ubuntu 26.04) · wave 1 · branch `part-b`
- **Needs merged first:** Part 0 · **Better after:** A2 (every result auto-advances)
- **Spec:** [SPEC §9, Part B](../SPEC.md#part-b--learning-task-formats), plus §4.1–§4.6, §5, §8.3; the parallel rules in [§9.0](../SPEC.md#90-parallel-plan)
- **Built at the same time as:** C (learner model, Ashlie: owns `learner/`, the simple picker and the forced source), A2 then H (feed and viewer, Max), A3 (integrator)

This is the part's state file (SPEC §9.0.4). Keep it current while you work. The integrator reads it when merging the branch and folds it into `PROJECT_STATE.md`; don't edit that file, the spec, `AGENTS.md` or the READMEs.

## 1. Files this part owns

From SPEC §9.0.3; new files in these folders are fine too.

- `web/src/tasks/learningFormats.ts`, `learningViews.tsx`, `web/src/tasks/ui/**` (except `GameFrame*`), `web/src/tasks/{lesson,question,quiz-choice,quiz-build}/`
- `web/src/camera/checkMode.ts` (new), `web/src/camera/cameraSession.ts` (only if needed)
- `web/src/lib/handshapes.ts`, `web/src/lib/engine.ts`, `web/src/components/CameraView.tsx`
- `web/content/signs/*.json` (`description`, `translations` only), `web/content/curriculum.json`, `web/src/content/curriculum.ts`
- `web/src/i18n/parts/learning.ts`, and the core `quiz` section of `en.ts`/`es.ts`

Not yours in this wave: the feed and the tutorial (A2), `src/viewer/` and the `render` block of sign files (H), `src/learner/`, `feed/simplePicker.ts`, `dev/forcedSource.ts` (C).

## 2. Checklist

Tick an item only when it is implemented **and** verified.

- [x] Shared UI in `tasks/ui/`: TaskFrame (with task progress), ChoiceGrid, TileBank, SelfCheck, MirrorCompare (+ CameraCheck, ProductiveTry, the rolling recorder, labels and hint rendering)
- [x] `checkModeFor()` in `camera/checkMode.ts` + tests
- [x] `lesson` (camera / mirror / self, relearn variant)
- [x] `question`: sign-term, sign-sentence, spell-word (all modes)
- [x] `quiz-choice` polish: all content kinds, similarity and confusion distractors, replay and slow-motion params; items from `probes`, then `practice`
- [x] `quiz-build` (gloss mode; translation mode optional, only with authored `tokens`) — gloss mode only: no phrase has `tokens` (D-B10)
- [x] Generators use only the `LearnerQueries` lists (Part 0 stub); tests with `fakeQueries()`
- [x] Every result carries `feedback`
- [x] Evidence mapping tests (skill, check mode, `selfGraded`, items)
- [x] English for the letter descriptions (`description.en`, faithful) and the handshape hints (moved to i18n) (R-020)
- [x] Formats registered in `learningFormats.ts` / `learningViews.tsx`; strings in `i18n/parts/learning.ts`
- [x] Manual checks in dev mode, every content kind, camera on and off; mirror clips never persisted and released on exit — scripted in headless Chrome 158 with a fake camera fed with real WLASL clips (§9); the laptop webcam itself is for you to try (§10)
- [x] The simple picker rotates through all formats
- [x] Gates green

## 3. Contract changes

Additive changes to `core/types.ts`, the learner queries, the `SignViewer` props, `feed/derived.ts` or the dev panel slot (SPEC §9.0.4, rule 2): **none.** `core/types.ts`, `learner/`, `SignViewer` and the dev slot are untouched.

Interfaces of files this part owns that other parts use (all backward compatible):

- `components/CameraView.tsx`: new optional props `detect` (default `true`; `false` = a plain mirror, no MediaPipe) and `onStream(stream | null)`; `onFrame` is now optional. `dev-camera-probe` works unchanged.
- `lib/handshapes.ts`: `Evaluation` gains `issues: HandIssue[]` (language-neutral feedback), and `hints: string[]` now holds stable issue codes (`"extend:index+middle"`, `"thumbIn"`) instead of Spanish sentences. The sentences moved to `i18n/parts/learning.ts` (`hints`, `fingerHint`). New item-level helpers `hasCameraRule(itemId)`, `evaluateSign(itemId, f)`, `matchingSigns(f)`: **Part E adds the static number rules behind these**, and `checkModeFor()` then returns `camera` for numbers with no other change. `scripts/verify-letters.ts` (H) still runs; on a failure it now prints codes.
- `lib/engine.ts`: new `SPELL_WORDS`, the fingerspelling word bank (Part E's spelling games may share it).
- `quiz-choice` params (logged in `card.shown`): `choices` stays for a single question, as in Part A; new `sets` (one option list per item of a verification probe), `similarity`, and the dev knobs `similar`, `replay`, `slow`, `probe`.

## 4. Cross-part edits

Edits outside the files above, kept minimal, so the integrator can expect the conflict.

- **`web/src/feed/simplePicker.test.ts` (Part C's).** Six tests assumed that quiz-choice walks the curriculum with `nextItems`, which Part B removes on purpose (SPEC Part B item 5). The picker's walk is now tested with a local `test-walk` format double (like the existing `test-camera` one), and the cold-start test expects a **lesson** on the first curriculum item (SPEC §7.8.5). No change to `simplePicker.ts` itself. If Part C rewrote these tests too, keep C's version and apply the same idea: test the picker with doubles, not with the real formats' item sources.

## 5. Decisions

Format: `D-BNN · YYYY-MM-DD · decision` — *why* — status.

- **D-B01 · 2026-11-22 · Camera feedback is data, rendered by i18n.** A failed check reports a `HandIssue` (`{ key: "fingers", action, fingers }` or one of 30 fixed keys); `t.learning.hints` and `fingerHint()` render it in English or Spanish. The Spanish sentences are the original wording; the English is a faithful translation. `handshapes.ts` keeps importing nothing. — *R-020 asked to move the hints to i18n; the Node scripts load `handshapes.ts` directly, so it can't import the dictionaries (they load content through Vite's `import.meta.glob`).* — active
- **D-B02 · 2026-11-22 · `checkModeFor(itemId, skill, cameraUsable)`:** `camera` when the camera is usable and the item has detector rules (24 static letters today); `mirror` when it is usable and nothing can check the item (words, sentences, numbers until Part E, J, Z); `self` without a usable camera, and for receptive skills (the camera only checks what the learner produces). The views re-evaluate it from `useCameraState()`, so a camera denied mid-try switches the try to self-grading. — active
- **D-B03 · 2026-11-22 · Generator priority:** lesson = `relearn` (2) then `frontier` (3); quiz-choice = one verification probe over up to 3 `probes`, then `practice("receptive")` (4); question = sign-term from `practice("productive")`, sign-sentence from `eligiblePhrases`, spell-word from the met letters, in a **seeded shuffled** variant order (the simple picker takes the first draft, so the variants rotate); quiz-build = `eligiblePhrases` (3). — *SPEC §7.8.1, §4.5 ("probes, then practice") and Part B item 7.* — active
- **D-B04 · 2026-11-22 · Dev params pick a variant:** `only` for lesson (0 auto · 1 new · 2 relearn) and question (0 any · 1 sign-term · 2 sign-sentence · 3 spell-word), `probe` for quiz-choice (0 auto · 1 practice only · 2 probes only). Ints, because the dev params picker only has ints. In forced mode `withContent()` answers every list with the chosen content, so **auto shows the spec's first priority: a relearn ("review") lesson, a 3-question probe card.** Set `only: 1` / `probe: 1` for the typical card. — *Keeps the feed's priority and makes every variant playable without touching DevScreen (Part E's in wave 2).* — active (Q-B02)
- **D-B05 · 2026-11-22 · quiz-choice and the challenge level** (`tasks/learningConfig.ts`): options 2–4 as in D-030; high-similarity distractors from ce ≥ 0.3 (the learner's confusions first, at most 2, then look-alikes); slow motion off from ce ≥ 0.5 and no replay from ce ≥ 0.8. `SignViewer` has no per-button prop and is used as it is, so "no slow motion" hides its controls (the sign still loops) and "no replay" also plays it once (`loop={false}`). The evidence carries `similarity` ("high" only when a confusion or look-alike really made it into the options; SPEC §7.4 adds slip for it). — active
- **D-B06 · 2026-11-22 · Look-alikes:** letter groups that share a handshape family as the content describes them: A E M N S T (fist, R-003 and the spec's M/N, A/S/T/E), H K P R U V (P "like K, pointing down"), D G L Q X Z (Q "like G, pointing down"), C O, I J Y (J "the I handshape"), F W. Phrases look alike when they share signs. Numbers and words get no table: their look-alikes come from the learner's own confusions only. — *Rule 5: nothing invented; the table only orders distractors.* — active
- **D-B07 · 2026-11-22 · Mirror recording:** two `MediaRecorder`s on the open stream, half a 5 s segment apart, each restarting and throwing its clip away; "Done" keeps the longer running clip, i.e. the last 2.5–5 s (`MIRROR.segmentMs`). One Blob behind a `blob:` URL, revoked on grading, when the card stops being active, on unmount and on "try again". Without `MediaRecorder` the learner compares themselves live with the reference. The mirror runs `CameraView` with `detect={false}` (no MediaPipe). — *A WebM can't be trimmed at the front, so a rolling window needs staggered recorders; the spec asks for "the last ~4 s".* — active
- **D-B08 · 2026-11-22 · Self mode:** lessons offer "I did it" and "Show it again" (SPEC §4.3); each "show it again" is counted in the evidence's `hints`; there is no "I couldn't" button (a "too hard" swipe says that). Questions reveal the reference, then "I got it right" / "Not quite". — active (Q-B01)
- **D-B09 · 2026-11-22 · Evidence mapping** (pure builders, `*/result.ts`, unit-tested): lesson = receptive `exposure` (check `none`) + one productive retrieval; sign-term = one productive retrieval; sign-sentence = one productive retrieval per distinct sign **and** one for the phrase; spell-word = one per distinct letter, wrong if any occurrence was skipped, J and Z confirmed while the camera shows the learner = `mirror`; quiz-choice = one receptive `choice` retrieval per question; quiz-build = one receptive `build` retrieval per distinct sign (right when placed at all) plus one for the phrase (right only in the exact order). `selfGraded` on every mirror and self check; `confusedWith` from the camera ("looks like an N") and from wrong choices. — active
- **D-B10 · 2026-11-22 · quiz-build** targets the phrase **and its signs** (`items = [phrase, ...signs]`, SPEC §7.5), with `itemKinds: ["phrase"]` so dev mode offers phrases. Distractor tiles come from the other phrases' words first, then any word, with labels unique in both languages. "Right signs, wrong order" is said in the banner and shows in the evidence. The translation mode (MAY) is not offered: no phrase has authored `tokens`. — active
- **D-B11 · 2026-11-22 · spell-word words:** `SPELL_WORDS` in `lib/engine.ts`, the old spelling activities' English word lists minus words with a doubled letter in a row (ZOO, PIZZA…: the camera can't see the bounce). `pickWord()` keeps words made only of met letters, prefers the most urgent one, and sizes them by ce (2–3, 3–4, 4–6 letters). ASL fingerspells English words, so the word is the same in both UI languages. — active (Q-B03)
- **D-B12 · 2026-11-22 · XP** (`learningConfig.ts`): lesson 10 (5 if the try failed); sign-term 12; sign-sentence 15; spell-word 15 × share of right letters; quiz-choice 10 per right sign, 12 per right phrase; quiz-build 15, 5 for right signs in the wrong order. — active
- **D-B13 · 2026-11-22 · After a check the card shows the reference** (question: "then the reference is shown"; lesson: the sign again), so the banner's answer has the sign next to it. — active
- **D-B14 · 2026-11-22 · Layout:** the learning formats share `TaskFrame`; a sign viewer in a task body is a size container that takes only the height left (and clips instead of painting over the options); when that height is short, the viewer's credit and then its controls give way (container queries). On short screens tiles and phrase options get smaller; quiz-build hides its bank and Check button once the answer is marked. Checked at 320 × 568 and 412 × 915. — *Found in testing: Part A's stage minimum overflowed the quiz-build and phrase-probe cards at 320 × 568.* — active
- **D-B15 · 2026-11-22 · Registry order** `lesson, quiz-choice, question, quiz-build` (the picker rotates in this order). — active

## 6. Open questions

Format: `Q-BNN` question — *Default: what you assumed meanwhile.*

- **Q-B01** Should a lesson's self mode also offer "I couldn't do it" (a failed self-graded try), besides "I did it" and "Show it again"? — *Default: no, as SPEC §4.3 words it; a "too hard" swipe says it, and "show it again" is logged as hints.*
- **Q-B02** In dev forced mode, should a format's default be its most typical card (a new lesson, a single question) rather than the feed's first priority (a review lesson, a probe card)? — *Default: the feed's priority, with the `only` / `probe` dev params to pick the variant (D-B04).*
- **Q-B03** spell-word asks for English words (ASL fingerspells English). In the Spanish UI the prompt reads "Deletrea: CAB", with no translation of the word. Show one? — *Default: no translation (none exists in the content, and rule 5 keeps us from adding word meanings by hand).*

## 7. Risks, known issues and stubs

Format: `R-BNN` description.

- **R-B01** **The simple picker can queue the same lesson twice at cold start**: the next card is chosen while the current one is still on screen, and the frontier only moves once its evidence is logged (the stub and Part C's model alike). Visible in the learner's feed until Part D: tutorial → lesson L-A → lesson L-A. Suggested fix for Part C (owner of `feed/simplePicker.ts`) or Part D: pass the items of the queued cards in `avoid` when building the queries (`ctx.history.filter((c) => c.planned).flatMap((c) => c.items)`).
- **R-B02** The feed header shows "I can't use the camera now" on every camera-optional card, even when the camera is already off or the card is in self mode (`CardHeader`, Part A2's file); pressing it exits the card with `camera_off`. Suggestion for A2/D: show it only while the camera is usable.
- **R-B03** Until Part A2 is merged, wrong answers wait for Next (Part A's rule). Every Part B result carries `feedback` with the answer, so A2's auto-advance applies to them unchanged. Long phrase notes make the wrong-answer wait long (A2 clamps it at 5 s).
- **R-B04** Real hands: the camera checks were verified with Chrome's fake camera fed with real WLASL clips (MediaPipe on CPU in headless Chrome), not with a person in front of this laptop's webcam. Detector thresholds are first guesses (R-003).
- **R-B05** No "holding" hum or "passed" chime for camera checks (SPEC §3.7): `sound/effects.ts` has no owner in wave 1 and is Part E's in wave 2. The feed's correct/wrong sounds play on the result.
- **R-B06** `MediaRecorder` support: the WebM path is verified in Chrome; Safari/iOS record MP4 (picked by `isTypeSupported`) but weren't tested; without `MediaRecorder` the mirror falls back to a live comparison.
- **R-B07** With the Part 0 stub, the learner's feed only offers quiz-build once every sign of a phrase has been met (the phrases are the last unit), so it shows up late; dev mode plays it at any time.
- **R-B08** A lesson's camera try runs two WebGL contexts (the small reference hand) next to the camera; within the §8.6 budget, but heavier on old phones.
- **R-B09** Pre-existing, not Part B: `favicon.ico` 404 in the console (no favicon in `index.html`, Part F1); the 3D hand's look for some letters (Part H).

## 8. Integration checks (for the integrator)

- [ ] With A2: the banner and auto-advance after every format's result (each result has `feedback`; the wrong ones carry the answer and a note).
- [ ] With C: the formats still find content with the real queries, in the feed and in dev forced mode. In particular: a lesson gives the item a productive retrieval, so `practice("productive")` should list it for questions; `eligiblePhrases` should list phrases for quiz-build and sign-sentence; `probes` should list claimed items for the probe card.
- [ ] With C: R-B01 (a queued duplicate lesson) — fixed in the picker or left to Part D.
- [ ] With H: the new viewer fits the lesson, question and quiz layouts on a 320 × 568 screen (re-run the small-screen checks below).
- [ ] On the spec machine: a lesson for a static letter with the MX Brio and a real hand; the mirror on the Android phone's front camera.

## 9. Session log

Newest first: date · what was done · verification · next step.

- **2026-11-22 · Part B — learning task formats** (S2, Pol's laptop)
  - *Setup:* the laptop had no Node. Installed Node 22.23.5 in user space: the official `node-v22.23.5-linux-x64.tar.xz`, SHA-256 checked against `SHASUMS256.txt`, unpacked to `~/.local/node-v22.23.5-linux-x64`, with `node`, `npm`, `npx` and `corepack` linked from `~/.local/bin` (already first on `PATH`); npm 10.9.9. `npm ci` left `package-lock.json` unchanged; `npm run setup:media`: 98/98 clips present.
  - *Done:* the four formats (`lesson`, `question`, `quiz-choice` polish, `quiz-build`), the shared task UI, `checkModeFor()`, the camera check, the mirror with its in-memory rolling recorder, self-grading, look-alike distractors, the fingerspelling word bank, English letter descriptions and camera hints (R-020), and the strings in both languages.
  - *Verification:* typecheck, test (23 files, 151 tests) and build green; `node web/scripts/verify-letters.ts` still passes every static letter, and every rule threshold is unchanged. Browser: headless Chrome for Testing 158 over the DevTools protocol against `npm run dev`, phone emulation (412 × 915 and 320 × 568, touch), Chrome's fake camera fed with real WLASL clips (MJPEG made in the browser; the "hold" clips repeat a frame the app's own detector passes): see §10.
  - *Found and fixed while testing:* at 320 × 568 the sign viewer overflowed the quiz-build and phrase-probe cards (Part A's stage minimum in `feed.css` wins over a same-specificity rule loaded earlier), hiding the answer row; fixed by D-B14.
  - *Next:* the user's hand checks (§10), then commit and push `part-b`; the integrator merges it (wave 1). Part E (wave 2) starts once B is merged.

## 10. Handoff to the integrator

- **What the branch contains:** the four learning formats with their generators, views, result builders and tests (`web/src/tasks/{lesson,question,quiz-choice,quiz-build}/`); the shared task UI (`web/src/tasks/ui/`: TaskFrame, ChoiceGrid, TileBank, SelfCheck, MirrorCompare, CameraCheck, ProductiveTry, the rolling recorder, the hold tracker, labels, hint rendering, `ui.css`); `camera/checkMode.ts`; `tasks/learningConfig.ts` (every Part B constant); `tasks/testing.ts` (`strictQueries()`, `genContext()` for generator tests, reusable by Part E); the registry lists; `lib/handshapes.ts` (issues as data, item helpers); `CameraView` (`detect`, `onStream`); `lib/engine.ts` (`SPELL_WORDS`); English `description.en` for the 26 letters (only those two lines per file changed; `render` untouched); `i18n/parts/learning.ts`; and the cross-part test edit (§4).
- **How it was verified:** gates green on Ubuntu 26.04 with Node 22.23.5 (see §9 for numbers). The browser suite (throwaway scripts, not in the repo) played every format in dev forced mode with the camera on (fake camera fed with real clips) and off, and checked the log: 99 checks, all passing on the final run, including
  - lesson: camera pass (the A clip passes the A rules: +10 XP, exposure + `camera` retrieval), camera give-up (`confusedWith: "L-A"`, "That looks like an A"), mirror (two recorders, `blob:` replay, reference side by side, self-graded `mirror`), self with the camera off ("show it again" → `hints: 1`, `getUserMedia` never called), the relearn label;
  - question: sign-term by camera (no coaching, reference after), camera give-up, mirror and self (a number); sign-sentence by mirror and self (evidence on every sign and the phrase, gloss and grammar note); spell-word letter by letter with the camera (C skipped, A detected, B skipped), J confirmed by the learner, and self;
  - quiz-choice for a letter, a number, a word and a phrase (wrong answers log `confusedWith`), a 3-question probe card with progress, high similarity (look-alike letters, `similarity: "high"`), slow motion off at ce 0.5;
  - quiz-build: tap, take back, "Right signs, wrong order", then the right order;
  - mirror privacy: every clip URL revoked after the card and unreadable afterwards, no Blob written to IndexedDB, nothing in Cache Storage, no non-GET request and nothing outside the app's origin;
  - 320 × 568: nothing clipped or overlapping in nine layouts, also with the feedback banner; Spanish strings and descriptions;
  - the learner's feed (simple picker, real DB): with a seeded log it rotated question → quiz-build → lesson → quiz-choice, three times in 12 cards (sign-term and spell-word questions, new lessons); from a fresh first launch: tutorial → lesson L-A → lesson L-A (R-B01) → quiz-choice → question → lesson L-B …;
  - no console errors apart from the existing favicon 404.
- **What needs the spec machine or a person:** a real hand in front of a real camera (the MX Brio, the laptop webcam, the Android phone's front camera); the camera indicator light going off when a camera card exits or "I can't use the camera now" is pressed; Safari's MP4 recording (R-B06); the feel of the hold and the self-grading flow.
- **Follow-ups for other parts:** C or D — R-B01 (avoid the queued cards' items). A2 — R-B02 (camera-off button on self-mode cards), and the wrong-answer auto-advance will apply to every Part B format. E — number rules go behind `hasCameraRule()` / `evaluateSign()` / `matchingSigns()`; `TileBank`, `ChoiceGrid`, `TaskFrame`, `CameraCheck`, `SPELL_WORDS` and `tasks/testing.ts` are ready to reuse; the camera-check sounds (R-B05) belong in `sound/effects.ts`. H — the 320 × 568 layouts rely on `.sv`, `.sv-stage`, `.sv-controls` and `.sv-credit` keeping their class names.
