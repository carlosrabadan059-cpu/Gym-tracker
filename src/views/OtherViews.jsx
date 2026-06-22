import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { Check } from 'lucide-react';
import { getRoutineIcon, calculateRealCalories, getAverageWorkoutMET } from '../lib/routineUtils';
import { cn, loadWorkoutLogs, loadLastExerciseLog, loadLastExerciseLogGlobal } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { ExerciseDetailModal } from './ExerciseDetailModal';

const TrainingView = ({ workout, onFinish }) => {
    const { user, profile } = useAuth();
    const userWeight = profile?.weight || null;

    const activeWorkout = workout?.exercises ? workout : null;
    const STORAGE_KEY = activeWorkout ? `gymTracker_workout_${activeWorkout.id}` : null;

    const getSavedState = () => {
        if (!STORAGE_KEY) return null;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    };

    const [activeExercise, setActiveExercise] = useState(null);
    const [resumedFromSave, setResumedFromSave] = useState(false);
    const [completedExercises, setCompletedExercises] = useState({});
    const [exerciseLogs, setExerciseLogs] = useState({});
    const [lastExerciseLogs, setLastExerciseLogs] = useState({});
    const [logsLoading, setLogsLoading] = useState(true);
    const [timerStates, setTimerStates] = useState({});
    const [workoutStartTime] = useState(() => {
        const saved = getSavedState();
        return saved?.workoutStartTime ?? Date.now();
    });
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    useEffect(() => {
        if (!activeWorkout) return;
        const interval = setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - workoutStartTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [workoutStartTime, activeWorkout]);

    const [sessionReady, setSessionReady] = useState(false);
    const [isLiveSession, setIsLiveSession] = useState(false);

    useEffect(() => {
        if (!STORAGE_KEY || !sessionReady) return;
        if (!isLiveSession && !resumedFromSave) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            completedExercises,
            exerciseLogs,
            workoutStartTime,
        }));
    }, [completedExercises, exerciseLogs, workoutStartTime, STORAGE_KEY, sessionReady, isLiveSession, resumedFromSave]);

    const avgMET = useMemo(
        () => activeWorkout ? getAverageWorkoutMET(activeWorkout.exercises) : 0,
        [activeWorkout]
    );
    const liveCalories = activeWorkout
        ? Math.round(avgMET * (userWeight || 75) * (elapsedSeconds / 3600))
        : 0;
    const displayTime = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`;

    useEffect(() => {
        const fetchExistingLogs = async () => {
            if (!activeWorkout || !user?.id) return;
            setLogsLoading(true);
            try {
                const savedSession = getSavedState();

                if (savedSession) {
                    console.log('[TrainingView] Restaurando sesión guardada en localStorage', savedSession);
                    setCompletedExercises(savedSession.completedExercises ?? {});
                    setExerciseLogs(savedSession.exerciseLogs ?? {});
                    setResumedFromSave(true);
                } else {
                    const allLogs = await loadWorkoutLogs(user.id);
                    const todayStr = new Date().toDateString();
                    console.log('[TrainingView] activeWorkout.id:', activeWorkout.id, 'buscando en', allLogs.length, 'logs');
                    console.log('[TrainingView] routineIds en logs:', [...new Set(allLogs.map(l => l.routineId))]);
                    const todaysLog = allLogs.find(l =>
                        l.routineId === activeWorkout.id && new Date(l.date).toDateString() === todayStr
                    );
                    console.log('[TrainingView] log de hoy:', todaysLog);

                    const weekStart = new Date();
                    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                    weekStart.setHours(0, 0, 0, 0);
                    const recentLog = todaysLog || allLogs
                        .filter(l => l.routineId === activeWorkout.id && new Date(l.date) >= weekStart)
                        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

                    if (recentLog && recentLog.logs) {
                        const currentExerciseIds = new Set(activeWorkout.exercises?.map(ex => String(ex.id)) || []);
                        const filteredLogs = {};
                        Object.entries(recentLog.logs).forEach(([id, log]) => {
                            if (currentExerciseIds.has(String(id)) || id === 'workoutDuration' || id === 'cardio') {
                                filteredLogs[id] = log;
                            }
                        });

                        setExerciseLogs(filteredLogs);
                        const completed = {};
                        activeWorkout.exercises?.forEach(ex => {
                            if (filteredLogs[ex.id] || filteredLogs[String(ex.id)]) completed[ex.id] = true;
                        });
                        setCompletedExercises(completed);
                    }
                }

                if (activeWorkout.exercises?.length) {
                    const lastLogsEntries = await Promise.all(
                        activeWorkout.exercises.map(async (ex) => {
                            let last = await loadLastExerciseLog(user.id, activeWorkout.id, ex.id);
                            if (!last && ex.name) {
                                last = await loadLastExerciseLogGlobal(user.id, ex.name, activeWorkout.id);
                            }
                            return [ex.id, last];
                        })
                    );
                    setLastExerciseLogs(Object.fromEntries(lastLogsEntries));
                }
            } catch (error) {
                console.error("Failed to fetch logs:", error);
            } finally {
                setLogsLoading(false);
                setSessionReady(true);
            }
        };
        fetchExistingLogs();
    }, [activeWorkout, user]);

    const allExercisesCompleted = activeWorkout?.exercises?.every(ex => completedExercises[ex.id]);

    const handleExerciseModalClose = (completed, logs) => {
        if (activeExercise) {
            setIsLiveSession(true);
            setExerciseLogs(prev => ({
                ...prev,
                [activeExercise.id]: logs
            }));
            if (completed) {
                setCompletedExercises(prev => ({
                    ...prev,
                    [activeExercise.id]: true
                }));
            }
            setActiveExercise(null);
        }
    };

    if (!activeWorkout) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-24 text-center gap-4">
                <p className="text-text-secondary text-sm">No se pudo cargar la rutina.</p>
                <button
                    onClick={() => onFinish(null)}
                    className="px-6 py-2 rounded-xl bg-surface-highlight text-text-primary text-sm font-medium"
                >
                    Volver
                </button>
            </div>
        );
    }

    const routineIcon = getRoutineIcon(activeWorkout.name);

    const handleResetSession = () => {
        if (STORAGE_KEY) localStorage.removeItem(STORAGE_KEY);
        setCompletedExercises({});
        setExerciseLogs({});
        setResumedFromSave(false);
    };

    return (
        <div className="flex h-full flex-col items-center p-6 text-center space-y-6 relative">
            <Card className="w-full p-6 bg-surface border-l-4 border-primary flex items-center gap-4">
                {routineIcon && (
                    <div className="h-20 w-20 rounded-3xl overflow-hidden bg-surface-highlight/50 border border-surface-highlight flex-shrink-0">
                        <img
                            src={routineIcon}
                            alt="icon"
                            className="h-full w-full object-cover p-2.5"
                        />
                    </div>
                )}
                <div className="text-left flex-1">
                    <h2 className="text-2xl font-bold text-black dark:text-white leading-tight">{activeWorkout?.name || 'Entrenamiento'}</h2>
                    {resumedFromSave ? (
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">Retomando entrenamiento</span>
                            <button
                                onClick={handleResetSession}
                                className="text-xs text-text-secondary underline underline-offset-2"
                            >
                                Reiniciar
                            </button>
                        </div>
                    ) : (
                        <p className="text-text-secondary">{activeWorkout?.exercises?.length || 0} Ejercicios</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-mono font-bold text-primary">{displayTime}</span>
                        <span className="text-xs text-text-secondary">•</span>
                        <span className="text-xs font-bold text-primary">{liveCalories} kcal</span>
                    </div>
                </div>
            </Card>

            <div className="w-full space-y-4 flex-1 overflow-y-auto pb-20">
                {logsLoading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                ) : null}
                {!logsLoading && activeWorkout?.exercises?.map((ex, idx) => (
                    <Card
                        key={ex.id || idx}
                        className="p-4 flex items-center gap-4 bg-surface active:bg-surface-highlight transition-colors cursor-pointer"
                        onClick={() => setActiveExercise(ex)}
                    >
                        <div className="h-16 w-16 rounded-lg bg-surface-highlight overflow-hidden flex-shrink-0">
                            {(ex.image_url || ex.image) && (
                                <img
                                    src={ex.image_url || ex.image}
                                    alt={ex.name}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=200';
                                    }}
                                />
                            )}
                        </div>
                        <div className="flex-1 text-left">
                            <h4 className="font-bold text-black dark:text-white">{ex.name}</h4>
                            <p className="text-sm text-primary">{ex.series} series x {ex.reps} reps</p>
                        </div>
                        <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all ${completedExercises[ex.id]
                            ? 'bg-primary border-primary text-black'
                            : 'border-text-secondary/30 group-hover:border-primary'
                            }`}>
                            {completedExercises[ex.id] && <Check size={18} strokeWidth={3} />}
                        </div>
                    </Card>
                ))}
            </div>

            <button
                onClick={() => {
                    const endTime = Date.now();
                    const durationMinutes = Math.round((endTime - workoutStartTime) / 60000);
                    const realCalories = calculateRealCalories(activeWorkout.exercises, userWeight, durationMinutes);
                    const currentExerciseIds = new Set(activeWorkout.exercises?.map(ex => String(ex.id)) || []);
                    const filteredExerciseLogs = {};
                    Object.entries(exerciseLogs).forEach(([id, log]) => {
                        if (currentExerciseIds.has(String(id))) {
                            filteredExerciseLogs[id] = log;
                        }
                    });

                    const finalLogs = {
                        ...filteredExerciseLogs,
                        workoutDuration: {
                            startTime: workoutStartTime,
                            endTime,
                            durationMinutes,
                            realCalories
                        }
                    };
                    if (activeWorkout?.cardio) {
                        finalLogs.cardio = activeWorkout.cardio;
                    }
                    onFinish(finalLogs);
                }}
                disabled={!allExercisesCompleted}
                className={cn(
                    "w-full py-4 font-bold rounded-xl transition-all duration-300",
                    allExercisesCompleted
                        ? "bg-primary text-black active:scale-95 shadow-lg shadow-primary/20"
                        : "bg-surface-highlight text-text-secondary opacity-50 grayscale cursor-not-allowed"
                )}
            >
                Terminar Entrenamiento
            </button>

            {activeExercise && (
                <ExerciseDetailModal
                    exercise={activeExercise}
                    initialLog={exerciseLogs[activeExercise.id]}
                    lastLog={lastExerciseLogs[activeExercise.id] ?? null}
                    isCompleted={completedExercises[activeExercise.id]}
                    onClose={handleExerciseModalClose}
                    savedTimerState={timerStates[activeExercise.id]}
                    onTimerStateChange={(state) =>
                        setTimerStates(prev => ({ ...prev, [activeExercise.id]: state }))
                    }
                />
            )}
        </div>
    );
};

export { TrainingView };
