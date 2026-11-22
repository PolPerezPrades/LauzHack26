import { useEffect, useRef, useState } from "react";
import { createRng, seedFrom } from "../../core/rng";
import type { TaskViewProps } from "../../core/types";
import { useT } from "../../i18n";
import { sound } from "../../sound";
import { SignViewer } from "../../viewer/SignViewer";
import { RAIN, clockAfter, gameRainResult, type RainEvent } from "../game-rain/spec";
import "../game-rain/rain.css";
import { TaskFrame } from "../ui/TaskFrame";
import { GRID, nextTarget, shuffled, type GameGridParams } from "./spec";
import "./grid.css";

const TICK_MS = 100;
const letterOf = (id: string) => id.replace(/^L-/, "");

/** Same clock and HUD as game-rain (its CSS is reused); tiles are keyed by letter, so a shuffle moves them without remounting. */
export function GameGridView({ plan, active, report }: TaskViewProps<GameGridParams>) {
  const t = useT();
  const targets = plan.items;
  const [rng] = useState(() => createRng(seedFrom(plan.cardId)));
  const [tiles, setTiles] = useState<string[]>(() => (plan.params.tiles ?? [...targets]).slice(0, GRID.tiles));
  const [target, setTarget] = useState<string>(() => nextTarget(targets, null, rng));
  const [leftMs, setLeftMs] = useState<number>(RAIN.startMs);
  const [phase, setPhase] = useState<"play" | "end">("play");
  const [mark, setMark] = useState<{ id: string; ok: boolean } | null>(null);
  const clock = useRef<number>(RAIN.startMs);
  const alive = useRef(0);
  const shownAt = useRef(0);
  const events = useRef<RainEvent[]>([]);
  const score = useRef(0);
  const done = useRef(false);
  const markTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setPhase("end");
    sound.play("settle");
    setTimeout(() => report(gameRainResult(events.current, { score: score.current, aliveMs: alive.current })), RAIN.endMs);
  };

  useEffect(() => {
    if (!active || phase !== "play") return;
    const id = setInterval(() => {
      alive.current += TICK_MS;
      clock.current = Math.max(0, clock.current - TICK_MS);
      setLeftMs(clock.current);
      if (clock.current <= 0) finish();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [active, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(markTimer.current), []);

  const flashTile = (id: string, ok: boolean) => {
    setMark({ id, ok });
    clearTimeout(markTimer.current);
    markTimer.current = setTimeout(() => setMark(null), 300);
  };

  const press = (id: string) => {
    if (!active || done.current) return;
    const ms = alive.current - shownAt.current;
    if (id === target) {
      events.current.push({ item: target, kind: "hit", ms });
      score.current += 1;
      clock.current = clockAfter(clock.current, "hit");
      sound.play("correct");
      flashTile(id, true);
      setTiles((ts) => shuffled(ts, rng));
      setTarget(nextTarget(targets, target, rng));
      shownAt.current = alive.current;
    } else {
      events.current.push({ item: target, kind: "wrong", pressed: id, ms });
      clock.current = clockAfter(clock.current, "wrong");
      sound.play("wrong");
      flashTile(id, false);
    }
    setLeftMs(clock.current);
    if (clock.current <= 0) finish();
  };

  // keyboard alternative: 1–9 press the tiles, row by row
  const pressRef = useRef(press);
  pressRef.current = press;
  const tilesRef = useRef(tiles);
  tilesRef.current = tiles;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > tilesRef.current.length) return;
      e.preventDefault();
      pressRef.current(tilesRef.current[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const low = leftMs <= 3000;

  return (
    <TaskFrame
      className="game-rain game-grid"
      badge={t.games.rain.badge}
      badgeTone="check"
      prompt={phase === "end" ? t.games.rain.timeUp : <>{t.games.grid.prompt} <span className="grid-target">{letterOf(target)}</span></>}
    >
      <div className="rain-hud">
        <span className={`rain-clock ${low ? "rain-clock-low" : ""}`}>⏱ {(leftMs / 1000).toFixed(1)}s</span>
        <span className="rain-score">⭐ {score.current}</span>
      </div>
      <div className="rain-bar"><div style={{ transform: `scaleX(${Math.min(1, leftMs / RAIN.startMs)})` }} /></div>
      {phase === "end" ? (
        <div className="grid-end">
          <div className="rain-end-score">{score.current}</div>
          <div>{t.games.rain.score(score.current)}</div>
        </div>
      ) : (
        <div className="grid-board">
          {tiles.map((id) => (
            <button
              key={id}
              type="button"
              className={`grid-tile ${mark?.id === id ? (mark.ok ? "grid-ok" : "grid-bad") : ""}`}
              disabled={!active}
              aria-label={t.games.grid.tile}
              onClick={() => press(id)}
            >
              <SignViewer ids={[id]} size="sm" controls={false} credit={false} orbit={false} />
            </button>
          ))}
        </div>
      )}
    </TaskFrame>
  );
}
