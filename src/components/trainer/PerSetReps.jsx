// Interruptor "Reps por serie" y un selector por serie (pirámides).
// Ver docs/superpowers/specs/2026-10-08-reps-por-serie-design.md.
// Las reps fijas se siguen editando con el selector de siempre de cada
// pantalla; este componente solo añade el modo por serie.
import { Minus, Plus } from 'lucide-react';
import { parseRepScheme, isPerSet } from '../../lib/repScheme';

function MiniStepper({ value, onChange }) {
    return (
        <div className="flex items-center gap-1">
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(Math.max(1, value - 1)); }}
                className="w-6 h-6 rounded-md bg-surface-highlight flex items-center justify-center">
                <Minus size={10} className="text-text-primary" />
            </button>
            <span className="w-6 text-center text-sm font-bold text-text-primary tabular-nums">{value}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(Math.min(99, value + 1)); }}
                className="w-6 h-6 rounded-md bg-surface-highlight flex items-center justify-center">
                <Plus size={10} className="text-text-primary" />
            </button>
        </div>
    );
}

export function PerSetReps({ series, reps, onChange, label = 'Reps por serie' }) {
    const on = isPerSet(reps);
    const perSet = parseRepScheme(reps, series);
    const setOne = (i, v) => {
        const next = [...perSet];
        next[i] = v;
        onChange(next.join('-'));
    };

    return (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => onChange(on ? perSet[0] : perSet.join('-'))}
                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                <span className={`w-8 h-[18px] rounded-full p-0.5 transition-colors ${on ? 'bg-primary' : 'bg-surface-highlight'}`}>
                    <span className={`block w-3.5 h-3.5 rounded-full bg-white transition-all ${on ? 'ml-3.5' : 'ml-0'}`} />
                </span>
                {label}
            </button>
            {on && (
                <div className="flex flex-wrap gap-2">
                    {perSet.map((v, i) => (
                        <div key={i} className="flex flex-col items-center gap-0.5 rounded-lg bg-background px-2 py-1">
                            <span className="text-[9px] text-text-secondary uppercase">Serie {i + 1}</span>
                            <MiniStepper value={v} onChange={(nv) => setOne(i, nv)} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
