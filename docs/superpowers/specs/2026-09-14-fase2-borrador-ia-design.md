# Fase 2.1 + 2.4 — Generar borrador de rutina con IA, con motivo por ejercicio

**Fecha:** 2026-09-14
**Alcance:** `docs/plan-trainer-improvements.md`, Fase 2, puntos 2.1 (generar
borrador) y 2.4 (explicar el porqué). 2.2 (revisar rutina) ya está hecha y no
se toca. 2.3 (progresión de ciclo) queda fuera, depende del etiquetado
muscular de v3 Fase C.

## Contexto

El entrenador ya puede crear rutinas a mano en `RoutineAssignerView.jsx`
(pestañas "Rutinas existentes" / "Crear nueva") y ya puede pedirle a una IA
que **revise** una rutina ya construida (`RoutineReviewModal.jsx`, workflow
n8n `Gym_App_Trainer_Review`). Lo que falta es que la IA pueda proponer un
**borrador desde cero**, a partir del objetivo y el historial del cliente, con
una línea de justificación por ejercicio.

**Principio de diseño de toda la Fase 2 (ya cerrado, no se revisita):** la IA
propone, el entrenador dispone. Nada generado por la IA se asigna al cliente
sin que el entrenador pulse Guardar — el borrador entra en el mismo
constructor de rutinas ya existente, como si lo hubiera rellenado un humano.

## Decisiones ya tomadas (no reabrir)

1. **Guardar ya los campos de prescripción sugeridos.** `target_weight`,
   `target_rir`, `rest_seconds` y `notes` que proponga la IA se persisten al
   pulsar Guardar, igual que `series`/`reps`. Esto obliga a extender
   `handleSave` (ver "Cambios en `handleSave`" abajo), que hoy **no** guarda
   esos 4 campos ni siquiera en la creación manual — es un hueco real del
   código, no solo del flujo de IA.
2. **La IA solo elige ejercicios del catálogo maestro** (`exercise_catalog`,
   101 filas). No puede inventar nombres ni crear ejercicios nuevos.
3. **El "motivo" de cada ejercicio es efímero.** Se ve durante la revisión del
   borrador, no se guarda en `exercises` ni en ningún otro sitio. Si el
   entrenador quiere dejar una nota permanente, usa el campo `notes` ya
   existente (que si la IA lo propone, ese sí se guarda).
4. **"Con IA" es una 3ª pestaña** en `RoutineAssignerView.jsx`, junto a
   "Rutinas existentes" y "Crear nueva". Al generar un borrador con éxito, la
   vista cambia automáticamente a la pestaña "Crear nueva" con
   `routineName`/`selectedExercises` ya rellenados — no hay una pantalla de
   revisión aparte ni comparación lado a lado. (El plan original describía una
   vista comparativa "borrador a un lado, rutina actual al otro" para pantalla
   ancha; se descarta a propósito por YAGNI — el entrenador ya puede editar o
   borrar cualquier ejercicio del borrador en "Crear nueva" antes de guardar,
   que es donde de verdad se decide qué se asigna.)

## Arquitectura

Dos piezas independientes que se conectan por un único webhook:

### 1. Workflow n8n nuevo: `Gym_App_RoutineDraft`

- Carpeta Gym (`mFYxumQoAzC950ee`), junto a `Gym_App_Trainer_Review` y
  `Gym_App_Chat` — **no se toca ninguno de los dos existentes.**
- Webhook propio, sin memoria conversacional (es una llamada estructurada de
  entrada/salida, no un chat).
- Modelo `gpt-4.1-mini`, credencial `OpenAI Carlos` (`HeNfhfUfwAHOImZn`).
- **Entrada** (JSON del POST):
  ```json
  {
    "clientGoal": "Fuerza",
    "level": "intermedio",
    "daysPerWeek": 4,
    "equipment": "gimnasio completo",
    "limitations": "molestia en el hombro derecho",
    "exerciseNames": ["Sentadilla trasera", "Press banca", "..."],
    "recentHistorySummary": "..."
  }
  ```
  `exerciseNames` es la lista completa de nombres de `exercise_catalog` (las
  101 filas) — es la única forma de que el modelo "solo pueda" elegir del
  catálogo: se le da la lista cerrada y se le pide que responda usando esos
  nombres literalmente. `recentHistorySummary` es un resumen textual corto
  (no el JSON crudo) de los últimos `workout_logs` del cliente, construido en
  el cliente antes de llamar al webhook — mismo espíritu que el contexto que
  ya arma `RoutineReviewModal.jsx` para su propio webhook.
