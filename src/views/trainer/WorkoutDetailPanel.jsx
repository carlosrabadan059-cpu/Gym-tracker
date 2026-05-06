import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { isBodyweightExercise, isTimeBasedExercise } from '../../lib/exerciseUtils';
import { ArrowLeft, Dumbbell, Calendar, Timer } from 'lucide-react';
import { routines as staticRoutines } from '../../data/routines';

const STATIC_ID_TO_NAME = {};
staticRoutines.forEach(r => r.exercises.forEach(ex => {
    STATIC_ID_TO_NAME[String(ex.id)] = { name: ex.name, catalog_id: ex.catalog_id };
}));

export function WorkoutDetailPanel({ entry, onClose }) {
    const [nameMap, setNameMap] = useState({ ...STATIC_ID_TO_NAME });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ids = Object.keys(entry.logs || {}).filter(k => k !== 'workoutDuration' && k !== 'cardio');
        if (ids.length === 0) { setLoading(false); return; }

        const fetchNames = async () => {
            let nextNameMap = { ...STATIC_ID_TO_NAME };

            const { data } = await supabase
                .from('exercises')
                .select('id, name, catalog_id, exercise_catalog(name)')
                .in('id', ids.map(Number));

            if (data) {
                data.forEach(ex => {
                    const resolvedName = ex.exercise_catalog?.name || ex.name;
                    nextNameMap[String(ex.id)] = { name: resolvedName, catalog_id: ex.catalog_id };
                });
            }

            const missingIds = ids.filter(id => !data?.some(d => String(d.id) === id) && STATIC_ID_TO_NAME[id]?.catalog_id);
            if (missingIds.length > 0) {
                const catalogIds = [...new Set(missingIds.map(id => STATIC_ID_TO_NAME[id].catalog_id))];
                const { data: catalogData } = await supabase
                    .from('exercise_catalog')
                    .select('id, name')
                    .in('id', catalogIds);

                if (catalogData) {
                    missingIds.forEach(id => {
                        const catId = STATIC_ID_TO_NAME[id].catalog_id;
                        const catRow = catalogData.find(c => c.id === catId);
                        if (catRow) {
                            nextNameMap[id] = { name: catRow.name, catalog_id: catId };
                        }
                    });
                }
            }

            setNameMap(nextNameMap);
            setLoading(false);
        };

        fetchNames();
    }, [entry]);

    const exercises = useMemo(() => {
        if (!entry.logs) return [];
        return Object.entries(entry.logs)
            .filter(([k]) => k !== 'workoutDuration' && k !== 'cardio')
            .map(([id, log]) => {
                const mapData = nameMap[id];
                let name = `Ejercicio antiguo (#${id})`;
                let catalog_id = null;

                if (mapData) {
                    name = (typeof mapData === 'string' ? mapData : mapData.name);
                    catalog_id = typeof mapData !== 'string' ? mapData.catalog_id : null;
                }
                return {
                    id,
                    name,
                    catalog_id,
                    sets: Object.values(log.setsData || {}),
                };
            });
    }, [entry.logs, nameMap]);

    const duration = entry.logs?.workoutDuration;

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
            <header className="flex items-center gap-3 p-4 border-b border-surface-highlight sticky top-0 bg-background z-10">
                <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-highlight transition-colors">
                    <ArrowLeft size={22} className="text-text-primary" />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-text-primary truncate">{entry.routineName}</h2>
                    <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-text-secondary">
                            <Calendar size={11} />
                            {new Date(entry.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        {duration?.durationMinutes > 0 && (
                            <span className="flex items-center gap-1 text-xs text-text-secondary">
                                <Timer size={11} />
                                {duration.durationMinutes} min
                            </span>
                        )}
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-surface rounded-2xl p-4 border border-surface-highlight animate-pulse">
                            <div className="h-4 bg-surface-highlight rounded w-1/3 mb-3" />
                            <div className="space-y-2">
                                {[1, 2, 3].map(j => <div key={j} className="h-3 bg-surface-highlight rounded w-1/2" />)}
                            </div>
                        </div>
                    ))
                ) : exercises.length === 0 ? (
                    <div className="text-center py-12 text-text-secondary">
                        <Dumbbell size={36} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Sin datos de ejercicios.</p>
                    </div>
                ) : (
                    exercises.map(ex => {
                        const doneSets = ex.sets.filter(s => s.done !== false);
                        return (
                            <div key={ex.id} className="bg-surface rounded-2xl p-4 border border-surface-highlight">
                                <p className="font-semibold text-text-primary text-sm mb-3">{ex.name}</p>
                                <div className="space-y-1.5">
                                    {doneSets.length === 0 ? (
                                        <p className="text-xs text-text-secondary">Sin series completadas.</p>
                                    ) : (
                                        doneSets.map((set, i) => {
                                            const w = parseFloat(String(set.weight || '0').replace(',', '.')) || 0;
                                            const r = parseInt(set.reps) || 0;
                                            const isBodyweightAbs = isBodyweightExercise(ex);
                                            const isTimeBased = isTimeBasedExercise(ex);
                                            return (
                                                <div key={i} className="flex items-center gap-2">
                                                    <span className="text-xs text-text-secondary w-12">Serie {i + 1}</span>
                                                    <span className="text-xs font-mono font-bold text-text-primary">
                                                        {isBodyweightAbs || isTimeBased ? (
                                                            r > 0 ? `${r} ${isTimeBased ? 'min' : 'reps'}` : '—'
                                                        ) : (
                                                            <>
                                                                {w > 0 ? `${w} kg` : '—'}
                                                                {w > 0 && r > 0 ? ' × ' : ''}
                                                                {r > 0 ? `${r} reps` : ''}
                                                            </>
                                                        )}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}

                {duration?.realCalories > 0 && (
                    <div className="bg-primary/10 rounded-2xl p-4 border border-primary/20 flex items-center justify-between">
                        <span className="text-sm font-semibold text-text-primary">Calorías estimadas</span>
                        <span className="text-lg font-black text-primary">{Math.round(duration.realCalories)} kcal</span>
                    </div>
                )}
            </div>
        </div>
    );
}
