/**
 * Session orchestrator (rule- and score-based, no LLM). Builds a session from the learner profile
 * and the current context, and explains every decision.
 *
 * Ingredients, in priority order:
 *   1. due reviews (FSRS) — receptive and productive memories are scheduled separately;
 *   2. weak points (recent errors, confusions) — reinforced with confusable distractors;
 *   3. new items from the frontier unit, introduced gradually (fewer when there is a review
 *      backlog or recent accuracy is below the 80–85 % target band, more when it is above);
 *   4. variety (no activity three times in a row, a game, a final mini-exam);
 *   5. capabilities right now: no camera → only receptive activities.
 * Modes: "auto" (what to do today), "topic" (a chosen unit), "game" (a chosen game).
 */
import { CAMERA_LETTERS, PHRASES, SIGNS, UNITS, getSign, label, type Unit } from "../content/curriculum";
import { DIALOGUES, PASSAGES, scenarioSigns } from "../content/scenarios";
import type { Modality, SessionContext } from "../data/events";
import { ACTIVITY, availableIn, estimateSeconds, type ItemKind } from "./activityCatalog";
import { isDue, isWeak, mastery, retrievability, topConfusion, TARGET_ACCURACY, type Profile } from "./profile";

export interface PlanStep {
  activity: string;
  items: string[];
  modality: Modality;
  why: string[];
  /** passage / dialogue id for content-driven activities */
  content?: string;
}
export interface SessionPlan {
  mode: "auto" | "topic" | "game";
  target?: string;
  steps: PlanStep[];
  log: string[];
  seconds: number;
}
export interface PlanRequest { mode: "auto" | "topic" | "game"; unitId?: string; activityId?: string }

export function itemKind(id: string): ItemKind {
  if (PHRASES.has(id)) return "phrase";
  return getSign(id)?.kind ?? "word";
}
const isSeen = (p: Profile, id: string) => !!p.items[id] && (!!p.items[id].receptive || !!p.items[id].introducedTs);
const pct = (x: number) => `${Math.round(x * 100)} %`;

// ---- units -------------------------------------------------------------------------------------
export function unitProgress(u: Unit, p: Profile, now = Date.now()) {
  if (!u.items.length) return { receptive: 0, productive: 0, seen: 0 };
  const rec = u.items.reduce((s, id) => s + mastery(p.items[id]?.receptive, now), 0) / u.items.length;
  const letters = u.items.filter((id) => itemKind(id) === "letter");
  const prod = letters.length ? letters.reduce((s, id) => s + mastery(p.items[id]?.productive, now), 0) / letters.length : 0;
  const seen = u.items.filter((id) => isSeen(p, id)).length / u.items.length;
  return { receptive: rec, productive: prod, seen };
}

/** The unit being learnt now: first unit from the placement start that is not yet mostly seen & retained. */
export function frontierUnit(p: Profile, now = Date.now()): Unit {
  const start = Math.max(0, UNITS.findIndex((u) => u.id === p.settings.startUnit));
  for (let i = start; i < UNITS.length; i++) {
    const u = UNITS[i];
    if (!u.items.length) continue;
    const pr = unitProgress(u, p, now);
    if (pr.seen < 0.9 || pr.receptive < 0.35) return u;
  }
  return UNITS[UNITS.length - 1];
}

