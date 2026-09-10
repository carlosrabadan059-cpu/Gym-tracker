import { Clock, Flame } from 'lucide-react';

function formatRelativeDate(isoDate) {
    if (!isoDate) return '';
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'hoy';
    if (diffDays === 1) return 'hace 1 día';
    return `hace ${diffDays} días`;
}

/**
 * Tarjeta de "última sesión": duración + kcal de la última vez que se
 * completó una rutina, hasta que se vuelva a hacer. Usada en el Dashboard
 * (bajo cada rutina) y en la ficha del entrenamiento (antes/durante de
 * hacerlo), mismo aspecto en los dos sitios.
 */
export function LastSessionCard({ summary }) {
    if (!summary) return null;

    return (
        <div className="w-full bg-background rounded-xl border border-surface-highlight px-3 py-2 flex items-center justify-center flex-wrap gap-x-4 gap-y-1">
            <span className="text-[11px] text-text-secondary">
                Última vez · {formatRelativeDate(summary.date)}
            </span>
            <span className="flex items-center gap-1 text-sm font-bold text-text-primary">
                <Clock size={13} className="text-text-secondary" />
                {summary.durationMinutes} min
            </span>
            {summary.totalCalories != null && (
                <span className="flex items-center gap-1 text-sm font-bold text-text-primary">
                    <Flame size={13} className="text-primary" />
                    {summary.totalCalories} kcal
                    {summary.caloriesSource === 'health' && (
                        <span className="text-[9px] font-bold text-primary uppercase tracking-wide bg-primary/10 rounded-full px-1.5 py-0.5">
                            Watch
                        </span>
                    )}
                </span>
            )}
        </div>
    );
}