- **Salida** (JSON esperado):
  ```json
  {
    "nombre": "Fuerza — Torso/Pierna 4 días",
    "ejercicios": [
      {
        "catalogName": "Sentadilla trasera",
        "series": 4,
        "reps": 8,
        "target_weight": 60,
        "target_rir": 2,
        "rest_seconds": 120,
        "notes": null,
        "motivo": "Multiarticular de pierna, va primero para priorizar carga con el sistema nervioso fresco."
      }
    ]
  }
  ```
  `catalogName` debe ser exactamente uno de los nombres recibidos en
  `exerciseNames`. `target_weight`/`target_rir`/`rest_seconds`/`notes` son
  opcionales (pueden venir `null` si la IA no tiene base para sugerirlos).
- Si `catalogName` no casa con ningún nombre del catálogo enviado (typo del
  modelo, nombre inventado), ese ejercicio concreto se descarta al procesar la
  respuesta en el cliente — no rompe el resto del borrador, ver
  "Manejo de errores" abajo.

### 2. UI: pestaña "Con IA" en `RoutineAssignerView.jsx`

Nuevo valor de `mode`: `'existing' | 'new' | 'ai'`. Un formulario simple:

- Objetivo — prefill desde `client.goal` (columna `profiles.goal`, ya existe),
  editable.
- Nivel — select (principiante / intermedio / avanzado).
- Días por semana — number input.
- Material disponible — texto libre corto.
- Lesiones o limitaciones — texto libre corto, opcional.

Botón "Generar borrador". Al pulsarlo:

1. Se construye `recentHistorySummary` a partir de los `workout_logs` más
   recientes del cliente (reutilizar la misma consulta/idea que ya usa
   `RoutineReviewModal.jsx` o `ClientProfileView.jsx` para mostrar historial,
   no inventar una nueva).
2. Se llama al webhook `Gym_App_RoutineDraft` con el mismo patrón que
   `RoutineReviewModal.jsx` (línea a línea, es el patrón ya probado en
   producción):
   - `REQUEST_TIMEOUT_MS = 30000`.
   - Estado `status`: `'idle' | 'loading' | 'done' | 'error'`.
   - `AbortController` + `setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)`.
   - `fetch(webhookUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload), signal })`.
   - Comprobar `response.ok`, lanzar si no.
   - Catch: `console.error` + mensaje de fallback en español
     ("No se pudo generar el borrador. Inténtalo de nuevo.").
   - Env var: `VITE_N8N_ROUTINE_DRAFT_WEBHOOK_URL` (mismo naming que
     `VITE_N8N_TRAINER_REVIEW_WEBHOOK_URL` de la 2.2). El usuario la añade en
     Vercel una vez exista el workflow — fuera del alcance de este spec.
3. Con la respuesta ya parseada, por cada ejercicio del array `ejercicios`:
   - Buscar en `catalog` (el estado ya cargado en `RoutineAssignerView`, viene
     de `exercise_catalog`) una entrada cuyo `name` coincida exactamente
     (case-insensitive, `trim()`) con `catalogName`.
   - Si hay match: añadir a `selectedExercises` un objeto con la misma forma
     que ya usa `toggleExercise` (`catalog_id`, `name`, `image_url`) más los
     campos nuevos: `series`, `reps`, `target_weight`, `target_rir`,
     `rest_seconds`, `notes`, y **`motivo`** (este último solo vive en memoria
     del componente, nunca llega a `handleSave`).
   - Si no hay match: se descarta, y se acumula en una lista de "N ejercicios
     no reconocidos" para avisar al entrenador (ver "Manejo de errores").
4. `setRoutineName(borrador.nombre)`, `setSelectedExercises(...)` con la lista
   resuelta, `setMode('new')` — la vista salta directa a "Crear nueva" ya
   rellena.

### Cambios en "Crear nueva" (mostrar el motivo)

Cada `ExerciseCard`/fila de `selectedExercises` en el modo "Crear nueva" ya
renderiza nombre + steppers de series/reps. Cuando el ejercicido trae
`motivo` (o sea, viene de un borrador de IA recién generado, no de edición
manual ni de catálogo), se añade una línea de texto secundario debajo del
nombre, p.ej. en cursiva o con un icono de bombilla — detalle visual menor,
no bloquea el resto del diseño. El campo `motivo` **no se envía** en el
`insert` de `handleSave`.

