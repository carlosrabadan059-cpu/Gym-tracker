/* eslint-disable react-refresh/only-export-components -- entry de prototipo */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, History, Sparkles } from 'lucide-react';
import './index.css';
import { parseRepScheme } from './lib/repScheme';
import { suggestNextWeight } from './lib/progression';

// PROTOTIPO — sin Supabase. Reproduce el bloque "Última vez + Registrar series"
// de ExerciseDetailModal con la precarga de pesos de la última sesión.

const SCENARIOS = {
    mismas: {
        label: 'Mismas series que la última vez',
        exercise: { name: 'Press banca', series: 3, reps: '8-10', target_weight: null },
        lastLog: { date: 'hace 3 días', setsData: { 0: { weight: '60', reps: '10' }, 1: { weight: '60', reps: '9' }, 2: { weight: '57.5', reps: '8' } } },
    },
    mas: {
        label: 'Ahora 4 series, antes 2',
        exercise: { name: 'Remo con barra', series: 4, reps: '10', target_weight: null },
        lastLog: { date: 'hace 1 semana', setsData: { 0: { weight: '50', reps: '10' }, 1: { weight: '50', reps: '10' } } },
    },
    piramide: {
        label: 'Pirámide 12-10-8-6',
        exercise: { name: 'Press militar', series: 4, reps: '12-10-8-6', target_weight: null },
        lastLog: { date: 'ayer', setsData: { 0: { weight: '30', reps: '12' }, 1: { weight: '35', reps: '10' }, 2: { weight: '40', reps: '8' }, 3: { weight: '42.5', reps: '6' } } },
    },
    entrenador: {
        label: 'Entrenador fija 70 kg, historial 65',
        exercise: { name: 'Sentadilla', series: 3, reps: '6', target_weight: 70 },
        lastLog: { date: 'hace 4 días', setsData: { 0: { weight: '65', reps: '6' }, 1: { weight: '65', reps: '6' }, 2: { weight: '65', reps: '5' } } },
    },
    primera: {
        label: 'Primera vez (sin historial)',
        exercise: { name: 'Hip thrust', series: 3, reps: '12', target_weight: null },
        lastLog: null,
    },
};

// Lógica candidata para src/lib/progression.js
function buildInitialSets({ exercise, lastLog, priority }) {
    const reps = parseRepScheme(exercise.reps, exercise.series);
    const pyramid = new Set(reps).size > 1;
    const last = lastLog?.setsData || {};
    const lastIdx = Object.keys(last).map(Number).filter((i) => last[i]?.weight).sort((a, b) => a - b);
    const lastWeight = lastIdx.length ? last[lastIdx[lastIdx.length - 1]].weight : '';
    const coach = exercise.target_weight != null ? String(exercise.target_weight) : '';
    const out = {};
    reps.forEach((r, i) => {
        const fromHistory = last[i]?.weight || lastWeight;
        const weight = priority === 'coach' ? (coach || fromHistory || '') : (fromHistory || coach || '');
        out[i] = { weight, reps: pyramid ? String(r) : String(exercise.reps), prefilled: !!weight };
    });
    return out;
}

