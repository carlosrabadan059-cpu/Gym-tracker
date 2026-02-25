import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { routines } from '../data/routines';
import { X, Info, Check } from 'lucide-react';
import { getRoutineIcon, calculateCaloriesByVolume } from '../lib/routineUtils';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

const ExerciseDetailModal = ({ exercise, onClose }) => {
    if (!exercise) return null;

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
    const [selectedDuration, setSelectedDuration] = useState(60);
    const [completedSets, setCompletedSets] = useState({});
    const [setsData, setSetsData] = useState(() => {
        const initial = {};
        const count = parseInt(exercise.series) || 3;
        for (let i = 0; i < count; i++) {
            initial[i] = { weight: '', reps: exercise.reps || '10' };
        }
        return initial;
    });
    const [inputErrors, setInputErrors] = useState({});
    const [showInfo, setShowInfo] = useState(false);

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

        setCompletedSets(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    // Audio context for beep sound
    const playBeep = () => {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.value = 880; // A5
        gain.gain.value = 0.1;

        osc.start();
        setTimeout(() => {
            osc.stop();
            ctx.close();
        }, 500);
    };

    useEffect(() => {
        let interval = null;
        if (timerActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setTimerActive(false);
            playBeep();
            setTimeout(() => setTimeLeft(selectedDuration), 2000);
        }
        return () => clearInterval(interval);
    }, [timerActive, timeLeft, selectedDuration]);

    const toggleTimer = () => {
        if (!timerActive) {
            setTimeLeft(selectedDuration);
            setTimerActive(true);
        } else {
            setTimerActive(false);
        }
    };

    const handleDurationSelect = (duration) => {
        setSelectedDuration(duration);
        if (!timerActive) {
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
                        onClick={() => onClose(false)}
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

                    {/* Info / Tips Collapsible */}
                    <div className="flex flex-col items-start">
                        <button
                            onClick={() => setShowInfo(!showInfo)}
                            className="bg-blue-500/20 p-2 rounded-full text-blue-400 hover:bg-blue-500/30 transition-colors"
                        >
                            <Info size={20} />
                        </button>

                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showInfo ? 'max-h-24 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                            <div
                                className="rounded-xl bg-blue-500/10 p-3 border border-blue-500/20 text-sm text-blue-200 cursor-pointer"
                                onClick={() => setShowInfo(false)}
                            >
                                Mantén la técnica controlada en todo momento. Descansa 60-90s entre series.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Action - Fixed at bottom of modal */}
                <div className="p-4 pb-6 border-t border-surface-highlight bg-surface mt-auto z-10">
                    <button
                        onClick={() => {
                            // Close and return true to indicate completion
                            onClose(true);
                        }}
                        className="w-full rounded-2xl bg-primary py-4 font-bold text-black shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                    >
                        Completar Ejercicio
                    </button>
                </div>
            </div>
        </div>
    );
};

const TrainingView = ({ workout, onFinish }) => {
    const { profile } = useAuth();
    const userWeight = profile?.weight || null;

    // If no specific workout passed, default to Day 1
    const activeWorkout = workout && workout.exercises ? workout : routines.find(r => r.id === 'day1');
    const [activeExercise, setActiveExercise] = useState(null);
    const [completedExercises, setCompletedExercises] = useState({});

    const allExercisesCompleted = activeWorkout?.exercises?.every(ex => completedExercises[ex.id]);

    const handleExerciseComplete = () => {
        if (activeExercise) {
            setCompletedExercises(prev => ({
                ...prev,
                [activeExercise.id]: true
            }));
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
                onClick={onFinish}
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
                    onClose={(completed) => {
                        if (completed === true) {
                            handleExerciseComplete();
                        } else {
                            setActiveExercise(null);
                        }
                    }}
                />
            )}
        </div>
    );
};

import { StatisticsView } from './StatisticsView';



export { TrainingView, StatisticsView as ProgressView };