// ---- planning ----------------------------------------------------------------------------------
export function planSession(p: Profile, ctx: SessionContext, req: PlanRequest = { mode: "auto" }, now = Date.now()): SessionPlan {
  const log: string[] = [];
  const budget = ctx.minutes * 60;
  const steps: PlanStep[] = [];
  let seconds = 0;
  const can = (id: string) => { const a = ACTIVITY.get(id); return !!a && availableIn(a, ctx); };
  const push = (activity: string, items: string[], why: string[], content?: string) => {
    const meta = ACTIVITY.get(activity)!;
    steps.push({ activity, items, modality: meta.trains, why, content });
    seconds += estimateSeconds(meta, items.length);
  };

  if (!ctx.camera) log.push("Sin cámara ahora: solo actividades receptivas (entender signos).");
  const [lo, hi] = TARGET_ACCURACY;
  log.push(`Precisión reciente ${pct(p.accuracyEma)} (objetivo ${pct(lo)}–${pct(hi)}) → dificultad ${p.difficulty > 0.25 ? "subiendo" : p.difficulty < -0.25 ? "bajando" : "estable"}.`);

  // ---- game mode: one game, items chosen from what the learner knows --------------------------
  if (req.mode === "game" && req.activityId) {
    const meta = ACTIVITY.get(req.activityId)!;
    if (meta.content) {
      const c = pickScenario(p, meta.content, now, true)!;
      push(meta.id, scenarioSigns(c.id), ["elegido por ti", c.why], c.id);
      log.push(`${meta.title}: «${c.title}».`);
      return { mode: "game", target: meta.id, steps, log, seconds };
    }
    const pool = knownPool(p, meta.requires.itemKinds, now);
    const n = meta.requires.maxItems || 0;
    const items = n ? pool.slice(0, n) : [];
    push(meta.id, items, ["juego elegido por ti", items.length ? "con signos que ya conoces, empezando por los más débiles" : ""].filter(Boolean));
    log.push(`Juego: ${meta.title}.`);
    return { mode: "game", target: meta.id, steps, log, seconds };
  }

  const unit = req.mode === "topic" && req.unitId ? UNITS.find((u) => u.id === req.unitId)! : frontierUnit(p, now);
  const inScope = (id: string) => req.mode !== "topic" || unit.items.includes(id);
  log.push(req.mode === "topic" ? `Tema elegido: ${unit.title}.` : `Tema en curso: ${unit.title}.`);

  // 1. due reviews (receptive), most forgotten first
  const all = Object.keys(p.items).filter((id) => (SIGNS.has(id) || PHRASES.has(id)) && inScope(id));
  const dueR = all.filter((id) => isDue(p.items[id].receptive, now))
    .sort((a, b) => retrievability(p.items[a].receptive, now) - retrievability(p.items[b].receptive, now));
  // productive: due letter productions, plus letters known receptively but never produced
  const dueP = !ctx.camera ? [] : [
    ...all.filter((id) => itemKind(id) === "letter" && isDue(p.items[id].productive, now)),
    ...all.filter((id) => itemKind(id) === "letter" && !p.items[id].productive && mastery(p.items[id].receptive, now) > 0.15),
  ].filter((id, i, arr) => arr.indexOf(id) === i && CAMERA_LETTERS.includes(getSign(id)!.en));
  const weak = all.filter((id) => !dueR.includes(id) && isWeak(p.items[id], now));
  log.push(`Repasos vencidos: ${dueR.length} receptivos${ctx.camera ? `, ${dueP.length} productivos` : ""}. Puntos débiles: ${weak.length}.`);

  // 2. new items, introduced gradually
  const fresh = unit.items.filter((id) => !isSeen(p, id) && itemKind(id) !== "phrase");
  let newCount = Math.round(2 + 2 * p.difficulty);
  if (dueR.length > 10) newCount = Math.min(newCount, 1);
  if (ctx.minutes <= 5) newCount = Math.min(newCount, 2);
  if (p.answers === 0) newCount = Math.max(newCount, 3);
  const newItems = fresh.slice(0, Math.max(0, newCount));
  log.push(`Nuevos: ${newItems.length} de ${unit.title}${dueR.length > 10 ? " (pocos: hay muchos repasos pendientes)" : ""}.`);

  // phrases in level-3 units: receptive phrase practice
  const phrasePool = unit.id === "phrases" || unit.id === "core"
    ? [...PHRASES.keys()].filter((id) => inScope(id) || unit.id === "core").sort((a, b) => retrievability(p.items[a]?.receptive, now) - retrievability(p.items[b]?.receptive, now))
    : [];

  // ---- compose -------------------------------------------------------------------------------
  const queue: PlanStep[] = []; // practice of new items, released one step later (interleaving)
  const flush = () => { const s = queue.shift(); if (s) { steps.push(s); seconds += estimateSeconds(ACTIVITY.get(s.activity)!, s.items.length); } };
  const practiced = new Set<string>();

  if (dueR[0]) {
    push(recognizeFor(dueR[0]), [dueR[0]], [...reviewWhy(p, dueR[0], now, "repaso vencido"), "calentamiento"]);
    practiced.add(dueR[0]);
  }
  for (const id of newItems) {
    push("intro", [id], [`signo nuevo de «${unit.title}»`, "introducción gradual"]);
    flush();
    queue.push({ activity: recognizeFor(id), items: [id], modality: "receptive", why: ["practicar el signo recién presentado (recuperación activa)"] });
    practiced.add(id);
  }

  for (const id of dueP.slice(0, 3)) {
    if (seconds > budget * 0.6) break;
    flush();
    const first = !p.items[id].productive;
    push("imitate", [id], [first ? "ya la reconoces: toca producirla (habilidad productiva)" : "repaso productivo vencido", "cámara disponible"]);
  }
  // understanding in context and guided conversation once most of their signs are known
  if (req.mode === "auto" && unit.level >= 2) {
    const comp = pickScenario(p, "passage", now);
    if (comp && seconds < budget * 0.6) push("comprehension", scenarioSigns(comp.id), ["comprensión en contexto", comp.why], comp.id);
    const dlg = pickScenario(p, "dialogue", now);
    if (dlg && seconds < budget * 0.6) push("conversation", scenarioSigns(dlg.id), ["producción: responder en signos (orden ASL)", dlg.why], dlg.id);
  }

  const reviewLeft = dueR.filter((id) => !practiced.has(id));
  // same-kind reviews grouped into a game: 6+ → rain, 4+ → match / memory (what the learner finishes)
  const groupKind = (k: ItemKind) => reviewLeft.filter((id) => itemKind(id) === k && !practiced.has(id));
  for (const k of ["word", "letter", "number"] as ItemKind[]) {
    const g = groupKind(k);
    if (g.length < 4) continue;
    const game = pickGame(p, g.length >= 6 ? ["rain", "match", "memory"] : ["match", "memory"], steps, can);
    if (!game) continue;
    const items = g.slice(0, ACTIVITY.get(game.id)!.requires.maxItems);
    flush();
    push(game.id, items, ["repasos vencidos agrupados en un juego", game.why]);
    items.forEach((i) => practiced.add(i));
  }
  for (const id of reviewLeft.filter((i) => !practiced.has(i))) {
    if (seconds > budget * 0.75) break;
    flush();
    push(recognizeFor(id), [id], reviewWhy(p, id, now, "repaso vencido"));
    practiced.add(id);
  }
  for (const id of weak.slice(0, 3)) {
    if (seconds > budget * 0.85) break;
    flush();
    push(recognizeFor(id), [id], reviewWhy(p, id, now, "punto débil"));
    practiced.add(id);
  }
  for (const id of phrasePool.slice(0, 4)) {
    if (seconds > budget * 0.8) break;
    flush();
    push("phrase", [id], [p.items[id]?.receptive ? "repaso de frase" : "frase nueva: gramática ASL en contexto"]);
    practiced.add(id);
  }
  while (queue.length) flush();

  // time left and accuracy allows it → introduce a few more new signs (still gradual)
  const extraNew = fresh.slice(newItems.length, newItems.length + 3);
  for (const id of extraNew) {
    if (seconds > budget * 0.6 || p.difficulty < -0.25 || req.mode === "game") break;
    push("intro", [id], [`signo nuevo de «${unit.title}»`, "hay tiempo y vas bien"]);
    queue.push({ activity: recognizeFor(id), items: [id], modality: "receptive", why: ["practicar el signo recién presentado (recuperación activa)"] });
    flush();
    newItems.push(id);
    practiced.add(id);
  }
  while (queue.length) flush();
  // second, spaced round on today's new signs: a matching game if there are 4+, else single recalls
  const today = newItems.filter((id) => itemKind(id) !== "phrase");
  const round2 = today.length >= 4 ? pickGame(p, ["match", "memory"], steps, can) : null;
  if (seconds < budget * 0.85 && round2) {
    push(round2.id, shuffleIds(today).slice(0, 4), ["segunda ronda espaciada de los signos nuevos", round2.why]);
  } else {
    for (const id of today) {
      if (seconds > budget * 0.85) break;
      push(recognizeFor(id), [id], ["segunda ronda espaciada del signo nuevo"]);
    }
  }

  // fill the remaining time: weakest memories that are not due yet
  const filler = all.filter((id) => !practiced.has(id) && itemKind(id) !== "phrase")
    .sort((a, b) => retrievability(p.items[a].receptive, now) - retrievability(p.items[b].receptive, now));
  for (const id of filler) {
    if (seconds > budget * 0.8) break;
    push(recognizeFor(id), [id], [`refuerzo: memoria más débil (${pct(retrievability(p.items[id].receptive, now))})`]);
    practiced.add(id);
  }

  // a game for variety when there is time and material (chosen from the learner's behaviour)
  const letters = all.filter((id) => itemKind(id) === "letter");
  const knownLetters = letters.filter((id) => mastery(p.items[id].receptive, now) > 0.2).length;
  const known = all.filter((id) => itemKind(id) !== "phrase");
  if (seconds < budget * 0.95) {
    const options = [
      ...(letters.length >= 4 ? ["spell"] : []),
      ...(known.length >= 6 ? ["rain"] : []),
      ...(knownLetters >= 8 && req.mode === "auto" ? ["sprint"] : []),
    ];
    const game = pickGame(p, options, steps, can);
    if (game?.id === "spell") push("spell", spellPool(p, now), ["juego de deletreo con letras que ya conoces", game.why]);
    else if (game?.id === "rain") push("rain", knownPool(p, ["letter", "number", "word"], now).slice(0, 8), ["juego con signos que ya conoces", game.why]);
    else if (game?.id === "sprint") push("sprint", [], ["cámara disponible y ya conoces suficientes letras", game.why]);
  }

  // final mini-exam on what was practised this session
  const examItems = [...practiced].filter((id) => itemKind(id) !== "phrase").slice(-3);
  if (examItems.length >= 2) push("quiz", examItems, ["comprobación final de lo practicado hoy"]);

  if (!steps.length && fresh.length === 0) log.push("No hay nada pendiente en este tema: ¡dominado!");
  avoidRepeats(steps);
  log.push(`Plan: ${steps.length} actividades, ~${Math.round(seconds / 60)} min de ${ctx.minutes}.`);
  return { mode: req.mode, target: req.mode === "topic" ? unit.id : undefined, steps, log, seconds };
}

