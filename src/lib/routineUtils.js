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
 * Devuelve el MET asignado a un ejercicio por nombre.
 */
const getExerciseMET = (exerciseName) => {
    const name = (exerciseName || '').toLowerCase();
    if (
        name.includes('sentadilla') ||
        name.includes('peso muerto') ||
        name.includes('press') ||
        name.includes('prensa') ||
        name.includes('remo')
    ) return MET_VALUES.STRENGTH_HEAVY;
    if (
        name.includes('flexiones') ||
        name.includes('dominadas') ||
        name.includes('fondos')
    ) return MET_VALUES.BODYWEIGHT;
    if (
        name.includes('cinta') ||
        name.includes('correr') ||
        name.includes('bici') ||
        name.includes('elíptica')
    ) return MET_VALUES.CARDIO;
    return MET_VALUES.STRENGTH_LIGHT;
};

/**
 * Calcula calorías estimadas basadas en volumen (series x repeticiones)
 * Asume ~1 minuto de esfuerzo activo por cada serie.
 */
export const calculateCaloriesByVolume = (exercise, userWeightKg) => {
    const weight = userWeightKg || 75;
    const numSets = parseInt(exercise.series, 10) || 0;
    if (numSets === 0) return 0;

    const met = getExerciseMET(exercise.name);
    const estimatedActiveMinutes = numSets * 1;
    return Math.round(calculateCaloriesByTime(met, weight, estimatedActiveMinutes));
};

/**
 * Calcula el MET promedio de un conjunto de ejercicios.
 */
export const getAverageWorkoutMET = (exercises) => {
    if (!exercises || exercises.length === 0) return MET_VALUES.DEFAULT;
    const total = exercises.reduce((sum, ex) => sum + getExerciseMET(ex.name), 0);
    return total / exercises.length;
};

/**
 * Calcula calorías reales basadas en la duración del entreno y el MET promedio
 * de los ejercicios que lo componen.
 */
export const calculateRealCalories = (exercises, userWeightKg, durationMinutes) => {
    const weight = userWeightKg || 75;
    const met = getAverageWorkoutMET(exercises);
    return Math.round(calculateCaloriesByTime(met, weight, durationMinutes));
};

export const CARDIO_TYPES = {
    'Andar': 5,            // Legacy
    'Andar en cinta': 5,
    'Correr en cinta': 10,
    'Elíptica': 8,
    'Bicicleta': 7
};

export const calculateCardioCalories = (type, minutes, userWeightKg) => {
    const weight = userWeightKg || 75;
    const calsPerMin = CARDIO_TYPES[type];
    if (!calsPerMin || !minutes) return 0;

    // calsPerMin are usually given for a standard ~75kg person, let's scale it slightly by weight
    // Basic scaling: (weight / 75) * baseCals
    const scaleFactor = weight / 75;
    return Math.round(calsPerMin * scaleFactor * minutes);
};
