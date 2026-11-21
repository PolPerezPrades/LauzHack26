/**
 * Comprehension passages and guided dialogues (content/comprehension.json, content/dialogues.json).
 * Every sentence is a sequence of existing sign ids in ASL order; anything referencing a missing
 * sign is dropped at load time. The scripted dialogue engine implements the same interface an
 * LLM-backed partner will implement in phase 3 (src/learning/extensions.ts → DialogueProvider).
 */
import comprehension from "../../content/comprehension.json";
import dialogues from "../../content/dialogues.json";
import { SIGNS } from "./curriculum";

export interface Question { q: string; options: string[]; answer: number; items: string[] }
export interface Passage { id: string; level: number; title: string; sentences: string[][]; questions: Question[] }

export interface Expectation { signs: string[]; next: string; fingerspellName?: boolean }
export interface DialogueNode { narration?: string; partner: string[]; es: string; hint?: string; expect?: Expectation[]; end?: boolean }
export interface Dialogue {
  id: string; title: string; level: number; story: boolean; setting: string;
  partner: { name: string; emoji: string };
  start: string;
  nodes: Record<string, DialogueNode>;
}

const known = (ids: string[]) => ids.every((id) => SIGNS.has(id));

export const PASSAGES = new Map<string, Passage>(
  (comprehension.passages as unknown as Passage[])
    .filter((p) => p.sentences.every(known) && p.questions.every((q) => known(q.items)))
    .map((p) => [p.id, p]),
);

export const DIALOGUES = new Map<string, Dialogue>(
  (dialogues.dialogues as unknown as Dialogue[])
    .filter((d) => Object.values(d.nodes).every((n) => known(n.partner) && (n.expect ?? []).every((e) => known(e.signs))))
    .map((d) => [d.id, d]),
);

/** All sign ids a passage / dialogue uses (to judge if the learner is ready for it). */
export function scenarioSigns(id: string): string[] {
  const p = PASSAGES.get(id);
  if (p) return [...new Set(p.sentences.flat())];
  const d = DIALOGUES.get(id);
  if (d) return [...new Set(Object.values(d.nodes).flatMap((n) => [...n.partner, ...(n.expect ?? []).flatMap((e) => e.signs)]))];
  return [];
}

export interface TurnResult { accepted: boolean; expectation?: Expectation; next?: string; feedback?: string }

/** Scripted dialogue partner: exact sign sequences (ASL order matters). */
export const scriptedDialogue = {
  evaluate(dialogueId: string, nodeId: string, reply: string[]): TurnResult {
    const node = DIALOGUES.get(dialogueId)?.nodes[nodeId];
    if (!node?.expect) return { accepted: false };
    const match = node.expect.find((e) => e.signs.length === reply.length && e.signs.every((s, i) => s === reply[i]));
    if (match) return { accepted: true, expectation: match, next: match.next };
    const sameSigns = node.expect.find((e) => e.signs.length === reply.length && [...e.signs].sort().join() === [...reply].sort().join());
    return { accepted: false, feedback: sameSigns ? "Tienes los signos correctos, pero el orden no es el de ASL." : node.hint };
  },
};