### Cambios en `handleSave`

El insert de `exercises` (línea ~538 de `RoutineAssignerView.jsx`) hoy es:

```js
selectedExercises.map((ex, i) => ({
    routine_id: routineId,
    name: ex.name,
    series: String(ex.series),
    reps: String(ex.reps),
    image_url: ex.image_url,
    catalog_id: ex.catalog_id ?? null,
    ui_order: i + 1,
}))
```

Se extiende a incluir los 4 campos ya existentes en la tabla `exercises`
(`target_weight numeric`, `target_rir smallint`, `rest_seconds integer`,
`notes text` — confirmado por schema real, sin migración necesaria) cuando el
ejercicio los trae:

```js
selectedExercises.map((ex, i) => ({
    routine_id: routineId,
    name: ex.name,
    series: String(ex.series),
    reps: String(ex.reps),
    image_url: ex.image_url,
    catalog_id: ex.catalog_id ?? null,
    ui_order: i + 1,
    target_weight: ex.target_weight ?? null,
    target_rir: ex.target_rir ?? null,
    rest_seconds: ex.rest_seconds ?? null,
    notes: ex.notes ?? null,
}))
```

**Efecto colateral intencional:** esto también afecta a la creación manual de
rutinas ("Crear nueva" sin pasar por IA) — hoy esos 4 campos nunca se rellenan
al crear a mano, así que seguirán guardándose como `null` exactamente igual
que ahora (no hay UI manual para editarlos en el flujo de creación, solo se
editan después desde la ficha de la rutina, que es donde vive la Fase 1). No
cambia ningún comportamiento visible para la creación manual — solo dejamos
de perder los datos cuando SÍ vienen rellenos (desde IA).

## Manejo de errores

- **Timeout o fallo de red en la llamada al webhook:** mismo patrón que
  `RoutineReviewModal.jsx` — mensaje de error en español, el formulario queda
  disponible para reintentar. No se navega a ningún sitio ni se pierde lo que
  el entrenador haya escrito en el formulario "Con IA".
- **JSON de respuesta mal formado o sin el campo `ejercicios`:** se trata como
  error (mismo mensaje genérico), no se intenta "rescatar" un JSON parcial.
- **Uno o más `catalogName` sin match en el catálogo:** no es un error total.
  El borrador se construye igualmente con los ejercicios que sí casaron, y se
  muestra un aviso corto ("La IA sugirió 2 ejercicios que no existen en el
  catálogo y se han omitido") antes de saltar a "Crear nueva". Si **ningún**
  ejercicio casa, sí se trata como error total (no tiene sentido abrir "Crear
  nueva" vacío) y no se cambia de pestaña.
- **Respuesta con 0 ejercicios en el array:** mismo caso que "ningún match" —
  error total.

## Fuera de alcance (explícito)

- Vista de comparación lado a lado borrador/rutina actual en pantalla ancha
  (mencionada en el plan original) — YAGNI, ver decisión 4 arriba.
- Tempo (`exercises.tempo`) — la IA no lo sugiere en esta fase, se queda como
  hoy (edición manual posterior).
- Cualquier caché o reutilización de un borrador generado — si el entrenador
  sale de la pestaña "Con IA" sin generar, o genera dos veces, no hay
  historial de borradores anteriores.
- Construcción del propio workflow n8n paso a paso (nodos, prompt exacto) —
  eso se decide al implementarlo, siguiendo el protocolo del skill
  `using-n8n-skills`, no en este documento.

## Testing

Sin lógica pura nueva que amerite un test de Vitest aislado (todo el trabajo
nuevo en cliente es fetch + mapeo de datos dentro de un componente). La
verificación real es manual: generar un borrador contra el workflow de n8n ya
desplegado, confirmar que "Crear nueva" queda bien rellena, y confirmar por
`mcp__supabase__execute_sql` (lectura) que al guardar los 4 campos nuevos
llegan a la fila de `exercises` esperada. Si al implementar aparece una
función pura extraíble (p.ej. el matching `catalogName` → `catalog_id`), sí
lleva su test — decisión del implementador en el momento, no bloquea el plan.