/** Why an item is reviewed: recent errors / confusions first, recall estimate when informative. */
function reviewWhy(p: Profile, id: string, now: number, prefix: string): string[] {
  const it = p.items[id];
  const errs = it.errorTs.filter((t) => now - t < 7 * 86_400_000).length;
  const c = topConfusion(it);
  const r = retrievability(it.receptive, now);
  return [
    prefix,
    ...(errs ? [`fallado ${errs} ${errs === 1 ? "vez" : "veces"} hace poco`] : []),
    ...(c ? [`confundes ${label(id)} con ${label(c)}`] : []),
    ...(!errs && r > 0 && r < 0.97 ? [`recuerdo estimado ${pct(r)}`] : []),
  ];
}

/**
 * Game choice from behaviour: favours games the learner usually finishes, tries formats never
 * played, and avoids repeating one already in this session.
 */
function pickGame(p: Profile, ids: string[], steps: PlanStep[], can: (id: string) => boolean) {
  const scored = ids.filter(can).map((id) => {
    const s = p.activities[id];
    const started = s?.started ?? 0;
    const completion = ((s?.completed ?? 0) + 1) / (started + 2);
    const inPlan = steps.some((st) => st.activity === id);
    const score = (0.5 + completion) / (1 + 0.15 * started) - (inPlan ? 1 : 0) + Math.random() * 0.15;
    const why = started === 0 ? "formato nuevo para ti" : completion > 0.7 && started >= 2 ? "un juego que sueles terminar" : "variedad de formato";
    return { id, score, why };
  });
  return scored.sort((a, b) => b.score - a.score)[0] ?? null;
}

