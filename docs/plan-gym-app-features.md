# Versión 3: funciones de las apps de gimnasio mejor valoradas

**Fecha:** 2026-09-07 (estado actualizado 2026-09-16)
**Estado:** versión 3 de Rutinex. **Fase A hecha** (1RM estimado, RPE por
serie, sugerencia de peso — la calculadora de discos que también formaba
parte se implementó y se revirtió, ver Fase A abajo). **Fase C hecha**
(etiquetado muscular + mapa de recuperación, ver detalle abajo). **Fase B
(superseries/circuitos) diferida a una versión futura**, sin diseñar. La
**versión 2** (integración con Apple Health, fases 0 a 5,
incluida la Live Activity) está en
[plan-apple-health-integration.md](plan-apple-health-integration.md).
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
- ❌ ~~Calculadora de discos~~ **revertida (2026-09-12)**. Asumía siempre
  barra olímpica de 20 kg cargada por los dos lados — incorrecto para
  máquinas de palanca/T-bar, poleas y prensas (bug real reportado con
  captura: "Remo en T apoyado" mostraba un desglose imposible). El catálogo
  de ejercicios no tiene ningún dato fiable para distinguir barra libre del
  resto por nombre, así que se quitó en vez de arreglarse a medias. Ver
  `docs/superpowers/specs/2026-09-12-quitar-desglose-discos-design.md`. El
  peso total en kg se mantiene igual.
- ✅ 1RM estimado (Epley) en el bloque "Última vez" + badge "Récord estimado"
  en la fila cuando el 1RM de esa serie supera el mejor histórico
  (`loadExerciseBest1RM` en `utils.js`).
- ✅ RPE por serie (`RPE_OPTIONS` 6-10), aparece solo tras marcar la serie,
  opcional. Se guarda en `setsData[i].rpe` (el JSONB de `workout_logs` lo
  absorbe, sin migración).
- ✅ Sugerencia de peso para la próxima sesión — **heurística local**
  (`src/lib/progression.js`), no la IA de `ChatView`: ese webhook es un chat
  n8n de texto libre, no una API estructurada, y sacar de ahí
  `{peso, reps, motivo}` fiable era un workflow nuevo, no un quick win. La
  regla local: última vez con todas las series cerradas y (si hay RPE)
  ninguna ≥ 9 → sube un incremento (2,5 kg si peso ≥ 20, si no 1 kg); RPE ≥ 9
  o reps por debajo del objetivo → mantén. Se muestra en el bloque "Última
  vez". La versión con IA queda como evolución si la heurística se queda
  corta.

### Fase B — Superseries / circuitos · ⏸️ Diferida a una versión futura (2026-09-16)

Agrupar 2+ ejercicios consecutivos sin descanso entre ellos (ej: press de
banca → remo, directo al siguiente sin parar el cronómetro). Toca tres
sitios:

- **Modelo de datos** (`routines`/`exercises`): hoy cada ejercicio es una
  fila independiente sin relación entre sí — haría falta algo tipo
  `superset_group_id` para marcar cuáles van juntos.
- **`TrainingView`**: el flujo hoy es ejercicio → descanso → ejercicio; con
  superseries pasaría a ejercicio A → ejercicio B → (ahí sí) descanso.
- **Constructor de rutinas**: UI para agrupar/desagrupar ejercicios al
  montar la rutina.

No hay spec ni decisiones tomadas — queda como descripción de una línea, sin
diseñar. Con las Fases A y C hechas, es la única pieza que queda de este
plan; se retoma cuando haga falta de verdad, con su propio ciclo
brainstorming → spec → plan.

### Fase C — Mapa de recuperación muscular · ✅ Hecho (2026-09-16)

La función estrella de Fitbod. Se dio por "apuesta a medio plazo" porque
parecía necesitar taxonomía muscular desde cero — al construirla resultó que
el paso 1 ya estaba a medias (`exercise_catalog.category`, 101/101), así que
todo el trabajo real quedó en los músculos secundarios y el cálculo.

**1. Taxonomía — músculos secundarios. ✅ Hecho.**

