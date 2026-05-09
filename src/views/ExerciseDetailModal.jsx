import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, History } from 'lucide-react';
import { calculateCaloriesByVolume } from '../lib/routineUtils';
import { isBodyweightExercise, isTimeBasedExercise } from '../lib/exerciseUtils';
import { useAuth } from '../context/AuthContext';
import { subscribeToPush, scheduleServerPush } from '../lib/pushNotifications';

function formatRelativeDate(isoDate) {
    if (!isoDate) return '';
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'hoy';
    if (diffDays === 1) return 'hace 1 día';
    return `hace ${diffDays} días`;
}

export const ExerciseDetailModal = ({ exercise, initialLog, lastLog, isCompleted, onClose, savedTimerState, onTimerStateChange }) => {
    const { user, profile } = useAuth();
    const userWeight = profile?.weight || null;

    const isBodyweight = isBodyweightExercise(exercise);
    const isTimeBased = isTimeBasedExercise(exercise);

    const [timerActive, setTimerActive] = useState(() => {
        if (!savedTimerState?.timerActive || !savedTimerState?.targetTime) return false;
        return savedTimerState.targetTime > Date.now();
    });
    const [timeLeft, setTimeLeft] = useState(() => {
        const dur = savedTimerState?.selectedDuration ?? 60;
        if (!savedTimerState?.timerActive || !savedTimerState?.targetTime) return dur;
        const remaining = Math.ceil((savedTimerState.targetTime - Date.now()) / 1000);
        return remaining > 0 ? remaining : dur;
    });
    const [targetTime, setTargetTime] = useState(() => {
        if (!savedTimerState?.timerActive || !savedTimerState?.targetTime) return null;
        return savedTimerState.targetTime > Date.now() ? savedTimerState.targetTime : null;
    });
    const [selectedDuration, setSelectedDuration] = useState(savedTimerState?.selectedDuration ?? 60);
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
    const beepFiredRef = useRef(false);
    const scheduledEndNodesRef = useRef([]);
    const timerStateRef = useRef({ timerActive: false, targetTime: null, selectedDuration: 60 });
    const onTimerStateChangeRef = useRef(onTimerStateChange);
    useEffect(() => { onTimerStateChangeRef.current = onTimerStateChange; }, [onTimerStateChange]);
    useEffect(() => {
        timerStateRef.current = { timerActive, targetTime, selectedDuration };
        onTimerStateChangeRef.current?.({ timerActive, targetTime, selectedDuration });
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

        const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        silentAudio.loop = true;
        silentAudioRef.current = silentAudio;

        return () => {
            cancelScheduledEndBeep();
            if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
                audioCtxRef.current.close().catch(() => {});
            }
            if (!timerStateRef.current.timerActive) {
                scheduleSWNotification(null);
            }
        };
    }, []);

    const requestNotificationPermission = async () => {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    scheduleSWNotification(Date.now() + 1000, true);
                    // Register Web Push subscription for background notifications
                    if (user?.id) subscribeToPush(user.id);
                }
            } catch (e) {
                console.error("Permission request failed", e);
            }
        }
    };

    // Auto-subscribe to Web Push if permission was previously granted
    const [pushDebug, setPushDebug] = useState('');
    useEffect(() => {
        if (user?.id && 'Notification' in window && Notification.permission === 'granted') {
            setPushDebug('Subscribing...');
            subscribeToPush(user.id)
                .then(ok => setPushDebug(ok ? '✅ Push OK' : '❌ Push failed'))
                .catch(e => setPushDebug('❌ ' + e.message));
        } else {
            const reasons = [];
            if (!user?.id) reasons.push('no user');
            if (!('Notification' in window)) reasons.push('no Notification API');
            else if (Notification.permission !== 'granted') reasons.push('permission=' + Notification.permission);
            setPushDebug('⚠️ ' + reasons.join(', '));
        }
    }, [user?.id]);

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

    const silentAudioRef = useRef(null);

    const cancelScheduledEndBeep = useCallback(() => {
        scheduledEndNodesRef.current.forEach(osc => {
            try { osc.stop(); } catch (e) { /* already stopped */ }
        });
        scheduledEndNodesRef.current = [];
    }, []);

    const scheduleEndBeep = useCallback((delaySec) => {
        cancelScheduledEndBeep();
        const ctx = audioCtxRef.current;
        if (!ctx || ctx.state === 'closed') return;

        const baseTime = ctx.currentTime + delaySec;
        const makeNote = (startTime, freq, dur, waveType = 'square') => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = waveType;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.35, startTime + 0.02);
            gain.gain.setValueAtTime(0.35, startTime + dur - 0.05);
            gain.gain.linearRampToValueAtTime(0, startTime + dur);
            osc.frequency.setValueAtTime(freq, startTime);
            osc.start(startTime);
            osc.stop(startTime + dur + 0.05);
            scheduledEndNodesRef.current.push(osc);
        };
        makeNote(baseTime, 880, 0.3);
        makeNote(baseTime + 0.4, 880, 0.3);
        makeNote(baseTime + 0.8, 1320, 0.5);
    }, [cancelScheduledEndBeep]);

    const unlockAudio = () => {
        requestNotificationPermission().catch(() => {});
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
        let sanitized = value;
        if (value !== '') {
            const num = parseFloat(value);
            if (!isNaN(num)) {
                if (field === 'weight') sanitized = String(Math.min(Math.max(num, 0), 500));
                if (field === 'reps')   sanitized = String(Math.min(Math.max(Math.trunc(num), 1), 300));
            }
        }
        setSetsData(prev => ({
            ...prev,
            [index]: { ...prev[index], [field]: sanitized }
        }));
        if (inputErrors[index]) {
            setInputErrors(prev => {
                const next = { ...prev };
                delete next[index];
                return next;
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
            scheduleEndBeep(dur);
            silentAudioRef.current?.play().catch(() => {});
            scheduleSWNotification(target, true);
            if (user?.id) scheduleServerPush(user.id, target);
        }
    };

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
                scheduleNote(now, 440, 0.15);
                scheduleNote(now + 0.1, 880, 0.2);
            } else {
                scheduleNote(now, 880, 0.3, 'square');
                scheduleNote(now + 0.4, 880, 0.3, 'square');
                scheduleNote(now + 0.8, 1320, 0.5, 'square');
                if ('vibrate' in navigator) {
                    navigator.vibrate([500, 200, 500, 200, 800]);
                }
            }
        } catch (error) {
            console.error('No se pudo reproducir el sonido del temporizador', error);
        }
    }, []);

    useEffect(() => {
        let interval = null;

        if (timerActive && targetTime) {
            beepFiredRef.current = false;

            interval = setInterval(() => {
                const remaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
                setTimeLeft(remaining);
                if (remaining === 0 && !beepFiredRef.current) {
                    beepFiredRef.current = true;
                    setTimerActive(false);
                    setTargetTime(null);
                    silentAudioRef.current?.pause();
                    // End beep was pre-scheduled via Web Audio at timer start.
                    // Vibrate as additional feedback (Android only).
                    if ('vibrate' in navigator) {
                        navigator.vibrate([500, 200, 500, 200, 800]);
                    }
                    setTimeout(() => setTimeLeft(timerStateRef.current.selectedDuration), 2000);
                }
            }, 500);
        }

        return () => {
            clearInterval(interval);
        };
    }, [timerActive, targetTime, playBeep]);

    useEffect(() => {
        const handleSWMessage = (event) => {
            if (event.data?.type !== 'TIMER_FIRED') return;
            if (beepFiredRef.current) return;
            beepFiredRef.current = true;
            const { selectedDuration } = timerStateRef.current;
            setTimerActive(false);
            setTargetTime(null);
            setTimeLeft(0);
            silentAudioRef.current?.pause();
            if ('vibrate' in navigator) navigator.vibrate([500, 200, 500, 200, 800]);
            setTimeout(() => setTimeLeft(selectedDuration), 2000);
        };
        navigator.serviceWorker?.addEventListener('message', handleSWMessage);
        return () => navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    }, [playBeep]);

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
                silentAudioRef.current?.pause();
                if ('vibrate' in navigator) navigator.vibrate([500, 200, 500, 200, 800]);
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
            scheduleEndBeep(dur);
            silentAudioRef.current?.play().catch(() => {});
            scheduleSWNotification(t, true);
            if (user?.id) scheduleServerPush(user.id, t);
        } else {
            setTimerActive(false);
            setTargetTime(null);
            cancelScheduledEndBeep();
            silentAudioRef.current?.pause();
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
            scheduleEndBeep(duration);
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

                    {/* iOS / PWA Status Banner */}
                    {(() => {
                        const items = [];
                        if ('Notification' in window && Notification.permission !== 'granted') {
                            items.push(
                                <li key="perm">Debes <button onClick={requestNotificationPermission} className="underline font-bold">Permitir Notificaciones</button>.</li>
                            );
                        }
                        if (!window.navigator.standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
                            items.push(
                                <li key="pwa">Usa "Añadir a pantalla de inicio" en Safari para que funcione bloqueado.</li>
                            );
                        }
                        if (items.length === 0) return null;
                        return (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-500 flex flex-col gap-2">
                                <p className="font-bold uppercase tracking-tight">⚠️ Acción requerida para avisos en reposo:</p>
                                <ul className="list-disc ml-4 space-y-1">{items}</ul>
                            </div>
                        );
                    })()}

                    {/* DEBUG: Push status — remove after debugging */}
                    {pushDebug && (
                        <p className="text-xs text-center text-text-secondary bg-surface-highlight rounded-lg p-2 font-mono">{pushDebug}</p>
                    )}

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

                        const headerBadge = lastLog && sets.length > 0 ? [
                            sharedWeight && !isBodyweight ? `${sharedWeight} kg` : null,
                            sharedReps   ? `${sharedReps} ${isTimeBased ? 'min' : 'reps'}` : null,
                        ].filter(Boolean).join(' × ') : null;

                        const needsPerSeriesList = lastLog && sets.length > 0 && (!sharedWeight || !sharedReps);

                        return (
                            <div className="rounded-2xl border p-4"
                                style={{
                                    background: 'color-mix(in srgb, #f59e0b 8%, transparent)',
                                    borderColor: 'color-mix(in srgb, #f59e0b 30%, transparent)'
                                }}
                            >
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
                                            min="0"
                                            max="500"
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
                                        min="1"
                                        max="300"
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

                {/* Footer */}
                <div className="p-4 pb-6 border-t border-surface-highlight bg-surface mt-auto z-10">
                    <button
                        onClick={() => {
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
