# Versión 3: funciones de las apps de gimnasio mejor valoradas

**Fecha:** 2026-09-07
**Estado:** aparcado como **versión 3** de Rutinex. La **versión 2** es la
integración con Apple Health completa —fases 0 a 5, incluida la Live Activity—
en [plan-apple-health-integration.md](plan-apple-health-integration.md), y va
antes que todo lo de este documento. Nada de aquí está decidido para
construirse todavía.
**Objetivo:** identificar qué funciones de las apps de entrenamiento mejor
valoradas (Hevy, Fitbod, Strong, JEFIT) aportarían más a Rutinex, evitando
recomendar lo que ya existe.

---

## Qué se miró

- **Hevy** (4.9★, App Store, +200k reseñas) — logging rápido, calculadora de
  discos inline, "rendimiento anterior" visible mientras registras la serie
  actual, componente social (seguir a otros, comparar progreso).
- **Fitbod** — rutinas generadas por IA según equipo disponible y
  recuperación muscular, mapa de calor de recuperación por grupo muscular
  (0-100%, ventana de 48-72h), biblioteca de +1600 ejercicios con vídeo.
- **Strong** — minimalista, registro rápido sin ruido, sin IA ni social.
- **JEFIT** y otros — biblioteca de programas/rutinas predefinidas (5/3/1,
  PPL), comunidad.

