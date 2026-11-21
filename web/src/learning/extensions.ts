/**
 * Extension points for phase 3 (LLMs). In phase 2 every provider is LOCAL and rule-based;
 * a model-backed implementation only has to implement the same interface (the server already has
 * Claude endpoints in server/api.ts, disabled from the client until phase 3).
 *
 * The contract is the event log: `buildLearnerContext` turns it into the compact, privacy-light
 * summary an LLM will receive (no free text from the learner, only learning events).
 */
import { label } from "../content/curriculum";
import type { V1Event as LearningEvent } from "../data/eventsV1";
import type { SessionPlan } from "./orchestrator";
import { mastery, topConfusion, type Profile } from "./profile";

export interface SessionSummary { xp: number; seconds: number; answers: { itemId: string; correct: boolean; activity: string }[] }

export interface CoachFeedback { message: string; tips: string[]; focus: string[]; source: "local" | "llm" }

/** End-of-session feedback. */
export interface CoachProvider { feedback(profile: Profile, session: SessionSummary, events: LearningEvent[]): Promise<CoachFeedback> }
/** Optional re-ranking / annotation of the rule-based plan (never adds unknown signs). */
export interface PlanAdvisor { review(plan: SessionPlan, profile: Profile): Promise<SessionPlan> }
/** Dialogue turns for the guided conversation (scripted trees today, generated tomorrow). */
export interface DialogueProvider { next(dialogueId: string, nodeId: string, history: string[]): Promise<{ nodeId: string } | null> }

export const localCoach: CoachProvider = {
  async feedback(profile, session) {
    const n = session.answers.length;
    const ok = session.answers.filter((a) => a.correct).length;
    const acc = n ? ok / n : 1;
    const pctS = `${Math.round(acc * 100)} %`;
    const missed = [...new Set(session.answers.filter((a) => !a.correct).map((a) => a.itemId))];
    const confusions = missed.map((id) => { const c = profile.items[id] && topConfusion(profile.items[id]); return c ? `${label(id)} ↔ ${label(c)}` : null; }).filter(Boolean) as string[];
    const message = acc >= 0.9 ? `¡Sesión redonda! ${pctS} de aciertos: la próxima vez subimos el ritmo y metemos más signos nuevos.`
      : acc >= 0.75 ? `Buen trabajo: ${pctS} de aciertos, justo en la zona en la que más se aprende.`
      : `Has acertado un ${pctS}. Lo que falló volverá antes en los repasos: así se fija.`;
    const tips = [
      missed.length ? `Repasaremos pronto: ${missed.slice(0, 4).map(label).join(", ")}.` : "Mantén la racha: unos minutos cada día valen más que una hora a la semana.",
      ...(confusions.length ? [`Fíjate en la diferencia entre ${confusions.slice(0, 2).join(" y ")}.`] : []),
      profile.settings.cameraPref ? "Las letras se fijan mejor si además las haces con la mano (cámara)." : "Cuando tengas cámara, practica también producir las letras.",
    ];
    return { message, tips, focus: missed.slice(0, 4), source: "local" };
  },
};

export const identityAdvisor: PlanAdvisor = { review: async (plan) => plan };

/** Compact learner context for an LLM: profile digest + the most recent events. */
export function buildLearnerContext(profile: Profile, events: LearningEvent[], now = Date.now()) {
  const items = Object.values(profile.items).map((it) => ({
    item: label(it.id),
    receptive: Math.round(mastery(it.receptive, now) * 100) / 100,
    productive: it.productive ? Math.round(mastery(it.productive, now) * 100) / 100 : null,
    confusedWith: topConfusion(it) ? label(topConfusion(it)!) : null,
  }));
  return {
    settings: profile.settings,
    accuracyRecent: Math.round(profile.accuracyEma * 100) / 100,
    streak: profile.streak,
    activities: profile.activities,
    items,
    recentEvents: events.slice(-200).map(({ type, ts, ...rest }) => ({ type, ts, ...rest })),
  };
}
