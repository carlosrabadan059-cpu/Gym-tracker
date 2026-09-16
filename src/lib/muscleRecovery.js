import { MUSCLE_VOCABULARY } from './muscleTaxonomy';
import { countCompletedSets } from './muscleVolume';

// Mapa de recuperación muscular (v3 Fase C2). Ver
// docs/superpowers/specs/2026-09-16-mapa-recuperacion-design.md.
//
// Todas las constantes de abajo son heurísticas, no fisiología medida: están
// aisladas y con nombre justamente para poder ajustarlas viendo datos reales
// sin tener que releer el algoritmo.

// Cuánto aporta a un músculo secundario cada serie, frente al 1.0 del
// principal. Peso único para todos los secundarios: distinguir cuánto se
// carga el hombro en un press de banca frente a un press militar exigiría un
// dato que el catálogo no tiene y que nadie mantendría a mano.
export const SECONDARY_SET_WEIGHT = 0.5;

// Series efectivas que dejan un grupo a 0% de recuperación. El número más
// discutible del modelo, y el primero que habrá que tocar.
export const FULL_FATIGUE_SETS = 12;

// Ventana de recuperación por grupo: los pequeños se recuperan antes que los
// grandes. 48h / 72h es lo que pedía el plan de la v3.
export const RECOVERY_HOURS = {
    'Abdomen': 48,
    'Bíceps': 48,
    'Hombro': 48,
    'Tríceps': 48,
    'Dorsal': 72,
    'Glúteo': 72,
    'Pecho': 72,
    'Pierna': 72,
};

const STATE_THRESHOLDS = { fresco: 70, parcial: 35 };

const NON_EXERCISE_KEYS = new Set(['cardio', 'workoutDuration']);

function stateFor(recovery) {
    if (recovery >= STATE_THRESHOLDS.fresco) return 'fresco';
    if (recovery >= STATE_THRESHOLDS.parcial) return 'parcial';
    return 'fatigado';
}

/**
 * Recuperación estimada por grupo muscular, de 0 a 100.
 *
 * Cada serie completada suma fatiga al grupo principal del ejercicio y,
 * con menos peso, a sus secundarios. Esa fatiga decae linealmente hasta
 * desaparecer al cumplirse la ventana del grupo.
 *
 * @param {Array<{date: string, logs: object}>} logs  de loadWorkoutLogs
 * @param {Record<string, {category: string, secondary_muscles: string[]}>} exerciseMuscleMap
 * @param {Date} referenceDate  normalmente ahora; explícito para poder testear
 * @returns {Array<{category: string, recovery: number, state: string, fatigue: number}>}
 *          los 8 grupos, de menos a más recuperado
 */
export function computeMuscleRecovery(logs, exerciseMuscleMap, referenceDate) {
    const fatigueByGroup = Object.fromEntries(MUSCLE_VOCABULARY.map(m => [m, 0]));
    const now = referenceDate.getTime();

    (logs || []).forEach((session) => {
        const hoursElapsed = (now - new Date(session.date).getTime()) / 3600000;
        // Las sesiones futuras (relojes desincronizados) se ignoran en vez de
        // sumar fatiga negativa.
        if (hoursElapsed < 0) return;

        Object.entries(session.logs || {}).forEach(([exerciseId, log]) => {
            if (NON_EXERCISE_KEYS.has(exerciseId)) return;

            const muscles = exerciseMuscleMap?.[exerciseId];
            if (!muscles?.category) return;

            const sets = countCompletedSets(log);
            if (sets === 0) return;

            const contributions = [
                { group: muscles.category, weight: 1 },
                ...(muscles.secondary_muscles || []).map(group => ({ group, weight: SECONDARY_SET_WEIGHT })),
            ];

            contributions.forEach(({ group, weight }) => {
                if (!(group in fatigueByGroup)) return;

                const windowHours = RECOVERY_HOURS[group];
                if (hoursElapsed >= windowHours) return;

                const remaining = 1 - hoursElapsed / windowHours;
                fatigueByGroup[group] += sets * weight * remaining;
            });
        });
    });

    return MUSCLE_VOCABULARY
        .map((category) => {
            const fatigue = fatigueByGroup[category];
            const recovery = Math.max(0, Math.round(100 - (fatigue / FULL_FATIGUE_SETS) * 100));
            return { category, recovery, state: stateFor(recovery), fatigue };
        })
        .sort((a, b) => a.recovery - b.recovery || a.category.localeCompare(b.category, 'es'));
}
