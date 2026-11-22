# Part H — Hand and avatar quality

- **Status:** merged in `917f48d` (2026-11-22). Still open: the user's look at the review set, the Android 60 fps check, Safari, and a fluent signer's review of the changed letters.
- **Stream:** S3 "look and feel" · run on **Pol's laptop (Ubuntu 26.04)** instead of Max's Mac (D-H01) · wave 1 · branch `part-h`
- **Needs merged first:** Part 0 · **Better after:** —
- **Spec:** [SPEC §9, Part H](../SPEC.md#part-h--hand-and-avatar-quality), plus §2.1, §8.5, §8.6, and `docs/fase2.md` (how the viewer is built); the parallel rules in [§9.0](../SPEC.md#90-parallel-plan)
- **Built at the same time as:** B (uses `SignViewer`, Pol), C (Ashlie), A3 (integrator)

This is the part's state file (SPEC §9.0.4). Keep it current while you work. The integrator reads it when merging the branch and folds it into `PROJECT_STATE.md`; don't edit that file, the spec, `AGENTS.md` or the READMEs.

## 1. Files this part owns

From SPEC §9.0.3; new files in these folders are fine too.

- `web/src/viewer/**` (including `viewer.css` and `handshapes.fitted.json`), `web/src/screens/Lab.tsx`
- `web/scripts/extract_motion.py`, `fit-letters.ts`, `verify-letters.ts`, new scripts (e.g. the smoothness metric)
- `web/public/motion/**`, `web/content/reference/`
- the `render` block of `web/content/signs/*.json` (Part B edits `description` and `translations` in the same files)
- the core `viewer` and `lab` sections of `en.ts`/`es.ts`

Not yours in this wave: the feed (A2, done), `src/tasks/` (B), the Python prototype at the repository root.

## 2. Checklist

Tick an item only when it is implemented **and** verified.

- [x] Baseline: the review set recorded in `#lab` before any change (letters A C E M N O R S T X J Z; words hello, thank-you, mother, father, eat, drink, name, want, yes, no; numbers 3, 6, 9); problem list in §2.1
- [x] Hand: proportions, palm shape, thumb web, palm vs back shading, outlines, joint limits, per-letter camera angles, smooth J and Z (D-H06–D-H10)
- [x] `scripts/verify-letters.ts` passes; no letter bends backwards (new anatomy check, also in `npm test`)
- [x] Avatar: smoothing and interpolation, crossfade when a hand is lost, constant bone lengths, hand attached to the wrist, plausible elbows, body proportions, face from the blendshapes, phone framing (D-H02, D-H04, D-H11, D-H14)
- [x] (MAY) motion re-extracted and smaller; avatar/video changes recorded (D-H05, D-H13: no render changed; the quality gate would now flip NAME, Q-H04)
- [x] Smoothness script in `scripts/`; before/after numbers: RMS acceleration of wrists and fingertips −51 %, bone-length variation 0.00 % (from up to 143 %). The arithmetic mean drops only −10 %: see D-H03 and Q-H03
- [x] Performance: 60 fps in `#lab` and in the feed (headless Firefox); draw calls per viewer **lower** than before: hand 39 → 4, avatar 94 → 44
- [ ] `SignViewer` props backward compatible ✓; `#lab` works ✓ (all 103 signs, both languages); **Chrome and Safari not checked**: only Firefox 158 could run on this machine (R-H01)
- [ ] The user approved the before/after set (Q-H01)
- [x] Gates green (typecheck, 254 tests, build)

### 2.1 Baseline problems (recorded 2026-11-22, before any change)

Recordings: `web/.cache/part-h-review/before/` (gitignored; §10). Draw calls and triangles counted per frame by wrapping WebGL in the page.

Letters (procedural hand):

1. Fingers were uniform capsules ("sausages"): no taper, no knuckles; each phalanx a separate mesh with its own outline, so the hand looked segmented.
2. The palm was a convex hull of 14 points, a faceted blob, narrower than the knuckles; it was rebuilt (a new geometry) every frame.
3. No thumb web: the thumb floated apart from the index.
4. Palm and back were hard to tell: one skin colour; the nails were tiny white blobs that read like teeth on the fists (E, S, T).
5. The fist letters A, S and T looked like claws: the poses were fitted to MediaPipe references, which open a fist they cannot see (R-003); S's thumb sank into the fingers.
6. C was a bracket (straight thumb); every letter used the same camera angle, so the side-view letters (C, G, O, P, Q, X) read poorly.
7. J had a visible corner, and both J and Z stopped at every keyframe (ease in and out per segment).
8. A thick dark sleeve stub sat at the wrist; the framing spent a third of the stage on the forearm.
9. 39 draw calls and 13.2k triangles per hand.

Avatar (words, numbers):

10. Hands were drawn 1.75× life, scaled about the wrist: they covered the face (HELLO) and missed contact points (MOTHER's thumb never reached the chin).
11. Hands grew and shrank: hand bone lengths varied by 12–25 % (standard deviation) within a clip, the palm by up to 79 %; arm bones by 1–10 %.
12. 15 fps data, linearly interpolated: the velocity jumped 15 times a second.
13. Lost hands froze (held frames) or popped (a fixed resting hand switching to tracking); blurred detections at the start and end of a sign showed hands of half size (palm 3–7 cm instead of ~10).
14. Hands were attached at the wrist (the data's hand wrist equals the arm's), but the elbows followed MediaPipe's noisy depth.
15. The body: a flat torso hull rebuilt every frame, sausage limbs, a flat box for the neck, a 23 cm sphere for the head, no ears or nose, dots for eyes, brows hidden by the hair.
16. The smile blendshapes were extracted but never used.
17. Framing: the avatar filled about a third of the stage; the resting hand at the hip was always in frame.
18. A loop jumped from the last pose to the first.
19. In the data itself: in every contact sign the hand sat 10–15 cm in front of the face, and up to 13 cm too low on chin and mouth contacts (MediaPipe's world estimate).
20. Motion files were three times larger than their data (float32 digits).
21. About 94 draw calls and 34.2k triangles per avatar.

## 3. Contract changes

- **`SignViewer` props (additive):** `renderOverride?: SignSpec["render"]` (lab: draw a sign another way, e.g. preview the avatar of a sign that ships as video), `view?: V3` (lab: camera direction for a letter), `perf?: boolean` (performance read-out; default = the `signa:perf` switch). Existing props unchanged.
- **`SignSpec.render` (additive, `src/content/signs.ts`):** the hand variant gains an optional `view?: [x, y, z]`, the camera direction that reads best for the letter (D-H10).
- **`HandMesh`:** same props and exports (`Highlight`, `SKIN`, `OUTLINE`, `PLACEHOLDER`); `sleeve` is accepted but no longer drawn. New export `PALM`.
- **Motion files:** same fields as before, plus `version` (2 = compact numbers, 3 = hands anchored to the image) and `quality.anchorShift`. The new viewer reads every version; the old viewer would read the new files too.
- **Viewer internals** (no other part imports them): `AvatarScene` takes `motion: PreparedMotion` (was `frames` + `fps`); `loadPreparedMotion()` caches the cleaned clip; `prepareMotion`, `avatarExtent`, `frameAt` moved to `viewer/motion.ts` (re-exported from `AvatarScene`). `prefetchSigns()` is unchanged.

## 4. Cross-part edits

- `web/src/content/signs.ts`: one line, the optional `view` on the hand render type (§3). Nobody else edits this file in wave 1; B's branch does not touch it.
- The `render` blocks of `L-C`, `L-G`, `L-O`, `L-P`, `L-Q`, `L-X` (owned) sit two lines below the `description` blocks Part B edits. A dry three-way merge against `origin/part-b` (`git merge-file`, 2026-11-22) merges all six files cleanly, keeping both changes.

## 5. Decisions

- **D-H01 · 2026-11-22 · Part H ran on Pol's Ubuntu laptop, on `part-h` branched from `origin/gesture_learning` (`8211eae`: Part 0, A3 and C).** The user moved the S3 prompt here and asked for the branch. H needs only Part 0 (SPEC §9.0.1), so it doesn't start from `part-b` or `part-a2`. Browsers: only Firefox 158 could run here. Downloading Chrome for Testing was refused by the agent's permission policy, and Linux has no Safari (R-H01). — active
- **D-H02 · 2026-11-22 · The avatar's motion is cleaned when a clip loads, in a pure module (`viewer/motion.ts`), with its constants in `viewer/params.ts`.** The steps:
  - hand detections whose palm is more than 30 % off the clip's median count as lost;
  - gaps of up to 3 frames are interpolated, and runs under 3 frames are dropped;
  - a lost hand crossfades (0.6 s) to a relaxed hand that follows the forearm;
  - bone lengths are constant per clip (medians, clamped to anatomical ratios) by working in bone-direction space;
  - Gaussian smoothing: light while a hand is tracked in the signing space (σ 0.5 frame body, 1.0 hand), stronger while it is lost or below the signing space (σ up to 2.5: the rise from rest and the drop back are transitions, not the sign);
  - a cubic B-spline resamples to 60 fps (continuous velocity and acceleration);
  - the arms use two-bone IK with constant lengths and the measured elbow as the pole (25 % towards a natural elbow);
  - shoulders, hips, spine and neck get constant lengths too.
  It costs about 2 ms per clip on this laptop; the prefetch does it in idle time. *Why:* no re-extraction is needed to replay any clip smoothly, and the metrics script and the tests run exactly what the viewer plays. — active
- **D-H03 · 2026-11-22 · The smoothness acceptance uses the quadratic mean (RMS) of the frame-to-frame acceleration at 60 Hz, on wrists and fingertips at life size, against the old pipeline on the old files; the arithmetic mean and the jerk are reported next to it** (`scripts/motion-metrics.ts`). *Why:* the arithmetic mean can't see stepped playback. With linear interpolation the acceleration is a spike at every source frame, and the mean of those spikes equals the mean of a smooth curve through the same samples. In these clips most acceleration is the real rise and drop of the arms, and the old artifacts (shrinking and frozen hands) lowered it. Result: RMS 16.1 → 7.9 m/s² (−51 %), jerk 735 → 120 m/s³ (−84 %), arithmetic mean 6.3 → 5.7 m/s² (−10 %). Q-H03 asks the user to confirm. — active
- **D-H04 · 2026-11-22 · Avatar hands are drawn 1.3× life (was 1.75×), scaled about the knuckles, and the constant-size hand is placed by its fingertips.** The wrist, and through the IK the arm, takes up the difference. *Why:* location is part of the sign. The old wrist-scaled big hand covered the face and moved every contact. MediaPipe also sees a hand ±20 % in size from frame to frame, and shrinking it about the wrist pulled the fingertips off what they touch. — active
- **D-H05 · 2026-11-22 · Motion re-extracted (`uv run python web/scripts/extract_motion.py words --motion-only`), with the hands, wrists and elbows anchored to the image landmarks (`anchor_to_image`, files `version` 3).** Per frame, the face and shoulders fit a similarity from world x/y to the image. Each hand (translation only, placed by its fingertips) and each elbow moves to the world x/y of its image position. The offsets are smoothed over time, and depth stays MediaPipe's. The trim (active span) is measured before anchoring, so every sign keeps its extent: 76 of 77 clips have their old frame count, num-5 one frame less. *Why:* the world landmarks put THANK-YOU's fingertip 9–10 cm below the mouth; the image shows 5.8 cm (on the chin), and the anchored data now has 5.8–6.6 cm. `--motion-only` leaves the sign files' `video` and `review` blocks alone (other parts' blocks); no render was changed (Q-H04). — active
- **D-H06 · 2026-11-22 · Fist letters A, S and T curl the fingers fully (88/105/65°) and keep their fitted thumbs; S's thumb is pitched 10° out so it rests on the fingers. C is rounder (thumb 24/28°, fingers 38/52/28°).** These are overrides in `handshapeLibrary.ts`; `handshapes.fitted.json` is unchanged. *Why:* the real clips show tight fists, while the fitted poses inherited MediaPipe's half-open fists (claws). Every static letter still passes the rules. O can't curve more without failing its "thumb touches index" rule, so it stays. — active (review by a fluent signer still open, R-003)
- **D-H07 · 2026-11-22 · One generated surface per hand (`viewer/handGeometry.ts`, pure and tested) replaces the 39 meshes:**
  - tapered phalanges (the hull of two spheres, so joints read as knuckles);
  - a superellipse palm swept from the wrist to the knuckle line, fleshier on the palm side;
  - a thumb web, and a bare tapered forearm long enough that the frame always cuts it (the sleeve stub is gone);
  - vertex colours: palm and finger pads lighter (`#fcdcc4`) than the back (`#f2bd94`); per-finger feedback colours;
  - nails as a second small mesh on the backs of the tips;
  - one inverted-hull outline.
  *Why:* the look the spec asks for, at 4 draw calls and 7.2k triangles per hand (was 39 and 13.2k). — active
- **D-H08 · 2026-11-22 · Joint limits (`JOINT_LIMITS`, `clampPose()` in `kinematics.ts`) clamp every procedural pose.** A new anatomy check (`viewer/handChecks.ts`: signed flexion per joint, fingers through the palm) runs in `verify-letters.ts` and in the tests. `fit-letters.ts` searches inside the same limits. — active
- **D-H09 · 2026-11-22 · J and Z are arc-length paths (`movementPath()`): J a Catmull–Rom curve through its keyframes, Z three straight strokes with corners rounded (r 0.09).** Both have one ease in and out over the whole movement. — active
- **D-H10 · 2026-11-22 · Per-letter camera angles in the `render` block (`render.view`):**
  - C, G and O almost from the front, where their curve is seen in profile;
  - P, Q and X from three-quarters right, where the K/G pointing down and the hook read.
  The angles were picked by eye from six candidates per letter. A spelled word keeps one angle for all its letters. — active
- **D-H11 · 2026-11-22 · Avatar framing: the head, the shoulders, and the elbow and hand of each arm that is raised in a frame; a resting hand stays out of the frame.** The camera is almost frontal (`[0.14, 0.06, 1]`), because the face carries grammar. The body: a lathe torso with rounded shoulders, sleeved upper arms, bare tapered forearms, a neck, and an oval head with hair, ears and nose. The eyes widen or narrow with the brows, and the mouth opens with `jawOpen` and smiles with `mouthSmile*`. No allocation per frame. — active
- **D-H12 · 2026-11-22 · Lab additions:**
  - an avatar preview for signs that ship as video;
  - view presets for letters (their own, front, side, ¾, above);
  - a ⏱ switch for each viewer's fps, worst frame time, draw calls and triangles (`viewer/PerfProbe.tsx`; the same localStorage switch `signa:perf` shows it in the feed, for the phone check).
  — active
- **D-H13 · 2026-11-22 · Motion files are written compactly: 4 decimals, 3 for the blendshapes (the extractor's own precision), 4.87 MB → 1.84 MB.** `scripts/compact-motion.ts` (with `--check`) does it, and the extractor now writes the same format. `_quality.json` (read by nothing) was regenerated from the files. — active
- **D-H14 · 2026-11-22 · A looping avatar holds its last pose 0.8 s and blends back to the first pose over the last 0.3 s instead of jumping.** `onEnded` keeps its old timing. — active

## 6. Open questions

- **Q-H01** Does the before/after review set look good enough (`web/.cache/part-h-review/index.html`, §10)? — *Default: none; this is the last acceptance item.*
- **Q-H02** Some review signs ship as video: MOTHER, EAT, YES, NO and the numbers 3, 6, 9 (numbers never qualified for the avatar). The lab now previews their avatar. Should any switch to it? — *Default: keep video until you say so. A switch is one `render` block each.*
- **Q-H03** Is the RMS acceleration (−51 %) the reading of "mean frame-to-frame acceleration at least 50 % lower" you meant (D-H03)? The arithmetic mean drops only 10 %, because most acceleration is real arm movement. — *Default: RMS.*
- **Q-H04** On the re-extracted data, the extractor's quality gate would switch NAME to video (hand coverage 0.75/0.75, under 0.8). Keep NAME as an avatar? — *Default: keep it. The viewer now crossfades lost frames, and no render was changed.*
- **Q-H05** Hand size: 1.3× life (was 1.75×). Bigger reads better on a phone but moves contacts. — *Default: 1.3 (`AVATAR.handScale`).*

## 7. Risks, known issues and stubs

- **R-H01** Chrome and Safari were not checked; every browser check ran in Firefox 158 (headless, WebDriver BiDi). The code uses plain WebGL 1/2 features (vertex colours, dynamic buffers, lathe and capsule geometry, the existing outline shader) and `requestIdleCallback` with a Safari fallback. Still to do: Chrome on the integrator's laptop, and Safari/iOS on Max's Mac or an iPhone.
- **R-H02** 60 fps was measured in headless Firefox on this laptop (lab and feed: medians 16.6–17.1 ms, p95 ≈ 17.3 ms, one or two 33 ms frames per 2 s drag, the same for video and letter cards). Real phones are untested (§8).
- **R-H03** Depth stays MediaPipe's: in contact signs the hand is 10–15 cm in front of the face. It doesn't show from the feed's near-frontal view, but it shows when you orbit in the lab.
- **R-H04** The re-extraction used the current "latest" Holistic model. Coverage moved a little (NAME's right hand 0.86 → 0.75; num-5 is one frame shorter). The extractor also downloaded `models/holistic_landmarker.task` and `uv` created `.venv/` at the repository root; both are gitignored.
- **R-H05** The arithmetic-mean acceleration drops only 10 % (D-H03, Q-H03).
- **R-H06** `prepareMotion` runs on the main thread: about 2 ms per clip here, maybe 10–20 ms on a mid-range phone when an avatar card mounts without prefetch. The prefetch runs it in idle time.
- **R-H07** The fist letters (A, S, T) and C changed shape (D-H06) and need the same review by a fluent signer as every letter (R-003).
- **R-H08** The recordings and the review page live in `web/.cache/part-h-review/` (gitignored, 80 MB), so they aren't in git; only this laptop has them.

## 8. Integration checks (for the integrator)

- [ ] With B merged: lessons, questions and quizzes still fit on a 320 × 568 screen with the new viewer. The stage keeps its 4:3 aspect; nothing outside `viewer/` changed size.
- [ ] On the Android phone: 60 fps while swiping a card with an avatar. Turn on the read-out with `localStorage.setItem("signa:perf", "1")` in `chrome://inspect`, or with ⏱ in `#lab`.
- [ ] Chrome and Safari (iOS): `#lab` letters and avatars look as in the review page; no console errors (R-H01).
- [ ] With B merged: the camera tasks' highlighted fingers (`highlight`) still colour the right fingers on the new hand.

## 9. Session log

- **2026-11-22 · Part H on Pol's laptop** (the S3 prompt, moved here by the user)
  - *Setup:* branch `part-h` from `origin/gesture_learning` (`8211eae`), `npm ci` (lockfile unchanged), `npm run setup:media` (98/98 clips). Firefox 158 driven over WebDriver BiDi by throwaway scripts (Chrome blocked, D-H01). `uv run --frozen` for the extractor.
  - *Baseline:* the 25 review signs recorded in `#lab` (WebM per panel, stills, draw calls, frame pacing) before any change; problem list in §2.1.
  - *Done:*
    - motion pipeline: `motion.ts`, `params.ts`;
    - metrics script `motion-metrics.ts`;
    - hand surface `handGeometry.ts` and the new `HandMesh`;
    - anatomy checks and joint limits;
    - fist and C poses;
    - J/Z paths;
    - per-letter views in six `render` blocks;
    - new avatar body and face, framing, loop blend;
    - `SignViewer` (prepared motion, views, `renderOverride`, `perf`), `PerfProbe`, idle prefetch;
    - lab: avatar preview, view presets, ⏱;
    - compact motion files and a fixed extractor;
    - re-extraction with image anchoring (`--motion-only`);
    - strings in English and Spanish.
  - *Verification:*
    - typecheck, `npm test` (23 files, 254 tests: 230 + 24 new) and build green (1,725 kB, 483 kB gzip; R-015's warning);
    - `verify-letters.ts`: every static letter passes the rules and the anatomy check;
    - `motion-metrics.ts`: PASS (RMS −51 %, bones 0.00 %);
    - Firefox 158: all 103 signs in `#lab` in both languages with no console errors (only R-014's `THREE.Clock`);
    - feed (dev forced quiz-choice, 412 × 915, touch drags): avatar, letter and video cards at about 60 fps;
    - the after set recorded with the same script as the baseline.
  - *Next:* the user's look at the review set (Q-H01–Q-H05), then commit and push `part-h`.

## 10. Handoff to the integrator

- **What the branch contains:**
  - the viewer's inside: hand surface, avatar body and face, the motion pipeline, J/Z paths, joint limits;
  - six `render` blocks;
  - 77 re-extracted, compact motion files (version 3) and `_quality.json`;
  - extractor changes: image anchoring, `--motion-only`, compact output;
  - new scripts `motion-metrics.ts` and `compact-motion.ts`; the anatomy check added to `verify-letters.ts`;
  - lab tools;
  - viewer and lab strings in English and Spanish.
  No new dependency, and the lockfile is untouched.
- **How to see it:** `npm run dev` → `#lab` (⏱ for numbers; the lab previews the avatar for video signs). On this laptop, the side-by-side review of the 25 signs is `web/.cache/part-h-review/index.html` (open it as a file, or at `http://localhost:5173/.cache/part-h-review/index.html`); the metrics are `node scripts/motion-metrics.ts`.
- **How it was verified:** §9. Gates on Ubuntu 26.04 with Node 22.23.5. Only Firefox 158 (R-H01).
- **Expect at merge:** the one-line type change in `src/content/signs.ts` (§4). The six sign files merge cleanly with B (checked). `public/motion/*.json` are one-line files rewritten wholesale (77 files; no other part touches them).
- **Needs the spec machine or others:** the Android 60 fps swipe check and Chrome (§8), Safari/iOS (Max's Mac), and a fluent signer for the letter poses (R-003, R-H07).
- **Follow-ups for other parts:** none required. F1's lazy three.js stays inside `SignViewer` as planned; `PerfProbe` can help F2's performance pass. If the user switches any video sign to the avatar (Q-H02, Q-H04), the change is one `render` block per sign.
