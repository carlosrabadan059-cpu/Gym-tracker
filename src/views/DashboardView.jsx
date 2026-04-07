import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, TrendingUp, ChevronRight, Check } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { getRoutineIcon, calculateCaloriesByVolume } from '../lib/routineUtils';
import { useAuth } from '../context/AuthContext';

const DashboardView = ({ onStartDaily, onSeeAll, completedRoutines = [] }) => {
    const { profile, user } = useAuth();
    const [expandedRoutine, setExpandedRoutine] = useState(null);
    const [routines, setRoutines] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showCardioSelector, setShowCardioSelector] = useState(false);
    const [pendingRoutine, setPendingRoutine] = useState(null);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const touchStartY = useRef(0);
    const containerRef = useRef(null);
    const pullDistanceRef = useRef(0);
    const isRefreshingRef = useRef(false);

    const userWeight = profile?.weight || null;

    const fetchRoutines = useCallback(async () => {
        if (!user || !profile) return;
        try {
            const { data: assigned, error: assignedErr } = await supabase
                .from('assigned_routines')
                .select('routine_id')
                .eq('client_id', user.id);

            let targetRoutineIds = [];
            if (!assignedErr && assigned && assigned.length > 0) {
                targetRoutineIds = assigned.map(a => a.routine_id);
            } else {
                targetRoutineIds = ['day1', 'day2', 'day3', 'day4'];
            }

            const { data: routinesData, error: routinesError } = await supabase
                .from('routines')
                .select('*')
                .in('id', targetRoutineIds)
                .order('id');

            if (routinesError) throw routinesError;

            const { data: exercisesData, error: exercisesError } = await supabase
                .from('exercises')
                .select('*')
                .in('routine_id', targetRoutineIds)
                .order('ui_order');

            if (exercisesError) throw exercisesError;

            const mergedRoutines = routinesData.map(routine => ({
                ...routine,
                exercises: exercisesData.filter(ex => ex.routine_id === routine.id)
            }));

            setRoutines(mergedRoutines);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
            isRefreshingRef.current = false;
        }
    }, [user, profile]);

    useEffect(() => {
        if (user && profile) fetchRoutines();
    }, [user, profile, fetchRoutines]);

    // Pull-to-refresh touch handlers
    // Los refs espejean el estado para que los handlers no necesiten estar en deps,
    // evitando que los listeners se re-registren en cada cambio de pullDistance.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const onTouchStart = (e) => {
            if (el.scrollTop === 0) {
                touchStartY.current = e.touches[0].clientY;
            }
        };
        const onTouchMove = (e) => {
            if (touchStartY.current === 0) return;
            const delta = e.touches[0].clientY - touchStartY.current;
            if (delta > 0 && el.scrollTop === 0) {
                const dist = Math.min(delta * 0.4, 70);
                pullDistanceRef.current = dist;
                setPullDistance(dist);
            }
        };
        const onTouchEnd = () => {
            if (pullDistanceRef.current >= 60 && !isRefreshingRef.current) {
                isRefreshingRef.current = true;
                setIsRefreshing(true);
                setLoading(true);
                fetchRoutines();
            }
            pullDistanceRef.current = 0;
            setPullDistance(0);
            touchStartY.current = 0;
        };

        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: true });
        el.addEventListener('touchend', onTouchEnd);
        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
        };
    }, [fetchRoutines]);

    const toggleRoutine = (id) => {
        setExpandedRoutine(expandedRoutine === id ? null : id);
    };

    if (loading) return (
        <div className="space-y-4 pb-24">
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-surface rounded-2xl p-5 border border-surface-highlight animate-pulse">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-14 w-14 rounded-2xl bg-surface-highlight flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-surface-highlight rounded w-2/3" />
                            <div className="h-3 bg-surface-highlight rounded w-1/3" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        {[1, 2, 3].map(j => (
                            <div key={j} className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-surface-highlight flex-shrink-0" />
                                <div className="flex-1 h-3 bg-surface-highlight rounded" />
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 h-9 bg-surface-highlight rounded-full" />
                </div>
            ))}
        </div>
    );

    return (
        <div ref={containerRef} className="space-y-6 pb-24 overflow-y-auto">
            {/* Pull-to-refresh indicator */}
            {(pullDistance > 0 || isRefreshing) && (
                <div
                    className="flex items-center justify-center transition-all"
                    style={{ height: isRefreshing ? 48 : pullDistance, overflow: 'hidden' }}
                >
                    <div className={`w-6 h-6 rounded-full border-2 border-primary border-t-transparent ${isRefreshing ? 'animate-spin' : ''}`}
                        style={{ transform: `rotate(${pullDistance * 3}deg)` }}
                    />
                </div>
            )}
            {/* Daily Routines */}
            <div>
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-text-primary">Tus Rutinas Diarias</h3>
                </div>

                {routines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="p-5 bg-surface-highlight rounded-full mb-4">
                            <TrendingUp size={40} className="text-text-secondary opacity-50" />
                        </div>
                        <p className="text-text-primary font-semibold">No hay rutinas asignadas</p>
                        <p className="text-text-secondary text-sm mt-1">Contacta con tu entrenador para que te asigne una rutina</p>
                    </div>
                ) : null}

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
                                            if (isCompleted) {
                                                onStartDaily(routine);
                                            } else {
                                                setPendingRoutine(routine);
                                                setShowCardioSelector(true);
                                            }
                                        }}
                                    >
                                        {isCompleted ? (
                                            <>
                                                Revisar Entrenamiento
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

            {/* Cardio Selector Modal */}
            {showCardioSelector && pendingRoutine && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-surface border border-surface-highlight w-full max-w-sm rounded-[2rem] p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-text-primary text-center mb-2">
                            Añadir Cardio Previo
                        </h3>
                        <p className="text-sm text-text-secondary text-center mb-6">
                            ¿Vas a calentar antes de empezar?
                        </p>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {[
                                { name: 'Andar en cinta', img: '/exercises/cardio-andar.png' },
                                { name: 'Correr en cinta', img: '/exercises/cardio-correr.png' },
                                { name: 'Elíptica', img: '/exercises/cardio-eliptica.png' },
                                { name: 'Bicicleta', img: '/exercises/cardio-bicicleta.png' }
                            ].map((cardio) => {
                                const isSelected = pendingRoutine.cardio?.type === cardio.name;
                                return (
                                    <div
                                        key={cardio.name}
                                        className={cn(
                                            "relative h-24 rounded-xl overflow-hidden cursor-pointer transition-all border-2",
                                            isSelected ? "border-primary shadow-lg shadow-primary/20 scale-[1.02]" : "border-transparent hover:border-surface-highlight hover:scale-[1.01]"
                                        )}
                                        onClick={() => {
                                            setPendingRoutine({ ...pendingRoutine, cardio: { type: cardio.name } });
                                        }}
                                    >
                                        <img
                                            src={cardio.img}
                                            alt={cardio.name}
                                            className={cn("absolute inset-0 w-full h-full object-cover transition-all", isSelected ? "opacity-100" : "opacity-60")}
                                        />
                                        <div className={cn("absolute inset-0 bg-gradient-to-t transition-all", isSelected ? "from-black/90 via-black/40 to-transparent" : "from-black/80 to-black/20")} />
                                        <div className="absolute inset-x-0 bottom-2 text-center z-10">
                                            <span className={cn("text-sm font-bold", isSelected ? "text-primary drop-shadow-md" : "text-white")}>
                                                {cardio.name}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {pendingRoutine.cardio?.type && (
                            <div className="mb-6 animate-fadeIn">
                                <p className="text-xs text-text-secondary uppercase tracking-wider mb-2 font-medium">Duración</p>
                                <div className="flex justify-between gap-2">
                                    {[10, 15, 20].map((mins) => (
                                        <Button
                                            key={mins}
                                            variant="outline"
                                            className="flex-1 border-surface-highlight hover:border-primary transition-colors bg-background"
                                            onClick={() => setPendingRoutine({ ...pendingRoutine, cardio: { ...pendingRoutine.cardio, duration: mins } })}
                                            style={{
                                                borderColor: pendingRoutine.cardio?.duration === mins ? 'var(--primary)' : '',
                                                backgroundColor: pendingRoutine.cardio?.duration === mins ? 'rgba(var(--primary-rgb), 0.1)' : ''
                                            }}
                                        >
                                            <span className={cn("font-bold text-lg", pendingRoutine.cardio?.duration === mins ? "text-primary" : "text-text-primary")}>
                                                {mins}'
                                            </span>
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-3 mt-8">
                            <Button
                                className="w-full bg-primary text-black font-bold h-12 text-lg rounded-xl shadow-lg shadow-primary/20"
                                onClick={() => {
                                    onStartDaily(pendingRoutine);
                                    setShowCardioSelector(false);
                                    setPendingRoutine(null);
                                }}
                            >
                                {pendingRoutine.cardio?.duration ? 'Guardar e Iniciar' : 'Empezar sin Cardio'}
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full text-text-secondary hover:text-white h-10"
                                onClick={() => {
                                    setShowCardioSelector(false);
                                    setPendingRoutine(null);
                                }}
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export { DashboardView };
