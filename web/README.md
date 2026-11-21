# Signa · Aprende ASL

Plataforma web gamificada para aprender **Lengua de Signos Americana (ASL)**: onboarding, prueba de nivel,
sesiones adaptativas con racha, XP y progreso, y práctica de dactilología con la webcam (MediaPipe Hands).
Decisiones de diseño de la fase 2: [`../docs/fase2.md`](../docs/fase2.md).

## Arrancar

```bash
cd web
npm install
npm run setup:media   # vídeos originales (WLASL) y modelo de MediaPipe Hands
npm run dev           # http://localhost:5173  (incluye la API /api/*)
```

`http://localhost:5173/#lab` abre el **laboratorio de signos**: cada letra en 3D junto a la mano real del signante
y su vídeo, y cada palabra en avatar junto a su vídeo. Sirve para revisar el contenido con un signante.

Producción: `npm run build && npm start` → http://localhost:8787.

## Cómo se muestran los signos

Un único componente, `SignViewer` (`src/viewer/`), elige el renderizado según el JSON del signo:

| `render` | Qué se ve | De dónde sale |
|---|---|---|
| `hand` | Mano 3D toon (letras), rotable; J y Z animadas con su trayectoria | Configuración + orientación del JSON → `handshapeLibrary.ts` (ángulos ajustados a la mano real del signante) |
| `avatar` | Avatar toon de medio cuerpo (brazos, manos, cejas) | Movimiento extraído con MediaPipe Holistic del **vídeo real** de WLASL (`public/motion/*.json`) |
| `video` | El clip original encuadrado en el espacio de signado | WLASL (cuando el seguimiento de manos no es fiable) |

Siempre hay botón de repetir, cámara lenta y, si el signo viene de un vídeo, **ver el vídeo real**.

## Contenido

- `content/signs/<id>.json`: un JSON por signo, independiente del renderizador (fonología: configuración, orientación,
  ubicación, movimiento, rasgos no manuales; vídeo de origen; referencias; estado de revisión).
- `content/curriculum.json`: unidades y frases (secuencias de ids de signos, con su nota gramatical).
- `content/reference/letter-poses.json`: pose real de la mano para 21 letras (MediaPipe sobre clips de WLASL).

Fuentes: [WLASL v0.3](https://dxli94.github.io/WLASL/) (clips de diccionarios ASL; *Computational Use of Data Agreement*,
uso académico/no comercial), descripciones de [Lifeprint](https://www.lifeprint.com/asl101/fingerspelling/abc.htm) e
ilustraciones de dominio público de Wikimedia Commons como referencia. Nada se genera con IA.

## Scripts de contenido

```bash
uv run python web/scripts/extract_motion.py words     # (desde la raíz) movimiento de cada clip → avatar o vídeo
uv run python web/scripts/extract_motion.py letters   # poses reales de las letras
node scripts/fit-letters.ts                           # ajusta las poses 3D a las manos reales
node scripts/verify-letters.ts                        # comprueba las 26 letras (reglas ASL + referencia real)
```

## Detección de letras con la cámara

Reglas por letra en `src/lib/handshapes.ts`, calibradas con las poses reales de referencia. En la actividad de cámara,
**🔧 Ver datos del detector** muestra los valores en vivo. J y Z llevan movimiento y no se comprueban.
