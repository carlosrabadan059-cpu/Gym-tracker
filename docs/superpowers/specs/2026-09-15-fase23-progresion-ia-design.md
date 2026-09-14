# Fase 2.3 — Proponer la progresión del siguiente ciclo con IA

**Fecha:** 2026-09-15
**Alcance:** `docs/plan-trainer-improvements.md`, Fase 2.3 ("A partir de lo
que el cliente realmente levantó y su RPE/RIR, qué subir, qué mantener, qué
cambiar porque se ha estancado"). Estaba marcada como dependiente de "RPE/RIR
real del cliente (v3 Fase A)" — **v3 Fase A ya está hecha** (RPE por serie en
`setsData[i].rpe`, ver `docs/plan-gym-app-features.md`), así que esta pieza
está desbloqueada de verdad, no en teoría.

Reutiliza directamente dos piezas ya construidas esta misma sesión:
- **Fase 2.1/2.4** (borrador de rutina con IA): mismo principio "la IA
  propone, el entrenador dispone", mismo patrón de workflow n8n dedicado,
  mismo patrón de componente React (`GenerateWithAiTab` en
  `RoutineAssignerView.jsx`) para la llamada al webhook.
- **Fase 3 parte 2** (mesociclo con progresión programada): la tabla
  `weekly_progression` por ejercicio en `ClientProfileView.jsx` ya existe —
  esta pieza la rellena con una sugerencia de la IA en vez de que el
  entrenador escriba cada semana a mano, que es literalmente lo que pedía
  el plan original.

## Decisiones tomadas (brainstorming, no reabrir)

1. **Por ejercicio, no por rutina entera.** Un botón "Sugerir con IA" dentro
   del editor de cada ejercicio, donde ya vive la tabla de progresión
   semanal. Encaja con que `weekly_progression` ya es por ejercicio, y con
   que el historial relevante (peso/reps/RPE reales) es el de ESE ejercicio
   concreto, no el de la rutina.
2. **Siempre 4 semanas.** Sin campo nuevo de "número de semanas" en el
   formulario — mesociclo estándar. Si el entrenador quiere ajustar, ya
   puede añadir/quitar filas a mano en la tabla existente.
3. **Sin datos de partida → botón deshabilitado.** Si el ejercicio no tiene
   ni `target_weight` puesto ni historial real de entreno, el botón "Sugerir
   con IA" aparece deshabilitado con el texto "Sin datos suficientes" — no
   se llama a la IA para que invente un peso de la nada.

## Arquitectura

### 1. n8n — nuevo workflow `Gym_App_ProgressionSuggestion`

Mismo patrón que `Gym_App_RoutineDraft` (Fase 2.1): webhook propio, sin
memoria conversacional, modelo gpt-4.1-mini, credencial "OpenAI Carlos"
(`HeNfhfUfwAHOImZn`), carpeta Gym en n8n.rabadanhouse.space. No se toca
`Gym_App_RoutineDraft`, `Gym_App_Trainer_Review` ni `Gym_App_Chat`.

**Entrada (JSON):**
```json
{
  "exerciseName": "Press de banca",
  "category": "Pecho",
  "clientGoal": "Hipertrofia",
  "level": "intermedio",
  "currentSeries": 4,
  "currentReps": 10,
  "currentTargetWeight": 60,
  "currentTargetRir": 2,
  "historySummary": "2026-09-01: 4×10 @57.5kg RPE7\n2026-09-08: 4×10 @60kg RPE8\n..."
}
```

**Salida esperada (JSON estructurado):**
```json
{
  "semanas": [
    { "week": 1, "series": 4, "reps": 10, "target_weight": 60, "target_rir": 2, "motivo": "Mantener el peso de la última sesión, consolidar técnica" },
    { "week": 2, "series": 4, "reps": 10, "target_weight": 62.5, "target_rir": 2, "motivo": "RPE estable en 7-8, toca subir un escalón" },
    { "week": 3, "series": 4, "reps": 8, "target_weight": 65, "target_rir": 1, "motivo": "Reducir reps al subir peso para mantener la intensidad" },
    { "week": 4, "series": 3, "reps": 8, "target_weight": 60, "target_rir": 3, "motivo": "Semana de descarga antes de reevaluar" }
  ]
}
```

Siempre 4 elementos en `semanas`. `motivo` es obligatorio por semana — sin
eso, es una caja negra, mismo principio ya aplicado en 2.4.

### 2. `src/lib/trainerUtils.js` — dos funciones puras nuevas

```js
/**
 * Resume el historial real de UN ejercicio (peso/reps/RPE por sesión) en
 * texto plano para la IA de progresión (Fase 2.3). A diferencia de
 * summarizeWorkoutHistory (Fase 2.1, resume sesiones completas), esto
 * resume series de un solo ejercicio con su dato de intensidad real.
 *
 * @param {Array<{date: string, setsData: object}>} history  de loadExerciseHistory (utils.js)
 * @returns {string}
 */
export function summarizeExerciseHistoryForAI(history) { /* ... */ }

/**
 * Arma el cuerpo del POST a Gym_App_ProgressionSuggestion (Fase 2.3).
 */
export function buildProgressionSuggestionPayload({ exerciseName, category, clientGoal, level, currentSeries, currentReps, currentTargetWeight, currentTargetRir, historySummary }) { /* ... */ }
```

