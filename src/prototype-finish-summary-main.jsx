/* eslint-disable react-refresh/only-export-components -- entry de prototipo, no HMR de producción */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, Flame, Clock, Watch } from 'lucide-react';
import './index.css';

// PROTOTIPO — no toca Supabase ni Health. Reproduce la tarjeta-resumen que
// aparece al terminar un entreno (OtherViews.jsx) con datos mock, para verla
// sin tener que repetir un entreno real. Ver docs/plan-apple-health-integration.md.

const SCENARIOS = {
    real: {
        label: 'Hoy 09:58 (real, kcal Watch)',
        data: {
            cardio: { type: 'Andar en cinta', calories: 77, duration: 15 },
            workoutDuration: { durationMinutes: 74, realCalories: 329, caloriesSource: 'health', totalCalories: 406 },
        },
    },
    estimado: {
        label: 'Sin Watch (estimación MET)',
        data: {
            cardio: { type: 'Correr en cinta', calories: 92, duration: 10 },
            workoutDuration: { durationMinutes: 58, realCalories: 245, caloriesSource: 'estimated', totalCalories: 337 },
        },
    },
    sinCardio: {
        label: 'Sin cardio previo',
        data: {
            cardio: null,
            workoutDuration: { durationMinutes: 41, realCalories: 198, caloriesSource: 'estimated', totalCalories: 198 },
        },
    },
};

function FinishSummaryCard({ finishSummary, onContinue }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-surface border border-surface-highlight w-full max-w-sm rounded-[2rem] p-6 shadow-2xl">
                <div className="flex justify-center mb-4">
                    <div className="h-14 w-14 rounded-full bg-primary/15 flex items-center justify-center">
                        <Check size={28} className="text-primary" strokeWidth={3} />
                    </div>
                </div>
                <h3 className="text-xl font-bold text-text-primary text-center mb-1">
                    Entrenamiento completado
                </h3>
                <p className="text-sm text-text-secondary text-center mb-6">
                    Resumen de la sesión
                </p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-background rounded-xl p-3 flex flex-col items-center gap-1">
                        <Clock size={18} className="text-text-secondary" />
                        <p className="text-lg font-bold text-text-primary">
                            {finishSummary.workoutDuration.durationMinutes} min
                        </p>
                        <p className="text-[11px] text-text-secondary">Duración</p>
                    </div>
                    <div className="bg-background rounded-xl p-3 flex flex-col items-center gap-1">
                        <Flame size={18} className="text-primary" />
                        <p className="text-lg font-bold text-text-primary">
                            {finishSummary.workoutDuration.totalCalories} kcal
                        </p>
                        <p className="text-[11px] text-text-secondary">Total</p>
                    </div>
                </div>

                <div className="space-y-2 mb-6">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">Fuerza</span>
                        <span className="text-text-primary font-medium flex items-center gap-1.5">
                            {finishSummary.workoutDuration.realCalories} kcal
                            {finishSummary.workoutDuration.caloriesSource === 'health' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-wide">
                                    <Watch size={11} /> Watch
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wide">
                                    estimado
                                </span>
                            )}
                        </span>
                    </div>
                    {finishSummary.cardio && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-text-secondary">Cardio ({finishSummary.cardio.type})</span>
                            <span className="text-text-primary font-medium">
                                {finishSummary.cardio.calories} kcal
                            </span>
                        </div>
                    )}
                </div>

                <button
                    onClick={onContinue}
                    className="w-full py-4 font-bold rounded-xl bg-primary text-black active:scale-95 shadow-lg shadow-primary/20 transition-all"
                >
                    Continuar
                </button>
            </div>
        </div>
    );
}

function Prototype() {
    const [scenario, setScenario] = useState('real');
    const [dismissed, setDismissed] = useState(false);

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <div className="p-4 text-center text-text-secondary text-sm">
                Prototipo — tarjeta resumen fin de entreno
            </div>

            {!dismissed && (
                <FinishSummaryCard
                    finishSummary={SCENARIOS[scenario].data}
                    onContinue={() => setDismissed(true)}
                />
            )}

            {dismissed && (
                <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
                    (Continuar pulsado — aquí volvería al Dashboard)
                </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 flex justify-center gap-2 p-4 bg-surface/90 backdrop-blur border-t border-surface-highlight">
                {Object.entries(SCENARIOS).map(([key, s]) => (
                    <button
                        key={key}
                        onClick={() => { setScenario(key); setDismissed(false); }}
                        className={`text-xs font-bold px-3 py-2 rounded-lg transition-all ${scenario === key ? 'bg-primary text-black' : 'bg-background text-text-secondary'}`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <Prototype />
    </StrictMode>,
);
