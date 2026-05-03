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
