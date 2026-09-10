// Cálculo de discos por lado y 1RM estimado. Puro cliente, sin backend.
// v3 Fase A (docs/plan-gym-app-features.md). Prototipado en la rama
// prototype/logging-ui (variante A, "inline mínimo").

/** Peso de la barra olímpica estándar. */
export const BAR_KG = 20;

/** Discos disponibles por lado, de mayor a menor (kg). */
export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

/**
 * Discos a poner POR LADO para alcanzar un peso total con la barra estándar.
 * Devuelve un array de kg (p.ej. [20, 20, 2.5]) o null si el peso no es
 * alcanzable exactamente con los discos disponibles (o es menor que la barra).
 */
export function platesPerSide(total) {
    if (!total || total < BAR_KG) return null;
    let perSide = (total - BAR_KG) / 2;
    const out = [];
    for (const p of PLATES) {
        while (perSide >= p - 0.001) {
            out.push(p);
            perSide = Math.round((perSide - p) * 100) / 100;
        }
    }
    return perSide > 0.01 ? null : out;
}

/** "2×20 + 1×2,5" a partir de [20, 20, 2.5]. '' si el array está vacío. */
export function formatPlates(plates) {
    if (!plates || !plates.length) return '';
    const counts = plates.reduce((acc, p) => ({ ...acc, [p]: (acc[p] || 0) + 1 }), {});
    return Object.entries(counts)
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .map(([p, n]) => `${n}×${String(p).replace('.', ',')}`)
        .join(' + ');
}

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
