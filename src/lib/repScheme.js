// src/lib/repScheme.js
// Repeticiones por serie (pirámides). Ver
// docs/superpowers/specs/2026-10-08-reps-por-serie-design.md.
//
// `reps` sigue siendo texto en la base de datos: "8" son reps fijas y
// "12-10-8-6" una pirámide. Todo lo que lee o escribe reps pasa por aquí,
// para no volver a convertir una pirámide en un número por el camino.

const DEFAULT_REPS = 10;

/**
 * Reps de cada serie. "8" con 4 series → [8, 8, 8, 8]; "12-10-8-6" con 4 →
 * [12, 10, 8, 6]. Una pirámide más corta que las series repite la última
 * cifra; una más larga se recorta.
 */
export function parseRepScheme(reps, series) {
    const nums = String(reps ?? '').split('-').map((n) => parseInt(n, 10)).filter((n) => n > 0);
    const base = nums.length ? nums : [DEFAULT_REPS];
    const count = Math.max(1, parseInt(series, 10) || base.length);
    return Array.from({ length: count }, (_, i) => base[Math.min(i, base.length - 1)]);
}

/** De vuelta a texto: "8" si todas son iguales, "12-10-8-6" si no. */
export function formatRepScheme(perSet) {
    return perSet.every((n) => n === perSet[0]) ? String(perSet[0]) : perSet.join('-');
}

/** ¿Es una pirámide (más de una cifra distinta)? */
export function isPyramid(reps) {
    const nums = String(reps ?? '').split('-').map((n) => parseInt(n, 10)).filter((n) => n > 0);
    return nums.length > 1 && nums.some((n) => n !== nums[0]);
}

/** Reps objetivo de la serie `index` (0, 1, 2...). */
export function repsForSet(reps, index) {
    return parseRepScheme(reps, index + 1)[index];
}

/**
 * ¿Está en modo "reps por serie"? En el editor, una pirámide con todas las
 * cifras iguales ("8-8-8-8") sigue en ese modo hasta guardar, para que el
 * interruptor no se apague solo; al guardar, normalizeReps la deja en "8".
 */
export const isPerSet = (reps) => String(reps ?? '').includes('-');

/** Ajusta una pirámide al nuevo número de series; las reps fijas no cambian. */
export function resizeReps(reps, series) {
    return isPerSet(reps) ? parseRepScheme(reps, series).join('-') : reps;
}

/** Texto final para guardar: "8" o "12-10-8-6", con tantas cifras como series. */
export function normalizeReps(reps, series) {
    return isPerSet(reps) ? formatRepScheme(parseRepScheme(reps, series)) : String(reps ?? DEFAULT_REPS);
}
