import { getWeekStart } from './utils';

// Ejercicios cuyo id ya no se puede resolver a una categoría del catálogo:
// rutinas borradas con el tiempo dejan ids huérfanos en workout_logs (hoy,
// 17 de los 80 ids que aparecen en el historial real). Se agrupan aparte en
// vez de descartarlos — un hueco de datos escondido es un dato falso.
export const UNCLASSIFIED_GROUP = 'Sin clasificar';

const NON_EXERCISE_KEYS = new Set(['cardio', 'workoutDuration']);

/**
 * Cuenta las series completadas de un ejercicio dentro de una sesión.
 *
 * `completedSets` es la señal buena (el usuario marcó la serie como hecha).
 * Los logs antiguos pueden no traerla; ahí se cuentan las series con reps
 * registradas, que es lo más cercano a "esto se hizo" que queda.
 *
 * Exportada para que muscleRecovery.js use exactamente esta regla: duplicarla
 * es como empezó el lío de "inicio de semana" que hubo que unificar después.
 */
export function countCompletedSets(log) {
    if (!log || typeof log !== 'object') return 0;

    if (log.completedSets && typeof log.completedSets === 'object') {
        return Object.values(log.completedSets).filter(Boolean).length;
    }

    return Object.values(log.setsData || {})
        .filter(set => (parseInt(set?.reps, 10) || 0) > 0)
        .length;
}

/**
 * Series completadas por grupo muscular en la semana (lunes a domingo) de
 * `referenceDate`. Los grupos sin series no aparecen: el gráfico muestra lo
 * entrenado, no un listado de ceros.
 *
 * @param {Array<{date: string, logs: object}>} logs  de loadWorkoutLogs
 * @param {Record<string, string>} idToCategory  id de ejercicio → categoría
 * @param {Date} referenceDate  normalmente hoy; explícito para poder testear
 * @returns {Array<{category: string, sets: number}>} de más a menos series
 */
export function computeWeeklyMuscleVolume(logs, idToCategory, referenceDate) {
    if (!logs || logs.length === 0) return [];

    const weekStart = getWeekStart(referenceDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const setsByCategory = {};

    logs.forEach((session) => {
        const sessionDate = new Date(session.date);
        if (sessionDate < weekStart || sessionDate >= weekEnd) return;

        Object.entries(session.logs || {}).forEach(([exerciseId, log]) => {
            if (NON_EXERCISE_KEYS.has(exerciseId)) return;

            const sets = countCompletedSets(log);
            if (sets === 0) return;

            const category = idToCategory?.[exerciseId] || UNCLASSIFIED_GROUP;
            setsByCategory[category] = (setsByCategory[category] || 0) + sets;
        });
    });

    return Object.entries(setsByCategory)
        .map(([category, sets]) => ({ category, sets }))
        .sort((a, b) => b.sets - a.sets);
}
