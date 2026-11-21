# Parts built in parallel

One state file per part that is built in parallel (SPEC §9.0): [A2](A2.md) · [A3](A3.md) · [B](B.md) · [C](C.md) · [H](H.md) · [D](D.md) · [E](E.md) · [F1](F1.md) · [F2](F2.md).

The agent doing a part keeps its file current: status, checklist, decisions, questions, risks, log and the handoff. The integrator reads the file when it merges the part's branch and folds it into `PROJECT_STATE.md`. Agents in a parallel part don't edit `PROJECT_STATE.md`, `docs/SPEC.md`, `AGENTS.md` or the READMEs.

## Conventions

- **Status** (top of the file): `not started` · `in progress` · `ready to merge` · `merged in <commit>`.
- **Ids** carry the part: decisions `D-B01`, questions `Q-B01`, risks `R-B01`. No renumbering at merge.
- **Contract changes** and **cross-part edits** are listed in their own sections, so the integrator can expect conflicts.
- Absolute dates (`YYYY-MM-DD`), file paths, no long logs or secrets.

## Starting a part (for the humans)

Once per machine:

```bash
git clone git@github.com:PolPerezPrades/LauzHack26.git   # Windows: use a fresh clone made after Part 0 (LF endings)
cd LauzHack26
git checkout gesture_learning
```

For each part:

```bash
git checkout gesture_learning && git pull
git checkout -b part-c            # the part's branch (SPEC §9.0.1)
# start the coding agent at the repository root and paste the part's prompt (below)
# when the agent reports green gates and an updated part file:
git add -A
git commit -m "Part C: learner model v2"
git push -u origin part-c
# then tell the integrator (Pablo)
```

A wave-2 part starts from `gesture_learning` once the integrator says the parts it needs are merged. If you are ready earlier, you MAY branch from your own finished branch instead (`git checkout part-c && git checkout -b part-d`); never rebase a branch you have pushed.

## Wave 1 prompts

### S1 · Ashlie's PC (Windows 11) · Part C, branch `part-c`

```text
Do Part C (Learner model v2) of Signa, and only that part. You are stream S1 of a parallel plan, on a Windows 11 PC, on the git branch part-c.

1. Read AGENTS.md, PROJECT_STATE.md (§1 first), docs/SPEC.md §1–§2, §7, §8.3 and §9 (start with §9.0, then the Part C entry), and docs/parts/C.md, which is your state file.
2. Setup in web/: `node -v` must be 22.18 or newer. Then `npm ci` (never `npm install`) and `npm run setup:media`.
3. Other agents are building Part B (learning formats) and Parts A2 and H (feed, viewer) at the same time on other machines. Edit only the files Part C owns (SPEC §9.0.3) and keep every contract additive (§9.0.4). The stub in web/src/learner/queries.ts is yours to replace: keep createLearnerQueries(events, opts) and withContent() working, because Part B's generators call them.
4. Record everything in docs/parts/C.md: checklist, decisions D-C01…, questions, risks, log and handoff. Don't edit PROJECT_STATE.md, docs/SPEC.md, AGENTS.md or the READMEs.
5. Don't commit, push or create branches; I will.

Finish with typecheck, test and build green. Then tell me what you did, how you verified it, what I should test by hand, and what the integrator must know.
```

### S2 · Pol's laptop (Ubuntu 26.04) · Part B, branch `part-b`

```text
Do Part B (Learning task formats) of Signa, and only that part. You are stream S2 of a parallel plan, on an Ubuntu 26.04 laptop, on the git branch part-b.

1. Read AGENTS.md, PROJECT_STATE.md (§1 first), docs/SPEC.md §1–§2, §4.1–§4.6, §5, §8.3 and §9 (start with §9.0, then the Part B entry), and docs/parts/B.md, which is your state file. The old activities in web/src/activities/ are the references for the ports.
2. Setup: if `node -v` fails or is older than 22.18, install Node 22.23.5 in user space without sudo (the official linux-x64 tarball from https://nodejs.org/dist/v22.23.5/, unpacked under ~/.local, with its bin/ first on PATH). Then in web/: `npm ci` (never `npm install`) and `npm run setup:media`.
3. Other agents are building Part C (learner model) and Parts A2 and H (feed, viewer) at the same time on other machines. Edit only the files Part B owns (SPEC §9.0.3) and keep contracts additive (§9.0.4). In particular: pick items only through the LearnerQueries lists (a stub answers them until Part C lands; don't write another one), test generators with fakeQueries(), always report feedback in results (Part A2 makes every result auto-advance), use SignViewer as it is, and put new strings in web/src/i18n/parts/learning.ts.
4. Test the camera, mirror and self modes with this laptop's webcam (or Chrome's fake camera fed with a hand clip), and with the camera off.
5. Record everything in docs/parts/B.md: checklist, decisions D-B01…, questions, risks, log and handoff. Don't edit PROJECT_STATE.md, docs/SPEC.md, AGENTS.md or the READMEs.
6. Don't commit, push or create branches; I will.

Finish with typecheck, test and build green. Then tell me what you did, how you verified it, what I should test by hand, and what the integrator must know.
```

