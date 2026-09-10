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
        }))
        .filter(s => s.weight > 0 && s.reps > 0);

    if (sets.length === 0) return null;

    // Peso de trabajo = el más alto que se movió esa sesión.
    const topWeight = Math.max(...sets.map(s => s.weight));
    const topSets = sets.filter(s => s.weight === topWeight);

    const target = repTarget(exerciseReps);
    const minReps = Math.min(...topSets.map(s => s.reps));
    const hitReps = target == null || minReps >= target;

    const maxRpe = topSets.reduce((m, s) => (s.rpe != null && s.rpe > m ? s.rpe : m), 0);
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
