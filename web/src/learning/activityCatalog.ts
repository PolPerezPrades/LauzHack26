/**
 * Common Activity format — metadata only (no React), so the orchestrator can reason about every
 * activity: what it needs (camera, item kinds, how many items), what it trains (receptive /
 * productive) and how long it takes. UI components are bound in src/activities/registry.tsx.
 * Adding an activity = one entry here + one component there.
 */
import type { Modality } from "../data/eventsV1";

export type ItemKind = "letter" | "number" | "word" | "phrase";
export type ActivityKind = "intro" | "practice" | "game" | "exam";

export interface ActivityMeta {
  id: string;
  title: string;
  icon: string;
  description: string;
  kind: ActivityKind;
  requires: { camera: boolean; itemKinds: ItemKind[]; minItems: number; maxItems: number };
  /** modality of the answers it records */
  trains: Modality;
  /** time estimate: base + per item (seconds) */
  seconds: { base: number; perItem: number };
  /** listed in the games catalogue for free play */
  inCatalog?: boolean;
  /** content-driven activities pick a passage / dialogue instead of items */
  content?: "passage" | "dialogue" | "story";
}

export const ACTIVITIES: ActivityMeta[] = [
  {
    id: "intro", title: "Signo nuevo", icon: "✨", description: "Presentación de un signo antes de practicarlo.",
    kind: "intro", requires: { camera: false, itemKinds: ["letter", "number", "word"], minItems: 1, maxItems: 1 },
    trains: "receptive", seconds: { base: 12, perItem: 0 },
  },
  {
    id: "recognize", title: "Reconocer", icon: "👀", description: "Mira el signo y elige su significado.",
    kind: "practice", requires: { camera: false, itemKinds: ["letter", "number", "word"], minItems: 1, maxItems: 1 },
    trains: "receptive", seconds: { base: 15, perItem: 0 },
  },
  {
    id: "phrase", title: "Entender una frase", icon: "💬", description: "Una secuencia de signos: elige la traducción.",
    kind: "practice", requires: { camera: false, itemKinds: ["phrase"], minItems: 1, maxItems: 1 },
    trains: "receptive", seconds: { base: 25, perItem: 0 },
  },
  {
    id: "imitate", title: "Imitar el signo", icon: "📷", description: "Haz la letra ante la cámara: te dice qué dedo corregir.",
    kind: "practice", requires: { camera: true, itemKinds: ["letter"], minItems: 1, maxItems: 1 },
    trains: "productive", seconds: { base: 25, perItem: 0 },
  },
  {
    id: "rain", title: "Lluvia de signos", icon: "🌧", description: "Los signos caen cada vez más rápido: identifícalos antes de que toquen el suelo.",
    kind: "game", requires: { camera: false, itemKinds: ["letter", "number", "word"], minItems: 6, maxItems: 10 },
    trains: "receptive", seconds: { base: 15, perItem: 7 }, inCatalog: true,
  },
  {
    id: "memory", title: "Memory", icon: "🃏", description: "Da la vuelta a las cartas y empareja cada signo con su significado.",
    kind: "game", requires: { camera: false, itemKinds: ["letter", "number", "word"], minItems: 4, maxItems: 4 },
    trains: "receptive", seconds: { base: 20, perItem: 12 }, inCatalog: true,
  },
  {
    id: "comprehension", title: "Comprensión", icon: "📖", description: "Te cuentan algo en signos; responde para demostrar que lo entendiste.",
    kind: "practice", requires: { camera: false, itemKinds: ["word"], minItems: 0, maxItems: 0 },
    trains: "receptive", seconds: { base: 90, perItem: 0 }, inCatalog: true, content: "passage",
  },
  {
    id: "conversation", title: "Conversación guiada", icon: "🗨", description: "Te hacen preguntas en signos y respondes construyendo la frase en orden ASL.",
    kind: "practice", requires: { camera: false, itemKinds: ["word"], minItems: 0, maxItems: 0 },
    trains: "productive", seconds: { base: 120, perItem: 0 }, inCatalog: true, content: "dialogue",
  },
  {
    id: "story", title: "Historia: la cafetería", icon: "☕", description: "Modo historia: pide en una cafetería atendida por personas sordas.",
    kind: "game", requires: { camera: false, itemKinds: ["word"], minItems: 0, maxItems: 0 },
    trains: "productive", seconds: { base: 150, perItem: 0 }, inCatalog: true, content: "story",
  },
  {
    id: "spell", title: "Deletreo rápido", icon: "🔡", description: "La mano deletrea una palabra cada vez más rápido: escríbela.",
    kind: "practice", requires: { camera: false, itemKinds: ["letter"], minItems: 2, maxItems: 8 },
    trains: "receptive", seconds: { base: 30, perItem: 0 }, inCatalog: true,
  },
  {
    id: "match", title: "Emparejar contra reloj", icon: "🧩", description: "Une cada signo con su significado antes de que acabe el tiempo.",
    kind: "game", requires: { camera: false, itemKinds: ["letter", "number", "word"], minItems: 4, maxItems: 4 },
    trains: "receptive", seconds: { base: 10, perItem: 8 }, inCatalog: true,
  },
  {
    id: "sprint", title: "Sprint de deletreo", icon: "⚡", description: "Deletrea con la cámara todas las palabras que puedas en 60 s.",
    kind: "game", requires: { camera: true, itemKinds: ["letter"], minItems: 0, maxItems: 0 },
    trains: "productive", seconds: { base: 75, perItem: 0 }, inCatalog: true,
  },
  {
    id: "quiz", title: "Mini-examen", icon: "🎯", description: "Comprobación final: sin cámara lenta ni repeticiones.",
    kind: "exam", requires: { camera: false, itemKinds: ["letter", "number", "word", "phrase"], minItems: 2, maxItems: 4 },
    trains: "receptive", seconds: { base: 5, perItem: 8 },
  },
];

export const ACTIVITY = new Map(ACTIVITIES.map((a) => [a.id, a]));

export function estimateSeconds(a: ActivityMeta, n: number) {
  return a.seconds.base + a.seconds.perItem * n;
}

export function availableIn(a: ActivityMeta, ctx: { camera: boolean }) {
  return !a.requires.camera || ctx.camera;
}