Fuentes: [Fitbod blog](https://fitbod.me/blog/best-workout-tracker-apps-for-2026/),
[comparativa Hevy/Strong/Fitbod](https://www.sensai.fit/blog/hevy-vs-strong-vs-fitbod),
[reseña Hevy 2026](https://repreturn.com/hevy-app-review/),
[cómo genera Fitbod tus rutinas](https://fitbod.me/blog/fitbod-algorithm/).

## Qué ya tiene Rutinex (no recomendar de nuevo)

Revisado contra el código antes de proponer nada, para no duplicar:

| Función | Ya existe en | Nota |
|---|---|---|
| "Rendimiento anterior" visible al loguear | [ExerciseDetailModal.jsx:557-600](../src/views/ExerciseDetailModal.jsx#L557-L600) | Bloque "Última vez" con peso/reps de la sesión anterior — es la función #1 más valorada de Hevy, Rutinex ya la tiene |
| Récord personal / PR | [StatisticsView.jsx](../src/views/StatisticsView.jsx) tab Progresión | Card "Récord Personal" ya calculada |
| Racha + heatmap de actividad | `StatisticsView.jsx` tab Actividad | Heatmap de 90 días + racha semanal |
| Rutinas asignadas por entrenador | `assigned_routines`, vistas `trainer/*` | Cubre el mismo hueco que las "rutinas predefinidas" de JEFIT, pero personalizado por un humano en vez de una plantilla genérica — más valioso para quien tiene entrenador |
| Cálculo de calorías por volumen/MET | `routineUtils.js` | Base ya construida — con Apple Health (plan aparte) pasa a poder validarse contra datos reales |

## Huecos reales encontrados (nada de esto existe hoy)

Confirmado con grep sobre el código — no hay calculadora de discos, ni 1RM
estimado, ni RPE/RIR, ni superseries/circuitos, ni mapa de recuperación
muscular.

### 1. Calculadora de discos inline — la función #1 de Hevy

Al ver el peso objetivo de una serie, mostrar qué discos poner por lado
(ej. "60 kg → 2× 20 + 2× 5 por lado"), justo donde ya se introduce el peso
en `ExerciseDetailModal.jsx`. Puro cálculo cliente, sin backend, sin
Health. Esfuerzo bajo, es la función que los usuarios de Hevy citan más.

### 2. 1RM estimado + aviso de PR en el momento

Rutinex ya guarda peso×reps por serie y ya calcula el PR histórico en
Estadísticas — falta la fórmula de 1RM estimado (Epley: `peso × (1 + reps/30)`)
aplicada en vivo, y un aviso tipo "¡Nuevo récord!" en el momento de marcar
la serie, no solo al mirar después en Estadísticas. Encaja natural con lo
que ya existe.

### 3. RPE/RIR por serie

Campo opcional (1-10 o "repeticiones en reserva") junto a peso/reps en cada
serie. Barato de añadir al esquema de `setsData` ya existente. Sirve de
base para autorregular el peso sugerido en el futuro (ver punto 5).

### 4. Superseries / circuitos

Agrupar 2+ ejercicios consecutivos sin descanso entre ellos — hoy cada
ejercicio es independiente con su propio descanso. Requiere cambios en el
modelo de rutina (`routines.js`/tabla `exercises`) y en el flujo de
`TrainingView`. Esfuerzo medio-alto, pero es una carencia real para
quienes entrenan en circuito.

### 5. Sugerencia de peso para la próxima sesión (ya casi tenéis la IA)

Fitbod destaca por sugerir peso/reps según recuperación e historial.
Rutinex ya tiene infraestructura de IA en `ChatView.jsx` — en vez de
construir un motor de recomendación nuevo desde cero, la vía más barata es
extender ese mismo chat/IA para que, con el historial ya guardado en
`workout_logs`, proponga el peso de la próxima sesión de un ejercicio
("la última vez hiciste 4×8 a 60kg con RIR 1 → prueba 62,5kg"). Reutiliza
lo que ya existe en vez de construir un sistema de recomendación aparte.

### 6. Mapa de recuperación muscular (el más caro, el más distintivo)

El rasgo estrella de Fitbod. Necesita: (a) taxonomía de grupo muscular por
ejercicio (`exercise_catalog` no la tiene todavía, solo hay mapeo de iconos
por nombre de rutina en `routineUtils.js`), (b) cálculo de volumen reciente
por grupo muscular con ventana de 48-72h, (c) visualización tipo heatmap.
Esfuerzo alto, pero es el tipo de función que un usuario cita como razón
para preferir una app sobre otra — candidato a diferenciador real si se
decide invertir en él.

## Descartado / con reservas

- **Componente social (seguir a otros, feed, comparar progreso)** — es el
  diferenciador de Hevy, pero Rutinex ya tiene un modelo entrenador-cliente
  (relación 1:1 guiada), no un público general de desconocidos. Añadir un
  feed social choca con ese posicionamiento salvo que se decida
  explícitamente ampliar el producto en esa dirección — no recomendado sin
  esa conversación aparte.
- **Biblioteca de programas predefinidos (5/3/1, PPL, etc.)** — Rutinex ya
  cubre ese hueco mejor vía el entrenador asignando rutinas reales; añadir
  plantillas genéricas es redundante salvo para el caso de usuario sin
  entrenador, que hoy no está claro que exista en el producto.

## Roadmap de mejoras futuras

### Fase A — Registro de series enriquecido (los 4 quick wins juntos)

Las cuatro caben en la misma pantalla (`ExerciseDetailModal.jsx`), así que
tiene sentido construirlas de una vez y no en cuatro pasadas:

1. **Calculadora de discos** — cálculo cliente puro (barra 20 kg + discos
   20/15/10/5/2,5/1,25 por lado). Sin backend, sin migración.
2. **1RM estimado + aviso de PR en el momento** — fórmula Epley
   (`peso × (1 + reps/30)`) sobre los datos que ya se guardan; el aviso salta
   al marcar la serie, no solo al mirar Estadísticas después.
3. **RPE/RIR por serie** — campo opcional añadido al esquema `setsData` ya
   existente. Requiere migración menor (el JSONB de `workout_logs` lo absorbe
   sin cambios de esquema SQL) y que Estadísticas lo ignore si falta.
4. **Sugerencia de peso vía la IA existente** — extender `ChatView.jsx` /
   el mismo backend de IA para proponer peso×reps de la próxima sesión a
   partir de `workout_logs` (+ RPE del punto 3 cuando exista).

**Diseño:** prototipado con 3 variantes (A inline mínimo / B tarjeta de
objetivo / C serie activa expandida). Ver
`src/views/prototype-logging/NOTES.md` en la rama `prototype/logging-ui`.

**Veredicto (2026-09-10): gana A — "inline mínimo".** Cero bloques nuevos,
respeta la velocidad de registro. Implementado en `ExerciseDetailModal.jsx`:
- ✅ Calculadora de discos (`src/lib/plates.js`: barra 20 kg + discos
  25/20/15/10/5/2,5/1,25). Texto fino bajo cada fila de serie.
- ✅ 1RM estimado (Epley) en el bloque "Última vez" + badge "Récord estimado"
  en la fila cuando el 1RM de esa serie supera el mejor histórico
  (`loadExerciseBest1RM` en `utils.js`).
- ✅ RPE por serie (`RPE_OPTIONS` 6-10), aparece solo tras marcar la serie,
  opcional. Se guarda en `setsData[i].rpe` (el JSONB de `workout_logs` lo
  absorbe, sin migración).
- ⏳ Sugerencia de peso vía la IA existente — PR aparte (necesita tocar el
  backend de IA de `ChatView`).

### Fase B — Superseries / circuitos

Agrupar 2+ ejercicios consecutivos sin descanso entre ellos. Toca el modelo
de datos (`routines`/`exercises`) y el flujo de `TrainingView`, no solo la
UI — por eso va después de la Fase A pese a ser también una carencia real.

### Fase C — Mapa de recuperación muscular (apuesta a medio plazo)

La función estrella de Fitbod, y la más cara. Necesita, en este orden:

1. Taxonomía de grupo muscular por ejercicio en `exercise_catalog` (hoy solo
   existe mapeo de iconos por nombre de rutina en `routineUtils.js`).
2. Cálculo de volumen reciente por grupo muscular, ventana 48-72h.
3. Visualización tipo heatmap (mapa corporal o barras por grupo).

Es la única de la lista que puede funcionar como diferenciador real frente a
otras apps, pero también la única que no se puede hacer en una tarde —
valorarla como decisión de producto, no como quick win.

### Orden recomendado

Fase A (las 4 juntas) → Fase B → Fase C. Ninguna depende de la integración
con Apple Health, así que pueden avanzar en paralelo a ese plan.

---

## Estado

Documento de estudio + propuesta. Nada implementado ni ejecutado. Ver
también [docs/plan-apple-health-integration.md](plan-apple-health-integration.md)
para la integración con Apple Health, que es un eje de mejora aparte.
