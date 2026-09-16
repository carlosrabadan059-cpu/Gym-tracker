// v2 Fase 5: avisos proactivos de inactividad, insight semanal y entreno
// detectado sin registrar. Ver
// docs/superpowers/specs/2026-09-16-avisos-proactivos-design.md.
//
// Inactividad/insight sin datos de Health: "sincronización" se redefine
// como inactividad real de entreno (workout_logs), porque no existe ningún
// timestamp de "última lectura de Health" guardado en ningún sitio (se lee
// en vivo cada vez).

import { supabase } from './supabase';
import { computeDaysSinceLastSession, INACTIVITY_ALERT_DAYS } from './adherence';
import { getWeekStart } from './utils';
import { isHealthAvailableOnThisPlatform, getMostRecentWorkout, isStrengthWorkout, mapWorkoutToCardioType } from './appleHealth';

/**
 * ¿Toca avisar de inactividad? Una vez por racha de inactividad: si ya se
 * avisó después de la última sesión real, no se repite hasta que el
 * cliente vuelva a entrenar y se quede inactivo otra vez.
 *
 * @param {{lastSessionDate: string|Date|null, threshold?: number, lastInactivityNotificationDate?: string|Date|null}} params
 * @returns {boolean}
 */
export function shouldNotifyInactivity({ lastSessionDate, threshold = INACTIVITY_ALERT_DAYS, lastInactivityNotificationDate = null }) {
    if (!lastSessionDate) return false;
    const daysSince = computeDaysSinceLastSession([lastSessionDate]);
    if (daysSince === null || daysSince < threshold) return false;
    if (!lastInactivityNotificationDate) return true;
    return new Date(lastInactivityNotificationDate).getTime() < new Date(lastSessionDate).getTime();
}

/**
 * ¿Toca mandar el insight semanal? Una vez por semana, solo si hay algo
 * que resumir.
 *
 * @param {{sessionCountThisWeek: number, weekStart: Date, lastWeeklyInsightNotificationDate?: string|Date|null}} params
 * @returns {boolean}
 */
export function shouldNotifyWeeklyInsight({ sessionCountThisWeek, weekStart, lastWeeklyInsightNotificationDate = null }) {
    if (sessionCountThisWeek <= 0) return false;
    if (!lastWeeklyInsightNotificationDate) return true;
    return new Date(lastWeeklyInsightNotificationDate).getTime() < weekStart.getTime();
}

/**
 * ¿Toca avisar de un entreno de Health sin registrar hoy? Match por día
 * completo, no por sesión individual.
 *
 * @param {{hasRecognizedHealthWorkoutToday: boolean, hasLoggedWorkoutToday: boolean, alreadyNotifiedToday: boolean}} params
 * @returns {boolean}
 */
export function shouldNotifyUnloggedWorkout({ hasRecognizedHealthWorkoutToday, hasLoggedWorkoutToday, alreadyNotifiedToday }) {
    return hasRecognizedHealthWorkoutToday && !hasLoggedWorkoutToday && !alreadyNotifiedToday;
}

/**
 * Comprueba y, si toca, inserta el aviso de inactividad para este usuario.
 * Best-effort: nunca lanza, solo registra el error en consola.
 *
 * @param {string} userId
 */
export async function checkInactivityNotification(userId) {
    try {
        const [{ data: lastLog }, { data: lastNotif }] = await Promise.all([
            supabase.from('workout_logs').select('date').eq('user_id', userId).order('date', { ascending: false }).limit(1),
            supabase.from('notifications').select('created_at').eq('user_id', userId).eq('type', 'inactivity').order('created_at', { ascending: false }).limit(1),
        ]);

        const shouldNotify = shouldNotifyInactivity({
            lastSessionDate: lastLog?.[0]?.date ?? null,
            lastInactivityNotificationDate: lastNotif?.[0]?.created_at ?? null,
        });
        if (!shouldNotify) return;

        await supabase.from('notifications').insert([{
            user_id: userId,
            type: 'inactivity',
            title: 'Llevas unos días sin entrenar',
            message: `Han pasado ${INACTIVITY_ALERT_DAYS} días o más desde tu última sesión. ¡Vuelve cuando quieras!`,
        }]);
    } catch (err) {
        console.error('[proactiveNotifications] Error comprobando inactividad:', err);
    }
}

/**
 * Comprueba y, si toca, inserta el insight semanal para este usuario.
 * Best-effort: nunca lanza, solo registra el error en consola.
 *
 * @param {string} userId
 */
export async function checkWeeklyInsightNotification(userId) {
    try {
        const weekStart = getWeekStart(new Date());
        const [{ count: sessionCountThisWeek }, { data: lastNotif }] = await Promise.all([
            supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('date', weekStart.toISOString()),
            supabase.from('notifications').select('created_at').eq('user_id', userId).eq('type', 'weekly_insight').order('created_at', { ascending: false }).limit(1),
        ]);

        const shouldNotify = shouldNotifyWeeklyInsight({
            sessionCountThisWeek: sessionCountThisWeek ?? 0,
            weekStart,
            lastWeeklyInsightNotificationDate: lastNotif?.[0]?.created_at ?? null,
        });
        if (!shouldNotify) return;

        const label = sessionCountThisWeek === 1 ? 'entreno' : 'entrenos';
        await supabase.from('notifications').insert([{
            user_id: userId,
            type: 'weekly_insight',
            title: 'Resumen de tu semana',
            message: `Esta semana: ${sessionCountThisWeek} ${label}. ¡Sigue así!`,
        }]);
    } catch (err) {
        console.error('[proactiveNotifications] Error comprobando insight semanal:', err);
    }
}

/**
 * Comprueba y, si toca, inserta el aviso de entreno de Health sin
 * registrar hoy. No-op fuera de la app nativa (sin acceso a HealthKit).
 * Best-effort: nunca lanza, solo registra el error en consola.
 *
 * @param {string} userId
 */
export async function checkUnloggedWorkoutNotification(userId) {
    if (!isHealthAvailableOnThisPlatform()) return;
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const minutesSinceTodayStart = Math.ceil((Date.now() - todayStart.getTime()) / 60_000);

        const [workout, { count: loggedCountToday }, { data: lastNotif }] = await Promise.all([
            getMostRecentWorkout({ sinceMinutesAgo: minutesSinceTodayStart }),
            supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('date', todayStart.toISOString()),
            supabase.from('notifications').select('created_at').eq('user_id', userId).eq('type', 'unlogged_workout').order('created_at', { ascending: false }).limit(1),
        ]);

        const cardioType = mapWorkoutToCardioType(workout);
        const isRecognized = isStrengthWorkout(workout) || cardioType !== null;

        const shouldNotify = shouldNotifyUnloggedWorkout({
            hasRecognizedHealthWorkoutToday: isRecognized,
            hasLoggedWorkoutToday: (loggedCountToday ?? 0) > 0,
            alreadyNotifiedToday: new Date(lastNotif?.[0]?.created_at ?? 0).getTime() >= todayStart.getTime(),
        });
        if (!shouldNotify) return;

        const duration = Math.max(1, Math.round(workout.duration / 60));
        const label = isStrengthWorkout(workout) ? 'fuerza' : cardioType;
        await supabase.from('notifications').insert([{
            user_id: userId,
            type: 'unlogged_workout',
            title: 'Entreno detectado sin registrar',
            message: `Detectamos ${duration} min de ${label} sin registrar en Rutinex, ¿lo añades?`,
        }]);
    } catch (err) {
        console.error('[proactiveNotifications] Error comprobando entreno sin registrar:', err);
    }
}
