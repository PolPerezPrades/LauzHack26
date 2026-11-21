# Fase 2: visualización, motor adaptativo y actividades

Resumen de lo que se decidió en la fase 2, por qué, y qué queda preparado para la fase 3 (LLMs).
Código en `web/`, con un commit por bloque (`f0b2136`, `c62651c` y `6944185`).

## 1. Visualización de los signos

**Decisión.** Hay un único componente, `SignViewer`, y el contenido no sabe cómo se dibuja.

- **Letras (A–Z):** mano 3D *toon* generada por código con react-three-fiber. Cada falange es una cápsula, con contorno negro de grosor fijo en píxeles y uñas que indican de un vistazo si se ve la palma o el dorso. Se puede rotar, y la J y la Z se animan con su trayectoria dibujada en el aire.
- **Palabras:** avatar *toon* de medio cuerpo que reproduce el **movimiento real** de un signante. Ese movimiento se extrae offline con MediaPipe Holistic de los clips de WLASL (brazos, las dos manos con 21 puntos cada una, y cejas y boca a partir de los blendshapes faciales). Las manos se dibujan un 75 % más grandes para que se lean bien.
- **Respaldo:** si las manos no se detectaron bien (cobertura por debajo del 80 %), se muestra el **vídeo original**, recortado automáticamente al espacio de signado. Es el caso de 36 de los 77 signos de vocabulario.

**Por qué.**
- **Estilo:** pedisteis una mano figurada, no realista. No encontramos una mano riggeada con licencia CC0 clara, y la mano generada por código no depende de ningún asset.
- **Signos inventados:** no queríamos inventar signos. El movimiento del avatar sale de un signante real, y la pose de cada letra se **ajustó por optimización** a la mano real de un signante (`scripts/fit-letters.ts`):
  - 16 letras quedan a 4–11° de flexión media de la mano real;
  - las 24 estáticas pasan las reglas ASL del detector (`scripts/verify-letters.ts`).
- **Ver el original:** siempre se puede pulsar "ver vídeo real" para comparar.

**Qué hacen otras plataformas.**
- Lingvano, The ASL App, PopSign y Signing Savvy enseñan con vídeo de personas sordas o de signantes.
- Hand Talk usa un avatar 3D que se puede rotar y ralentizar, con la cara grande porque la expresión es gramatical.
- Nuestra combinación: vídeo real como fuente de verdad y avatar o mano 3D como capa didáctica.

**Formato de un signo.** Un JSON por signo en `web/content/signs/<id>.json`, con esquema `sign/1`:
```jsonc
{ "id": "L-J", "type": "letter", "gloss": "J", "translations": { "es": "J", "en": "J" }, "unit": "abc2",
  "phonology": { "hands": 1, "handshape": "J", "orientation": { "palm": "out", "fingers": "up" },
                 "location": "neutral", "movement": { "type": "trace", "shape": "trace-J", "articulator": "pinky" },
                 "nonManual": null },
  "render": { "type": "hand" },            // "hand" | "avatar" (+ motion) | "video"
  "video": { "src": "...", "crop": [x0, y0, x1, y1], "source": { "dataset": "WLASL v0.3", "site": "...", "url": "..." } },
  "references": [ ... ], "review": { "status": "auto-checked", "note": "..." } }
```
Los parámetros siguen la fonología de ASL-LEX y HamNoSys (configuración, orientación, ubicación, movimiento y rasgos no manuales). Para cambiar de técnica de render solo hay que tocar `src/viewer/`.

**Verificación.**
- Hay un laboratorio en `/#lab` que muestra lado a lado la mano 3D, la mano real (los puntos de MediaPipe dibujados con la misma malla) y el vídeo.
- **Pendiente:** que una persona que signe ASL con fluidez revise el contenido antes de marcarlo como `verified`. Las letras de puño (A, E, M, N, S, T) y las que se ven de lado (C, G, O, P, Q, X) son las que más lo necesitan. Las de lado no tienen referencia fiable de MediaPipe, así que se compusieron a mano y solo pasaron las reglas.

## 2. Motor de aprendizaje adaptativo

**Métodos.**

| Método | Cómo se aplica | Por qué |
|---|---|---|
| Repetición espaciada FSRS (`ts-fsrs` 5.4) | Una memoria por signo **y por modalidad** | FSRS supera a SM-2 en exactitud y es el estándar actual (Anki). Comprender y producir se evalúan por separado en la literatura de ASL. |
| Recuperación activa | Cada práctica es una pregunta o una producción, con feedback inmediato | Meta-análisis en aula: g ≈ 0,50 (Yang et al., 2021) |
| Zona de desarrollo próximo | Controlador de dificultad con objetivo del 80–85 % de aciertos. Regula cuántos signos nuevos entran, los tiempos y los distractores | Es el mismo principio que Birdbrain de Duolingo: dificultad del ejercicio frente a nivel del alumno |
| Intercalado | De **formatos**, nunca tres actividades iguales seguidas. No mezclamos a propósito signos parecidos. | El meta-análisis de Brunmair y Richter (2019) halla un efecto negativo del intercalado con palabras |
| Discriminación | Con dificultad media o alta, los distractores salen de las **confusiones reales** del alumno | Es donde más se aprende ("confundes M con N") |

