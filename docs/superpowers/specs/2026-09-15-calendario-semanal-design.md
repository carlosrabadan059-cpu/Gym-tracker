# Fase 3 (parte 1) — Calendario semanal: qué rutina toca cada día

**Fecha:** 2026-09-15
**Alcance:** `docs/plan-trainer-improvements.md`, Fase 3, primer punto ("Calendario
semanal: qué rutina toca cada día. Hoy las rutinas son 'Día 1-4' sin fecha ni
orden temporal real"). Los otros dos puntos de la Fase 3 (progresión programada
por semanas, mesociclo con fechas de inicio/fin) quedan **fuera de este spec**
a propósito — son una pieza separada que depende de que esta exista primero
(hace falta saber qué día toca qué rutina antes de poder decir "en la semana 2
esa rutina cambia a esto"). Se diseñarán después, en su propio spec.

## Decisiones ya tomadas (respuestas del brainstorming, no reabrir)

1. El Dashboard del cliente **destaca la rutina de hoy y sigue mostrando el
   resto debajo** — no filtra, no oculta nada. El cliente puede seguir
   adelantando o repitiendo cualquier rutina asignada, igual que hoy.
2. Una rutina puede tener **varios días de la semana asignados** (ej. "Full
   Body" en lunes/miércoles/viernes) — no un único día fijo.
3. **Solo el entrenador** asigna los días — desde las pantallas de
   entrenador, nunca desde la vista de cliente.
4. Un día sin ninguna rutina programada muestra una **card de descanso**
   arriba del todo ("Hoy toca descanso"), y el resto de rutinas asignadas
   sigue visible debajo, igual que en el caso 1.

## Arquitectura

Una columna nueva en `routines`, sin tabla aparte — se rechazó una tabla
`routine_schedule_days` (routine_id, day_of_week) por ser sobre-ingeniería
para un array de como mucho 7 valores sin datos propios por fila; el RLS que
ya protege `routines` cubre la columna nueva sin cambios.

### 1. Migración

Nueva columna nullable en `routines`:

```sql
alter table routines add column if not exists scheduled_days smallint[];
```

`smallint[]`, no `int[]` — son valores 0-6, cabe de sobra y es más barato.
`null` (no `'{}'`) significa "sin día fijo asignado" — el valor por defecto
para toda rutina existente y cualquier rutina nueva que el entrenador no
programe explícitamente. Un array vacío `{}` se trata igual que `null` en
todo el código (ver más abajo) — nunca se distingue entre los dos a
propósito, para no tener dos formas distintas de decir "sin programar".

**Convención de valores**: igual que `Date.prototype.getDay()` de JS —
`0` = domingo, `1` = lunes, … `6` = sábado. Se elige esta y no
lunes-primero-de-la-semana porque es la que ya usa `new Date().getDay()` sin
ninguna conversión, y evita añadir una tercera convención de "inicio de
semana" al proyecto — que ya tiene una inconsistencia documentada en
`CLAUDE.md` entre domingo (`loadCompletedRoutines`, `TrainingView`) y lunes
(`StatisticsView`). La UI muestra los días en el orden L-M-X-J-V-S-D (el
natural en español), pero internamente cada botón guarda el valor de
`getDay()` que le corresponde — la tabla de mapeo va en el propio componente,
sin introducir una utilidad nueva en `lib/`.

### 2. `src/lib/routineSchedule.js` (nuevo, funciones puras)

Dos funciones, testeadas con Vitest:

```js
export const WEEKDAY_LABELS = [
    { value: 1, label: 'L' },
    { value: 2, label: 'M' },
    { value: 3, label: 'X' },
    { value: 4, label: 'J' },
    { value: 5, label: 'V' },
    { value: 6, label: 'S' },
    { value: 0, label: 'D' },
];

/**
 * ¿Esta rutina está programada para el día `dayOfWeek` (0-6, getDay())?
 * Una rutina sin `scheduled_days` (null o array vacío) nunca "toca hoy" —
 * se trata como sin programar, no como "todos los días".
 */
export function isRoutineScheduledForDay(scheduledDays, dayOfWeek) {
    return Array.isArray(scheduledDays) && scheduledDays.includes(dayOfWeek);
}

/**
 * Separa una lista de rutinas en las de hoy y el resto, para el Dashboard.
 * `todayDayOfWeek` se pasa como parámetro (no se llama a `new Date()` dentro)
 * para que la función sea pura y testeable con cualquier día fijo.
 */
export function splitRoutinesByToday(routines, todayDayOfWeek) {
    const today = [];
    const rest = [];
    for (const routine of routines) {
        if (isRoutineScheduledForDay(routine.scheduled_days, todayDayOfWeek)) {
            today.push(routine);
        } else {
            rest.push(routine);
        }
    }
    return { today, rest };
}
```

### 3. `DashboardView.jsx` — destacar la rutina de hoy

En `fetchRoutines`, tras tener `mergedRoutines` ya ordenado (como hoy), se
calcula `splitRoutinesByToday(mergedRoutines, new Date().getDay())` y se
guarda en dos listas de estado (`todayRoutines`, `otherRoutines`) en vez de
una sola `routines`. El render:

- Si `todayRoutines.length > 0`: una cabecera "Hoy toca" seguida de esas
  tarjetas (mismo componente `Card` de rutina que ya existe, sin cambios de
  diseño en la tarjeta en sí), y debajo una cabecera "Resto de tus rutinas"
  con `otherRoutines`.
- Si `todayRoutines.length === 0`: una card fija de descanso ("💤 Hoy toca
  descanso" o similar, tono ligero) donde iría la sección "Hoy toca", y
  debajo "Tus rutinas" (todas, sin la palabra "resto" porque no hay nada de
  lo que sean "resto") con `otherRoutines` (que en este caso es la lista
  completa).
- Si **ninguna** rutina del cliente tiene `scheduled_days` (caso de un
  cliente cuyo entrenador no usa el calendario todavía): todas caen en
  `otherRoutines`, se muestra la card de descanso arriba igual que si hoy no
  tocara nada — comportamiento correcto por construcción, no hace falta un
  caso especial de "el entrenador no programó nada" distinto de "hoy no toca
  nada".

Pull-to-refresh y el resto de `DashboardView.jsx` no cambian.

### 4. `RoutineAssignerView.jsx` — asignar días al crear una rutina nueva

En el bloque de configuración de "Crear nueva" (nombre + selector de color,
`md:hidden p-4 space-y-3` y su gemelo del rail derecho en escritorio), se
añade una fila de 7 botones día-a-día usando `WEEKDAY_LABELS`, multi-toggle
(pulsar añade/quita ese día del array en estado local `scheduledDays`,
inicializado a `[]`). Al guardar (`handleSave`), se incluye
`scheduled_days: scheduledDays.length > 0 ? scheduledDays : null` en el
`insert` de `routines` (mismo criterio de "vacío = null" del punto 1).

**No es obligatorio elegir ningún día** — `canSave` no cambia, sigue
dependiendo solo de `routineName` y `selectedExercises.length > 0`. Una
rutina sin día es un caso válido y esperado (el "Full Body" o similar que el
cliente hace "cuando le toque", sin fijar).

### 5. `ClientProfileView.jsx` — editar los días de una rutina ya asignada

En la card de cada rutina asignada (la que ya tiene el lápiz de renombrar,
`Pencil`, junto al nombre), se añade el mismo selector de 7 días, visible
siempre (no detrás de un modo de edición) justo debajo del nombre/fecha de
asignación. Cada toggle dispara un `update` directo a `routines` (mismo
patrón que `handleToggleTemplate`, optimista: actualiza el estado local
primero, revierte si Supabase falla):

```js
const handleToggleScheduledDay = async (assignment, day) => {
    const routine = routine; // la rutina de esa asignación, ya en el estado local
    const current = routine.scheduled_days || [];
    const next = current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day].sort((a, b) => a - b);
    // ...set state optimista + supabase.from('routines').update({ scheduled_days: next.length ? next : null }).eq('id', routine.id)
    // ...revertir en el catch, mismo patrón que handleToggleTemplate
};
```

(El nombre exacto de la variable que referencia la rutina dentro del `.map`
existente se ajusta al de la implementación real al escribir el plan — el
patrón de arriba es el contrato, no el código literal a copiar.)

## Testing

- `src/lib/routineSchedule.test.js` (nuevo): `isRoutineScheduledForDay` y
  `splitRoutinesByToday`, cubriendo: día que coincide, día que no coincide,
  `scheduled_days` null, `scheduled_days` array vacío, varias rutinas
  mezcladas (algunas con día de hoy, otras sin), orden preservado dentro de
  cada grupo.
- Sin test para las migraciones ni para los `handleToggle*`/`handleSave` de
  Supabase — mismo criterio que el resto del código de este archivo (wrappers
  finos de Supabase, verificación manual en navegador).

## Fuera de alcance (explícito)

- Progresión programada por semanas y mesociclo con fechas — spec aparte,
  después de este.
- Cualquier vista de "calendario" tipo cuadrícula mensual/semanal visual —
  esto es solo "destacar la de hoy", no un calendario navegable.
- Cambiar el criterio de inicio de semana ya inconsistente en el proyecto
  (domingo vs. lunes) — no se toca, es un problema documentado y aparte.
- Notificaciones o recordatorios el día que toca una rutina — no pedido,
  no se construye.
