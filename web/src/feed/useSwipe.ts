/**
 * Pointer gestures for the card stack (D-009: Pointer Events, no library). A pointer that moves
 * less than the tap slop is a tap and reaches the task's buttons untouched; a longer drag is a
 * swipe, unless it starts inside `[data-noswipe]` (inputs, sliders, scroll areas). Works the same
 * for touch, mouse and pen. Every press is reported, so the feed can hold the auto-advance while a
 * finger rests on the card (SPEC §3.4); a press always ends, even when released outside the stack.
 */
import { useEffect, useRef, type RefObject } from "react";
import { FEED } from "./config";
import { releaseVelocity, type PointerSample } from "./swipe";

export interface SwipeRelease {
  dx: number;
  dy: number;
  /** px/ms over the last ~100 ms */
  vx: number;
  vy: number;
}

export interface SwipeCallbacks {
  /** whether a drag may start on this target now */
  canStart(target: Element): boolean;
  /** a press began where a drag may start: it can still become a tap, a hold or a drag */
  onPress?(): void;
  /** that press ended without becoming a drag: a tap, a hold, or the browser took the pointer */
  onPressEnd?(): void;
  /** the press became a drag */
  onStart(): void;
  /** displacement since pointerdown, at most once per animation frame */
  onMove(dx: number, dy: number): void;
  onEnd(release: SwipeRelease): void;
  /** the browser took the pointer away (e.g. a system gesture) */
  onCancel(): void;
}

export function useSwipe(ref: RefObject<HTMLElement | null>, callbacks: SwipeCallbacks) {
  const cb = useRef(callbacks);
  cb.current = callbacks;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let p: { id: number; x0: number; y0: number; dragging: boolean; samples: PointerSample[]; raf: number; x: number; y: number } | null = null;
    let suppressClick = false;

    const down = (e: PointerEvent) => {
      if (p || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
      const target = e.target as Element;
      if (target.closest("[data-noswipe]") || !cb.current.canStart(target)) return;
      p = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dragging: false, samples: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }], raf: 0, x: e.clientX, y: e.clientY };
      cb.current.onPress?.();
    };

    const move = (e: PointerEvent) => {
      if (!p || e.pointerId !== p.id) return;
      if (!p.dragging) {
        if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < FEED.tapSlopPx) return;
        p.dragging = true;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* pointer already gone */
        }
        cb.current.onStart();
      }
      p.x = e.clientX;
      p.y = e.clientY;
      p.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      if (p.samples.length > 32) p.samples.splice(0, p.samples.length - 32);
      if (!p.raf) {
        const cur = p;
        cur.raf = requestAnimationFrame(() => {
          cur.raf = 0;
          if (p === cur) cb.current.onMove(cur.x - cur.x0, cur.y - cur.y0);
        });
      }
    };

    const up = (e: PointerEvent) => {
      if (!p || e.pointerId !== p.id) return;
      const cur = p;
      p = null;
      cancelAnimationFrame(cur.raf);
      if (!cur.dragging) {
        cb.current.onPressEnd?.(); // a tap or a hold: the click goes through
        return;
      }
      // the click that follows a drag must not press the button the drag started on
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      const dx = e.clientX - cur.x0, dy = e.clientY - cur.y0;
      cb.current.onMove(dx, dy);
      cb.current.onEnd({ dx, dy, ...releaseVelocity(cur.samples, { x: e.clientX, y: e.clientY, t: e.timeStamp }, FEED.velocityWindowMs) });
    };

    const cancel = (e: PointerEvent) => {
      if (!p || e.pointerId !== p.id) return;
      const cur = p;
      p = null;
      cancelAnimationFrame(cur.raf);
      if (cur.dragging) cb.current.onCancel();
      else cb.current.onPressEnd?.();
    };

    // Touch pointers are implicitly captured by the element under the finger; taking the capture
    // makes that element fire a (bubbling) lostpointercapture. Only our own capture matters.
    const lost = (e: PointerEvent) => {
      if (e.target === el) cancel(e);
    };

    const click = (e: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    // A press that never became a drag has no capture: its release may land outside the stack (or
    // on the next card, if the one it began on has left). Listening on the window ends it anyway,
    // in the capture phase so that no handler inside a card can stop the event first.
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", cancel, true);
    el.addEventListener("lostpointercapture", lost);
    el.addEventListener("click", click, true);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", cancel, true);
      el.removeEventListener("lostpointercapture", lost);
      el.removeEventListener("click", click, true);
      if (p) cancelAnimationFrame(p.raf);
    };
  }, [ref]);
}
