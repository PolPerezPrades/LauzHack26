/**
 * Every user-facing string of the UI, in English: the default language and the reference shape.
 * Every other language (es.ts) is typed as `Messages`, so a missing or extra key fails the build.
 * Components never hard-code text: they read it through `useT()` (i18n/index.ts).
 */
import type { ExitKind } from "../core/types";
import type { Lang } from "./langs";
import type { FormatTexts } from "./parts/types";
import { games } from "./parts/games";
import { learner } from "./parts/learner";
import { learning } from "./parts/learning";
import { recommender } from "./parts/recommender";
import { settings } from "./parts/settings";

export const en = {
  app: {
    title: "Signa · Learn ASL",
    loading: "Loading…",
  },

  lang: {
    label: "Language",
    /** each language names itself, so the switch reads the same in every UI language */
    names: { en: "English", es: "Español" } as Record<Lang, string>,
    short: { en: "EN", es: "ES" } as Record<Lang, string>,
  },

  feed: {
    /** announced when a card leaves; the left, right and down ones are also the drag stamps */
    exits: {
      next: "Next card",
      too_easy: "Too easy",
      too_hard: "Too hard",
      dislike_format: "Not for me",
      camera_off: "No camera",
    } satisfies Record<ExitKind, string>,
    actionsLabel: "Card actions",
    /** one button per swipe; Next has none, because it happens on its own (Part A2) */
    actions: {
      too_easy: { label: "Too easy", aria: "Too easy (left arrow)" },
      dislike_format: { label: "Not for me", aria: "I don't like this kind of task (down arrow)" },
      too_hard: { label: "Too hard", aria: "Too hard (right arrow)" },
    },
    praise: ["Correct!", "Great!", "Well done!", "That's it!", "Perfect!"],
    incorrect: "Not quite…",
    chose: (option: string) => `You chose: ${option}`,
    answer: (a: string) => `Answer: ${a}`,
    xp: (n: number) => `+${n} XP`,
    holdToRead: "Hold the card to keep reading",
    statsLabel: (streak: number, xp: number) => `${streak}-day streak and ${xp} XP`,
    mute: "Mute sounds",
    unmute: "Turn sounds on",
    empty: "No tasks available right now.",
    retry: "Try again",
    taskError: "This task failed. You can remove it with a swipe or the buttons.",
    announceCorrect: "Correct answer",
    announceWrong: (answer?: string) => (answer ? `Wrong answer. Answer: ${answer}` : "Wrong answer"),
    forced: (format: string) => `Forced: ${format}`,
    backToDev: "Back to developer mode",
  },

  camera: {
    offButton: "I can't use the camera now",
    offShort: "No camera",
    privacy: "Video is processed on your device. Nothing is recorded or uploaded.",
    starting: "Starting the camera and hand detector…",
    denied: "Camera permission denied. You can keep going without the camera.",
    notFound: "No camera found.",
    failed: (detail: string) => `Couldn't start the camera (${detail}).`,
    detectorFailed: "Couldn't load the hand detector (MediaPipe model).",
    offThisSession: "The camera is off for this session.",
    camera: (n: number) => `Camera ${n}`,
    facing: { user: "front", environment: "rear", unknown: "unspecified" } as Record<string, string>,
    trackInfo: (label: string, facing: string, w: number, h: number) => `${label} · ${facing} · ${w}×${h}`,
  },

  formats: {
    "system-tutorial": { title: "How it works", rules: "Learn to move the cards." },
    "quiz-choice": { title: "Pick the meaning", rules: "Watch the sign and choose what it means." },
    "dev-camera-probe": { title: "Camera test", rules: "Show a hand to the camera for one second." },
    ...learning.formats.en,
    ...games.formats.en,
  } as FormatTexts,

  tutorial: {
    title: "How Signa works",
    intro: "Each card is a short task. The next one waits behind it.",
    /** the automatic Next first (Part A2), then the three swipes */
    rows: [
      { exit: "next", icon: "↑", text: "When you finish a task, the card flies up on its own." },
      { exit: "too_easy", icon: "←", text: "Left: too easy for me." },
      { exit: "too_hard", icon: "→", text: "Right: too hard." },
      { exit: "dislike_format", icon: "↓", text: "Down: I don't like this kind of task." },
    ] as { exit: ExitKind; icon: string; text: string }[],
    buttons: "You can also use the buttons below or the arrow keys.",
    tryIt: "Try it: swipe this card away or press a button.",
  },

  quiz: {
    letter: "Which letter is this?",
    number: "Which number is this?",
    word: "What does this sign mean?",
    phrase: "What does this sentence mean?",
    sign: "What does it mean?",
  },

  probe: {
    title: "Camera test",
    instructions: "Show a hand to the camera and hold it still for a second.",
    noHand: "Show your hand to the camera",
    holding: "I can see it! Keep your hand there…",
    detected: "Hand detected: the camera works.",
  },

  /** Labels for content codes (the content files hold ids and codes, not UI text). */
  content: {
    nonManual: {
      neutral: "Neutral expression",
      yn: "Yes/no question · raised eyebrows",
      wh: "Open question · furrowed eyebrows",
      neg: "Negation · shake the head from side to side",
      topic: "Topic · raised eyebrows on the first part",
    } as Record<string, string>,
  },

  viewer: {
    missing: "Sign not available",
    loading: "Loading…",
    noVideo: "No video",
    dragHint: "↔ drag to rotate",
    replay: "↻ Replay",
    slow: "🐢 Slow",
    resetView: "⟲ View",
    hand3d: "✋ 3D hand",
    avatar: "🧍 Avatar",
    realVideo: "🎥 Real video",
    creditSequence: "Sequence of dictionary signs",
    creditHand: "3D hand · pose checked against real video and ASL descriptions",
    creditAvatar: "Avatar replaying the real motion from the video",
    perf: (fps: number, worstMs: number, calls: number, triangles: number) =>
      `${fps.toFixed(0)} fps · worst frame ${worstMs.toFixed(0)} ms · ${calls} draw calls · ${(triangles / 1000).toFixed(1)}k triangles`,
  },

  lab: {
    title: "Sign lab",
    back: "Back",
    render: "render",
    review: "review",
    handshape: "handshape",
    palm: "palm",
    fingers: "fingers",
    movement: "movement",
    hand3d: "3D hand",
    avatar: "Avatar",
    video: "Video",
    realHand: "Real hand (MediaPipe)",
    noRealRef: "No real reference",
    reference: "Reference",
    illustration: "illustration",
    avatarPreview: "Avatar (preview: this sign ships as video)",
    perf: "⏱ Performance",
    views: "Views",
    viewOwn: "the sign's own",
    viewFront: "front",
    viewSide: "side",
    viewThreeQuarter: "¾",
    viewAbove: "above",
  },

  dev: {
    title: "Developer mode",
    sandboxNote: "Everything you play here is saved to the test database “signa-dev”. Your real progress doesn't change.",
    backToFeed: "Go to the feed",
    format: "Format",
    devOnly: "dev only",
    formatInfo: (family: string, camera: string, trains: string) => `family ${family} · camera ${camera} · trains ${trains || "—"}`,
    content: "Content",
    unit: "Unit",
    allUnits: "Whole curriculum",
    itemsHint: "Pick specific items, or none to walk the unit in order.",
    noContent: "This format doesn't use content.",
    clearItems: "Clear selection",
    params: "Parameters",
    challenge: "Challenge level (ce)",
    auto: "auto",
    resulting: "Resulting parameters",
    camera: "Camera",
    cameraOn: "On",
    cameraOff: "Off (as with “I can't use the camera now”)",
    cameraState: (state: string) => `State in this session: ${state}`,
    play: "▶ Play in forced mode",
    sandbox: "Sandbox",
    sandboxCount: (n: number) => `${n} ${n === 1 ? "event" : "events"} in “signa-dev”`,
    reset: "Reset sandbox",
    resetConfirm: "Delete every event in the sandbox?",
    log: "Event log",
    logSource: "Database",
    logSandbox: "sandbox (signa-dev)",
    logReal: "real (signa, read-only)",
    logType: "Type",
    logAll: "all",
    logFilter: "Filter text",
    logShowing: (shown: number, total: number) => `Showing ${shown} of ${total} (the 100 most recent matches)`,
    logEmpty: "No events.",
  },

  // Strings added by later parts live in their own modules (i18n/parts/, SPEC §9.0), so parts
  // built in parallel never edit this file for their own strings.
  learning: learning.en,
  learner: learner.en,
  recommender: recommender.en,
  games: games.en,
  settings: settings.en,
};

export type Messages = typeof en;