/** Best passage / dialogue: most of its signs already known, not done recently. */
function pickScenario(p: Profile, kind: "passage" | "dialogue" | "story", now: number, force = false) {
  const list = kind === "passage"
    ? [...PASSAGES.values()].map((x) => ({ id: x.id, title: x.title, level: x.level }))
    : [...DIALOGUES.values()].filter((d) => d.story === (kind === "story")).map((x) => ({ id: x.id, title: x.title, level: x.level }));
  const scored = list.map((c) => {
    const signs = scenarioSigns(c.id);
    const knownShare = signs.filter((id) => p.items[id]?.receptive).length / Math.max(1, signs.length);
    const recent = !!p.contentDone[c.id] && now - p.contentDone[c.id] < 86_400_000;
    return { ...c, knownShare, score: knownShare - (recent ? 1 : 0) - c.level * 0.01, why: `conoces el ${pct(knownShare)} de sus signos` };
  }).sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;
  if (force) return best;
  return best.knownShare >= 0.7 && best.score > 0 ? best : null;
}

function recognizeFor(id: string) {
  return itemKind(id) === "phrase" ? "phrase" : "recognize";
}

function shuffleIds<T>(a: T[]) {
  return [...a].sort(() => Math.random() - 0.5);
}

/** Items the learner knows, weakest first (for games). */
function knownPool(p: Profile, kinds: ItemKind[], now: number) {
  const ids = Object.keys(p.items).filter((id) => SIGNS.has(id) && kinds.includes(itemKind(id)) && p.items[id].receptive);
  const pool = ids.sort((a, b) => retrievability(p.items[a].receptive, now) - retrievability(p.items[b].receptive, now));
  if (pool.length >= 4) return pool;
  // not enough known items yet: complete with the frontier unit
  const extra = frontierUnit(p, now).items.filter((id) => !pool.includes(id) && kinds.includes(itemKind(id)));
  return [...pool, ...extra];
}

