import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { X, Check, History } from 'lucide-react';
import { getRoutineIcon, calculateCaloriesByVolume, calculateRealCalories } from '../lib/routineUtils';
import { cn, loadWorkoutLogs, loadLastExerciseLog, loadLastExerciseLogGlobal } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { StatisticsView } from './StatisticsView';

/** Formatea una fecha ISO como "hace N días" o "hoy" */
function formatRelativeDate(isoDate) {
    if (!isoDate) return '';
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'hoy';
    if (diffDays === 1) return 'hace 1 día';
    return `hace ${diffDays} días`;
}

const ExerciseDetailModal = ({ exercise, initialLog, lastLog, isCompleted, onClose }) => {
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

    const audioCtxRef = useRef(null);
    // Ref para el setTimeout de la notificación de fondo
    const bgTimeoutRef = useRef(null);
    // Flag para evitar que el beep se dispare dos veces (setTimeout + visibilitychange)
    const beepFiredRef = useRef(false);
    // Ref que mantiene siempre el estado actual del timer (evita closures obsoletas)
    const timerStateRef = useRef({ timerActive: false, targetTime: null, selectedDuration: 60 });
    useEffect(() => {
        timerStateRef.current = { timerActive, targetTime, selectedDuration };
    }, [timerActive, targetTime, selectedDuration]);

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
            // Limpiar timeout de fondo al desmontar
            if (bgTimeoutRef.current) clearTimeout(bgTimeoutRef.current);
        };
    }, []);

    // Pide permiso de notificación del SO (sólo la primera vez)
    const requestNotificationPermission = () => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    };

    // Lanza una notificación nativa del SO (funciona con la pantalla apagada)
    const showSystemNotification = useCallback(() => {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification('¡Recuperación completada! 💪', {
                    body: '¡Es hora de tu siguiente serie!',
                    icon: '/favicon.ico',
                    silent: false,
                });
            } catch (e) {
                console.error('Notification error:', e);
            }
        }
    }, []);

    const unlockAudio = () => {
        // Pedir permiso de notificación en el primer gesto del usuario
        requestNotificationPermission();
        try {
            // Unlock Web Audio API
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

            // Unlock SpeechSynthesis for iOS (must be triggered by user interaction)
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance('');
                utterance.volume = 0;
                window.speechSynthesis.speak(utterance);
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
            // Ensure timer restarts from beginning, but use selectedDuration instead of hardcoded 60
            setTargetTime(Date.now() + selectedDuration * 1000);
            setTimeLeft(selectedDuration);
            setTimerActive(true);
        }
    };

    // Audio context para el sonido de pitido + voz + notificación del SO
    const playBeep = useCallback(() => {
        // Notificación nativa del SO (para cuando la app está en segundo plano)
        showSystemNotification();
        try {
            // Voz (fiable en iOS, interrumpe música de fondo)
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance('Recuperación completada');
                utterance.lang = 'es-ES';
                utterance.rate = 1.1;
                utterance.pitch = 1;
                utterance.volume = 1;
                window.speechSynthesis.speak(utterance);
            }

            // Vibración en móvil
            if ('vibrate' in navigator) {
                navigator.vibrate([500, 200, 500, 200, 800]);
            }

            const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
            if (!ctx) return;

            if (ctx.state === 'suspended') ctx.resume();

            const scheduleBeep = (startTime, freq) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'square';
                gain.gain.value = 1;
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(1, startTime + 0.05);
                gain.gain.setValueAtTime(1, startTime + 0.4);
                gain.gain.linearRampToValueAtTime(0, startTime + 0.5);
                osc.start(startTime);
                osc.stop(startTime + 0.5);
            };

            const now = ctx.currentTime;
            scheduleBeep(now, 880);
            scheduleBeep(now + 0.6, 880);
            scheduleBeep(now + 1.2, 1320);

            if (ctx !== audioCtxRef.current) {
                setTimeout(() => {
                    if (ctx.state !== 'closed') ctx.close().catch(() => {});
                }, 2000);
            }
        } catch (error) {
            console.error('No se pudo reproducir el sonido del temporizador', error);
        }
    }, [showSystemNotification]);

    // Capa 1: setInterval para actualizar el contador visual
    // Capa 2: setTimeout exacto que dispara el beep aunque el intervalo esté throttled
    useEffect(() => {
        let interval = null;

        // Cancelar cualquier timeout de fondo previo
        if (bgTimeoutRef.current) {
            clearTimeout(bgTimeoutRef.current);
            bgTimeoutRef.current = null;
        }

        if (timerActive && targetTime) {
            beepFiredRef.current = false;
            // Timeout exacto: se ejecuta en el momento preciso incluso en background
            const delay = Math.max(0, targetTime - Date.now());
            bgTimeoutRef.current = setTimeout(() => {
                if (beepFiredRef.current) return;
                beepFiredRef.current = true;
                setTimerActive(false);
                setTargetTime(null);
                setTimeLeft(0);
                playBeep();
                setTimeout(() => setTimeLeft(timerStateRef.current.selectedDuration), 2000);
            }, delay);

            // Intervalo solo para actualizar el display visual
            interval = setInterval(() => {
                const remaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
                setTimeLeft(remaining);
            }, 500);
        }

        return () => {
            clearInterval(interval);
            // No cancelamos bgTimeoutRef aquí porque perderíamos la notificación de fondo
        };
    }, [timerActive, targetTime, playBeep]);

    // Capa 3: visibilitychange — cuando el usuario vuelve a la app, disparar si el timer ya expiró
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return;
            const { timerActive, targetTime, selectedDuration } = timerStateRef.current;
            if (!timerActive || !targetTime) return;
            if (Date.now() >= targetTime) {
                // El timer expiró mientras estábamos en segundo plano
                if (beepFiredRef.current) return;
                beepFiredRef.current = true;
                setTimerActive(false);
                setTargetTime(null);
                setTimeLeft(0);
                playBeep();
                setTimeout(() => setTimeLeft(selectedDuration), 2000);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [playBeep]); // solo se registra una vez, usa ref para el estado

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

                    {/* Referencia Última Vez */}
                    {(() => {
                        const sets = lastLog ? Object.entries(lastLog.setsData) : [];

                        const weights = sets.map(([, s]) => s.weight).filter(Boolean);
                        const repsArr = sets.map(([, s]) => s.reps).filter(Boolean);

                        const sharedWeight = weights.length > 0 && weights.every(w => w === weights[0]) ? weights[0] : null;
                        const sharedReps   = repsArr.length > 0 && repsArr.every(r => r === repsArr[0])   ? repsArr[0]  : null;

                        // Construye el badge del header con lo que es común a todas las series
                        const headerBadge = lastLog && sets.length > 0 ? [
                            sharedWeight ? `${sharedWeight} kg` : null,
                            sharedReps   ? `${sharedReps} reps` : null,
                        ].filter(Boolean).join(' × ') : null;

                        // Solo mostramos la lista de series si hay algo que varía
                        const needsPerSeriesList = lastLog && sets.length > 0 && (!sharedWeight || !sharedReps);

                        return (
                            <div className="rounded-2xl border p-4"
                                style={{
                                    background: 'color-mix(in srgb, #f59e0b 8%, transparent)',
                                    borderColor: 'color-mix(in srgb, #f59e0b 30%, transparent)'
                                }}
                            >
                                {/* Header: etiqueta + valores comunes */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <History size={14} className="text-amber-400 flex-shrink-0" />
                                        <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                                            {lastLog ? `Última vez — ${formatRelativeDate(lastLog.date)}` : '¡Primera vez registrada!'}
                                        </span>
                                        {lastLog?.fromOtherRoutine && (
                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                otra rutina
                                            </span>
                                        )}
                                    </div>
                                    {headerBadge && (
                                        <span className="font-mono font-bold text-amber-300 text-sm">
                                            {headerBadge}
                                        </span>
                                    )}
                                </div>

                                {/* Lista por serie: solo cuando peso o reps varían */}
                                {needsPerSeriesList && (
                                    <div className="space-y-1.5 mt-2">
                                        {sets.map(([idx, set]) => {
                                            const parts = [];
                                            if (!sharedWeight && set.weight) parts.push(`${set.weight} kg`);
                                            if (!sharedReps && set.reps)     parts.push(`${set.reps} reps`);
                                            return (
                                                <div key={idx} className="flex items-center justify-between text-sm">
                                                    <span className="text-text-secondary">Serie {parseInt(idx) + 1}</span>
                                                    <span className="font-mono font-bold text-amber-300">
                                                        {parts.join(' × ') || '—'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {!lastLog && (
                                    <p className="text-xs text-text-secondary mt-1">Aún no hay datos históricos para este ejercicio. ¡Registra tu primera sesión!</p>
                                )}
                            </div>
                        );
                    })()}

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

    const activeWorkout = workout?.exercises ? workout : null;

    const [activeExercise, setActiveExercise] = useState(null);
    const [completedExercises, setCompletedExercises] = useState({});
    const [exerciseLogs, setExerciseLogs] = useState({});
    const [lastExerciseLogs, setLastExerciseLogs] = useState({});
    const [workoutStartTime] = useState(() => Date.now());
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    // Cronómetro del entreno: actualiza cada segundo
    useEffect(() => {
        if (!activeWorkout) return;
        const interval = setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - workoutStartTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [workoutStartTime, activeWorkout]);

    const elapsedMinutes = elapsedSeconds / 60;
    const liveCalories = activeWorkout
        ? calculateRealCalories(activeWorkout.exercises, userWeight, elapsedMinutes)
        : 0;
    const displayTime = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`;

    useEffect(() => {
        const fetchExistingLogs = async () => {
            if (!activeWorkout || !user?.id) return;
            try {
                // Cargar logs de hoy
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
                    <p className="text-text-secondary">{activeWorkout?.exercises?.length || 0} Ejercicios</p>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-mono font-bold text-primary">{displayTime}</span>
                        <span className="text-xs text-text-secondary">•</span>
                        <span className="text-xs font-bold text-primary">{liveCalories} kcal</span>
                    </div>
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
                    const endTime = Date.now();
                    const durationMinutes = Math.round((endTime - workoutStartTime) / 60000);
                    const realCalories = calculateRealCalories(activeWorkout.exercises, userWeight, durationMinutes);
                    const finalLogs = {
                        ...exerciseLogs,
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

            {/* Modal Overlay */}
            {activeExercise && (
                <ExerciseDetailModal
                    exercise={activeExercise}
                    initialLog={exerciseLogs[activeExercise.id]}
                    lastLog={lastExerciseLogs[activeExercise.id] ?? null}
                    isCompleted={completedExercises[activeExercise.id]}
                    onClose={handleExerciseModalClose}
                />
            )}
        </div>
    );
};

export { TrainingView, StatisticsView as ProgressView };