**Datos.**
- **Log de eventos inmutable** en IndexedDB con Dexie (`src/data/`), con esquema versionado (`v`), "upcasters" para migrar eventos antiguos y exportación e importación en JSON.
- **Tipos de evento:** `profile.set`, `settings.set`, `placement.done`, `session.start` (contexto y plan con explicaciones), `activity.start` y `activity.end` (completada o abandonada), `answer` (ítem, modalidad, acierto, ms, `confusedWith`), `session.end`, `game.score` y `legacy.import` (el progreso de la v1 se migra una sola vez).
- **El perfil es una función pura del log** (`src/learning/profile.ts`). Calcula:
  - por ítem: tarjetas FSRS receptiva y productiva, errores recientes, confusiones y tiempo de respuesta;
  - por actividad: empezadas, completadas y abandonadas;
  - sesiones, racha y XP, precisión reciente y dificultad;
  - relatos y diálogos completados.
  El dominio por tema se deriva con recuerdo × estabilidad.
- **Reconstrucción:** el perfil siempre se reconstruye desde el log. El test confirma que es idéntico tras recargar y tras exportar e importar.

**Orquestador** (`src/learning/orchestrator.ts`, sin LLM). Tiene tres modos: *auto* (lo que toca hoy), *tema* y *juego*. Construye la sesión en este orden:
1. calentamiento con un repaso vencido;
2. signos nuevos con presentación y práctica intercalada (entre 0 y 4 según el retraso acumulado de repasos y la precisión reciente);
3. producción (Imitar) si hay cámara;
4. comprensión y conversación cuando ya conoces el 70 % de sus signos;
5. repasos vencidos agrupados en juegos (elegidos por el comportamiento: los que sueles terminar o formatos nuevos), puntos débiles, una segunda ronda espaciada de lo nuevo y un mini-examen final.

Sin cámara solo entran actividades receptivas.

Cada paso lleva su explicación ("repaso vencido + fallado 4 veces hace poco + confundes hola con adiós"). Se ve en Inicio ("¿Por qué este plan?"), en el botón ℹ de cada actividad y en `console.debug`.

**Navegación libre:** catálogo de temas y capítulos con su dominio receptivo y productivo, y catálogo de juegos. Todo alimenta el mismo log.

**Criterios de aceptación** (test de navegador sobre los módulos reales; todos pasan):
1. **Al abrir:** se genera una sesión coherente sin hacer nada.
2. **Sin cámara:** solo hay actividades receptivas y los juegos con cámara quedan desactivados.
3. **Fallos repetidos:** un signo fallado 4 veces vence antes (en 0 días frente a 3) y abre la sesión con su motivo.
4. **Reconstrucción:** el perfil es idéntico tras recargar y tras exportar e importar.

## 3. Actividades

Todas usan el formato común `ActivityMeta` (`src/learning/activityCatalog.ts`), que declara requisitos (cámara, tipos y número de ítems), habilidad (receptiva o productiva), duración y si sale en el catálogo de juegos. El componente se enlaza en `src/activities/registry.tsx`. Para añadir una actividad basta con una entrada en cada fichero, y el orquestador ya puede elegirla.

| Actividad | Habilidad | Mecánica y por qué aporta |
|---|---|---|
| 🌧 Lluvia de signos | receptiva | Los signos caen cada vez más rápido y hay 3 vidas: recuperación bajo presión de tiempo |
| 📷 Imitar el signo | productiva | La mano de referencia marca en rojo los dedos a corregir, con chips de estado por dedo y orientación. Detecta la letra que estás haciendo de verdad ("eso parece una N") y lo registra como confusión. |
| 📖 Comprensión | receptiva | Un relato en signos (orden ASL) seguido de preguntas: comprensión en contexto y no solo de vocabulario aislado |
| 🗨 Conversación guiada | productiva | Árbol de diálogo guionizado: la respuesta se construye signo a signo **en orden ASL**, se puede ver signada para imitarla y se valida. Distingue "signos correctos pero en orden de español". |
| ☕ Historia: la cafetería | productiva | Modo historia con ambientación: pedir en una cafetería atendida por personas sordas |
| 🃏 Memory | receptiva | Discriminación visual y recuerdo espaciado |

