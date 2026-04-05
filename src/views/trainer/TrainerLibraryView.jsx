import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Search, Dumbbell, ChevronRight } from 'lucide-react';

export function TrainerLibraryView({ onBack }) {
    const [routines, setRoutines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedRoutine, setExpandedRoutine] = useState(null);

    useEffect(() => {
        const fetchLibrary = async () => {
            try {
                const { data: routinesData, error: routinesError } = await supabase
                    .from('routines')
                    .select('*')
                    .order('id');

                if (routinesError) throw routinesError;

                const { data: exercisesData, error: exercisesError } = await supabase
                    .from('exercises')
                    .select('*')
                    .order('ui_order');

                if (exercisesError) throw exercisesError;

                // Merge exercises into routines
                const mergedRoutines = routinesData.map(routine => ({
                    ...routine,
                    exercises: exercisesData.filter(ex => ex.routine_id === routine.id)
                }));

                setRoutines(mergedRoutines);
            } catch (error) {
                console.error('Error fetching library:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchLibrary();
    }, []);

    const toggleRoutine = (id) => {
        setExpandedRoutine(expandedRoutine === id ? null : id);
    };

    return (
        <div className="flex flex-col h-full bg-background pb-20">
            <header className="mb-6 flex items-center gap-4 p-4 border-b border-surface-highlight sticky top-0 bg-background z-10">
                <button
                    onClick={onBack}
                    className="p-2 rounded-full hover:bg-surface-highlight transition-colors"
                >
                    <ArrowLeft size={24} className="text-text-primary" />
                </button>
                <h2 className="text-2xl font-bold text-text-primary">Librería</h2>
            </header>

            <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-12">
                <p className="text-sm text-text-secondary mb-4">
                    Tus rutinas y ejercicios disponibles para asignar.
                </p>

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-surface p-5 rounded-2xl border border-surface-highlight animate-pulse">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="space-y-2 flex-1">
                                        <div className="h-4 bg-surface-highlight rounded w-1/2" />
                                        <div className="h-3 bg-surface-highlight rounded w-1/3" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : routines.length === 0 ? (
                    <div className="text-center text-text-secondary mt-10">
                        <Dumbbell size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No hay rutinas en la librería.</p>
                    </div>
                ) : (
                    routines.map((routine) => {
                        const isExpanded = expandedRoutine === routine.id;

                        return (
                            <div
                                key={routine.id}
                                className={`bg-surface p-5 rounded-2xl border transition-all cursor-pointer border-l-4 ${routine.border_color} ${isExpanded ? 'border-primary shadow-lg' : 'border-surface-highlight hover:border-gray-500'}`}
                                onClick={() => toggleRoutine(routine.id)}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <div>
                                        <h3 className={`font-bold text-lg ${routine.text_color}`}>
                                            {routine.name}
                                        </h3>
                                        <p className="text-xs text-text-secondary mt-1">
                                            {routine.exercises.length} Ejercicios registrados
                                        </p>
                                    </div>
                                    <ChevronRight
                                        size={20}
                                        className={`text-text-secondary transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}
                                    />
                                </div>

                                {isExpanded && (
                                    <div className="mt-4 space-y-3 pt-4 border-t border-surface-highlight animate-fadeIn">
                                        {routine.exercises.map((ex) => (
                                            <div key={ex.id} className="flex items-center gap-3">
                                                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-surface-highlight">
                                                    {ex.image_url ? (
                                                        <img
                                                            src={ex.image_url}
                                                            alt={ex.name}
                                                            className="h-full w-full object-cover"
                                                            referrerPolicy="no-referrer"
                                                        />
                                                    ) : (
                                                        <div className="h-full w-full flex items-center justify-center">
                                                            <Dumbbell size={16} className="text-gray-500" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-1 items-center justify-between text-sm text-text-secondary">
                                                    <span className="font-medium text-text-primary">{ex.name}</span>
                                                    <span className="text-xs opacity-70 ml-2 whitespace-nowrap bg-background px-2 py-1 rounded-md">{ex.series}x{ex.reps}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
