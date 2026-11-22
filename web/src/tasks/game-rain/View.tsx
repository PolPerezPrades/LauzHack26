import { useEffect, useRef, useState } from "react";
import type { TaskViewProps } from "../../core/types";
import { useT } from "../../i18n";
import { sound } from "../../sound";
import { SignViewer } from "../../viewer/SignViewer";
import { TaskFrame } from "../ui/TaskFrame";
import { RAIN, clockAfter, fallMs, gameRainResult, type GameRainParams, type RainEvent } from "./spec";
import "./rain.css";

interface Drop {
  key: number;
  item: string;
  /** left edge, % of the sky */
  x: number;
  fall: number;
  born: number;
}

const TICK_MS = 100;
const letterOf = (id: string) => id.replace(/^L-/, "");

/** The game loop lives in refs (clock, drops, events); React state only mirrors what is drawn. */
export function GameRainView({ plan, active, report }: TaskViewProps<GameRainParams>) {
  const t = useT();
  const letters = plan.params.letters ?? plan.items;
  const [drops, setDrops] = useState<Drop[]>([]);
  const [leftMs, setLeftMs] = useState<number>(RAIN.startMs);
  const [phase, setPhase] = useState<"play" | "end">("play");
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const clock = useRef<number>(RAIN.startMs);
  const alive = useRef(0);
  const dropsRef = useRef<Drop[]>([]);
  const events = useRef<RainEvent[]>([]);
  const score = useRef(0);
  const nextKey = useRef(0);
  const sinceSpawn = useRef<number>(Number.POSITIVE_INFINITY);
  const lastItem = useRef<string | null>(null);
  const done = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const setDropList = (next: Drop[]) => {
    dropsRef.current = next;
    setDrops(next);
  };
  const blink = (kind: "ok" | "bad") => {
    setFlash(kind);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 250);
  };

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setPhase("end");
    setDropList([]);
    sound.play("settle");
    setTimeout(() => report(gameRainResult(events.current, { score: score.current, aliveMs: alive.current })), RAIN.endMs);
  };

  // the clock and the spawner; paused while the card isn't active
  useEffect(() => {
    if (!active || phase !== "play") return;
    const id = setInterval(() => {
      alive.current += TICK_MS;
      clock.current = Math.max(0, clock.current - TICK_MS);
      setLeftMs(clock.current);
      if (clock.current <= 0) return finish();
      sinceSpawn.current += TICK_MS;
      const fall = fallMs(alive.current);
      if (sinceSpawn.current >= fall * RAIN.spawnFactor && dropsRef.current.length < RAIN.maxDrops && letters.length) {
        sinceSpawn.current = 0;
        const pool = letters.length > 1 ? letters.filter((l) => l !== lastItem.current) : letters;
        const item = pool[Math.floor(Math.random() * pool.length)];
        lastItem.current = item;
        setDropList([...dropsRef.current, { key: nextKey.current++, item, x: 4 + Math.random() * 62, fall, born: alive.current }]);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [active, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const landed = (drop: Drop) => {
    if (done.current || !dropsRef.current.some((d) => d.key === drop.key)) return;
    events.current.push({ item: drop.item, kind: "miss", ms: alive.current - drop.born });
    clock.current = clockAfter(clock.current, "miss");
    setLeftMs(clock.current);
    setDropList(dropsRef.current.filter((d) => d.key !== drop.key));
    sound.play("wrong");
    blink("bad");
    if (clock.current <= 0) finish();
  };

  const press = (letter: string) => {
    if (!active || done.current) return;
    // the lowest (oldest) matching sign
    const hit = dropsRef.current.find((d) => d.item === letter);
    if (hit) {
      events.current.push({ item: hit.item, kind: "hit", ms: alive.current - hit.born });
      score.current += 1;
      clock.current = clockAfter(clock.current, "hit");
      setDropList(dropsRef.current.filter((d) => d.key !== hit.key));
      sound.play("correct");
      blink("ok");
    } else {
      const oldest = dropsRef.current[0];
      if (oldest) events.current.push({ item: oldest.item, kind: "wrong", pressed: letter });
      clock.current = clockAfter(clock.current, "wrong");
      sound.play("wrong");
      blink("bad");
    }
    setLeftMs(clock.current);
    if (clock.current <= 0) finish();
  };

  // keyboard alternative: the letter keys press the buttons
  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      const id = letters.find((l) => letterOf(l).toLowerCase() === e.key.toLowerCase());
      if (id) {
        e.preventDefault();
        pressRef.current(id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, letters]);

  const seconds = (leftMs / 1000).toFixed(1);
  const low = leftMs <= 3000;

  return (
    <TaskFrame className="game-rain" badge={t.games.rain.badge} badgeTone="check" prompt={phase === "end" ? t.games.rain.timeUp : t.games.rain.prompt}>
      <div className="rain-hud">
        <span className={`rain-clock ${low ? "rain-clock-low" : ""}`}>⏱ {seconds}s</span>
        <span className="rain-score">⭐ {score.current}</span>
      </div>
      <div className="rain-bar"><div style={{ transform: `scaleX(${Math.min(1, leftMs / RAIN.startMs)})` }} /></div>
      <div className={`rain-sky ${flash ? `rain-${flash}` : ""} ${active ? "" : "rain-paused"}`}>
        {phase === "end" ? (
          <div className="rain-end">
            <div className="rain-end-score">{score.current}</div>
            <div>{t.games.rain.score(score.current)}</div>
          </div>
        ) : drops.map((d) => (
          <div key={d.key} className="rain-drop" style={{ left: `${d.x}%`, animationDuration: `${d.fall}ms` }} onAnimationEnd={() => landed(d)}>
            <SignViewer ids={[d.item]} size="sm" controls={false} credit={false} orbit={false} />
          </div>
        ))}
        <div className="rain-ground" />
      </div>
      <div className="rain-keys">
        {letters.map((id) => (
          <button key={id} type="button" className="rain-key" disabled={!active || phase === "end"} onClick={() => press(id)}>
            {letterOf(id)}
          </button>
        ))}
      </div>
    </TaskFrame>
  );
}
