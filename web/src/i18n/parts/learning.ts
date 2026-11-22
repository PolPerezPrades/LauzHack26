/**
 * Strings of the learning formats (lessons, questions, quizzes) and the shared task UI, in
 * every UI language. Part B owns this file. Add each string to `en` and `es` (the build fails if
 * one is missing), and each new format's title and rules to `formats`. Components read them as
 * `t.learning.…`, and format titles through `t.formats`.
 *
 * The camera feedback sentences (`hints`) moved here from lib/handshapes.ts (R-020): the Spanish
 * is the original wording, the English a faithful translation.
 */
import { itemLabel } from "../../content/curriculum";
import type { Finger, FingerAction, HintKey, Part } from "../../lib/handshapes";
import { definePart } from "./types";

/** "a", "a and b", "a, b and c" */
const list = (xs: readonly string[], and: string) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${and} ${xs[xs.length - 1]}`);

/** English letter names that start with a vowel sound take "an": an A, an F, an M… */
const anLetter = (letter: string) => ("AEFHILMNORSX".includes(letter) ? `an ${letter}` : `a ${letter}`);

const EN_FINGER: Record<Finger, string> = { index: "index", middle: "middle", ring: "ring", pinky: "pinky" };
const ES_FINGER: Record<Finger, string> = { index: "el índice", middle: "el corazón", ring: "el anular", pinky: "el meñique" };
const EN_VERB: Record<FingerAction, string> = { extend: "Straighten", bend: "Bend", close: "Curl" };
const ES_VERB: Record<FingerAction, string> = { extend: "Estira", bend: "Curva", close: "Cierra" };

export const learning = definePart({
  en: {
    /** an item's meaning in this language (for code that only has the strings, like card previews) */
    item: (id: string) => itemLabel(id, "en"),
    letter: (letter: string) => `Letter ${letter}`,
    progress: (step: number, of: number) => `Step ${step} of ${of}`,
    description: "How to make it",

    parts: { thumb: "Thumb", index: "Index", middle: "Middle", ring: "Ring", pinky: "Pinky", orientation: "Orientation" } satisfies Record<Part, string>,
    fingerHint: (action: FingerAction, fingers: readonly Finger[]) =>
      `${EN_VERB[action]} your ${list(fingers.map((f) => EN_FINGER[f]), "and")} finger${fingers.length > 1 ? "s" : ""}`,
    hints: {
      together: "Keep your fingers together",
      apartV: "Spread your index and middle fingers into a V",
      pointUp: "Point your fingers up",
      pointSide: "Turn your hand: the fingers point to the side",
      pointDown: "Point your fingers down",
      thumbOut: "Stick your thumb out",
      thumbAlong: "Stretch your thumb out parallel to your index finger",
      thumbIn: "Tuck your thumb in; don't stick it out",
      thumbBesideIndex: "Put your thumb beside your index finger, not in front of it",
      thumbAcrossPalm: "Fold your thumb across your palm",
      thumbCurvedC: "Curve your thumb opposite your fingers, forming a C",
      openC: "Open the C a little between your thumb and fingers",
      touchMiddleTip: "Touch the tip of your middle finger with your thumb",
      thumbUnderTips: "Fold your thumb under your fingertips",
      tipsToThumb: "Bring your fingertips close to your thumb",
      indexThumbCircle: "Touch the tip of your index finger with your thumb (a circle)",
      thumbBetweenK: "Put your thumb between your index and middle fingers",
      rightAngleL: "Make an L: thumb and index finger at a right angle",
      thumbUnderThree: "Tuck your thumb under three fingers (as far as the pinky)",
      thumbUnderTwo: "Tuck your thumb under two fingers (index and middle)",
      indexTipToThumbO: "Bring your index fingertip to your thumb (make an O)",
      closeO: "Close the O: all your fingertips touch your thumb",
      crossMiddle: "Cross your middle finger over your index finger",
      thumbAcrossFront: "Cross your thumb in front of your fingers",
      thumbOnFingers: "Rest your thumb on your bent fingers",
      thumbBetweenT: "Tuck your thumb between your index and middle fingers",
      thumbPeeksT: "Your thumb peeks out under your bent index finger",
      noCross: "Don't cross your fingers",
      hookX: "Bend your index finger like a hook",
      movement: "This letter has movement, so the camera can't check it",
    } satisfies Record<HintKey, string>,

    camera: {
      showHand: "Show your hand to the camera",
      hold: "That's it! Hold it…",
      passed: "Perfect!",
      notYet: "Not yet: keep adjusting your hand",
      looksLike: (letter: string) => `That looks like ${anLetter(letter)}`,
      skip: "Skip",
      skipStuck: "Skip this one",
      signedIt: (letter: string) => `I signed ${letter}`,
      movement: (letter: string) => `${letter} has movement: sign it, then confirm.`,
    },

    mirror: {
      live: "Sign it while you watch yourself, then tap Done.",
      done: "Done",
      recording: "Recording here only",
      you: "You",
      reference: "Reference",
      compare: "Did yours look like the reference?",
      matched: "It matched",
      notQuite: "Not quite",
      again: "Try again",
      privacy: "Your clip stays in this card: it is never saved or sent.",
      noReplay: "Replay isn't available here: compare yourself live.",
    },

    self: {
      lessonTry: "Your turn: sign it now, without looking.",
      didIt: "I did it",
      showAgain: "Show it again",
      questionTry: "Sign it from memory, then check the answer.",
      showAnswer: "Show the answer",
      compare: "Did yours look like this?",
      gotIt: "I got it right",
      notQuite: "Not quite",
    },

    lesson: {
      badgeNew: "New sign",
      badgeRelearn: "Review",
      watch: "Watch it a couple of times.",
      nowYou: "Now you",
      preview: (name: string) => `New sign: ${name}`,
      previewRelearn: (name: string) => `Review: ${name}`,
      comeBack: "It will come back soon for more practice.",
    },

    question: {
      signIt: (name: string) => `Sign: ${name}`,
      sentence: "Sign this sentence in ASL",
      aslOrder: "Use ASL word order.",
      spell: (word: string) => `Fingerspell: ${word}`,
      spellSelf: "Fingerspell it from memory, then check.",
      skipLetter: "Skip letter",
      showMe: "Show me",
      skipped: (letters: string) => `Skipped: ${letters}`,
    },

    build: {
      prompt: "Tap the signs in ASL order",
      empty: "Your sentence",
      check: "Check",
      wrongOrder: "Right signs, wrong order.",
      preview: "Rebuild the sentence",
    },

    quiz: {
      probeBadge: "Quick check",
      summary: (right: number, of: number) => `${right} of ${of} right`,
    },
  },

  es: {
    item: (id: string) => itemLabel(id, "es"),
    letter: (letter: string) => `Letra ${letter}`,
    progress: (step: number, of: number) => `Paso ${step} de ${of}`,
    description: "Cómo se hace",

    parts: { thumb: "Pulgar", index: "Índice", middle: "Corazón", ring: "Anular", pinky: "Meñique", orientation: "Orientación" },
    fingerHint: (action: FingerAction, fingers: readonly Finger[]) => `${ES_VERB[action]} ${list(fingers.map((f) => ES_FINGER[f]), "y")}`,
    hints: {
      together: "Junta los dedos",
      apartV: "Separa el índice y el corazón en V",
      pointUp: "Apunta los dedos hacia arriba",
      pointSide: "Gira la mano: los dedos apuntan hacia un lado",
      pointDown: "Apunta los dedos hacia abajo",
      thumbOut: "Saca el pulgar hacia fuera",
      thumbAlong: "Estira el pulgar paralelo al índice",
      thumbIn: "Recoge el pulgar, no lo saques",
      thumbBesideIndex: "Pon el pulgar al lado del índice, no delante",
      thumbAcrossPalm: "Dobla el pulgar sobre la palma",
      thumbCurvedC: "El pulgar curvado enfrente, formando una C",
      openC: "Abre un poco la C entre el pulgar y los dedos",
      touchMiddleTip: "Toca la punta del corazón con el pulgar",
      thumbUnderTips: "Dobla el pulgar bajo las puntas de los dedos",
      tipsToThumb: "Acerca las puntas de los dedos al pulgar",
      indexThumbCircle: "Toca la punta del índice con el pulgar (círculo)",
      thumbBetweenK: "Pon el pulgar entre el índice y el corazón",
      rightAngleL: "Forma una L: pulgar y índice en ángulo recto",
      thumbUnderThree: "Mete el pulgar bajo tres dedos (hasta el meñique)",
      thumbUnderTwo: "Mete el pulgar bajo dos dedos (índice y corazón)",
      indexTipToThumbO: "Junta la punta del índice con el pulgar (forma una O)",
      closeO: "Cierra la O: todas las puntas tocan el pulgar",
      crossMiddle: "Cruza el corazón por encima del índice",
      thumbAcrossFront: "Cruza el pulgar por delante de los dedos",
      thumbOnFingers: "Apoya el pulgar sobre los dedos doblados",
      thumbBetweenT: "Mete el pulgar entre el índice y el corazón",
      thumbPeeksT: "El pulgar asoma bajo el índice doblado",
      noCross: "No cruces los dedos",
      hookX: "Dobla el índice como un gancho",
      movement: "Esta letra lleva movimiento y no se puede comprobar con la cámara",
    },

    camera: {
      showHand: "Muestra tu mano a la cámara",
      hold: "¡Así! Mantén la posición…",
      passed: "¡Perfecto!",
      notYet: "Aún no: sigue ajustando la mano",
      looksLike: (letter: string) => `Eso parece una ${letter}`,
      skip: "Saltar",
      skipStuck: "Saltar este",
      signedIt: (letter: string) => `Ya he signado la ${letter}`,
      movement: (letter: string) => `La ${letter} lleva movimiento: sígnala y confírmalo.`,
    },

    mirror: {
      live: "Sígnalo mientras te miras y pulsa Hecho.",
      done: "Hecho",
      recording: "Se graba solo aquí",
      you: "Tú",
      reference: "Referencia",
      compare: "¿Se parecía el tuyo a la referencia?",
      matched: "Se parecía",
      notQuite: "No del todo",
      again: "Repetir",
      privacy: "Tu clip se queda en esta tarjeta: nunca se guarda ni se envía.",
      noReplay: "Aquí no se puede repetir el clip: compárate en directo.",
    },

    self: {
      lessonTry: "Tu turno: sígnalo ahora, sin mirar.",
      didIt: "Lo he hecho",
      showAgain: "Enséñamelo otra vez",
      questionTry: "Sígnalo de memoria y luego mira la respuesta.",
      showAnswer: "Ver la respuesta",
      compare: "¿Te salió así?",
      gotIt: "Me salió bien",
      notQuite: "No del todo",
    },

    lesson: {
      badgeNew: "Signo nuevo",
      badgeRelearn: "Repaso",
      watch: "Míralo un par de veces.",
      nowYou: "Ahora tú",
      preview: (name: string) => `Signo nuevo: ${name}`,
      previewRelearn: (name: string) => `Repaso: ${name}`,
      comeBack: "Volverá pronto para que lo practiques más.",
    },

    question: {
      signIt: (name: string) => `Signa: ${name}`,
      sentence: "Signa esta frase en ASL",
      aslOrder: "Usa el orden de palabras de ASL.",
      spell: (word: string) => `Deletrea: ${word}`,
      spellSelf: "Deletréalo de memoria y luego compruébalo.",
      skipLetter: "Saltar letra",
      showMe: "Enséñamelo",
      skipped: (letters: string) => `Saltadas: ${letters}`,
    },

    build: {
      prompt: "Toca los signos en orden ASL",
      empty: "Tu frase",
      check: "Comprobar",
      wrongOrder: "Signos correctos, orden incorrecto.",
      preview: "Reconstruye la frase",
    },

    quiz: {
      probeBadge: "Comprobación rápida",
      summary: (right: number, of: number) => `${right} de ${of} bien`,
    },
  },

  formats: {
    en: {
      lesson: { title: "Quick lesson", rules: "Watch a new sign, then sign it yourself." },
      question: { title: "Your turn", rules: "Sign it without seeing it first." },
      "quiz-build": { title: "Build the sentence", rules: "Watch the sentence and put its signs in order." },
    },
    es: {
      lesson: { title: "Lección rápida", rules: "Mira un signo nuevo y luego hazlo tú." },
      question: { title: "Tu turno", rules: "Sígnalo sin verlo antes." },
      "quiz-build": { title: "Construye la frase", rules: "Mira la frase y ordena sus signos." },
    },
  },
});
