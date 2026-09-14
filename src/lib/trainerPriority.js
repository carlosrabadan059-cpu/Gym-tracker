// src/lib/trainerPriority.js
// Fase 5 (parte 1) del plan de entrenador: dashboard priorizado. Ver
// docs/superpowers/specs/2026-09-15-dashboard-entrenador-design.md.

import { INACTIVITY_ALERT_DAYS } from './adherence';

/**
 * Categoriza a un cliente para el dashboard del entrenador. Puro: todas las
 * señales se pasan ya calculadas (no hace fetch, no llama a `new Date()`).
 *
 * @param {object} signals
 * @param {number|null} signals.daysSinceLastSession - de computeDaysSinceLastSession
 * @param {number} signals.streak - de computeStreak
 * @param {boolean} signals.hasRoutineScheduledToday - alguna rutina asignada
 *   tiene scheduled_days que incluye el día de hoy
 * @param {boolean} signals.trainedToday - hay al menos un workout_log de hoy
 *   para este cliente (cualquier rutina)
 * @returns {'attention'|'progressing'|'neutral'}
 */
export function categorizeClient({ daysSinceLastSession, streak, hasRoutineScheduledToday, trainedToday }) {
    const isInactive = daysSinceLastSession === null || daysSinceLastSession >= INACTIVITY_ALERT_DAYS;
    const missedToday = hasRoutineScheduledToday && !trainedToday;
    if (isInactive || missedToday) return 'attention';
    if (streak > 0) return 'progressing';
    return 'neutral';
}
