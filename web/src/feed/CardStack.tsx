/**
 * The two mounted cards (SPEC §3.2): the current card on top and the next one behind it as a
 * lightweight preview. This component owns the DOM side of gestures — the drag pose, the stamps,
 * the exit, spring-back and grow animations. Decisions (may the card leave? what to log? which
 * sound?) belong to FeedScreen. When a card is promoted it keeps its DOM node (same key), so the
 * grow animation hands over to the resting layout without a jump.
 */
import { useImperativeHandle, useLayoutEffect, useRef, type ReactNode, type Ref } from "react";
import type { CardPlan, ExitKind } from "../core/types";
import { useT } from "../i18n";
import { prefersReducedMotion } from "../lib/env";
import { REST, animateAppear, animateBehindToFront, animateExit, animateNudge, animateSpring, finished, poseTransform, type Pose } from "./animations";
import { FEED } from "./config";
import { decideSwipe, dragProgress, rubberBand, type SwipeDir } from "./swipe";
import { useSwipe } from "./useSwipe";

export interface CardStackHandle {
  /** Flies the current card out (from its drag pose) while the next grows into place. */
  exit(dir: SwipeDir, showStamp: boolean): Promise<void>;
  /** Call right after the next card was promoted to current. */
  settle(): void;
  spring(): Promise<void>;
  nudge(): void;
}

interface Props {
  ref?: Ref<CardStackHandle>;
  current: CardPlan | null;
  next: CardPlan | null;
  renderCurrent(plan: CardPlan): ReactNode;
  renderPreview(plan: CardPlan): ReactNode;
  /** upward drags may commit (the task is completed, or the card allows Next anytime) */
  canUp(): boolean;
  canDrag(): boolean;
  onDragStart(): void;
  /** the drag crossed the commit distance (once per drag) */
  onThreshold(): void;
  onRelease(dir: SwipeDir | null, peakProgress: number): void;
  children?: ReactNode;
}

type StampDir = "left" | "right" | "down";
const STAMPS: { dir: StampDir; exit: ExitKind }[] = [
  { dir: "left", exit: "too_easy" },
  { dir: "right", exit: "too_hard" },
  { dir: "down", exit: "dislike_format" },
];

export function CardStack({ ref, current, next, renderCurrent, renderPreview, canUp, canDrag, onDragStart, onThreshold, onRelease, children }: Props) {
  const t = useT();
  const stackRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const behindRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const stampRefs = useRef<Partial<Record<StampDir, HTMLDivElement | null>>>({});
  const pose = useRef<Pose>(REST);
  const drag = useRef({ width: 1, height: 1, ticked: false, peak: 0 });
  const growing = useRef<Animation[]>([]);
  const springing = useRef<Animation | null>(null);

  const setStamps = (dir: SwipeDir | null, opacity: number) => {
    for (const s of STAMPS) {
      const el = stampRefs.current[s.dir];
      if (el) el.style.opacity = String(s.dir === dir ? Math.min(1, opacity) : 0);
    }
  };
  const applyPose = (p: Pose) => {
    pose.current = p;
    if (frontRef.current) frontRef.current.style.transform = p === REST ? "" : poseTransform(p);
  };

  useSwipe(stackRef, {
    canStart: (target) => !!frontRef.current?.contains(target) && canDrag(),
    onStart() {
      springing.current?.cancel();
      springing.current = null;
      const r = frontRef.current?.getBoundingClientRect();
      drag.current = { width: r?.width || 1, height: r?.height || 1, ticked: false, peak: 0 };
      onDragStart();
    },
    onMove(dx, dy) {
      const up = canUp();
      const { width, height } = drag.current;
      const rot = prefersReducedMotion() ? 0 : Math.max(-1, Math.min(1, dx / width)) * FEED.dragRotateDeg;
      applyPose({ dx, dy: dy < 0 && !up ? rubberBand(dy) : dy, rot });
      const { dir, progress } = dragProgress(dx, dy, width, height, { canUp: up });
      setStamps(dir, progress);
      drag.current.peak = Math.max(drag.current.peak, progress);
      if (progress >= 1 && !drag.current.ticked) {
        drag.current.ticked = true;
        onThreshold();
      }
    },
    onEnd({ dx, dy, vx, vy }) {
      const { width, height, peak } = drag.current;
      onRelease(decideSwipe({ dx, dy, vx, vy, width, height }, { canUp: canUp() }), peak);
    },
    onCancel() {
      onRelease(null, 0);
    },
  });

  useImperativeHandle(ref, () => ({
    async exit(dir, showStamp) {
      const front = frontRef.current;
      if (!front) return;
      springing.current?.cancel();
      if (showStamp) setStamps(dir === "up" ? null : dir, 1);
      const reduced = prefersReducedMotion();
      const out = animateExit(front, dir, pose.current, reduced);
      growing.current = animateBehindToFront(behindRef.current, dimRef.current, reduced);
      await Promise.all([finished(out), ...growing.current.map(finished)]);
    },
    settle() {
      // the promoted card now rests in the front position: drop the fills that held it there
      for (const a of growing.current) a.cancel();
      growing.current = [];
      pose.current = REST;
    },
    async spring() {
      const front = frontRef.current;
      if (!front) return;
      const from = pose.current;
      applyPose(REST);
      setStamps(null, 0);
      springing.current = animateSpring(front, from, prefersReducedMotion());
      await finished(springing.current);
      springing.current = null;
    },
    nudge() {
      if (frontRef.current && pose.current === REST) animateNudge(frontRef.current, prefersReducedMotion());
    },
  }), []);

  // a freshly queued card fades in behind the current one
  const nextId = next?.cardId;
  useLayoutEffect(() => {
    if (nextId) animateAppear(behindRef.current);
  }, [nextId]);

  return (
    <div className="feed-stack" ref={stackRef}>
      {current && (
        <div key={current.cardId} ref={frontRef} className="feed-card is-front" data-card-id={current.cardId} data-format={current.format}>
          {renderCurrent(current)}
          {STAMPS.map((s) => (
            <div key={s.dir} ref={(el) => { stampRefs.current[s.dir] = el; }} className={`stamp stamp-${s.dir}`} aria-hidden="true">{t.feed.exits[s.exit]}</div>
          ))}
        </div>
      )}
      {next && (
        <div key={next.cardId} ref={behindRef} className="feed-card is-behind" aria-hidden="true" data-card-id={next.cardId} data-format={next.format}>
          {renderPreview(next)}
          <div ref={dimRef} className="feed-card-dim" />
        </div>
      )}
      {children}
    </div>
  );
}
