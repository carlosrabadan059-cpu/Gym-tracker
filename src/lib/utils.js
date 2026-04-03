import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "./supabase";

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Helper para obtener el próximo sábado a las 23:59:59 (como límite de la semana)
// Si hoy es sábado, el límite es hoy mismo a esa hora.
export function getNextSaturdayExpiration() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysUntilSaturday = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;

    // Si hoy es domingo (0), quedan 6 días.
    const expirationDate = new Date(now);
    expirationDate.setDate(now.getDate() + daysUntilSaturday);
    expirationDate.setHours(23, 59, 59, 999);

    return expirationDate.getTime();
}

export async function loadCompletedRoutines(userId) {
    if (!userId) return [];

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    try {
        const { data, error } = await supabase
            .from('workout_logs')
            .select('routine_id')
            .eq('user_id', userId)
            .gte('date', startOfWeek.toISOString());

        if (error) throw error;

        return [...new Set(data.map(row => row.routine_id))];
    } catch (e) {
        console.error("Error loading completed routines from Supabase:", e);
        return [];
    }
}

// SUPABASE MIGRATION: Guardar registros en la nube (elimina el guardado local del entrenamiento en sí)
export async function saveWorkoutLog(userId, routineId, logs) {
    if (!userId) {
        console.error("Cannot save log: Missing user ID");
        return;
    }

    try {
        // En lugar de buscar en un array larguísimo, preguntamos si hay uno de hoy
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: existingLogs, error: searchError } = await supabase
            .from('workout_logs')
            .select('id')
            .eq('user_id', userId)
            .eq('routine_id', routineId)
            .gte('date', todayStart.toISOString());

        if (searchError) throw searchError;

        if (existingLogs && existingLogs.length > 0) {
            // Sobrescribir el de hoy
            const { error: updateError } = await supabase
                .from('workout_logs')
                .update({ logs: logs, date: new Date().toISOString() })
                .eq('id', existingLogs[0].id);

            if (updateError) throw updateError;
        } else {
            // Crear uno nuevo
            const { error: insertError } = await supabase
                .from('workout_logs')
                .insert([{
                    user_id: userId,
                    routine_id: routineId,
                    logs: logs
                }]);

            if (insertError) throw insertError;
        }
    } catch (e) {
        console.error("Error saving workout log to Supabase:", e);
    }
}

export async function loadWorkoutLogs(userId) {
    if (!userId) return [];

    try {
        const { data, error } = await supabase
            .from('workout_logs')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: true }); // Ordenados por fecha

        if (error) throw error;

        // Adapt format back to expected local history format slightly
        return data.map(row => ({
            id: row.id,
            routineId: row.routine_id,
            date: row.date,
            logs: row.logs
        }));
    } catch (e) {
        console.error("Error loading workout logs from Supabase:", e);
        return [];
    }
}

/**
 * Carga el último log registrado de un ejercicio específico dentro de una rutina,
 * excluyendo el entrenamiento de hoy para que sirva como referencia histórica.
 *
 * @param {string} userId
 * @param {string} routineId - La rutina donde buscar (ej: 'day1')
 * @param {string} exerciseId - El ID del ejercicio a buscar
 * @returns {{ setsData: object, date: string } | null}
 */
export async function loadLastExerciseLog(userId, routineId, exerciseId) {
    if (!userId || !routineId || !exerciseId) return null;

    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
            .from('workout_logs')
            .select('logs, date')
            .eq('user_id', userId)
            .eq('routine_id', routineId)
            .lt('date', todayStart.toISOString()) // Excluir el de hoy
            .order('date', { ascending: false })
            .limit(1);

        if (error) throw error;
        if (!data || data.length === 0) return null;

        const lastLog = data[0];
        const exerciseLog = lastLog.logs?.[exerciseId];

        if (!exerciseLog) return null;

        return {
            setsData: exerciseLog.setsData || {},
            date: lastLog.date,
        };
    } catch (e) {
        console.error("Error loading last exercise log from Supabase:", e);
        return null;
    }
}

/**
 * Fallback global: busca el último log de un ejercicio por NOMBRE en TODAS las rutinas.
 * Se usa cuando el usuario cambia de rutina y el ejercicio tiene un ID nuevo.
 *
 * @param {string} userId
 * @param {string} exerciseName - Nombre exacto del ejercicio
 * @param {string} [excludeRoutineId] - Rutina actual (para marcar si viene de otra)
 * @returns {{ setsData, date, routineId, fromOtherRoutine } | null}
 */
export async function loadLastExerciseLogGlobal(userId, exerciseName, excludeRoutineId) {
    if (!userId || !exerciseName) return null;

    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // 1. Obtener todos los IDs de ejercicios con ese nombre (case-insensitive)
        const { data: exercises, error: exError } = await supabase
            .from('exercises')
            .select('id, routine_id')
            .ilike('name', exerciseName);

        if (exError || !exercises || exercises.length === 0) return null;

        const exerciseIds = exercises.map(ex => String(ex.id));

        // 2. Cargar logs recientes ordenados por fecha DESC
        const { data: logs, error: logsError } = await supabase
            .from('workout_logs')
            .select('logs, date, routine_id')
            .eq('user_id', userId)
            .lt('date', todayStart.toISOString())
            .order('date', { ascending: false })
            .limit(100);

        if (logsError || !logs) return null;

        // 3. Devolver el primer log que contenga alguno de esos IDs
        for (const log of logs) {
            for (const exId of exerciseIds) {
                if (log.logs?.[exId]) {
                    const exerciseLog = log.logs[exId];
                    return {
                        setsData: exerciseLog.setsData || {},
                        date: log.date,
                        routineId: log.routine_id,
                        fromOtherRoutine: log.routine_id !== excludeRoutineId,
                    };
                }
            }
        }
        return null;
    } catch (e) {
        console.error('Error loading global last exercise log:', e);
        return null;
    }
}

/**
 * Devuelve el historial completo de un ejercicio buscando por nombre en todos los logs.
 * Usado por la sección "Historial de Ejercicios" en Estadísticas.
 *
 * @param {string} userId
 * @param {string} exerciseName
 * @returns {Array<{ date, routineId, setsData }>} Ordenado de más reciente a más antiguo
 */
export async function loadExerciseHistory(userId, exerciseName) {
    if (!userId || !exerciseName) return [];

    try {
        // 1. IDs de todos los ejercicios con ese nombre
        const { data: exercises, error: exError } = await supabase
            .from('exercises')
            .select('id')
            .ilike('name', exerciseName);

        if (exError || !exercises || exercises.length === 0) return [];

        const exerciseIds = exercises.map(ex => String(ex.id));

        // 2. Todos los logs del usuario, más recientes primero
        const { data: logs, error: logsError } = await supabase
            .from('workout_logs')
            .select('logs, date, routine_id')
            .eq('user_id', userId)
            .order('date', { ascending: false });

        if (logsError || !logs) return [];

        // 3. Una entrada por sesión
        const history = [];
        for (const log of logs) {
            for (const exId of exerciseIds) {
                if (log.logs?.[exId]) {
                    history.push({
                        date: log.date,
                        routineId: log.routine_id,
                        setsData: log.logs[exId].setsData || {},
                    });
                    break;
                }
            }
        }
        return history;
    } catch (e) {
        console.error('Error loading exercise history:', e);
        return [];
    }
}
