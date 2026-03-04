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

export function saveCompletedRoutines(routines) {
    const expiration = getNextSaturdayExpiration();
    const payload = {
        routines: routines,
        expiration: expiration
    };
    localStorage.setItem('gymTrackerCompletedRoutines', JSON.stringify(payload));
}

export function loadCompletedRoutines() {
    const data = localStorage.getItem('gymTrackerCompletedRoutines');
    if (!data) return [];

    try {
        const parsed = JSON.parse(data);
        const now = new Date().getTime();

        // Si ya ha pasado la fecha de expiración (sábado noche), reseteamos
        if (now > parsed.expiration) {
            localStorage.removeItem('gymTrackerCompletedRoutines');
            return [];
        }

        return parsed.routines || [];
    } catch (e) {
        console.error("Error parsing completed routines:", e);
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
