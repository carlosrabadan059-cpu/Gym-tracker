// Fase 3 (parte 1) del plan de entrenador: calendario semanal. Ver
// docs/plan-trainer-improvements.md y
// docs/superpowers/specs/2026-09-15-calendario-semanal-design.md.

/**
 * Días de la semana para el selector de UI, en el orden natural en español
 * (L-M-X-J-V-S-D), con el `value` que usa internamente `scheduled_days`
 * (igual que Date.prototype.getDay(): 0 = domingo ... 6 = sábado).
 */
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
 * Una rutina sin `scheduledDays` (null, undefined o array vacío) nunca
 * "toca hoy" — se trata como sin programar, no como "todos los días".
 *
 * @param {number[]|null|undefined} scheduledDays
 * @param {number} dayOfWeek
 * @returns {boolean}
 */
export function isRoutineScheduledForDay(scheduledDays, dayOfWeek) {
    return Array.isArray(scheduledDays) && scheduledDays.includes(dayOfWeek);
}

/**
 * Separa una lista de rutinas en las de hoy y el resto, para el Dashboard.
 * `todayDayOfWeek` se pasa como parámetro (no se llama a `new Date()` dentro)
 * para que la función sea pura y testeable con cualquier día fijo.
 *
 * @param {Array<{scheduled_days?: number[]|null}>} routines
 * @param {number} todayDayOfWeek
 * @returns {{ today: Array, rest: Array }}
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
