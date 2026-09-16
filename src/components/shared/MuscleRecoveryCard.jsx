import { HeartPulse } from 'lucide-react';

// Mapa de recuperación muscular (v3 Fase C2). Responde a "qué tengo
// descansado hoy", así que enseña los 8 grupos siempre — el valor está justo
// en ver los que no has tocado. Sin estado ni acceso a Supabase: recibe el
// array ya calculado por computeMuscleRecovery.

const STATE_STYLES = {
    fresco: { bar: 'bg-primary', label: 'Fresco' },
    parcial: { bar: 'bg-orange-400', label: 'A medias' },
    fatigado: { bar: 'bg-red-500', label: 'Fatigado' },
};

export function MuscleRecoveryCard({ data }) {
    if (!data || data.length === 0) return null;

    return (
        <div className="bg-surface rounded-2xl p-4 border border-surface-highlight">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-text-primary flex items-center gap-2">
                    <HeartPulse size={16} className="text-primary" /> Recuperación muscular
                </h3>
                <span className="text-[11px] text-text-secondary">estimada</span>
            </div>

            <div className="space-y-2">
                {data.map(({ category, recovery, state }) => (
                    <div key={category} className="flex items-center gap-2.5">
                        <span className="w-16 flex-shrink-0 text-[11px] text-text-secondary">{category}</span>
                        <div className="flex-1 h-2 rounded-full bg-surface-highlight overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${STATE_STYLES[state].bar}`}
                                style={{ width: `${recovery}%` }}
                            />
                        </div>
                        <span className="w-9 flex-shrink-0 text-right text-[11px] font-mono text-text-primary">
                            {recovery}%
                        </span>
                    </div>
                ))}
            </div>

            <p className="text-[10px] text-text-secondary mt-3">
                Estimación a partir de tus series de los últimos días. Informa, no manda.
            </p>
        </div>
    );
}
