const MUSCLE_GROUP_ICONS = {
    'pecho': '/categories/pecho.png',
    'dorsal': '/categories/dorsal.png',
    'biceps': '/categories/biceps.png',
    'bíceps': '/categories/biceps.png',
    'triceps': '/categories/triceps.png',
    'tríceps': '/categories/triceps.png',
    'hombro': '/categories/hombro.png',
    'pierna': '/categories/pierna.png',
    'gluteo': '/categories/gluteo.png',
    'glúteo': '/categories/gluteo.png',
    'abdomen': '/categories/abdomen.png',
    'trapecio': '/categories/hombro.png' // Fallback to shoulder icon for traps
};

export const getRoutineIcon = (name) => {
    if (!name) return null;
    const lowercaseName = name.toLowerCase();
    for (const [key, url] of Object.entries(MUSCLE_GROUP_ICONS)) {
        if (lowercaseName.includes(key)) return url;
    }
    return null;
};

// Diccionario de METs por intensidad
const MET_VALUES = {
    STRENGTH_LIGHT: 3.5,
    STRENGTH_HEAVY: 6.0,
    BODYWEIGHT: 8.0,
    CARDIO: 9.0,
    DEFAULT: 4.5
};

/**
 * Calcula las calorías quemadas basándose en el tiempo.
 */
export const calculateCaloriesByTime = (metValue, userWeightKg, durationMinutes) => {
    if (!userWeightKg || !durationMinutes) return 0;
    return metValue * userWeightKg * (durationMinutes / 60);
};

/**
 * Calcula calorías estimadas basadas en volumen (series x repeticiones)
 * Asume ~1 minuto de esfuerzo activo por cada serie.
 */
export const calculateCaloriesByVolume = (exercise, userWeightKg) => {
    const weight = userWeightKg || 75; // Peso por defecto si no hay perfil

    // Extraer el número de series
    const numSets = parseInt(exercise.series, 10) || 0;
    if (numSets === 0) return 0;

    const nameToLower = (exercise.name || '').toLowerCase();
    let met = MET_VALUES.DEFAULT;

    // Asignación simple de METs basada en el nombre
    if (
        nameToLower.includes('sentadilla') ||
        nameToLower.includes('peso muerto') ||
        nameToLower.includes('press') ||
        nameToLower.includes('prensa') ||
        nameToLower.includes('remo')
    ) {
        met = MET_VALUES.STRENGTH_HEAVY;
    } else if (
        nameToLower.includes('flexiones') ||
        nameToLower.includes('dominadas') ||
        nameToLower.includes('fondos')
    ) {
        met = MET_VALUES.BODYWEIGHT;
    } else if (
        nameToLower.includes('cinta') ||
        nameToLower.includes('correr') ||
        nameToLower.includes('bici') ||
        nameToLower.includes('elíptica')
    ) {
        met = MET_VALUES.CARDIO;
    } else {
        // Ejercicios accesorios típicos
        met = MET_VALUES.STRENGTH_LIGHT;
    }

    // Estimar duración basada en el número de series (aprox 1 minuto de esfuerzo activo por serie)
    const estimatedActiveMinutes = numSets * 1;

    return Math.round(calculateCaloriesByTime(met, weight, estimatedActiveMinutes));
};
