# Signa · Aprende ASL

Plataforma web gamificada para aprender **Lengua de Signos Americana (ASL)**: onboarding, prueba de nivel,
sesión diaria adaptativa con racha, XP y progreso, y práctica de dactilología con la webcam (MediaPipe Hands).

## Arrancar

```bash
cd web
npm install
npm run setup:media   # descarga vídeos reales (WLASL), alfabeto (Wikimedia Commons) y el modelo de MediaPipe
npm run dev           # http://localhost:5173  (incluye la API /api/*)
```

IA opcional: copia `.env.example` a `.env` y rellena `ANTHROPIC_API_KEY`. Sin clave la app funciona igual
con feedback local basado en reglas (en Ajustes ⚙️ se ve si Claude está conectado).

Producción: `npm run build && npm start` → http://localhost:8787.

## Qué hay

| Parte | Dónde |
|---|---|
| Onboarding (nivel + objetivo 5/10/15 min + cámara) | `src/screens/Onboarding.tsx` |
| Prueba de nivel (6 ejercicios: letras → números → palabras → frase) | `src/screens/Placement.tsx`, `buildPlacement` en `src/lib/engine.ts` |
| Sesión diaria adaptativa, dominio por signo, XP, combos, racha | `src/lib/engine.ts`, `src/screens/Lesson.tsx` |
| Actividades | `src/activities/`: Reconocimiento (vídeo → palabra / frase), Cámara (signar una letra), Emparejar contra reloj, Deletreo rápido, Sprint de 60 s |
| Temario (unidades, signos, frases con gramática ASL) | `content/signs.json` |
| Detector de configuraciones de mano | `src/lib/handshapes.ts` |
| IA generativa (Claude): feedback personalizado, ajuste de dificultad, frases de práctica | `server/api.ts` |

## Contenido y fuentes

- **Vídeos de signos**: [WLASL v0.3](https://dxli94.github.io/WLASL/), clips de diccionarios ASL (startasl, aslbricks,
  signschool…). Cada clip guarda su URL de origen en `src/content/media.json`. WLASL se distribuye bajo
  *Computational Use of Data Agreement* (uso académico / no comercial).
- **Alfabeto A–Z**: ilustraciones de dominio público de Wikimedia Commons ("Sign language X.svg").
  Wikimedia limita mucho las descargas: si faltan letras, vuelve a ejecutar `npm run setup:media` pasados unos minutos.
- **Frases**: secuencias de signos de diccionario reales. La IA solo elige *qué* signos combinar (siguiendo la
  gramática ASL); el servidor descarta cualquier glosa que no tenga un vídeo real. Nunca se generan vídeos.
- J y Z llevan movimiento y no se comprueban con la cámara (sí aparecen en reconocimiento y deletreo).

## Afinar la detección de letras

En la actividad de cámara pulsa **🔧 Ver datos del detector** para ver en vivo el estado de cada dedo, la posición
del pulgar, la separación entre dedos y la orientación. Los umbrales de cada letra están en `RULES`
(`src/lib/handshapes.ts`). Las letras del grupo del puño (A, E, M, N, S, T) son las más difíciles de distinguir.