Inspiración y matices de la investigación:
- **PopSign** (Georgia Tech y RIT) empareja vídeos de signos con palabras dentro de un juego.
- **Lingvano** practica con diálogos reales entre personas sordas y ofrece un "espejo" de cámara.
- **Los estudios sobre gamificación** muestran que rachas y clasificaciones mejoran el hábito más que el aprendizaje, y que pueden distraer de él. Por eso aquí los puntos premian la práctica de calidad (combos de aciertos, objetivo diario) y no hay clasificaciones.

**Límite honesto:** la producción se verifica físicamente solo en la dactilología, con la cámara. En la conversación, lo que se comprueba es la elección y el orden de los signos, no su ejecución.

## Fuentes consultadas

- Lingvano: [Apple Developer](https://developer.apple.com/articles/lingvano) · [App Store](https://apps.apple.com/app/id1547252782)
- Hand Talk: [Cómo se crearon Hugo y Maya](https://www.handtalk.me/en/blog/how-were-hugo-and-maya-created/)
- PopSign: [RIT/NTID](https://www.rit.edu/ntid/news/parents-deaf-children-can-more-easily-learn-sign-language-thanks-powerful-tech-collaboration) · [Georgia Tech dataset](https://signdata.cc.gatech.edu/view/datasets/popsign_v1_0/)
- Avatares a partir de MediaPipe: [sign.mt (LREC)](https://www.sign-lang.uni-hamburg.de/lrec/pub/26067.html)
- Notación: [SiGML/HamNoSys](https://arxiv.org/pdf/1502.02961) · [ASL-LEX 2.0](https://pmc.ncbi.nlm.nih.gov/articles/PMC7977685) · [WLASL-LEX](https://arxiv.org/pdf/2203.06096)
- Dactilología J y Z: [Lifeprint](https://www.lifeprint.com/asl101/pages-signs/z/z.htm) · [Alfabeto Lifeprint](https://www.lifeprint.com/asl101/fingerspelling/abc.htm)
- Repetición espaciada: [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)
- Duolingo: [Birdbrain](https://blog.duolingo.com/learning-how-to-help-you-learn-introducing-birdbrain) · [IEEE Spectrum](https://spectrum.ieee.org/duolingo)
- Intercalado: [Brunmair y Richter, 2019](https://pubmed.ncbi.nlm.nih.gov/31556629/)
- Recuperación activa: [Yang et al., 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC10950551)
- Habilidad receptiva frente a expresiva en ASL: [PMC4886323](https://pmc.ncbi.nlm.nih.gov/articles/PMC4886323)
- Gamificación: [Misuse in Duolingo (arXiv 2203.16175)](https://arxiv.org/pdf/2203.16175) · [Juegos serios en BSL (Economou et al., 2020)](https://clok.uclan.ac.uk/35229) · [VR 2D y 3D para ASL](https://arxiv.org/html/2405.08908v1)
- Almacenamiento: [Dexie: versionado](https://dexie.org/docs/Dexie/Dexie.version())
- Datos: [WLASL](https://dxli94.github.io/WLASL/) (*Computational Use of Data Agreement*, uso académico)

## Próximos pasos: fase 3 (LLMs)

Los puntos de extensión ya existen en `src/learning/extensions.ts`. En esta fase todos son locales y basados en reglas.

1. **`CoachProvider`:** feedback de fin de sesión. El servidor ya tiene `/api/coach` con Claude y salida estructurada (`server/api.ts`). Hay que conectarlo como implementación remota, con la local como respaldo.
2. **`DialogueProvider`:** sustituir `scriptedDialogue` por un interlocutor generado. Debe limitarse a signos con vídeo real y validar que cada glosa existe, igual que `/api/phrases`. El árbol guionizado puede servir de evaluación.
3. **`PlanAdvisor`:** que el LLM reordene o anote el plan del orquestador sin poder añadir signos inexistentes. El plan determinista seguiría como respaldo.
4. **Contexto:** `buildLearnerContext(profile, events)` ya resume el perfil y los últimos 200 eventos. Falta decidir la retención, el consentimiento y que nunca se envíe vídeo.
5. **Contenido:** importar la fonología de ASL-LEX 2.0 para rellenar `phonology` en las palabras, y ampliar el vocabulario con más clips. El extractor (`scripts/extract_motion.py`) decide automáticamente entre avatar y vídeo.
6. **Pendiente de esta fase:**
   - revisión del contenido por un signante fluido;
   - reconocimiento por cámara de signos con movimiento (fuera de alcance);
   - las 15 ilustraciones del alfabeto de Wikimedia que no se pudieron descargar por límite de peticiones (son opcionales: solo sirven de referencia en el laboratorio).
