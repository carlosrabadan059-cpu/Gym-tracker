// Sugerencia de peso para la próxima sesión de un ejercicio.
// Heurística local, determinista, sin backend ni IA — v3 Fase A, 4º quick
// win (docs/plan-gym-app-features.md). Si algún día se queda corta, la
// versión con IA (workflow n8n) es la evolución natural.
//
// Regla:
//   - Todas las series de la última vez cerradas y (si hay RPE) ninguna
//     ≥ 9  → subir peso un incremento.
//   - Alguna serie con RPE ≥ 9, o reps por debajo del objetivo → mantener.
//   - Sin datos de la última vez → no se sugiere nada.
// En pirámides ("12-10-8-6") la regla se aplica serie a serie: ver
// suggestSetWeights.

import { parseRepScheme } from './repScheme';

/** Incremento de peso sugerido según el peso actual (kg). */
function weightStep(weight) {
    if (weight >= 20) return 2.5;   // barra: disco de 1,25 por lado
    return 1;                        // mancuernas ligeras
}

/** Tope superior del rango de reps del ejercicio ("8-10" → 10, "12" → 12). */
function repTarget(exerciseReps) {
    if (!exerciseReps) return null;
    const nums = String(exerciseReps).match(/\d+/g);
    if (!nums) return null;
    return Math.max(...nums.map(Number));
}

/**
 * De un array de series {weight, reps, rpe}, filtra las válidas (peso y
 * reps > 0) y devuelve las que se hicieron al peso más alto de la sesión —
 * el "peso de trabajo" real, con su rango de reps y el RPE más alto
 * registrado entre ellas.
 * @param {Array<{weight: number, reps: number, rpe: number|null}>} sets
 * @returns {{ topWeight: number, topSets: Array, minReps: number, maxRpe: number } | null}
 */
export function pickTopWeightSets(sets) {
    const valid = sets.filter(s => s.weight > 0 && s.reps > 0);
    if (valid.length === 0) return null;
    const topWeight = Math.max(...valid.map(s => s.weight));
    const topSets = valid.filter(s => s.weight === topWeight);
    const minReps = Math.min(...topSets.map(s => s.reps));
    const maxRpe = topSets.reduce((m, s) => (s.rpe != null && s.rpe > m ? s.rpe : m), 0);
    return { topWeight, topSets, minReps, maxRpe };
}

/**
 * @param {{ setsData: object } | null} lastLog  última sesión del ejercicio
 * @param {string|number} exerciseReps           objetivo de reps ("8-10")
 * @returns {{ weight: number, reps: number, reason: string } | null}
 */
export function suggestNextWeight(lastLog, exerciseReps) {
    if (!lastLog?.setsData) return null;

    const sets = Object.values(lastLog.setsData)
        .map(s => ({
            weight: parseFloat(s.weight),
            reps: parseInt(s.reps, 10),
            rpe: s.rpe != null ? Number(s.rpe) : null,
        }));

    // Peso de trabajo = el más alto que se movió esa sesión.
    const picked = pickTopWeightSets(sets);
    if (!picked) return null;
    const { topWeight, minReps, maxRpe } = picked;

    const target = repTarget(exerciseReps);
    const hitReps = target == null || minReps >= target;
    const tooHard = maxRpe >= 9;

    if (hitReps && !tooHard) {
        const step = weightStep(topWeight);
        return {
            weight: Math.round((topWeight + step) * 100) / 100,
            reps: target ?? minReps,
            reason: maxRpe
                ? `La última vez cerraste ${minReps} reps con RPE ${maxRpe} — toca subir`
                : `La última vez cerraste ${minReps} reps sin apuros — toca subir`,
        };
    }

    return {
        weight: topWeight,
        reps: target ?? minReps,
        reason: tooHard
            ? `La última vez acabaste con RPE ${maxRpe} — repite peso y consolida`
            : `La última vez te quedaste en ${minReps} reps — repite peso hasta llegar a ${target}`,
    };
}

/**
 * Sugerencia serie a serie para una pirámide ("12-10-8-6"). Cada serie se
 * compara con la misma serie de la última sesión: sube un incremento si
 * llegó a sus reps objetivo sin RPE ≥ 9; si no, repite peso.
 *
 * @param {{ setsData: object } | null} lastLog
 * @param {string} reps     reps del ejercicio ("12-10-8-6")
 * @param {number|string} series
 * @returns {Array<{ weight: number, up: boolean, last: { weight: number, reps: number, rpe: number|null } } | null>}
 *          una entrada por serie; null si esa serie no tiene datos la última vez
 */
export function suggestSetWeights(lastLog, reps, series) {
    const last = lastLog?.setsData || {};
    return parseRepScheme(reps, series).map((target, i) => {
        const set = last[i];
        const weight = parseFloat(set?.weight);
        const done = parseInt(set?.reps, 10);
        if (!(weight > 0) || !(done > 0)) return null;
        const rpe = set?.rpe != null ? Number(set.rpe) : null;
        const up = done >= target && (rpe == null || rpe < 9);
        return {
            weight: up ? Math.round((weight + weightStep(weight)) * 100) / 100 : weight,
            up,
            last: { weight, reps: done, rpe },
        };
    });
}

/**
 * Pesos con los que arranca cada serie al abrir un ejercicio. Prioridad: el
 * objetivo del entrenador (`target_weight`); si no hay, el peso de la misma
 * serie la última vez; si esa serie no existía, el de la última serie
 * registrada. Sin ninguno, cadena vacía. No aplica la sugerencia de subida.
 *
 * @param {{ target_weight?: number|string|null, series?: number|string, reps?: string }} exercise
 * @param {{ setsData: object } | null} lastLog
 * @returns {string[]} un peso por serie ('' si no hay)
 */
export function prefillWeights(exercise, lastLog) {
    const count = parseInt(exercise.series, 10) || 3;
    const coach = exercise.target_weight != null ? String(exercise.target_weight) : '';
    const last = lastLog?.setsData || {};
    const weightOf = (i) => (parseFloat(last[i]?.weight) > 0 ? String(last[i].weight) : '');
    const recorded = Object.keys(last).map(Number).sort((a, b) => a - b).map(weightOf).filter(Boolean);
    const fallback = recorded[recorded.length - 1] || '';
    return Array.from({ length: count }, (_, i) => coach || weightOf(i) || fallback);
}
