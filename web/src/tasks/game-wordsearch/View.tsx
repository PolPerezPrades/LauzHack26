import { useEffect, useRef, useState } from "react";
import { createRng, seedFrom } from "../../core/rng";
import type { TaskViewProps } from "../../core/types";
import { useT } from "../../i18n";
import { sound } from "../../sound";
import { SignStill, StillHost, prefetchStills } from "../../viewer/SignStill";
import { RAIN, gameRainResult, type RainEvent } from "../game-rain/spec";
import "../game-rain/rain.css";
import { TaskFrame } from "../ui/TaskFrame";
import { WORDSEARCH, buildBoard, letterId, type Board, type GameWordsearchParams } from "./spec";
import "./wordsearch.css";

const TICK_MS = 100;

/** The words of board number `round`: the next wordsPerBoard words of the deck, cycling. */
const wordsOfRound = (deck: readonly string[], round: number) =>
  Array.from({ length: Math.min(WORDSEARCH.wordsPerBoard, deck.length) }, (_, i) => deck[(round * WORDSEARCH.wordsPerBoard + i) % deck.length]);

/** Shares game-rain's HUD styles and result mapping; the clock is the word search's own (WORDSEARCH). */
export function GameWordsearchView({ plan, active, report }: TaskViewProps<GameWordsearchParams>) {
  const t = useT();
  const deck = plan.params.words?.length ? plan.params.words : ["CAB"];
  const [rng] = useState(() => createRng(seedFrom(plan.cardId)));
  const [round, setRound] = useState(0);
  const [board, setBoard] = useState<Board>(() => buildBoard(wordsOfRound(deck, 0), WORDSEARCH.size, rng));
  const [found, setFound] = useState<number[]>([]);
  const [bad, setBad] = useState<number | null>(null);
  const [leftMs, setLeftMs] = useState<number>(WORDSEARCH.startMs);
  const [phase, setPhase] = useState<"play" | "end">("play");
  const clock = useRef<number>(WORDSEARCH.startMs);
  const events = useRef<RainEvent[]>([]);
  const score = useRef(0);
  const done = useRef(false);
  const badTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nextTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { prefetchStills(board.grid.map(letterId)); }, [board]);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setPhase("end");
    sound.play("settle");
    setTimeout(() => report(gameRainResult(events.current, { score: score.current, aliveMs: 0 })), RAIN.endMs);
  };
  const addClock = (ms: number) => {
    clock.current = Math.max(0, Math.min(WORDSEARCH.maxMs, clock.current + ms));
    setLeftMs(clock.current);
    if (clock.current <= 0) finish();
  };

  useEffect(() => {
    if (!active || phase !== "play") return;
    const id = setInterval(() => addClock(-TICK_MS), TICK_MS);
    return () => clearInterval(id);
  }, [active, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { clearTimeout(badTimer.current); clearTimeout(nextTimer.current); }, []);

  const isDone = (cells: readonly number[], path: readonly number[]) => path.every((c) => cells.includes(c));
  const allFound = board.words.every((w) => isDone(found, w.path));

  const press = (cell: number) => {
    if (!active || done.current || found.includes(cell) || allFound) return;
    const letter = board.grid[cell];
    const word = board.words.find((w) => w.path.includes(cell));
    if (!word) {
      events.current.push({ item: letterId(letter), kind: "wrong" });
      sound.play("wrong");
      setBad(cell);
      clearTimeout(badTimer.current);
      badTimer.current = setTimeout(() => setBad(null), 300);
      addClock(-WORDSEARCH.wrongPenaltyMs);
      return;
    }
    const now = [...found, cell];
    setFound(now);
    events.current.push({ item: letterId(letter), kind: "hit" });
    if (!isDone(now, word.path)) return sound.play("tick");
    score.current += 1;
    sound.play("correct");
    addClock(WORDSEARCH.wordBonusMs);
    if (board.words.every((w) => isDone(now, w.path))) {
      nextTimer.current = setTimeout(() => {
        const r = round + 1;
        setRound(r);
        setBoard(buildBoard(wordsOfRound(deck, r), WORDSEARCH.size, rng));
        setFound([]);
      }, 600);
    }
  };

  return (
    <TaskFrame
      className="game-rain game-wordsearch"
      badge={t.games.rain.badge}
      badgeTone="check"
      prompt={phase === "end" ? t.games.rain.timeUp : t.games.wordsearch.promptSigns}
    >
      <StillHost />
      <div className="rain-hud">
        <span className={`rain-clock ${leftMs <= 3000 ? "rain-clock-low" : ""}`}>⏱ {(leftMs / 1000).toFixed(1)}s</span>
        <span className="rain-score">⭐ {score.current}</span>
      </div>
      <div className="rain-bar"><div style={{ transform: `scaleX(${Math.min(1, leftMs / WORDSEARCH.startMs)})` }} /></div>
      {phase === "end" ? (
        <div className="ws-end">
          <div className="rain-end-score">{score.current}</div>
          <div>{t.games.wordsearch.score(score.current)}</div>
        </div>
      ) : (
        <>
          <div className="ws-clue">
            {board.words.map((w) => (
              <div key={`${round}:${w.word}:${w.path[0]}`} className={`ws-word ${isDone(found, w.path) ? "ws-word-done" : ""}`}>
                {[...w.word].map((l, i) => <span key={i} className={found.includes(w.path[i]) ? "ws-got" : ""}>{l}</span>)}
              </div>
            ))}
          </div>
          <div className="ws-board" style={{ gridTemplateColumns: `repeat(${board.size}, 1fr)` }}>
            {board.grid.map((l, cell) => (
              <button
                key={`${round}:${cell}`}
                type="button"
                className={`ws-cell ${found.includes(cell) ? "ws-found" : ""} ${bad === cell ? "ws-bad" : ""}`}
                disabled={!active}
                aria-label={t.games.grid.tile}
                onClick={() => press(cell)}
              >
                <SignStill id={letterId(l)} />
              </button>
            ))}
          </div>
        </>
      )}
    </TaskFrame>
  );
}
