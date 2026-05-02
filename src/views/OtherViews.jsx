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
    let isBodyweight = false;
    if (exercise.catalog_id) {
        isBodyweight = [84, 85, 86, 87, 88, 89, 90, 91, 93, 94].includes(Number(exercise.catalog_id));
    } else {
        const hasWeightKeywords = exerciseName.includes('máquina') || exerciseName.includes('mancuerna') || exerciseName.includes('barra') || exerciseName.includes('polea') || exerciseName.includes('disco');
        isBodyweight = !hasWeightKeywords && (
            exerciseName.includes('abdominal') ||
            exerciseName.includes('crunch') ||
            (exerciseName.includes('elevación') && (exerciseName.includes('pierna') || exerciseName.includes('rodilla') || exerciseName.includes('pelvis'))) ||
            exerciseName.includes('encogimiento') ||
            exerciseName.includes('lumbar') ||
            exerciseName.includes('plancha')
        );
    }
    let isTimeBased = false;
    if (exercise.catalog_id) {
        isTimeBased = Number(exercise.catalog_id) === 97;
    } else {
        isTimeBased = exerciseName.includes('plancha');
    }

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
    // Flag para evitar que el beep se dispare dos veces (SW message + visibilitychange)
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

        // Crear audio silencioso en loop para mantener JS despierto en iOS
        const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        silentAudio.loop = true;
        silentAudioRef.current = silentAudio;

        return () => {
            if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
                audioCtxRef.current.close().catch(() => {});
            }
            scheduleSWNotification(null);
        };
    }, []);

    // Pide permiso de notificación a través del SW (requerido en iOS y Android)
    const requestNotificationPermission = async () => {
        if ('Notification' in window && Notification.permission !== 'granted') {
            try {
                await Notification.requestPermission();
            } catch (e) {
                console.error("Permission request failed", e);
            }
        }
    };

    // Envía un mensaje al Service Worker para que gestione la notificación de fondo.
    // targetTime = timestamp en ms → programa la notificación
    // targetTime = null         → cancela cualquier notificación pendiente
    const scheduleSWNotification = (targetTime, isStart = false) => {
        if (!('serviceWorker' in navigator)) return;
        const msg = targetTime !== null
            ? { 
                type: 'SCHEDULE_NOTIFICATION', 
                targetTime, 
                title: isStart ? '¡Descanso iniciado! ⏱️' : '¡Recuperación completada! 💪',
                body: isStart ? 'El temporizador ha comenzado.' : '¡Es hora de tu siguiente serie!',
                isStart
              }
            : { type: 'CANCEL_NOTIFICATION' };

        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage(msg);
        } else {
            navigator.serviceWorker.ready.then((reg) => {
                if (reg.active) reg.active.postMessage(msg);
            }).catch(() => {});
        }
    };

    // Silent audio element reference to keep background alive
    const silentAudioRef = useRef(null);

    const unlockAudio = () => {
        // Pedir permiso de notificación en el primer gesto del usuario
        requestNotificationPermission().catch(() => {});
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
            const dur = selectedDuration;
            const target = Date.now() + dur * 1000;
            setTargetTime(target);
            setTimeLeft(dur);
            setTimerActive(true);
            playBeep('start');
            scheduleSWNotification(target, true);
        }
    };

    // Audio context para el sonido de pitido
    // Usamos Web Audio API porque suele mezclarse con la música en lugar de pausarla
    const playBeep = useCallback((type = 'end') => {
        try {
            const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
            if (!ctx) return;
            if (ctx.state === 'suspended') ctx.resume();

            const now = ctx.currentTime;
            
            const scheduleNote = (startTime, freq, duration, type = 'sine') => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = type;
                
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
                gain.gain.setValueAtTime(0.3, startTime + duration - 0.05);
                gain.gain.linearRampToValueAtTime(0, startTime + duration);
                
                osc.frequency.setValueAtTime(freq, startTime);
                osc.start(startTime);
                osc.stop(startTime + duration);
            };

            if (type === 'start') {
                // Sonido corto ascendente para el inicio
                scheduleNote(now, 440, 0.15);
                scheduleNote(now + 0.1, 880, 0.2);
            } else {
                // Sonido de fin (clásico triple beep)
                scheduleNote(now, 880, 0.3, 'square');
                scheduleNote(now + 0.4, 880, 0.3, 'square');
                scheduleNote(now + 0.8, 1320, 0.5, 'square');
                
                // Vibración en móvil
                if ('vibrate' in navigator) {
                    navigator.vibrate([500, 200, 500, 200, 800]);
                }
            }
        } catch (error) {
            console.error('No se pudo reproducir el sonido del temporizador', error);
        }
    }, []);

    // Capa 1: setInterval para actualizar el contador visual
    // Capa 2: Service Worker programa la notificación nativa en background (sw.js)
    useEffect(() => {
        let interval = null;

        if (timerActive && targetTime) {
            beepFiredRef.current = false;

            // Delegar la notificación de fondo al Service Worker
            scheduleSWNotification(targetTime);

            // Intervalo solo para actualizar el display visual
            interval = setInterval(() => {
                const remaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
                setTimeLeft(remaining);
                // Safety net: si la app sigue visible y el tiempo expiró, disparar aquí
                if (remaining === 0 && !beepFiredRef.current) {
                    beepFiredRef.current = true;
                    setTimerActive(false);
                    setTargetTime(null);
                    scheduleSWNotification(null);
                    playBeep('end');
                    setTimeout(() => setTimeLeft(timerStateRef.current.selectedDuration), 2000);
                }
            }, 500);
        } else {
            // Timer parado: cancelar cualquier notificación pendiente en el SW
            scheduleSWNotification(null);
        }

        return () => {
            clearInterval(interval);
        };
    }, [timerActive, targetTime, playBeep]);

    // Capa 3: Mensaje del SW → el timer expiró mientras la app estaba en segundo plano
    // En este momento la app puede estar visible (usuario volvió) y hay que reproducir audio.
    useEffect(() => {
        const handleSWMessage = (event) => {
            if (event.data?.type !== 'TIMER_FIRED') return;
            if (beepFiredRef.current) return;
            beepFiredRef.current = true;
            const { selectedDuration } = timerStateRef.current;
            setTimerActive(false);
            setTargetTime(null);
            setTimeLeft(0);
            playBeep('end');
            setTimeout(() => setTimeLeft(selectedDuration), 2000);
        };
        navigator.serviceWorker?.addEventListener('message', handleSWMessage);
        return () => navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    }, [playBeep]);

    // Capa 4: visibilitychange — cuando el usuario vuelve a la app, disparar si el timer ya expiró
    // (Fallback por si el SW fue terminado por el SO antes de disparar)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return;
            const { timerActive, targetTime, selectedDuration } = timerStateRef.current;
            if (!timerActive || !targetTime) return;
            if (Date.now() >= targetTime) {
                if (beepFiredRef.current) return;
                beepFiredRef.current = true;
                setTimerActive(false);
                setTargetTime(null);
                setTimeLeft(0);
                scheduleSWNotification(null);
                playBeep('end');
                setTimeout(() => setTimeLeft(selectedDuration), 2000);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [playBeep]);

    const toggleTimer = () => {
        unlockAudio();
        if (!timerActive) {
            const dur = selectedDuration;
            const t = Date.now() + dur * 1000;
            setTargetTime(t);
            setTimeLeft(dur);
            setTimerActive(true);
            playBeep('start');
            scheduleSWNotification(t, true);
        } else {
            setTimerActive(false);
            setTargetTime(null);
            scheduleSWNotification(null);
        }
    };

    const handleDurationSelect = (duration) => {
        setSelectedDuration(duration);
        if (!timerActive) {
            setTimeLeft(duration);
        } else {
            const newTarget = Date.now() + duration * 1000;
            setTargetTime(newTarget);
            setTimeLeft(duration);
            silentAudioRef.current?.play().catch(() => {});
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
                            <p className="text-xs text-text-secondary uppercase tracking-wider">{isTimeBased ? 'Minutos' : 'Repeticiones'}</p>
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
                            sharedWeight && !isBodyweight ? `${sharedWeight} kg` : null,
                            sharedReps   ? `${sharedReps} ${isTimeBased ? 'min' : 'reps'}` : null,
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
                                            if (!sharedWeight && set.weight && !isBodyweight && !isTimeBased) parts.push(`${set.weight} kg`);
                                            if (!sharedReps && set.reps)     parts.push(`${set.reps} ${isTimeBased ? 'min' : 'reps'}`);
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
                                {!isBodyweight && !isTimeBased && (
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
                                    <span className="text-xs text-text-secondary">{isTimeBased ? 'min' : 'reps'}</span>
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
    const [logsLoading, setLogsLoading] = useState(true);
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
            setLogsLoading(true);
            try {
                // Cargar logs de hoy o, en modo revisión, el más reciente de la semana
                const allLogs = await loadWorkoutLogs(user.id);
                const todayStr = new Date().toDateString();
                const todaysLog = allLogs.find(l =>
                    l.routineId === activeWorkout.id && new Date(l.date).toDateString() === todayStr
                );

                const weekStart = new Date();
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                weekStart.setHours(0, 0, 0, 0);
                const recentLog = todaysLog || allLogs
                    .filter(l => l.routineId === activeWorkout.id && new Date(l.date) >= weekStart)
                    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

                if (recentLog && recentLog.logs) {
                    setExerciseLogs(recentLog.logs);
                    const completed = {};
                    activeWorkout.exercises?.forEach(ex => {
                        if (recentLog.logs[ex.id]) completed[ex.id] = true;
                    });
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
            } finally {
                setLogsLoading(false);
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

