// 1RM estimado y RIR real aproximado. Puro cliente, sin backend.
// v3 Fase A (docs/plan-gym-app-features.md). El desglose de discos por lado
// que vivía aquí (platesPerSide/formatPlates) se quitó (Fase 4, 2026-09-12):
// asumía siempre barra olímpica de 20kg cargada por los dos lados, lo cual
// es incorrecto para máquinas de palanca/T-bar, poleas y prensas — y el
// catálogo de ejercicios no tiene ningún dato fiable para distinguir barra
// libre del resto (ver docs/superpowers/specs/2026-09-12-quitar-desglose-discos-design.md).

/**
 * 1RM estimado por la fórmula de Epley: peso × (1 + reps/30).
 * Redondeado a 1 decimal. null si falta peso o reps, o si son <= 0.
 */
export function estimate1RM(weight, reps) {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (!w || !r || w <= 0 || r <= 0) return null;
    return Math.round(w * (1 + r / 30) * 10) / 10;
}

/** Opciones de RPE (esfuerzo percibido, 1-10) que se ofrecen tras la serie. */
export const RPE_OPTIONS = [6, 7, 8, 9, 10];

/**
 * RIR (repeticiones en reserva) aproximado a partir del RPE marcado por el
 * cliente tras una serie. Conversión estándar RIR = 10 - RPE — aproximada
 * a propósito (el RPE es una sensación, no una cuenta exacta de reps
 * restantes), de ahí el "≈" con que se presenta en la UI. null si no hay
 * rpe (es un dato opcional, el cliente puede no haberlo marcado).
 */
export function rirFromRpe(rpe) {
    if (rpe == null) return null;
    return 10 - rpe;
}
