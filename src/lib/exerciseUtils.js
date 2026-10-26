const BODYWEIGHT_CATALOG_IDS = [84, 85, 86, 87, 88, 89, 90, 91, 93, 94];
const TIME_BASED_CATALOG_ID = 97;

export function isBodyweightExercise(exercise) {
    if (exercise.catalog_id) {
        return BODYWEIGHT_CATALOG_IDS.includes(Number(exercise.catalog_id));
    }
    const name = (exercise.name || '').toLowerCase();
    const hasWeightKeywords =
        name.includes('máquina') || name.includes('mancuerna') ||
        name.includes('barra') || name.includes('polea') || name.includes('disco');
    return !hasWeightKeywords && (
        name.includes('abdominal') ||
        name.includes('crunch') ||
        (name.includes('elevación') && (name.includes('pierna') || name.includes('rodilla') || name.includes('pelvis'))) ||
        name.includes('encogimiento') ||
        name.includes('lumbar') ||
        name.includes('plancha')
    );
}

export function isTimeBasedExercise(exercise) {
    if (exercise.catalog_id) {
        return Number(exercise.catalog_id) === TIME_BASED_CATALOG_ID;
    }
    return (exercise.name || '').toLowerCase().includes('plancha');
}

/**
 * Buscador del catálogo: un número (con o sin "#") busca ese ejercicio
 * exacto — "1" es el #1, no todos los que contienen un 1. Cualquier otro
 * texto busca en el nombre.
 */
export function matchesCatalogSearch(exercise, search) {
    const q = String(search ?? '').toLowerCase().trim();
    if (!q) return true;
    const idQuery = q.match(/^#?\s*(\d+)$/);
    if (idQuery) return String(exercise.id) === String(Number(idQuery[1]));
    return (exercise.name || '').toLowerCase().includes(q);
}

/** Solo las series de los ejercicios de la rutina (sin workoutDuration ni cardio). */
export function pickExerciseLogs(logs, workout) {
    const ids = new Set(workout?.exercises?.map(ex => String(ex.id)) || []);
    return Object.fromEntries(Object.entries(logs || {}).filter(([id]) => ids.has(String(id))));
}

/** JSON con las claves ordenadas: dos logs iguales dan el mismo texto aunque se construyeran en otro orden. */
export function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}
