/**
 * Sign registry: one renderer-agnostic JSON per sign in content/signs/<id>.json (schema "sign/1").
 * The viewer decides HOW to draw a sign from `render`; the learning engine only uses ids,
 * translations and units. Swapping the rendering technique never requires touching content.
 */
export interface Phonology {
  hands: 1 | 2;
  handshape: string;                                  // named handshape ("A", "B", "flat-O"…)
  orientation: { palm: string; fingers: string };      // signer's frame: out/in/left/right/up/down, "a+b"
  location: string;                                    // "neutral", "chin", "forehead", "chest"…
  movement: { type: string; shape: string; articulator?: string } | null;
  nonManual: { brows?: string; mouth?: string; head?: string } | null;
}

export interface SignSpec {
  schema: "sign/1";
  id: string;
  type: "letter" | "number" | "word";
  gloss: string;
  translations: { es: string; en: string };
  unit: string;
  phonology: Phonology | null;
  description: { es: string } | null;
  render: { type: "hand" } | { type: "avatar"; motion: string } | { type: "video" };
  video: { src: string; crop?: [number, number, number, number] | null; source: { dataset: string; site: string; url: string } } | null;
  references: { label: string; url: string; image?: string }[];
  review: { status: string; by?: string; note?: string };
}

const files = import.meta.glob("../../content/signs/*.json", { eager: true, import: "default" }) as Record<string, SignSpec>;

export const SIGN_SPECS = new Map<string, SignSpec>(Object.values(files).map((s) => [s.id, s]));

export function getSpec(id: string): SignSpec | undefined {
  return SIGN_SPECS.get(id);
}
