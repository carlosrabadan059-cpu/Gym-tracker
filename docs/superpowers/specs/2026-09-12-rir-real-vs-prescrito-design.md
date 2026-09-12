# Fase 4 (cierre) — RIR real del cliente junto al prescrito

Parte de [docs/plan-trainer-improvements.md](../../plan-trainer-improvements.md), sección "Fase 4 — Seguimiento y feedback", último sub-punto pendiente: "Ver el RPE/RIR real del cliente junto a lo prescrito". Con esto se cierra Fase 4 del todo.

## Contexto

v3 Fase A (ya en `main`) añadió captura de RPE por serie: `ExerciseDetailModal.jsx` ofrece `RPE_OPTIONS = [6, 7, 8, 9, 10]` tras marcar una serie completada, opcional. Ese valor viaja dentro de `setsData[i].rpe` y se persiste tal cual en `workout_logs.logs[exerciseId].setsData` al terminar el entreno (`saveWorkoutLog`) — el dato ya existe en producción para cualquier serie donde el cliente lo haya marcado.

Nadie en el lado entrenador lo lee hoy. `WorkoutDetailPanel.jsx` (detalle de una sesión pasada del cliente) muestra peso/reps por serie pero no RPE. `exercises.target_rir` (Fase 1, prescripción del entrenador) tampoco se cruza con el dato real en ningún sitio.

## Problema de escalas: RPE ≠ RIR

Lo capturado es **RPE** (esfuerzo percibido, 6-10, más alto = más difícil). Lo prescrito es **RIR** (repeticiones en reserva, 0-5, más bajo = más difícil) — escalas inversas. Conversión estándar acordada: **`RIR real ≈ 10 - RPE`**. Con `RPE_OPTIONS` limitado a 6-10, el RIR real aproximado cae siempre en el rango 0-4.

Es una aproximación (RIR real de verdad depende de cuántas reps quedaban, no solo de la sensación), de ahí el "≈" en el texto — no se presenta como un dato exacto.

## Alcance

- `WorkoutDetailPanel.jsx` (lado entrenador, detalle de sesión pasada) gana:
  - Junto al nombre de cada ejercicio: `objetivo RIR N` si ese ejercicio tenía `target_rir` prescrito (mismo criterio que hoy con cualquier campo de prescripción no puesto: si es `null`, no se muestra nada).
  - En cada línea de serie completada que tenga `rpe` guardado: se añade `· RIR real ≈M` (con `M = 10 - rpe`) al texto ya existente (`60 kg × 10 reps`). Series sin `rpe` (el cliente lo dejó sin marcar, es opcional) no muestran nada extra — igual que hoy.
- Sin colores de alerta, sin lógica de "esto es preocupante si difiere mucho" — solo los dos números uno junto al otro. Mismo criterio YAGNI que el resto de Fase 4: el entrenador compara a ojo, la app no interpreta.

## Datos

La query de ejercicios que ya hace `WorkoutDetailPanel.jsx`:

```javascript
supabase.from('exercises').select('id, name, catalog_id, exercise_catalog(name)').in('id', ids.map(Number))
```

gana `target_rir` en el `select`. Sin query nueva, sin tabla nueva — el único cambio de datos es una columna más en un `select` que ya existe. `nameMap`/`exercises` (el `useMemo` que construye la lista para renderizar) pasan a llevar también `target_rir` por ejercicio.

El RPE real por serie ya está en `entry.logs[exerciseId].setsData[i].rpe` — no hace falta tocar `enrichExercisesWithCatalog` ni ninguna otra query.

## Fuera de alcance (explícito)

- Ningún resumen/promedio de RPE/RIR en `ClientProfileView.jsx` — solo en el detalle de sesión (`WorkoutDetailPanel.jsx`).
- Ninguna alerta o resaltado cuando el RIR real se aleja del prescrito.
- Ningún cambio a cómo el cliente captura RPE (`ExerciseDetailModal.jsx` no se toca) ni a `RPE_OPTIONS`.
- Ninguna columna ni tabla nueva en Supabase — es una lectura adicional de una columna que ya existe (`exercises.target_rir`) más aritmética en el cliente sobre un dato que ya existe (`setsData[i].rpe`).
- Rutinas estáticas legacy (`day1`-`day4`, resueltas vía `STATIC_ID_TO_NAME`) no tienen fila en `exercises` con `target_rir` real — para esos IDs simplemente no habrá "objetivo RIR" que mostrar, igual que hoy no tienen ningún otro campo de prescripción.
