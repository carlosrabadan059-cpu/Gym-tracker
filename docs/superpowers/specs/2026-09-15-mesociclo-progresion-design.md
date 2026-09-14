# Fase 3 (parte 2) — Mesociclo con progresión programada

**Fecha:** 2026-09-15
**Alcance:** `docs/plan-trainer-improvements.md`, Fase 3, segundo y tercer punto
("Progresión programada: definir 4 semanas de una vez... en vez de reeditar
la rutina cada semana" y "Mesociclo con fechas: inicio, fin, y qué pasa al
terminar"). El primer punto de la Fase 3 (calendario semanal, qué rutina
toca cada día) ya está cerrado — ver
`docs/superpowers/specs/2026-09-15-calendario-semanal-design.md` — y esta
pieza depende de que exista, aunque no la usa directamente en el código.

## Decisiones tomadas (brainstorming, no reabrir)

1. **Auto-aplicar cada semana**: el entrenador define de una vez la tabla
   semana→valores; la app calcula sola qué semana toca según la fecha de
   inicio del mesociclo y usa esos valores ese día, sin que el entrenador
   reedite nada semana a semana.
2. **Por rutina**, no por cliente: cada rutina asignada tiene su propio
   mesociclo opcional. No fuerza a que todas las rutinas de un cliente
   avancen sincronizadas.
3. **Kg absolutos**, no %1RM: la app no guarda ningún 1RM (eso es v3, sin
   construir). El entrenador escribe el peso objetivo directo, igual que
   `target_weight` hoy.
4. **Por ejercicio**: cada ejercicio de la rutina tiene su propia progresión
   semanal independiente — uno puede subir de peso más rápido que otro.
5. **Al terminar el ciclo** (hoy supera la última semana definida): los
   valores se quedan congelados en los de la última semana, indefinidamente,
   hasta que el entrenador defina una progresión nueva o edite el ejercicio
   a mano. Sin aviso ni notificación — congelar silenciosamente es
   suficiente.
6. **UI en `ClientProfileView.jsx`**, sobre la rutina ya asignada al
   cliente — no en `RoutineAssignerView.jsx` al crearla. La fecha de inicio
   real de un mesociclo solo tiene sentido una vez la rutina está asignada,
   igual que el selector de días de la semana (que vive en el mismo sitio).

## Arquitectura

Sin tabla nueva — mismo criterio que `scheduled_days` (spec de calendario
semanal): se rechaza una tabla `mesocycle_weeks` (exercise_id, week_number,
...) por ser sobre-ingeniería para, como mucho, un puñado de filas por
ejercicio sin relaciones propias.

### 1. Migración

Dos columnas nuevas, ambas nullables:

```sql
alter table public.routines add column if not exists mesocycle_start_date date;
alter table public.exercises add column if not exists weekly_progression jsonb;
```

- `routines.mesocycle_start_date`: fecha de inicio real del mesociclo de esa
  rutina asignada. `null` = sin mesociclo, comportamiento actual sin
  cambios. Vive en `routines` (no en `assigned_routines`) porque cada rutina
  asignada ya es una copia privada por cliente (ver
  `20260910_routine_templates.sql`) — no hace falta una tabla de relación
  para algo 1:1 con la rutina.
- `exercises.weekly_progression`: array de objetos
  `{week, series, reps, target_weight, target_rir}`, uno por semana
  definida. `null` o `[]` = sin progresión para ese ejercicio (se trata
  igual, nunca se distingue entre los dos, mismo criterio que
  `scheduled_days`). `rest_seconds`, `tempo` y `notes` no varían por semana
  — se quedan como columnas base de siempre, editables igual que hoy.
  `week` es un entero ≥ 1, sin relación con ninguna convención de día de la
  semana — es "semana 1, 2, 3..." desde `mesocycle_start_date`.

No hay campo de "duración del mesociclo" ni de fecha de fin: la duración es
implícita en cuántas semanas tenga definidas `weekly_progression` (puede
variar por ejercicio). No hace falta más para conseguir el comportamiento
de "se congela en la última semana definida" del punto 5.

### 2. `src/lib/mesocycle.js` (nuevo, funciones puras)

```js
/**
 * Semana activa del mesociclo (1, 2, 3...) según la fecha de inicio y hoy.
 * Sin `startDate`, no hay mesociclo activo — se devuelve null, nunca 0
 * ni negativo. Una fecha de inicio futura se trata como semana 1 (el
 * mesociclo "no ha empezado" se comporta igual que "está en semana 1",
 * no hay estado intermedio nuevo que inventar).
 */
export function getCurrentMesocycleWeek(startDate, today) {
    if (!startDate) return null;
    const start = new Date(startDate);
    const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
    return Math.max(1, Math.floor(diffDays / 7) + 1);
}

/**
 * Devuelve el ejercicio con series/reps/target_weight/target_rir
 * sustituidos por los de la semana activa. Sin `weekNumber` (mesociclo no
 * activo en la rutina) o sin `weekly_progression` en el ejercicio, devuelve
 * el ejercicio sin cambios. Si `weekNumber` supera la última semana
 * definida, usa la última (congelado, decisión 5).
 */
export function applyMesocycleWeek(exercise, weekNumber) {
    const progression = exercise.weekly_progression;
    if (!weekNumber || !Array.isArray(progression) || progression.length === 0) {
        return exercise;
    }
    const sorted = [...progression].sort((a, b) => a.week - b.week);
    const entry = sorted.filter(w => w.week <= weekNumber).at(-1) || sorted[0];
    return {
        ...exercise,
        series: entry.series,
        reps: entry.reps,
        target_weight: entry.target_weight,
        target_rir: entry.target_rir,
    };
}
```

