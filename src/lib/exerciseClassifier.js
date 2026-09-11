// src/lib/exerciseClassifier.js

// exercise_catalog.category ya es el grupo muscular (ver TrainerLibraryView.jsx
// MUSCLE_GROUPS). Este mapa solo traduce grupo muscular a patrón de
// movimiento para detectar huecos tipo "6 empuje, 0 tirón".
export const PATTERN_BY_CATEGORY = {
    'Pecho': 'empuje',
    'Hombro': 'empuje',
    'Tríceps': 'empuje',
    'Dorsal': 'tiron',
    'Bíceps': 'tiron',
    'Pierna': 'pierna',
    'Glúteo': 'pierna',
    'Abdomen': 'core',
    'Cardio': 'core',
};

export function patternForCategory(category) {
    return PATTERN_BY_CATEGORY[category] || 'otro';
}

// Heurística de nombre, solo para compuesto vs. aislamiento dentro de una
// misma categoría (ej. "Press banca" compuesto vs. "Aperturas" aislamiento,
// ambos Pecho). Limitación conocida: un nombre atípico puede clasificarse
// mal — no bloquea el resto del análisis, solo distorsiona ese aviso.
const ISOLATION_KEYWORDS = [
    'curl', 'extension', 'extensión', 'elevacion', 'elevación',
    'aductor', 'abductor', 'cruce', 'vuelo', 'apertura', 'contraccion', 'contracción',
    'patada', 'encogimiento',
];

export function isCompound(exerciseName) {
    const lower = String(exerciseName || '').toLowerCase();
    return !ISOLATION_KEYWORDS.some(function checkKeyword(keyword) {
        return lower.includes(keyword);
    });
}

// exercises: [{ name, category, series, reps }] en orden real (ui_order)
export function buildRoutineBreakdown(exercises) {
    const patternCounts = { empuje: 0, tiron: 0, pierna: 0, core: 0, otro: 0 };
    const items = [];

    for (const ex of exercises) {
        const pattern = patternForCategory(ex.category);
        const compound = isCompound(ex.name);
        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
        items.push({
            name: ex.name,
            category: ex.category || 'Otros',
            pattern,
            compound,
            series: ex.series,
            reps: ex.reps,
        });
    }

    let orderBroken = false;
    let sawIsolation = false;
    for (const item of items) {
        if (!item.compound) {
            sawIsolation = true;
        } else if (sawIsolation) {
            orderBroken = true;
            break;
        }
    }

    return {
        items,
        patternCounts,
        legVolume: patternCounts.pierna,
        torsoVolume: patternCounts.empuje + patternCounts.tiron,
        orderBroken,
    };
}
