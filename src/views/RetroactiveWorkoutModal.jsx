import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Calendar, Dumbbell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns 'YYYY-MM-DD' for input[type=date] */
const toDateInput = (isoStr) => isoStr.split('T')[0];

/** Returns today's date as 'YYYY-MM-DD' */
const todayInput = () => toDateInput(new Date().toISOString());

// ─── Step 1: Select routine + date ─────────────────────────────────────────

const StepSelectRoutine = ({ routines, selectedRoutine, selectedDate, onRoutine, onDate }) => (
    <div className="space-y-5">
        <div>
            <p className="text-xs text-text-secondary uppercase tracking-wider mb-2 font-semibold">Fecha del entreno</p>
            <input
                type="date"
                max={todayInput()}
                value={selectedDate}
                onChange={e => onDate(e.target.value)}
                className="w-full bg-background border border-surface-highlight rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-primary transition-colors text-base"
            />
        </div>

        <div>
            <p className="text-xs text-text-secondary uppercase tracking-wider mb-2 font-semibold">Rutina</p>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {routines.map(r => (
                    <button
                        key={r.id}
                        onClick={() => onRoutine(r)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                            selectedRoutine?.id === r.id
                                ? 'border-primary bg-primary/10 text-text-primary'
                                : 'border-surface-highlight bg-background text-text-secondary hover:border-gray-500'
                        }`}
                    >
                        <Dumbbell size={16} className={selectedRoutine?.id === r.id ? 'text-primary' : 'text-text-secondary'} />
                        <span className="font-medium text-sm">{r.name}</span>
                        {selectedRoutine?.id === r.id && <Check size={14} className="text-primary ml-auto" strokeWidth={3} />}
                    </button>
                ))}
            </div>
        </div>
    </div>
);

// ─── Step 2: Log each exercise ──────────────────────────────────────────────

const StepLogExercises = ({ exercises, logsData, onChange }) => (
    <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
        {exercises.map(ex => {
            const setCount = parseInt(ex.series) || 3;
            return (
                <div key={ex.id} className="bg-background rounded-xl border border-surface-highlight p-3">
                    <div className="flex items-center gap-2 mb-3">
                        {ex.image_url && (
                            <img src={ex.image_url} alt={ex.name} className="w-8 h-8 rounded-lg object-contain flex-shrink-0" referrerPolicy="no-referrer" />
                        )}
                        <div>
                            <p className="text-sm font-semibold text-text-primary leading-tight">{ex.name}</p>
                            <p className="text-xs text-text-secondary">{ex.series} series × {ex.reps} reps</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {Array.from({ length: setCount }, (_, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <span className="w-6 text-xs text-text-secondary font-mono text-center">{i + 1}</span>
                                <div className="flex-1 flex items-center gap-1 bg-surface border border-surface-highlight rounded-lg px-3 py-1.5">
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={logsData[ex.id]?.setsData?.[i]?.weight || ''}
                                        onChange={e => onChange(ex.id, i, 'weight', e.target.value)}
                                        className="w-full bg-transparent text-text-primary text-right text-sm font-mono focus:outline-none placeholder-text-secondary/50"
                                    />
                                    <span className="text-xs text-text-secondary flex-shrink-0">kg</span>
                                </div>
                                <div className="flex-1 flex items-center gap-1 bg-surface border border-surface-highlight rounded-lg px-3 py-1.5">
                                    <input
                                        type="number"
                                        placeholder={ex.reps}
                                        value={logsData[ex.id]?.setsData?.[i]?.reps || ''}
                                        onChange={e => onChange(ex.id, i, 'reps', e.target.value)}
                                        className="w-full bg-transparent text-text-primary text-right text-sm font-mono focus:outline-none placeholder-text-secondary/50"
                                    />
                                    <span className="text-xs text-text-secondary flex-shrink-0">reps</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        })}
    </div>
);

// ─── Step 3: Confirm ────────────────────────────────────────────────────────

const StepConfirm = ({ routine, date, logsData }) => {
    const filled = Object.values(logsData).filter(ex =>
        Object.values(ex.setsData || {}).some(s => s.weight || s.reps)
    ).length;

    return (
        <div className="space-y-4">
            <div className="bg-background rounded-xl border border-surface-highlight p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Rutina</span>
                    <span className="font-semibold text-text-primary">{routine.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Fecha</span>
                    <span className="font-semibold text-text-primary flex items-center gap-1">
                        <Calendar size={13} />
                        {new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Ejercicios con datos</span>
                    <span className="font-semibold text-primary">{filled} / {routine.exercises.length}</span>
                </div>
            </div>
            <p className="text-xs text-text-secondary text-center">
                El registro se guardará con la fecha seleccionada y aparecerá en tu historial de progreso.
            </p>
        </div>
    );
};

// ─── Main Modal ─────────────────────────────────────────────────────────────

const STEPS = ['Seleccionar', 'Registrar', 'Confirmar'];

export function RetroactiveWorkoutModal({ routines, onClose, onSaved }) {
    const { user } = useAuth();

    const [step, setStep] = useState(0);
    const [selectedRoutine, setSelectedRoutine] = useState(null);
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return toDateInput(d.toISOString());
    });
    const [logsData, setLogsData] = useState({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState(null);

    // When routine changes, initialize empty logsData for all exercises
    const handleSelectRoutine = (r) => {
        setSelectedRoutine(r);
        const initial = {};
        r.exercises.forEach(ex => {
            const setCount = parseInt(ex.series) || 3;
            const setsData = {};
            for (let i = 0; i < setCount; i++) {
                setsData[i] = { weight: '', reps: ex.reps || '10' };
            }
            initial[ex.id] = { setsData, completedSets: {} };
        });
        setLogsData(initial);
    };

    const handleCellChange = (exId, setIdx, field, value) => {
        setLogsData(prev => ({
            ...prev,
            [exId]: {
                ...prev[exId],
                setsData: {
                    ...prev[exId]?.setsData,
                    [setIdx]: {
                        ...prev[exId]?.setsData?.[setIdx],
                        [field]: value,
                    }
                },
                // Mark set as completed if both fields have a value
                completedSets: {
                    ...prev[exId]?.completedSets,
                }
            }
        }));
    };

    const canAdvance = () => {
        if (step === 0) return selectedRoutine && selectedDate;
        return true;
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            // Mark all sets with any data as completed
            const finalLogs = {};
            Object.entries(logsData).forEach(([exId, exLog]) => {
                const completedSets = {};
                Object.entries(exLog.setsData || {}).forEach(([i, s]) => {
                    if (s.weight || s.reps) completedSets[i] = true;
                });
                finalLogs[exId] = { ...exLog, completedSets };
            });

            const isoDate = new Date(selectedDate + 'T12:00:00').toISOString();

            const { error: insertError } = await supabase
                .from('workout_logs')
                .insert({
                    user_id: user.id,
                    routine_id: selectedRoutine.id,
                    date: isoDate,
                    logs: finalLogs,
                });

            if (insertError) throw insertError;

            setSaved(true);
            setTimeout(() => {
                onSaved?.();
                onClose();
            }, 1200);
        } catch (err) {
            console.error('Error saving retroactive log:', err);
            setError('No se pudo guardar el registro. Inténtalo de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn pb-safe">
            <div className="w-full max-w-md bg-surface border border-surface-highlight rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden mb-0 sm:mb-8">

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <div>
                        <h2 className="text-lg font-bold text-text-primary">Registrar entreno pasado</h2>
                        <p className="text-xs text-text-secondary mt-0.5">Paso {step + 1} de {STEPS.length} — {STEPS[step]}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-surface-highlight transition-colors"
                    >
                        <X size={20} className="text-text-secondary" />
                    </button>
                </div>

                {/* Progress bar */}
                <div className="mx-5 mb-4 h-1 bg-surface-highlight rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                    />
                </div>

                {/* Step content */}
                <div className="px-5 pb-3">
                    {step === 0 && (
                        <StepSelectRoutine
                            routines={routines}
                            selectedRoutine={selectedRoutine}
                            selectedDate={selectedDate}
                            onRoutine={handleSelectRoutine}
                            onDate={setSelectedDate}
                        />
                    )}
                    {step === 1 && selectedRoutine && (
                        <StepLogExercises
                            exercises={selectedRoutine.exercises}
                            logsData={logsData}
                            onChange={handleCellChange}
                        />
                    )}
                    {step === 2 && selectedRoutine && (
                        <StepConfirm
                            routine={selectedRoutine}
                            date={selectedDate}
                            logsData={logsData}
                        />
                    )}
                </div>

                {/* Error */}
                {error && (
                    <p className="px-5 text-sm text-red-400 font-medium">{error}</p>
                )}

                {/* Footer navigation */}
                <div className="flex items-center gap-3 px-5 pt-4 pb-6 sm:pb-4 border-t border-surface-highlight">
                    {step > 0 ? (
                        <button
                            onClick={() => setStep(s => s - 1)}
                            className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-surface-highlight text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
                        >
                            <ChevronLeft size={16} /> Atrás
                        </button>
                    ) : (
                        <div className="flex-shrink-0 w-16" />
                    )}

                    <div className="flex-1" />

                    {step < STEPS.length - 1 ? (
                        <button
                            disabled={!canAdvance()}
                            onClick={() => setStep(s => s + 1)}
                            className="flex items-center gap-1 px-5 py-2.5 rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-40 transition-all"
                        >
                            Siguiente <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button
                            onClick={handleSave}
                            disabled={saving || saved}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-60 transition-all min-w-[120px] justify-center"
                        >
                            {saved ? (
                                <><Check size={16} strokeWidth={3} /> Guardado</>
                            ) : saving ? (
                                <span className="animate-pulse">Guardando...</span>
                            ) : (
                                <><Check size={16} strokeWidth={3} /> Guardar registro</>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