`summarizeExerciseHistoryForAI` recorre `history` (ya ordenado de más
reciente a más antiguo por `loadExerciseHistory`, se usa tal cual, sin
reordenar) y por cada sesión con al menos una serie con peso y reps
numéricos, produce una línea `YYYY-MM-DD: N×reps @pesokg RPEn` usando el
peso más alto de esa sesión (mismo criterio de "peso de trabajo" que
`src/lib/progression.js`'s `suggestNextWeight` ya usa) — si esa serie no
tiene RPE registrado, se omite el sufijo `RPEn`. Sesiones sin ninguna serie
válida se omiten. Sin historial → `'Sin historial de entrenamientos registrado para este ejercicio.'`
(mismo texto de fallback que `summarizeWorkoutHistory` usa para el caso
general, por consistencia).

### 3. `ClientProfileView.jsx` — botón "Sugerir con IA"

En el editor de ejercicio existente, junto al checkbox "Progresión por
semanas" (Fase 3 parte 2), un botón "✨ Sugerir con IA":

- **Deshabilitado** (con tooltip/texto "Sin datos suficientes") si
  `editingExercise.target_weight` está vacío **y** el ejercicio no tiene
  historial real — se comprueba llamando a `loadExerciseHistory(client.user_id, ex.name)`
  (ya existe en `utils.js`, usado hoy por "Historial de Ejercicios" en
  Estadísticas) al abrir el editor, no en cada render.
- Al pulsar: activa `useWeeklyProgression` (si no lo estaba ya), y lanza
  `handleSuggestProgression`, que:
  1. Llama a `loadExerciseHistory(client.user_id, ex.name)` de nuevo (o
     reusa el resultado de la comprobación anterior si sigue vigente).
  2. Construye el payload con `buildProgressionSuggestionPayload`, usando
     `client.goal`, `'intermedio'` como nivel por defecto (mismo default
     que 2.1, sin selector de nivel nuevo aquí — no pedido), y los valores
     base actuales del ejercicio.
  3. Hace `fetch` al webhook con el mismo patrón de
     `AbortController`/`setTimeout(REQUEST_TIMEOUT_MS)`/`isMountedRef`
     correctamente reseteado dentro del `useEffect` (el bug de StrictMode ya
     documentado y corregido en `GenerateWithAiTab` — este componente nuevo
     nace ya con el fix aplicado, no lo reintroduce).
  4. Con la respuesta, sustituye `editingExercise.weeklyProgression` por las
     4 filas devueltas (incluyendo su `motivo`, guardado en el estado local
     de cada fila para mostrarlo, no en la base de datos).
  5. Errores (timeout, HTTP no-ok, JSON inesperado): mensaje de error igual
     de visible que en `GenerateWithAiTab`, sin romper la tabla ya existente
     (si había filas manuales antes de pulsar el botón y la llamada falla,
     se quedan como estaban).
- Cada fila de la tabla de progresión (ya existente) muestra su `motivo`
  como una línea de texto pequeña debajo, solo cuando la fila tiene uno
  (es decir, solo tras generarla con IA — las filas creadas/editadas a mano
  no tienen motivo). Al pulsar "Guardar" el ejercicio, `handleSaveEdit`
  (ya existente) sigue mandando solo `{week, series, reps, target_weight,
  target_rir}` por fila a `weekly_progression` — `motivo` se descarta al
  persistir, igual que en 2.1.

### 4. Variable de entorno

`VITE_N8N_PROGRESSION_SUGGESTION_WEBHOOK_URL`, mismo host ya permitido en
el CSP de `vercel.json` (`n8n.rabadanhouse.space`). Se documenta en
`.env.example`, se añade a `.env.local`, y hay que recordar avisar al
usuario para añadirla en Vercel + redeploy manual (los cambios de solo
variables de entorno no redepliegan solos).

## Fuera de alcance (explícito)

- Cualquier cambio a `Gym_App_RoutineDraft`, `Gym_App_Trainer_Review` o
  `Gym_App_Chat` — workflows existentes, no se tocan.
- Selector de nivel/objetivo específico para esta llamada — reusa
  `client.goal` y un nivel fijo `'intermedio'`, igual de simple que se
  decidió para no repetir el formulario completo de Fase 2.1.
- Generar progresión para varios ejercicios a la vez — decisión tomada:
  por ejercicio, uno a uno.
- Cualquier cambio al esquema de `weekly_progression` en base de datos —
  sigue siendo `{week, series, reps, target_weight, target_rir}`, `motivo`
  vive solo en memoria del navegador durante la edición.

## Testing

`src/lib/trainerUtils.test.js` (extendido, ya existe con 17 tests de Fase
2.1): añadir tests para `summarizeExerciseHistoryForAI` (historial vacío,
una sesión con RPE, una sesión sin RPE, varias series por sesión → usa la
de peso más alto, sesión sin series válidas se omite) y
`buildProgressionSuggestionPayload` (todos los campos presentes, defaults
cuando falta `clientGoal`/`level`).

Sin test para el fetch/JSX del botón en `ClientProfileView.jsx` — mismo
criterio que `GenerateWithAiTab` (Fase 2.1), que tampoco lo tiene.
