// FC en vivo durante el descanso (v2 Fase 5). Ver
// docs/superpowers/specs/2026-09-16-fc-en-vivo-design.md.
//
// Lógica pura, sin imports nativos: la llamada a HealthKit vive en
// appleHealth.js (getLiveHeartRate) y aquí solo se decide qué muestra vale.

// El Watch escribe FC cada ~5s SI hay un entreno arrancado en él; puesto
// pero sin entreno, cada 5-10 min. 90s separa limpiamente los dos casos y
// deja margen para un hueco puntual.
export const LIVE_HR_MAX_AGE_MS = 90_000;

/**
 * Muestra de pulso más reciente, siempre que sea lo bastante fresca para
 * leerse como "ahora mismo". Devuelve null si no hay ninguna utilizable —
 * ese null es el que la UI pinta como estado apagado.
 *
 * No asume que el plugin devuelva las muestras ordenadas.
 */
export function pickLiveHeartRate(samples, { now = Date.now(), maxAgeMs = LIVE_HR_MAX_AGE_MS } = {}) {
    if (!Array.isArray(samples)) return null;

    let latest = null;
    let latestTime = -Infinity;

    for (const sample of samples) {
        const time = new Date(sample?.startDate).getTime();
        if (Number.isNaN(time) || time <= latestTime) continue;
        latest = sample;
        latestTime = time;
    }

    if (latest?.value == null) return null;
    // Justo en el umbral cuenta como fresca.
    if (now - latestTime > maxAgeMs) return null;

    return { bpm: Math.round(latest.value), sampledAt: latestTime };
}