/** Letters to spell with (known letters, weakest first). */
function spellPool(p: Profile, now: number) {
  return Object.keys(p.items).filter((id) => itemKind(id) === "letter" && p.items[id].receptive)
    .sort((a, b) => retrievability(p.items[a].receptive, now) - retrievability(p.items[b].receptive, now)).slice(0, 8);
}

/** Interleaving: never three equal activities in a row (swap with a later different one). */
function avoidRepeats(steps: PlanStep[]) {
  for (let i = 2; i < steps.length; i++) {
    if (steps[i].activity === steps[i - 1].activity && steps[i].activity === steps[i - 2].activity && steps[i].activity !== "intro") {
      const j = steps.findIndex((s, k) => k > i && s.activity !== steps[i].activity && s.activity !== "quiz" && s.activity !== "intro");
      if (j > 0) [steps[i], steps[j]] = [steps[j], steps[i]];
    }
  }
}

export function contextNow(cameraPref: boolean, minutes: number, cameraAvailable: boolean): SessionContext {
  const mobile = typeof window !== "undefined" && window.matchMedia?.("(max-width: 700px), (pointer: coarse)").matches;
  return { camera: cameraPref && cameraAvailable, device: mobile ? "mobile" : "desktop", minutes, hour: new Date().getHours() };
}
