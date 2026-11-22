/**
 * The feed (SPEC §3): opening the app shows a task card, and the next one already waits behind it.
 * Every card goes through the lifecycle of §3.4 —
 *   queued   a preview behind the current card (no camera, timers or WebGL)
 *   active   `card.shown` is logged and the task mounts; it activates once it is in place
 *   result   `evidence` + `card.result` are logged; a banner inside the card says how it went, and
 *            every result leaves on its own with the Next exit when its countdown ends
 *            (autoAdvance.ts). Holding the card freezes the countdown, a spring-back restarts it,
 *            and swipes stay possible to add an opinion
 *   exit     `card.exit` is logged; one shared animation; the queued card is replaced first if it
 *            can no longer be shown (camera off)
 * — and every exit has a gesture and a key; every exit but Next also has a button (Next happens on
 * its own). Logic and logging live here; the DOM side of gestures and animations lives in CardStack.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { cameraSession } from "../camera";
import { createRng, seedFrom } from "../core/rng";
import type { CardAvoid, CardPlan, CardSource, ExitKind, TaskResult } from "../core/types";
import type { LogStore } from "../data/logStore";
import { currentMessages, useT } from "../i18n";
import { sound, type SoundName } from "../sound";
import { TUTORIAL_ID, getFormat, needsCamera } from "../tasks/registry";
import { PREFETCH, VIEWS } from "../tasks/views";
import { ActionBar } from "./ActionBar";
import { autoAdvanceMs, createCountdown, type CountdownView } from "./autoAdvance";
import { CardHeader, CardPreview, FeedbackPanel, TaskErrorBoundary, TaskFailed } from "./CardParts";
import { CardStack, type CardStackHandle } from "./CardStack";
import { FEED } from "./config";
import { cardHistory, feedStats, soundMuted } from "./derived";
import { FeedTop } from "./FeedTop";
import { DIR_FOR_EXIT, EXIT_FOR_DIR } from "./swipe";
import "./feed.css";

const EXIT_SOUND: Record<ExitKind, SoundName> = { next: "next", camera_off: "next", too_easy: "easy", too_hard: "hard", dislike_format: "dislike" };
const KEY_EXIT: Record<string, ExitKind> = { ArrowUp: "next", Enter: "next", " ": "next", ArrowLeft: "too_easy", ArrowRight: "too_hard", ArrowDown: "dislike_format" };

interface Queue { current: CardPlan | null; next: CardPlan | null }

export interface FeedProps {
  log: LogStore;
  source: CardSource;
  sessionId: string;
  /** dev forced mode: label of the forced format, and the way back */
  forcedLabel?: string;
  onBackToDev?: () => void;
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
/** Enter and Space belong to a focused control that can use them; a disabled one (an answered option) can't. */
const ownsEnterAndSpace = (t: EventTarget | null) => t instanceof Element && !!t.closest("button:not(:disabled), a[href], [role='button']:not([aria-disabled='true'])");
const cardUsesCamera = (plan: CardPlan | null) => {
  const spec = plan ? getFormat(plan.format) : undefined;
  return !!spec && spec.requires.camera !== "none";
};
const playableNow = (plan: CardPlan) => {
  const spec = getFormat(plan.format);
  return !!spec && (!needsCamera(spec) || cameraSession.usable);
};

