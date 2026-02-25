import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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
