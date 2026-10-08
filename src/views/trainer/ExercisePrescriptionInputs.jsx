import React from 'react';
import { PerSetReps } from '../../components/trainer/PerSetReps';
import { isTimeBasedExercise } from '../../lib/exerciseUtils';

// Peso/RIR/descanso opcionales al crear la rutina (Fase 1 prescripción).
// Mismo estilo visual que el editor post-creación de ClientProfileView.jsx.
// hideWeight: en plantillas el peso se pone por cliente, al asignarla.
export function ExercisePrescriptionInputs({ values, onChange, hideWeight = false }) {
    return (
        <div className="grid grid-cols-3 gap-2 px-3 pb-3">
            {values.series != null && !isTimeBasedExercise(values) && (
                <div className="col-span-3">
                    <PerSetReps series={values.series} reps={values.reps} onChange={(v) => onChange('reps', v)} />
                </div>
            )}
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-text-secondary">
                Peso (kg)
                {hideWeight ? (
                    <span className="border border-dashed border-surface-highlight rounded-lg px-2 py-1.5 text-xs whitespace-nowrap normal-case tracking-normal">Por cliente</span>
                ) : (
                <input
                    type="number"
                    inputMode="decimal"
                    value={values.target_weight ?? ''}
                    onChange={(e) => onChange('target_weight', e.target.value === '' ? null : e.target.value)}
                    className="bg-surface border border-surface-highlight rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-primary"
                    placeholder="—"
                />
                )}
            </label>
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-text-secondary">
                RIR (0-5)
                <input
                    type="number"
                    min="0"
                    max="5"
                    value={values.target_rir ?? ''}
                    onChange={(e) => onChange('target_rir', e.target.value === '' ? null : e.target.value)}
                    className="bg-surface border border-surface-highlight rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-primary"
                    placeholder="—"
                />
            </label>
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-text-secondary">
                Descanso (s)
                <input
                    type="number"
                    min="0"
                    value={values.rest_seconds ?? ''}
                    onChange={(e) => onChange('rest_seconds', e.target.value === '' ? null : e.target.value)}
                    className="bg-surface border border-surface-highlight rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-primary"
                    placeholder="—"
                />
            </label>
        </div>
    );
}
