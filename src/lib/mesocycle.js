// src/lib/mesocycle.js
// Fase 3 (parte 2) del plan de entrenador: mesociclo con progresión
// programada. Ver docs/superpowers/specs/2026-09-15-mesociclo-progresion-design.md.
// Funciones puras: `today` siempre se pasa como parámetro, nunca se llama
// a `new Date()` dentro, para que sean testeables con cualquier fecha fija.

/**
 * Semana activa del mesociclo (1, 2, 3...) según la fecha de inicio y hoy.
 * Sin `startDate`, no hay mesociclo activo — null, nunca 0 ni negativo.
 * Una fecha de inicio futura se trata como semana 1: no existe un estado
 * intermedio de "aún no ha empezado".
 */
export function getCurrentMesocycleWeek(startDate, today) {
    if (!startDate) return null;
    const start = new Date(startDate);
    // `today` puede traer hora local (en producción, la hora real del
    // dispositivo); normalizamos a medianoche UTC de su fecha de calendario
    // para que la diferencia en días no dependa de la hora del día ni de la
    // zona horaria del navegador.
    const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.floor((todayUTC - start.getTime()) / 86400000);
    return Math.max(1, Math.floor(diffDays / 7) + 1);
}

/**
 * Devuelve el ejercicio con series/reps/target_weight/target_rir
 * sustituidos por los de la semana activa. Sin `weekNumber` o sin
 * `weekly_progression` (null o vacío), devuelve el ejercicio sin cambios.
 * Si `weekNumber` supera la última semana definida, usa la última
 * (congelado, decisión de diseño: nunca vuelve a un estado "vacío").
 * Si `weekNumber` es anterior a la primera semana definida, no hay ninguna
 * entrada aplicable todavía: se devuelve el ejercicio sin cambios (valores
 * base), nunca proyectando hacia atrás los valores de una semana futura.
 */
export function applyMesocycleWeek(exercise, weekNumber) {
    const progression = exercise.weekly_progression;
    if (!weekNumber || !Array.isArray(progression) || progression.length === 0) {
        return exercise;
    }
    const sorted = [...progression].sort((a, b) => a.week - b.week);
    const eligible = sorted.filter(w => w.week <= weekNumber);
    if (eligible.length === 0) {
        return exercise;
    }
    const entry = eligible[eligible.length - 1];
    return {
        ...exercise,
        series: entry.series,
        reps: entry.reps,
        target_weight: entry.target_weight,
        target_rir: entry.target_rir,
    };
}

/**
 * Situación del mesociclo con duración: semana actual sobre el total, último
 * día (el último de la semana `weeks`, contando desde el de inicio) y estado:
 * 'active', 'last' (su última semana) o 'finished' (ya pasó el último día).
 * Sin fecha de inicio o sin duración, null: no hay nada que avisar.
 * Ver docs/superpowers/specs/2026-10-12-duracion-mesociclo-design.md.
 */
export function getMesocycleStatus(startDate, weeks, today) {
    if (!startDate || !weeks) return null;
    const start = new Date(startDate);
    const end = new Date(start.getTime() + (weeks * 7 - 1) * 86400000);
    const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const week = getCurrentMesocycleWeek(startDate, today);
    const state = todayUTC > end.getTime() ? 'finished' : week >= weeks ? 'last' : 'active';
    return { week: Math.min(week, weeks), total: weeks, endDate: end.toISOString().slice(0, 10), state };
}

/**
 * Aviso de mesociclo para un cliente con varias rutinas: el más urgente de
 * sus mesociclos que esté en la última semana o ya terminado (terminado
 * gana; a igualdad, el que acaba antes). null si ninguno pide atención.
 */
export function getMesocycleAlert(routines, today) {
    const rank = { finished: 0, last: 1 };
    return routines
        .map(r => getMesocycleStatus(r.mesocycle_start_date, r.mesocycle_weeks, today))
        .filter(s => s && s.state in rank)
        .sort((a, b) => rank[a.state] - rank[b.state] || a.endDate.localeCompare(b.endDate))[0] || null;
}
