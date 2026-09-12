// src/lib/adherence.js

// Nota: "hoy"/"ayer" se calculan con el reloj local de quien ve la racha
// (el entrenador), no el del cliente que entrenó. Si están en zonas
// horarias distintas, un entreno de madrugada podría contarse en el día
// "equivocado" desde el punto de vista del entrenador. Aceptado: no hay
// info de zona horaria del cliente disponible en esta capa.

// Compara por día calendario local, ignorando la hora — dos sesiones el
// mismo día (aunque a horas distintas) cuentan como un solo día para la
// racha.
function toDayKey(dateInput) {
    const d = new Date(dateInput);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function dayKeyToDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function addDays(date, delta) {
    const next = new Date(date);
    next.setDate(next.getDate() + delta);
    return next;
}

// dates: array de fechas de sesiones (string ISO o Date), pueden repetirse
// o venir desordenadas. Racha = días consecutivos con sesión, contando
// hacia atrás desde hoy o ayer. Si la última sesión es de anteayer o antes,
// la racha está "muerta" y se devuelve 0 (no se muestra una racha vieja
// como si siguiera viva).
export function computeStreak(dates) {
    const daySet = new Set((dates || []).map(toDayKey));
    if (daySet.size === 0) return 0;

    const today = new Date();
    const todayKey = toDayKey(today);
    const yesterdayKey = toDayKey(addDays(today, -1));

    let cursor;
    if (daySet.has(todayKey)) {
        cursor = dayKeyToDate(todayKey);
    } else if (daySet.has(yesterdayKey)) {
        cursor = dayKeyToDate(yesterdayKey);
    } else {
        // No hay sesión hoy ni ayer → la racha está muerta, no se cuenta.
        return 0;
    }

    let streak = 0;
    while (daySet.has(toDayKey(cursor))) {
        streak += 1;
        cursor = addDays(cursor, -1);
    }
    return streak;
}

// dates: array de fechas de sesiones (string ISO o Date).
// Devuelve días enteros desde la sesión más reciente hasta hoy, o null si
// no hay ninguna sesión.
export function computeDaysSinceLastSession(dates) {
    if (!dates || dates.length === 0) return null;

    const latestMs = dates.reduce((max, d) => {
        const t = new Date(d).getTime();
        return t > max ? t : max;
    }, -Infinity);

    const latestDay = dayKeyToDate(toDayKey(latestMs));
    const todayDay = dayKeyToDate(toDayKey(new Date()));

    const diffMs = todayDay.getTime() - latestDay.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// Umbral a partir del cual "días sin entrenar" pasa de dato informativo a
// aviso de atención (ClientsListView). Vive aquí para que cualquier vista
// futura que quiera el mismo criterio lo reuse en vez de inventar el suyo.
export const INACTIVITY_ALERT_DAYS = 7;