function Modal({ scenario, priority, dim }) {
    const { exercise, lastLog } = scenario;
    const [sets, setSets] = useState(() => buildInitialSets({ exercise, lastLog, priority }));
    const [done, setDone] = useState({});
    const [errors, setErrors] = useState({});
    const suggestion = suggestNextWeight(lastLog, exercise.reps);

    const edit = (i, field, v) => setSets((p) => ({ ...p, [i]: { ...p[i], [field]: v, ...(field === 'weight' ? { prefilled: false } : {}) } }));
    const toggle = (i) => {
        if (!sets[i]?.weight) { setErrors((p) => ({ ...p, [i]: true })); return; }
        setDone((p) => ({ ...p, [i]: !p[i] }));
        // Confirmar la serie también "consolida" el peso precargado.
        setSets((p) => ({ ...p, [i]: { ...p[i], prefilled: false } }));
    };

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-bold text-text-primary">{exercise.name}</h2>

            <div className="rounded-2xl border p-4" style={{ background: 'color-mix(in srgb, #f59e0b 8%, transparent)', borderColor: 'color-mix(in srgb, #f59e0b 30%, transparent)' }}>
                <div className="flex items-center gap-2 mb-2">
                    <History size={14} className="text-amber-400" />
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                        {lastLog ? `Última vez — ${lastLog.date}` : '¡Primera vez registrada!'}
                    </span>
                </div>
                {lastLog && Object.entries(lastLog.setsData).map(([i, s]) => (
                    <div key={i} className="flex justify-between text-sm">
                        <span className="text-text-secondary">Serie {+i + 1}</span>
                        <span className="font-mono font-bold text-amber-300">{s.weight} kg × {s.reps}</span>
                    </div>
                ))}
                {suggestion && (
                    <div className="border-t border-amber-500/20 pt-2 mt-2 text-xs flex justify-between">
                        <span className="flex items-center gap-1.5 text-text-secondary"><Sparkles size={12} className="text-primary" /> Sugerencia</span>
                        <span className="font-mono font-bold text-primary">{String(suggestion.weight).replace('.', ',')} kg × {suggestion.reps}</span>
                    </div>
                )}
            </div>

            <div className="space-y-3">
                <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Registrar Series</h3>
                {Object.entries(sets).map(([k, s]) => {
                    const i = +k;
                    const faded = dim && s.prefilled;
                    return (
                        <div key={i} className="flex items-center gap-3">
                            <span className="w-8 text-center font-bold text-text-secondary">{i + 1}</span>
                            <div className={`flex-1 rounded-xl bg-background border px-4 py-3 flex items-center gap-2 ${errors[i] ? 'border-red-500 bg-red-500/10' : s.prefilled ? 'border-amber-500/40' : 'border-surface-highlight'}`}>
                                <input type="number" placeholder="0" value={s.weight}
                                    onChange={(e) => { edit(i, 'weight', e.target.value); setErrors((p) => ({ ...p, [i]: false })); }}
                                    className={`w-full bg-transparent focus:outline-none text-right font-mono ${faded ? 'text-text-secondary italic' : 'text-black dark:text-white'}`} />
                                <span className="text-xs text-text-secondary">kg</span>
                            </div>
                            <div className="flex-1 rounded-xl bg-background border border-surface-highlight px-4 py-3 flex items-center gap-2">
                                <input type="number" value={s.reps} onChange={(e) => edit(i, 'reps', e.target.value)}
                                    className="w-full bg-transparent text-black dark:text-white focus:outline-none text-right font-mono" />
                                <span className="text-xs text-text-secondary">reps</span>
                            </div>
                            <div onClick={() => toggle(i)}
                                className={`h-6 w-6 rounded-full border-2 flex items-center justify-center cursor-pointer ${done[i] ? 'bg-primary border-primary text-black' : 'border-text-secondary/30'}`}>
                                {done[i] && <Check size={14} strokeWidth={3} />}
                            </div>
                        </div>
                    );
                })}
                {Object.values(sets).some((s) => s.prefilled) && (
                    <p className="text-[11px] text-amber-400/80 pl-11">Pesos de la última vez — edítalos o confirma con el check.</p>
                )}
            </div>
        </div>
    );
}

function App() {
    const [key, setKey] = useState('mismas');
    const [priority, setPriority] = useState('history');
    const [dim, setDim] = useState(true);
    return (
        <div className="min-h-screen bg-background text-text-primary p-4 max-w-md mx-auto">
            <div className="mb-4 space-y-2 text-xs">
                <select value={key} onChange={(e) => setKey(e.target.value)} className="w-full bg-surface rounded-lg p-2">
                    {Object.entries(SCENARIOS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                </select>
                <div className="flex gap-2">
                    <button onClick={() => setPriority(priority === 'history' ? 'coach' : 'history')} className="flex-1 bg-surface rounded-lg p-2">
                        Prioridad: {priority === 'history' ? 'historial' : 'entrenador'}
                    </button>
                    <button onClick={() => setDim(!dim)} className="flex-1 bg-surface rounded-lg p-2">
                        Atenuado: {dim ? 'sí' : 'no'}
                    </button>
                </div>
            </div>
            <Modal key={`${key}-${priority}`} scenario={SCENARIOS[key]} priority={priority} dim={dim} />
        </div>
    );
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