export function FeedScreen({ log, source, sessionId, forcedLabel, onBackToDev }: FeedProps) {
  const t = useT();
  const events = useSyncExternalStore(log.subscribe, log.getEvents);
  const [queue, setQueueState] = useState<Queue>({ current: null, next: null });
  const [result, setResultState] = useState<TaskResult | null>(null);
  const [active, setActive] = useState(false);
  const [countdownView, setCountdownView] = useState<CountdownView | null>(null);
  // the wait before a finished card leaves on its own; it drives the banner's countdown bar
  const [countdown] = useState(() => createCountdown(setCountdownView));
  const [announcement, setAnnouncement] = useState({ text: "", n: 0 });
  const [started, setStarted] = useState(false);

  // gesture and timer callbacks outlive renders: they read the truth from refs
  const queueRef = useRef<Queue>(queue);
  const resultRef = useRef<TaskResult | null>(null);
  const stack = useRef<CardStackHandle>(null);
  const exiting = useRef(false);
  const initialized = useRef(false);
  const loggedShown = useRef<string | null>(null);
  const shownAt = useRef(0);
  const activeAt = useRef(0);
  const rng = useMemo(() => createRng(seedFrom(sessionId)), [sessionId]);

  const setQueue = useCallback((q: Queue) => {
    queueRef.current = q;
    setQueueState(q);
  }, []);
  const setResult = useCallback((r: TaskResult | null) => {
    resultRef.current = r;
    setResultState(r);
  }, []);
  const announce = useCallback((text: string) => setAnnouncement((a) => ({ text, n: a.n + 1 })), []);

  const pick = useCallback((queued: (CardPlan | null)[], avoid?: CardAvoid): CardPlan | null => {
    try {
      const events = log.getEvents();
      return source.next({ history: cardHistory(events, queued), events, cameraUsable: cameraSession.usable, rng }, avoid);
    } catch (err) {
      console.error("[feed] card source failed", err);
      return null;
    }
  }, [source, log, rng]);

  /** Starts an exit. Returns false when it isn't allowed now (e.g. Next before completion). */
  const exit = useCallback((kind: ExitKind, fromDrag = false): boolean => {
    const q = queueRef.current;
    const plan = q.current;
    if (!plan || exiting.current) return false;
    const completed = resultRef.current !== null;
    if (kind === "next" && !completed && !getFormat(plan.format)?.nextAnytime) return false;
    exiting.current = true;
    countdown.cancel();
    setActive(false);
    log.emit({ type: "card.exit", sessionId, cardId: plan.cardId, format: plan.format, exit: kind, completed, msVisible: Math.round(performance.now() - shownAt.current) });
    sound.play(EXIT_SOUND[kind]);
    sound.haptic("exit");
    announce(currentMessages().feed.exits[kind]);
    let next = q.next;
    if (next && !playableNow(next)) {
      next = pick([]);
      flushSync(() => setQueue({ current: plan, next }));
    }
    const promote = () => {
      flushSync(() => {
        setQueue({ current: next, next: null });
        setResult(null);
      });
      stack.current?.settle();
      exiting.current = false;
      if (next) sound.play("settle");
    };
    if (stack.current) void stack.current.exit(DIR_FOR_EXIT[kind], !fromDrag).then(promote);
    else promote();
    return true;
  }, [announce, countdown, log, pick, sessionId, setQueue, setResult]);

  const report = useCallback((cardId: string, r: TaskResult) => {
    const plan = queueRef.current.current;
    if (!plan || plan.cardId !== cardId || resultRef.current || exiting.current) return; // exactly once
    setResult(r);
    const on = { sessionId, cardId, format: plan.format };
    for (const ev of r.evidence) log.emit({ ...on, ...ev, type: "evidence" });
    log.emit({ ...on, type: "card.result", success: r.success, xp: r.xp, ms: Math.round(performance.now() - activeAt.current) });
    if (r.score !== undefined) log.emit({ ...on, type: "game.score", score: r.score, params: plan.params });
    if (r.feedback) {
      sound.play(r.feedback.correct ? "correct" : "wrong");
      if (!r.feedback.correct) sound.haptic("wrong");
      // callbacks outlive renders: read the strings of the language active now
      const now = currentMessages().feed;
      announce(r.feedback.correct ? now.announceCorrect : now.announceWrong(r.feedback.answer));
    }
    // every result leaves on its own (Part A2); a swipe before that adds the learner's opinion
    countdown.start(autoAdvanceMs(r), () => exit("next"));
  }, [announce, countdown, exit, log, sessionId, setResult]);

  const fill = useCallback(() => {
    const current = pick([]);
    setQueue({ current, next: current ? pick([current]) : null });
    setStarted(true);
  }, [pick, setQueue]);

  // the first card, and the one behind it
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    fill();
  }, [fill]);

  // a card became current: log it once, and choose the card behind it (one card of lag)
  const currentId = queue.current?.cardId;
  useEffect(() => {
    const plan = queueRef.current.current;
    if (!plan || loggedShown.current === plan.cardId) return;
    loggedShown.current = plan.cardId;
    shownAt.current = performance.now();
    log.emit({
      type: "card.shown", sessionId, cardId: plan.cardId, format: plan.format, items: plan.items,
      ...(plan.pool ? { pool: plan.pool } : {}), ...(plan.content ? { content: plan.content } : {}),
      params: plan.params, reasons: plan.reasons, ...(plan.score ? { score: plan.score } : {}), source: source.kind,
    });
    if (!queueRef.current.next) setQueue({ current: plan, next: pick([plan]) });
  }, [currentId, log, pick, sessionId, setQueue, source.kind]);

  // the task mounts inactive and starts its timers once it is in place
  useEffect(() => {
    if (!currentId) return;
    const raf = requestAnimationFrame(() => {
      activeAt.current = performance.now();
      setActive(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [currentId]);

  // warm the media of the card waiting behind
  const nextId = queue.next?.cardId;
  useEffect(() => {
    const n = queueRef.current.next;
    if (n) PREFETCH[n.format]?.(n);
  }, [nextId]);

  // camera opt-out (from the header button or a task) and failures: log, and leave a camera card
  useEffect(() => cameraSession.subscribe((change) => {
    if (change.event.type !== "opt-out" && change.event.type !== "failed") return;
    log.emit({ type: "camera.off", sessionId, reason: change.reason ?? "error" });
    if (change.event.type === "opt-out" && cardUsesCamera(queueRef.current.current)) exit("camera_off");
  }), [exit, log, sessionId]);

  // keyboard: arrows for the four exits; ↑, Enter and Space skip the wait after a result (ignored while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || isTyping(e.target)) return;
      const kind = KEY_EXIT[e.key];
      if (!kind) return;
      if ((e.key === "Enter" || e.key === " ") && ownsEnterAndSpace(e.target)) return;
      e.preventDefault();
      if (!exit(kind) && kind === "next") stack.current?.nudge();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exit]);

  // A hidden page freezes the countdown: a correction nobody sees must not leave on its own. Back
  // on the page, the wait starts again from the beginning.
  useEffect(() => {
    const onVisibility = () => (document.hidden ? countdown.hold("hidden") : countdown.release("hidden", true));
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      countdown.release("hidden");
    };
  }, [countdown]);

  useEffect(() => () => countdown.cancel(), [countdown]);

  const muted = useMemo(() => soundMuted(events), [events]);
  useEffect(() => {
    sound.setMuted(muted);
  }, [muted]);
  const toggleMute = () => {
    log.emit({ type: "settings.set", soundMuted: !muted });
    if (muted) {
      sound.setMuted(false);
      sound.play("settle");
    }
  };
  const stats = useMemo(() => feedStats(events, Date.now()), [events]);

  const onCameraOff = () => {
    // through the session: it stops the tracks, and the subscription above logs and exits
    if (cameraSession.usable) cameraSession.optOut();
    else exit("camera_off");
  };

  const plan = queue.current;

  return (
    <div className="feed">
      <div className="feed-col">
        <FeedTop streak={stats.streak} xp={stats.xp} muted={muted} onToggleMute={toggleMute} forcedLabel={forcedLabel} onBackToDev={onBackToDev} />
        <CardStack
          ref={stack}
          current={plan}
          next={queue.next}
          renderCurrent={(p) => {
            const View = VIEWS[p.format];
            return (
              <>
                <CardHeader plan={p} spec={getFormat(p.format)} onCameraOff={cardUsesCamera(p) ? onCameraOff : undefined} />
                <div className="feed-card-body">
                  <TaskErrorBoundary key={p.cardId}>
                    {View ? <View plan={p} active={active} camera={cameraSession} report={(r) => report(p.cardId, r)} /> : <TaskFailed />}
                  </TaskErrorBoundary>
                </div>
                {result && <FeedbackPanel cardId={p.cardId} result={result} countdown={countdownView} />}
              </>
            );
          }}
          renderPreview={(p) => <CardPreview plan={p} spec={getFormat(p.format)} />}
          canUp={() => resultRef.current !== null || !!getFormat(queueRef.current.current?.format ?? "")?.nextAnytime}
          canDrag={() => !exiting.current}
          // a finger on the card holds the countdown (to keep reading); a drag keeps holding it
          onPress={() => countdown.hold("pointer")}
          onPressEnd={() => countdown.release("pointer")}
          onThreshold={() => sound.play("tick")}
          onRelease={(dir, peak) => {
            const left = dir !== null && exit(EXIT_FOR_DIR[dir], true);
            // a card that sprang back starts its countdown again from the beginning, so it never gets stuck
            countdown.release("pointer", true);
            if (left) return;
            void stack.current?.spring();
            if (peak >= FEED.springSoundProgress) sound.play("spring");
          }}
        >
          {started && !plan && (
            <div className="feed-empty">
              <p>{t.feed.empty}</p>
              <button type="button" className="btn btn-primary" onClick={fill}>{t.feed.retry}</button>
              {onBackToDev && <button type="button" className="btn btn-ghost" onClick={onBackToDev}>{t.feed.backToDev}</button>}
            </div>
          )}
        </CardStack>
        <ActionBar disabled={!plan} highlight={plan?.format === TUTORIAL_ID} onExit={(k) => exit(k)} />
        <div className="sr-only" aria-live="polite">
          <span key={announcement.n}>{announcement.text}</span>
        </div>
      </div>
    </div>
  );
}
