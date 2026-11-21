# Part H — Hand and avatar quality

- **Status:** not started
- **Stream:** S3 "look and feel" · Max's Mac (macOS) · wave 1 (after A2) · branch `part-h`
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

- [ ] Baseline: the review set recorded in `#lab` before any change (letters A C E M N O R S T X J Z; words hello, thank-you, mother, father, eat, drink, name, want, yes, no; numbers 3, 6, 9); problem list below
- [ ] Hand: proportions, palm shape, thumb web, palm vs back shading, outlines, joint limits, per-letter camera angles, smooth J and Z
- [ ] `scripts/verify-letters.ts` passes; no letter bends backwards
- [ ] Avatar: smoothing and interpolation, crossfade when a hand is lost, constant bone lengths, hand attached to the wrist, plausible elbows, body proportions, face from the blendshapes, phone framing
- [ ] (MAY) motion re-extracted and smaller; avatar/video changes recorded
- [ ] Smoothness script in `scripts/`; before/after numbers: ≥ 50 % lower wrist and fingertip acceleration, bone-length variation < 2 %
- [ ] Performance: 60 fps in `#lab` and in the feed; ≤ about 2× today's draw calls per viewer
- [ ] `SignViewer` props backward compatible; `#lab` works; Chrome and Safari checked
- [ ] The user approved the before/after set
- [ ] Gates green

## 3. Contract changes

Additive changes to `core/types.ts`, the learner queries, the `SignViewer` props, `feed/derived.ts` or the dev panel slot (SPEC §9.0.4, rule 2). None yet.

## 4. Cross-part edits

Edits outside the files above, kept minimal, so the integrator can expect the conflict. None yet.

## 5. Decisions

Format: `D-HNN · YYYY-MM-DD · decision` — *why* — status. None yet.

## 6. Open questions

Format: `Q-HNN` question — *Default: what you assumed meanwhile.* None yet.

## 7. Risks, known issues and stubs

Format: `R-HNN` description. None yet.

## 8. Integration checks (for the integrator)

- [ ] With B merged: lessons, questions and quizzes still fit on a 320 × 568 screen with the new viewer.
- [ ] On the Android phone: 60 fps while swiping a card with an avatar.

## 9. Session log

Newest first: date · what was done · verification · next step.

## 10. Handoff to the integrator

Written at the end of the part: what the branch contains, how it was verified (gates, browsers, devices), what needs the spec machine (MX Brio, Android phone), and follow-ups for other parts.
