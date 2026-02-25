import React, { useState, useEffect } from 'react';
import { Play, TrendingUp, ChevronRight, Check } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { getRoutineIcon, calculateCaloriesByVolume } from '../lib/routineUtils';
import { useAuth } from '../context/AuthContext';

const DashboardView = ({ onStartDaily, onSeeAll, completedRoutines = [] }) => {
    const { profile } = useAuth();
    const [expandedRoutine, setExpandedRoutine] = useState(null);
    const [routines, setRoutines] = useState([]);
    const [loading, setLoading] = useState(true);

    const userWeight = profile?.weight || null;

    useEffect(() => {
        const fetchRoutines = async () => {
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
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRoutines();
    }, []);

    const toggleRoutine = (id) => {
        setExpandedRoutine(expandedRoutine === id ? null : id);
    };

    if (loading) return <div className="text-text-primary text-center py-10">Cargando rutinas...</div>;

    return (
        <div className="space-y-6 pb-24">
            {/* Daily Routines */}
            <div>
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-text-primary">Tus Rutinas Diarias</h3>
                </div>

                <div className="space-y-4">
                    {routines.map((routine) => {
                        const isExpanded = expandedRoutine === routine.id;
                        const isCompleted = completedRoutines.includes(routine.id);
                        const visibleExercises = isExpanded ? routine.exercises : routine.exercises.slice(0, 3);
                        const routineIcon = getRoutineIcon(routine.name);
                        const totalCalories = routine.exercises.reduce((sum, ex) => sum + calculateCaloriesByVolume(ex, userWeight), 0);

                        return (
                            <Card
                                key={routine.id}
                                className={cn(
                                    "flex flex-col gap-4 p-5 transition-all cursor-pointer border-l-4",
                                    routine.border_color,
                                    "bg-surface",
                                    isExpanded ? "scale-[1.02] shadow-lg" : "hover:scale-[1.01]",
                                    isCompleted && "opacity-80"
                                )}
                                onClick={() => toggleRoutine(routine.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {routineIcon && (
                                            <div className="h-14 w-14 rounded-2xl overflow-hidden bg-surface-highlight/50 border border-surface-highlight flex-shrink-0">
                                                <img
                                                    src={routineIcon}
                                                    alt="icon"
                                                    className="h-full w-full object-cover p-1.5"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&q=80&w=200';
                                                    }}
                                                />
                                            </div>
                                        )}
                                        <h4 className={cn("text-lg font-bold leading-tight", routine.text_color)}>
                                            {routine.name}
                                        </h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge className={cn("bg-opacity-20", routine.color, routine.text_color)}>
                                            {routine.exercises.length} Ejercicios • {totalCalories} kcal
                                        </Badge>
                                        <ChevronRight
                                            className={cn(
                                                "h-5 w-5 text-gray-400 transition-transform duration-300",
                                                isExpanded ? "rotate-90" : ""
                                            )}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {visibleExercises.map((ex) => (
                                        <div key={ex.id} className="flex items-center gap-3 animate-fadeIn">
                                            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-gray-700/50">
                                                {ex.image_url ? (
                                                    <img
                                                        src={ex.image_url}
                                                        alt={ex.name}
                                                        className="h-full w-full object-cover"
                                                        referrerPolicy="no-referrer"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.parentElement.classList.add('animate-pulse');
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="h-full w-full bg-surface-highlight" />
                                                )}
                                            </div>
                                            <div className="flex flex-1 items-center justify-between text-sm text-text-secondary">
                                                <span className="font-medium text-text-primary">{ex.name}</span>
                                                <span className="text-xs opacity-70 ml-2 whitespace-nowrap">{ex.series}x{ex.reps}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {!isExpanded && routine.exercises.length > 3 && (
                                        <div className="text-xs text-text-secondary opacity-50 pl-[3.25rem]">
                                            + {routine.exercises.length - 3} ejercicios más...
                                        </div>
                                    )}
                                </div>

                                <div className="mt-2 flex items-center justify-end">
                                    <Button
                                        size="sm"
                                        className={cn(
                                            "rounded-full w-full h-9 transition-all font-bold",
                                            isCompleted ? "bg-green-500 text-black shadow-lg shadow-green-500/20" : cn(routine.color, "text-black")
                                        )}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!isCompleted) onStartDaily(routine);
                                        }}
                                        disabled={isCompleted}
                                    >
                                        {isCompleted ? (
                                            <>
                                                Completada
                                                <Check className="ml-2 h-4 w-4 stroke-black" strokeWidth={3} />
                                            </>
                                        ) : (
                                            <>
                                                Iniciar Rutina
                                                <Play className="ml-2 h-4 w-4 fill-black" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export { DashboardView };
