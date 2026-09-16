// Vocabulario de grupos musculares y reglas de los músculos secundarios
// (v3 Fase C1). Vive aquí, y no en TrainerLibraryView, porque lo usan
// también los scripts de etiquetado y —cuando llegue C2— el cálculo de
// recuperación.

// Los 8 grupos musculares reales que ya usa `exercise_catalog.category`.
// MUSCLE_GROUPS en TrainerLibraryView tiene dos entradas más ('Cardio',
// 'Otros') que son cajones de sastre de la UI, no músculos: un ejercicio de
// cardio no "fatiga el cardio" ni se recupera en 48h.
export const MUSCLE_VOCABULARY = [
    'Abdomen', 'Bíceps', 'Dorsal', 'Glúteo', 'Hombro', 'Pecho', 'Pierna', 'Tríceps',
];

const VOCABULARY_SET = new Set(MUSCLE_VOCABULARY);

/**
 * Deja una lista de secundarios en forma canónica: solo etiquetas del
 * vocabulario, sin duplicados, sin el grupo principal y ordenada.
 *
 * Quitar el principal no es cosmético: si un press de banca guardase
 * `category: 'Pecho'` y también `'Pecho'` como secundario, el cálculo de
 * recuperación (C2) contaría la fatiga de pecho dos veces.
 *
 * @param {string[]|null|undefined} secondary
 * @param {string} category  grupo principal del ejercicio
 * @returns {string[]}
 */
export function normalizeSecondaryMuscles(secondary, category) {
    if (!Array.isArray(secondary)) return [];

    return [...new Set(secondary)]
        .filter(muscle => VOCABULARY_SET.has(muscle) && muscle !== category)
        .sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Valida una fila del JSON de propuestas antes de escribirla en la base de
 * datos. Se usa en `scripts/apply_secondary_muscles.mjs`: una propuesta que
 * no valide se salta y se reporta, en vez de colarse a medias.
 *
 * @param {{id: number, category: string, secondary_muscles: string[]}} proposal
 * @returns {boolean}
 */
export function isValidSecondaryProposal(proposal) {
    if (!proposal || typeof proposal !== 'object') return false;
    if (typeof proposal.id !== 'number' || !Number.isFinite(proposal.id)) return false;
    if (!VOCABULARY_SET.has(proposal.category)) return false;
    if (!Array.isArray(proposal.secondary_muscles)) return false;

    return proposal.secondary_muscles.every(
        muscle => VOCABULARY_SET.has(muscle) && muscle !== proposal.category
    );
}