`exercise_catalog.secondary_muscles` (`text[]`, migración
`20260916_add_secondary_muscles_to_catalog.sql`). Etiquetados los 101 con
IA (workflow n8n `Gym_App_SecondaryMuscles`, gpt-5-mini con salida
estructurada) por lotes, revisados en un JSON intermedio antes de aplicar
(`tools/tag-secondary-muscles.mjs` propone, `tools/apply-secondary-muscles.mjs`
aplica — separados a propósito para que la revisión humana sea real).
`src/lib/muscleTaxonomy.js` centraliza el vocabulario (los 8 grupos reales,
sin "Cardio"/"Otros") y la regla de que el grupo principal nunca puede
aparecer entre sus propios secundarios. Selector de secundarios añadido al
alta y edición de `TrainerLibraryView.jsx`, para que el catálogo no se
degrade al añadir ejercicios nuevos.

**Hallazgo real de calidad, corregido antes de aplicar nada:** la primera
pasada de etiquetado pedía "sinergistas y estabilizadores", y el modelo
marcó Abdomen como secundario en el 50% del catálogo y Hombro en el 41%,
casi siempre por "estabiliza el torso". Una etiqueta que aplica a medio
catálogo no discrimina nada, y habría dejado la barra de abdomen
permanentemente fatigada en el mapa de recuperación. Se ajustó el prompt a
"solo sinergistas que mueven la carga": Abdomen bajó al 0%, Hombro al 21%.
Ver `docs/superpowers/specs/2026-09-16-musculos-secundarios-design.md`.

**2. Cálculo de recuperación, ventana 48-72h. ✅ Hecho.**

`src/lib/muscleRecovery.js` (`computeMuscleRecovery`, puro y testeado, 11
tests): cada serie completada suma `1.0` de fatiga al grupo principal y
`0.5` a cada secundario (`SECONDARY_SET_WEIGHT`); la fatiga decae
linealmente hasta agotar la ventana del grupo — 48h para los pequeños
(Bíceps, Tríceps, Hombro, Abdomen), 72h para los grandes (Pecho, Dorsal,
Pierna, Glúteo). Todas las constantes (pesos, ventanas,
`FULL_FATIGUE_SETS = 12`) están aisladas y con nombre para ajustarse viendo
datos reales sin releer el algoritmo — `FULL_FATIGUE_SETS` en particular se
sabe corto para volúmenes altos (Dorsal y Pierna saturan a 0% con los datos
reales de Carlos) y es candidato a subir.

**3. Visualización. ✅ Hecho, como barras — mapa corporal SVG descartado.**

`MuscleRecoveryCard.jsx` (compartido), barras horizontales por grupo
coloreadas por estado (fresco/parcial/fatigado), en el Dashboard del
cliente — responde a "qué tengo descansado hoy", una pregunta de antes de
entrenar, no de después (por eso no va en Estadísticas, donde vive el
volumen semanal de la Fase 5 del plan de entrenador). El mapa corporal tipo
Fitbod se descartó: no hay ningún recurso anatómico en el repo y habría que
dibujarlo y mantenerlo en dos temas para una ganancia solo estética sobre
las barras. Verificado en real: a 0% la barra desaparecía del todo y los
grupos más fatigados —lo que más importa ver— quedaban indistinguibles de
"sin datos"; se le dio un mínimo visible del 4%.

Ver `docs/superpowers/specs/2026-09-16-mapa-recuperacion-design.md`.

### Orden recomendado (histórico)

Fase A (las 4 juntas) → Fase B → Fase C. **No se siguió tal cual**: la Fase
C se adelantó a la B porque, al revisar el plan de entrenador (Fase 5), se
descubrió que su dependencia bloqueante (taxonomía muscular) ya estaba
resuelta a medias — construirla no exigía esperar a nada. La Fase B
(supersets) sigue siendo la única pieza abierta de este documento. Ninguna
depende de la integración con Apple Health.

---

## Estado

**Fase A hecha (2026-09-10, calculadora de discos revertida 2026-09-12)**:
1RM estimado + badge de récord, RPE por serie, sugerencia de peso por
heurística local — los tres en `ExerciseDetailModal.jsx`.

**Fase C hecha (2026-09-16)**: músculos secundarios en el catálogo (101/101,
etiquetados con IA y revisados antes de aplicar) + cálculo de recuperación
con ventana 48-72h + tarjeta de barras en el Dashboard del cliente. Ver
detalle en la sección Fase C arriba.

**Fase B (superseries/circuitos) diferida a una versión futura** (ver
detalle arriba) — sin spec ni decisiones tomadas. Con A y C hechas, este
plan queda cerrado salvo por esa pieza diferida. Ver también
[docs/plan-apple-health-integration.md](plan-apple-health-integration.md)
para la integración con Apple Health, que es un eje de mejora aparte.