### S3 · Max's Mac (macOS) · Part A2, branch `part-a2`

```text
Do Part A2 (Feed feedback follow-ups) of Signa, and only that part. You are stream S3 of a parallel plan, on a Mac, on the git branch part-a2.

1. Read AGENTS.md, PROJECT_STATE.md (§1 first), docs/SPEC.md §1–§2, §3.3–§3.5 and §9 (start with §9.0, then the Part A2 entry), and docs/parts/A2.md, which is your state file.
2. Setup in web/: `node -v` must be 22.18 or newer (install Node 22 LTS if it isn't). Then `npm ci` (never `npm install`) and `npm run setup:media`.
3. Other agents are building Part B (learning formats) and Part C (learner model) at the same time on other machines. Edit only the files Part A2 owns (SPEC §9.0.3): the feed, the tutorial, and the core `feed` and `tutorial` strings.
4. Check the result in Chrome (desktop mouse and keyboard, phone emulation with touch, reduced motion) and in Safari.
5. Record everything in docs/parts/A2.md: checklist, decisions D-A201…, questions, risks, log and handoff. Don't edit PROJECT_STATE.md, docs/SPEC.md, AGENTS.md or the READMEs.
6. Don't commit, push or create branches; I will.

Finish with typecheck, test and build green. Then tell me what you did, how you verified it, what I should test by hand, and what the integrator must know.
```

### S3 · Max's Mac (macOS) · Part H, branch `part-h` (after A2 is committed and pushed)

```text
Do Part H (Hand and avatar quality) of Signa, and only that part. You are stream S3 of a parallel plan, on a Mac, on the git branch part-h. Part A2 is already done.

1. Read AGENTS.md, PROJECT_STATE.md (§1 first), docs/SPEC.md §1–§2, §8.5–§8.6 and §9 (start with §9.0, then the Part H entry), docs/fase2.md (how the hand and the avatar are built today), and docs/parts/H.md, which is your state file.
2. Setup in web/: `npm ci` and `npm run setup:media` (the clips are needed for the real-video comparison). To re-extract motion, install uv and run `uv run python web/scripts/extract_motion.py words` from the repository root.
3. Other agents are building Part B (which uses SignViewer) and Part C at the same time on other machines. Edit only the files Part H owns (SPEC §9.0.3): web/src/viewer/, the lab, the motion scripts and files, and only the `render` block of the sign files. SignViewer's props change only additively.
4. Start with the baseline: record the review set in #lab before changing anything. Show me before and after, side by side with the real video; I decide whether it looks good enough. Check Chrome and Safari, and keep 60 fps.
5. Record everything in docs/parts/H.md: checklist, decisions D-H01…, questions, risks, log and handoff. Don't edit PROJECT_STATE.md, docs/SPEC.md, AGENTS.md or the READMEs.
6. Don't commit, push or create branches; I will.

Finish with typecheck, test and build green. Then tell me what you did, how you verified it, what I should test by hand, and what the integrator must know.
```

### Integrator · Pablo's laptop · Part A3, branch `part-a3`

Done on the spec machine, because it needs the MX Brio. Same template as above, with SPEC §5.6 and the Part A3 entry, and `docs/parts/A3.md`.

## Wave 2 and later

Same template: the part, its stream and machine, the spec sections it lists, its part file, the parts working at the same time, and the files it owns. The integrator writes these prompts when wave 1 is merged.
