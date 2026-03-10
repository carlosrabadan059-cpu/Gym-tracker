import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { routines } from '../data/routines';
import { X, Check } from 'lucide-react';
import { getRoutineIcon, calculateCaloriesByVolume } from '../lib/routineUtils';
import { cn, loadWorkoutLogs } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

const ExerciseDetailModal = ({ exercise, initialLog, isCompleted, onClose }) => {
    const { profile } = useAuth();
    const userWeight = profile?.weight || null;

    const exerciseName = (exercise?.name || '').toLowerCase();
    const isBodyweight = exerciseName.includes('abdominal') ||
        exerciseName.includes('crunch') ||
        exerciseName.includes('elevación') ||
        exerciseName.includes('encogimiento') ||
        exerciseName.includes('lumbar') ||
        exerciseName.includes('plancha');

    const [timerActive, setTimerActive] = useState(false);
    const [timeLeft, setTimeLeft] = useState(60);
    const [targetTime, setTargetTime] = useState(null);
    const [selectedDuration, setSelectedDuration] = useState(60);
    const [completedSets, setCompletedSets] = useState(initialLog?.completedSets || {});
    const [setsData, setSetsData] = useState(() => {
        if (initialLog && initialLog.setsData) {
            return initialLog.setsData;
        }
        const initial = {};
        const count = parseInt(exercise.series) || 3;
        for (let i = 0; i < count; i++) {
            initial[i] = { weight: '', reps: exercise.reps || '10' };
        }
        return initial;
    });
    const [inputErrors, setInputErrors] = useState({});

    const audioCtxRef = React.useRef(null);

    useEffect(() => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                audioCtxRef.current = new AudioContext();
            }
        } catch (e) {
            console.error("AudioContext error:", e);
        }
        
        return () => {
            if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
                audioCtxRef.current.close().catch(() => {});
            }
        };
    }, []);

    const unlockAudio = () => {
        try {
            if (audioCtxRef.current) {
                if (audioCtxRef.current.state === 'suspended') {
                    audioCtxRef.current.resume();
                }
                const osc = audioCtxRef.current.createOscillator();
                const gain = audioCtxRef.current.createGain();
                gain.gain.value = 0;
                osc.connect(gain);
                gain.connect(audioCtxRef.current.destination);
                osc.start(audioCtxRef.current.currentTime);
                osc.stop(audioCtxRef.current.currentTime + 0.001);
            }
        } catch (e) {
            console.error("Unlock error:", e);
        }
    };

    const handleInputChange = (index, field, value) => {
        setSetsData(prev => ({
            ...prev,
            [index]: { ...prev[index], [field]: value }
        }));
        // Clear error when user types
        if (field === 'weight' && inputErrors[index]) {
            setInputErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[index];
                return newErrors;
            });
        }
    };

    const toggleSet = (index) => {
        const currentSet = setsData[index];
        if (!isBodyweight && (!currentSet || !currentSet.weight)) {
            setInputErrors(prev => ({ ...prev, [index]: true }));
            return;
        }

        const isCompleting = !completedSets[index];

        setCompletedSets(prev => ({
            ...prev,
            [index]: !prev[index]
        }));

        unlockAudio();

        if (isCompleting) {
            setSelectedDuration(60);
            setTargetTime(Date.now() + 60 * 1000);
            setTimeLeft(60);
            setTimerActive(true);
        }
    };

    // Audio context for beep sound (Louder, 3-beep sequence)
    const playBeep = () => {
        try {
            // Vibrate for mobile devices
            if ('vibrate' in navigator) {
                navigator.vibrate([500, 200, 500, 200, 800]); 
            }

            const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
            if (!ctx) return;

            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const scheduleBeep = (startTime, freq) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.type = 'square'; // More audible piercing sound
                gain.gain.value = 1; // Maximum volume
                osc.frequency.setValueAtTime(freq, startTime);

                // Attack and release envelope to avoid clicking while keeping it loud
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(1, startTime + 0.05); // slower attack
                gain.gain.setValueAtTime(1, startTime + 0.4); // longer sustain
                gain.gain.linearRampToValueAtTime(0, startTime + 0.5); // slower decay

                osc.start(startTime);
                osc.stop(startTime + 0.5);
            };

            const now = ctx.currentTime;
            // 3 distinct alarm beeps (longer and louder)
            scheduleBeep(now, 880);
            scheduleBeep(now + 0.6, 880);
            scheduleBeep(now + 1.2, 1320);

            // Do not close it if we are using the shared ref
            if (ctx !== audioCtxRef.current) {
                setTimeout(() => {
                    if (ctx.state !== 'closed') ctx.close().catch(() => {});
                }, 2000);
            }
        } catch (error) {
            console.error("No se pudo reproducir el sonido del temporizador", error);
        }
    };

    useEffect(() => {
        let interval = null;
        if (timerActive && targetTime) {
            // Check frequently (e.g. 500ms) to ensure smooth UI even if it lags a bit
            interval = setInterval(() => {
                const now = Date.now();
                const remaining = Math.max(0, Math.ceil((targetTime - now) / 1000));

                if (remaining > 0) {
                    setTimeLeft(remaining);
                } else {
                    // Timer finished
                    setTimerActive(false);
                    setTargetTime(null);
                    setTimeLeft(0);
                    playBeep();
                    setTimeout(() => setTimeLeft(selectedDuration), 2000);
                }
            }, 500);
        }
        return () => clearInterval(interval);
    }, [timerActive, targetTime, selectedDuration]);

    const toggleTimer = () => {
        unlockAudio();
        if (!timerActive) {
            setTargetTime(Date.now() + selectedDuration * 1000);
            setTimeLeft(selectedDuration);
            setTimerActive(true);
        } else {
            setTimerActive(false);
            setTargetTime(null);
        }
    };

    const handleDurationSelect = (duration) => {
        setSelectedDuration(duration);
        if (!timerActive) {
            setTimeLeft(duration);
        } else {
            // If already active, adjust the target time
            setTargetTime(Date.now() + duration * 1000);
            setTimeLeft(duration);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md overflow-hidden rounded-3xl bg-surface border border-surface-highlight shadow-2xl relative flex flex-col max-h-[80vh]">

                {/* Header Image */}
                <div className="relative h-64 w-full bg-gray-900">
                    <img
                        src={exercise.image_url || exercise.image}
                        alt={exercise.name}
                        className="h-full w-full object-cover opacity-90"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=800';
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
                    <button
                        onClick={() => onClose(false, { setsData, completedSets })}
                        className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors z-10"
                    >
                        <X size={24} />
                    </button>
                    <div className="absolute bottom-4 left-6">
                        <h2 className="text-3xl font-bold text-black dark:text-white leading-tight">{exercise.name}</h2>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-surface">
                    {/* Timer Section */}
                    <div className="bg-surface-highlight rounded-2xl p-4 border border-surface-highlight flex flex-col items-center">
                        <h3 className="text-xs text-text-secondary uppercase tracking-wider mb-3">Temporizador de Descanso</h3>
                        <div className="flex items-center gap-4 mb-4">
                            {[60, 90].map(duration => (
                                <button
                                    key={duration}
                                    onClick={() => handleDurationSelect(duration)}
                                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${selectedDuration === duration
                                        ? 'bg-primary text-black scale-105'
                                        : 'bg-surface text-text-secondary hover:bg-surface-highlight'
                                        }`}
                                >
                                    {duration}s
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={toggleTimer}
                            className={`w-full py-3 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${timerActive
                                ? 'bg-red-500/20 text-red-500 border border-red-500/50'
                                : 'bg-surface text-black dark:text-white hover:bg-surface-highlight border border-surface-highlight'
                                }`}
                        >
                            {timerActive ? (
                                <>
                                    <span>Detener</span>
                                    <span className="font-mono text-2xl ml-2">{timeLeft}s</span>
                                </>
                            ) : (
                                <>
                                    <span>Iniciar Descanso</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Targets */}
                    <div className="flex justify-around rounded-2xl bg-surface-highlight p-4 border border-surface-highlight">
                        <div className="text-center">
                            <p className="text-xs text-text-secondary uppercase tracking-wider">Series</p>
                            <p className="text-2xl font-bold text-primary">{exercise.series}</p>
                        </div>
                        <div className="h-full w-px bg-surface" />
                        <div className="text-center">
                            <p className="text-xs text-text-secondary uppercase tracking-wider">Repeticiones</p>
                            <p className="text-2xl font-bold text-primary">{exercise.reps}</p>
                        </div>
                        <div className="h-full w-px bg-surface" />
                        <div className="text-center">
                            <p className="text-xs text-text-secondary uppercase tracking-wider">Calorías</p>
                            <p className="text-2xl font-bold text-primary">{calculateCaloriesByVolume(exercise, userWeight)} kcal</p>
                        </div>
                    </div>

                    {/* Logging Inputs */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-2">Registrar Series</h3>
                        {Array.from({ length: parseInt(exercise.series) || 3 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="w-8 text-center font-bold text-text-secondary">{i + 1}</span>
                                {!isBodyweight && (
                                    <div className={`flex-1 rounded-xl bg-background border px-4 py-3 flex items-center gap-2 transition-colors ${inputErrors[i] ? 'border-red-500 bg-red-500/10' : 'border-surface-highlight'
                                        }`}>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={setsData[i]?.weight || ''}
                                            onChange={(e) => handleInputChange(i, 'weight', e.target.value)}
                                            className="w-full bg-transparent text-black dark:text-white placeholder-text-secondary focus:outline-none text-right font-mono"
                                        />
                                        <span className="text-xs text-text-secondary">kg</span>
                                    </div>
                                )}
                                <div className="flex-1 rounded-xl bg-background border border-surface-highlight px-4 py-3 flex items-center gap-2">
                                    <input
                                        type="number"
                                        placeholder={exercise.reps}
                                        value={setsData[i]?.reps || ''}
                                        onChange={(e) => handleInputChange(i, 'reps', e.target.value)}
                                        className="w-full bg-transparent text-black dark:text-white placeholder-text-secondary focus:outline-none text-right font-mono"
                                    />
                                    <span className="text-xs text-text-secondary">reps</span>
                                </div>
                                <div
                                    className={`h-6 w-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${completedSets[i]
                                        ? 'bg-primary border-primary text-black'
                                        : 'border-text-secondary/30 hover:border-primary hover:bg-primary/20'
                                        }`}
                                    onClick={() => toggleSet(i)}
                                >
                                    {completedSets[i] && <Check size={14} strokeWidth={3} />}
                                </div>
                            </div>
                        ))}
                    </div>


                </div>

                {/* Footer Action - Fixed at bottom of modal */}
                <div className="p-4 pb-6 border-t border-surface-highlight bg-surface mt-auto z-10">
                    <button
                        onClick={() => {
                            // Close and return true to indicate completion, pass logs
                            onClose(true, { setsData, completedSets });
                        }}
                        className="w-full rounded-2xl bg-primary py-4 font-bold text-black shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                    >
                        {isCompleted ? 'Actualizar Ejercicio' : 'Completar Ejercicio'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const TrainingView = ({ workout, onFinish }) => {
    const { user, profile } = useAuth();
    const userWeight = profile?.weight || null;

    // If no specific workout passed, default to Day 1
    const activeWorkout = workout && workout.exercises ? workout : routines.find(r => r.id === 'day1');
    const [activeExercise, setActiveExercise] = useState(null);
    const [completedExercises, setCompletedExercises] = useState({});
    const [exerciseLogs, setExerciseLogs] = useState({});

    useEffect(() => {
        const fetchExistingLogs = async () => {
            if (activeWorkout && user?.id) {
                try {
                    const allLogs = await loadWorkoutLogs(user.id);
                    const todayStr = new Date().toDateString();
                    const todaysLog = allLogs.find(l =>
                        l.routineId === activeWorkout.id && new Date(l.date).toDateString() === todayStr
                    );

                    if (todaysLog && todaysLog.logs) {
                        setExerciseLogs(todaysLog.logs);
                        const completed = {};
                        Object.keys(todaysLog.logs).forEach(exId => completed[exId] = true);
                        setCompletedExercises(completed);
                    }
                } catch (error) {
                    console.error("Failed to fetch todays logs:", error);
                }
            }
        };
        fetchExistingLogs();
    }, [activeWorkout, user]);

    const allExercisesCompleted = activeWorkout?.exercises?.every(ex => completedExercises[ex.id]);

    const handleExerciseModalClose = (completed, logs) => {
        if (activeExercise) {
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

    const routineIcon = getRoutineIcon(activeWorkout?.name);
    const totalRoutineCalories = activeWorkout?.exercises?.reduce((sum, ex) => sum + calculateCaloriesByVolume(ex, userWeight), 0) || 0;

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
                    <p className="text-text-secondary">{activeWorkout?.exercises?.length || 0} Ejercicios • {totalRoutineCalories} kcal</p>
                </div>
            </Card>

            <div className="w-full space-y-4 flex-1 overflow-y-auto pb-20">
                {activeWorkout?.exercises?.map((ex, idx) => (
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
                    const finalLogs = { ...exerciseLogs };
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

            {/* Modal Overlay */}
            {activeExercise && (
                <ExerciseDetailModal
                    exercise={activeExercise}
                    initialLog={exerciseLogs[activeExercise.id]}
                    isCompleted={completedExercises[activeExercise.id]}
                    onClose={handleExerciseModalClose}
                />
            )}
        </div>
    );
};

import { StatisticsView } from './StatisticsView';



export { TrainingView, StatisticsView as ProgressView };