Ambas puras, sin llamar a `new Date()` internamente en `applyMesocycleWeek`
ni asumir el momento actual en `getCurrentMesocycleWeek` (se pasa `today`
como parámetro) — mismo criterio de testabilidad que
`splitRoutinesByToday`.

### 3. `DashboardView.jsx` — aplicar la semana activa en el lado cliente

En `fetchRoutines`, justo después de construir `mergedRoutines` (línea
~230), por cada rutina con `mesocycle_start_date` se calcula
`getCurrentMesocycleWeek(routine.mesocycle_start_date, new Date())` y se
mapean sus `exercises` con `applyMesocycleWeek(ex, week)`. Rutinas sin
mesociclo no cambian.

Este es el **único punto de transformación en el lado cliente**: el mismo
objeto `routine` (ya con exercises "efectivos") es el que renderizan las
tarjetas del Dashboard y el que `handleStartRoutine` pasa a
`handleStartWorkout` → `TrainingView` → `ExerciseDetailModal`. No hace
falta tocar `OtherViews.jsx` ni `ExerciseDetailModal.jsx`: ya leen
`exercise.target_weight` / `.target_rir` / `.series` / `.reps` tal cual les
llegan.

### 4. `ClientProfileView.jsx` — definir y ver el mesociclo

**Fecha de inicio**, junto a la fila de días de la semana que ya existe por
rutina asignada: un `<input type="date">` llamado "Inicio de mesociclo",
opcional. `handleSetMesocycleStart(assignmentId, dateOrNull)` — mismo patrón
optimista que `handleToggleScheduledDay`: actualiza estado local primero,
`supabase.from('routines').update({ mesocycle_start_date: dateOrNull }).eq('id', routine.id)`,
si falla revierte re-leyendo el valor real de Supabase (no un snapshot
local obsoleto — mismo fix que ya se aplicó al toggle de días).

**Badge de semana activa**: si `mesocycle_start_date` está puesto, junto al
nombre de la rutina se muestra `Semana {getCurrentMesocycleWeek(...)}` en un
badge pequeño (mismo estilo visual que otros badges ya en el archivo).

**Editor de ejercicio**: el formulario que ya existe (`editingExercise`,
con series/reps/peso/RIR/descanso/tempo/notas) gana un checkbox
"Progresión por semanas":

- **Desmarcado (por defecto)**: comportamiento idéntico al actual. Los 4
  campos (series, reps, peso, RIR) son los inputs simples de siempre.
  `handleSave` manda `weekly_progression: null`.
- **Marcado**: esos 4 campos se sustituyen por una tabla, una fila por
  semana: columnas Semana (número, autoincremental, no editable),
  Series, Reps, Peso (kg), RIR. Botón "+ Semana" añade una fila nueva al
  final con los valores copiados de la última fila (arranque rápido:
  normalmente solo cambia el peso semana a semana). Botón de borrar por
  fila (mínimo 1 fila si el checkbox está marcado). `rest_seconds`, `tempo`
  y `notes` se quedan fuera de la tabla, editables igual que siempre.
  `handleSave` manda `weekly_progression: filas`, y además rellena las
  columnas base `series`/`reps`/`target_weight`/`target_rir` con los
  valores de la fila de semana 1 — así cualquier lectura que no pase por
  `applyMesocycleWeek` (p.ej. `WorkoutDetailPanel.jsx`, ver más abajo)
  seguirá viendo un valor razonable en vez de `null`.
- Al reabrir el editor de un ejercicio que ya tiene `weekly_progression`
  con filas, el checkbox se marca solo y la tabla se rellena con esas
  filas.

**Tarjeta de ejercicio colapsada** (línea `{ex.series}×{ex.reps} ·
{peso}kg · RIRn`): se calcula la semana activa de la rutina y se muestra
`applyMesocycleWeek(ex, week)` en vez de `ex` directo — el entrenador ve el
valor efectivo de hoy, coherente con lo que ve el cliente.

## Fuera de alcance (explícito)

- `WorkoutDetailPanel.jsx` (histórico de sesiones ya cerradas): sigue
  leyendo `target_rir` base tal cual, sin pasar por `applyMesocycleWeek`.
  Es una comparación sobre logs pasados, no una vista en vivo — no se toca.
- `RoutineAssignerView.jsx`: no gana ningún control de mesociclo al crear
  una rutina. Se define después, una vez asignada, en `ClientProfileView`.
- %1RM real, o cualquier cosa que dependa de un 1RM guardado — no existe en
  el modelo de datos (es alcance de v3, plate calculator / 1RM + PR alerts,
  sin construir).
- Notificación o aviso visual de "mesociclo terminado" más allá del propio
  badge de semana (que simplemente deja de subir cuando se congela) — no
  pedido, no se construye.
- Edición masiva de progresión (copiar la tabla de un ejercicio a otro,
  plantillas de progresión reutilizables) — no pedido.

## Testing

`src/lib/mesocycle.test.js` (nuevo):

- `getCurrentMesocycleWeek`: sin `startDate` → `null`; el mismo día de
  inicio → semana 1; a los 7 días → semana 2; a los 13 días → semana 2; a
  los 14 → semana 3; fecha de inicio futura → semana 1 (nunca negativa ni
  cero).
- `applyMesocycleWeek`: sin `weekNumber` → ejercicio sin cambios; sin
  `weekly_progression` (`null` o `[]`) → ejercicio sin cambios; semana
  dentro de rango → valores de esa semana exacta; semana mayor que la
  última definida → valores de la última (congelado); entradas desordenadas
  en el array → se ordenan antes de buscar, mismo resultado.

Sin test para los handlers de Supabase (`handleSetMesocycleStart`, el
`handleSave` extendido) ni para el render de la tabla de semanas — mismo
criterio que el resto de wrappers finos y JSX de este archivo, verificación
manual en navegador.
