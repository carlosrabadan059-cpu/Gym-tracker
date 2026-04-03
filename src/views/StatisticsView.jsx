import React, { useState, useEffect, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import {
    Trophy, TrendingUp, Calendar, Search,
    Flame, Zap, Target, ChevronRight, Star
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { loadWorkoutLogs, loadExerciseHistory } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

// ─────────────────────────────────────────────────────────
// Helper: inicio de la semana (lunes)
// ─────────────────────────────────────────────────────────
function getWeekStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
}

// ─────────────────────────────────────────────────────────
// Helper: racha de semanas consecutivas con entrenamiento
// ─────────────────────────────────────────────────────────
function calculateStreak(dates) {
    if (!dates.length) return { current: 0, best: 0 };
    const weekKeys = [...new Set(dates.map(d =>
        getWeekStart(d).toISOString().split('T')[0]
    ))].sort();

    let best = 1, run = 1;
    for (let i = 1; i < weekKeys.length; i++) {
        const diff = (new Date(weekKeys[i]) - new Date(weekKeys[i - 1])) / 86400000;
        run = diff <= 7 ? run + 1 : 1;
        if (run > best) best = run;
    }

    // ¿La racha sigue activa esta semana o la anterior?
    const lastWeek = new Date(weekKeys[weekKeys.length - 1]);
    const thisWeek = getWeekStart(new Date());
    const gapDays = (thisWeek - lastWeek) / 86400000;
    let current = 1;
    for (let i = weekKeys.length - 2; i >= 0; i--) {
        const diff = (new Date(weekKeys[i + 1]) - new Date(weekKeys[i])) / 86400000;
        if (diff <= 7) current++; else break;
    }
    const activeCurrent = gapDays <= 14 ? current : 0;
    return { current: activeCurrent, best };
}

// ─────────────────────────────────────────────────────────
// Helper: formatear fecha corta "04 abr"
// ─────────────────────────────────────────────────────────
function fmtShort(isoDate) {
    return new Date(isoDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

// ─────────────────────────────────────────────────────────
// Sub-componente: Heatmap de 90 días
// ─────────────────────────────────────────────────────────
function ActivityHeatmap({ heatmapData }) {
    const firstDayOfWeek = heatmapData[0]?.date?.getDay() ?? 1;
    const startPad = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const paddedDays = [...Array(startPad).fill(null), ...heatmapData];

    const dayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

    // Colores explícitos para garantizar visibilidad en cualquier tema
    const getCellBg = (count) => {
        if (!count || count === 0) return 'rgba(107,114,128,0.2)';
        if (count === 1) return '#86efac'; // verde suave
        if (count === 2) return '#4ade80'; // verde medio
        return '#16a34a';                  // verde oscuro
    };

    return (
        <div>
            {/* Cabeceras de día */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px', marginBottom: '4px' }}>
                {dayLabels.map(l => (
                    <div key={l} style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text-secondary, #9ca3af)', fontWeight: 600 }}>{l}</div>
                ))}
            </div>
            {/* Celdas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px' }}>
                {paddedDays.map((day, idx) => (
                    <div
                        key={idx}
                        title={day ? `${fmtShort(day.date)}: ${day.count} entrenamiento${day.count !== 1 ? 's' : ''}` : ''}
                        style={{
                            aspectRatio: '1',
                            minHeight: '14px',
                            borderRadius: '3px',
                            backgroundColor: day ? getCellBg(day.count) : 'transparent',
                            visibility: day ? 'visible' : 'hidden',
                            transition: 'background-color 0.2s',
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────
// Sub-componente: Tooltip personalizado para la gráfica
// ─────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-surface border border-surface-highlight rounded-xl px-3 py-2 shadow-xl text-sm">
            <p className="text-text-secondary font-medium mb-1">{label}</p>
            <p className="font-bold text-primary">{payload[0].value} kg</p>
        </div>
    );
}

// ─────────────────────────────────────────────────────────
// StatisticsView principal
// ─────────────────────────────────────────────────────────
export function StatisticsView() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('resumen');
    const [loading, setLoading] = useState(true);

    // Datos crudos compartidos entre tabs
    const [allLogs, setAllLogs] = useState([]);
    const [exercisesData, setExercisesData] = useState([]);

    // ── Resumen ──
    const [stats, setStats] = useState({
        total: 0, volume: 0, currentStreak: 0, bestStreak: 0,
        currentWeek: 0, bestWeek: 0
    });
    const [personalRecords, setPersonalRecords] = useState([]);

    // ── Progresión ──
    const [exerciseSearch, setExerciseSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedExercise, setSelectedExercise] = useState(null);
    const [progressionData, setProgressionData] = useState([]);
    const [progressionLoading, setProgressionLoading] = useState(false);

    // ── Actividad ──
    const [heatmapData, setHeatmapData] = useState([]);
    const [weekdayData, setWeekdayData] = useState([]);

    // ─── Carga inicial de datos ────────────────────────────
    useEffect(() => {
        if (!user?.id) return;
        (async () => {
            setLoading(true);
            try {
                const [logs, { data: exData }] = await Promise.all([
                    loadWorkoutLogs(user.id),
                    supabase.from('exercises').select('id, name, routine_id')
                ]);
                const exercises = exData || [];
                setAllLogs(logs);
                setExercisesData(exercises);
                computeStats(logs, exercises);
                computeActivity(logs);
            } catch (e) {
                console.error('Error loading stats:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, [user]);

    // ─── Cálculo de estadísticas resumen ──────────────────
    function computeStats(logs, exercises) {
        const idToName = {};
        exercises.forEach(ex => { idToName[String(ex.id)] = ex.name; });

        let vol = 0;
        const prMap = {}; // exerciseName → { maxWeight, date }

        const weekMap = {};
        logs.forEach(session => {
            // Volumen y PRs
            if (session.logs) {
                Object.entries(session.logs).forEach(([exId, exLog]) => {
                    if (exId === 'cardio') return;
                    let sessionMax = 0;
                    Object.values(exLog.setsData || {}).forEach(set => {
                        const w = parseFloat(String(set.weight || '0').replace(',', '.')) || 0;
                        const r = parseInt(set.reps) || 0;
                        vol += w * r;
                        if (w > sessionMax) sessionMax = w;
                    });
                    const name = idToName[exId];
                    if (name && sessionMax > 0) {
                        if (!prMap[name] || sessionMax > prMap[name].maxWeight) {
                            prMap[name] = { maxWeight: sessionMax, date: session.date };
                        }
                    }
                });
            }
            // Semanas
            const key = getWeekStart(new Date(session.date)).toISOString().split('T')[0];
            weekMap[key] = (weekMap[key] || 0) + 1;
        });

        const weekCounts = Object.values(weekMap);
        const bestWeek = weekCounts.length ? Math.max(...weekCounts) : 0;
        const thisWeekKey = getWeekStart(new Date()).toISOString().split('T')[0];
        const currentWeek = weekMap[thisWeekKey] || 0;

        const streak = calculateStreak(logs.map(l => new Date(l.date)));

        setStats({
            total: logs.length,
            volume: vol,
            currentStreak: streak.current,
            bestStreak: streak.best,
            currentWeek,
            bestWeek
        });

        const prs = Object.entries(prMap)
            .map(([name, v]) => ({ name, ...v }))
            .sort((a, b) => b.maxWeight - a.maxWeight)
            .slice(0, 10);
        setPersonalRecords(prs);
    }

    // ─── Cálculo de actividad (heatmap + días de semana) ──
    function computeActivity(logs) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days = Array.from({ length: 91 }, (_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() - (90 - i));
            return { date: d, count: 0 };
        });

        const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        const weekdayCounts = dayNames.map(n => ({ name: n, workouts: 0 }));

        logs.forEach(session => {
            const sd = new Date(session.date);
            sd.setHours(0, 0, 0, 0);
            const cell = days.find(d => d.date.getTime() === sd.getTime());
            if (cell) cell.count++;
            const dow = sd.getDay();
            const idx = dow === 0 ? 6 : dow - 1;
            weekdayCounts[idx].workouts++;
        });

        setHeatmapData(days);
        setWeekdayData(weekdayCounts);
    }

    // ─── Catálogo de ejercicios (para búsqueda) ───────────
    const exerciseCatalog = useMemo(() => (
        [...new Set(exercisesData.map(e => e.name).filter(Boolean))].sort()
    ), [exercisesData]);

    const filteredCatalog = useMemo(() => (
        exerciseSearch.length >= 2
            ? exerciseCatalog.filter(n => n.toLowerCase().includes(exerciseSearch.toLowerCase())).slice(0, 8)
            : []
    ), [exerciseSearch, exerciseCatalog]);

    const selectExercise = async (name) => {
        setExerciseSearch(name);
        setSelectedExercise(name);
        setShowDropdown(false);
        setProgressionLoading(true);
        try {
            const history = await loadExerciseHistory(user?.id, name);
            // Para la gráfica: max weight por sesión, ordenado cronológicamente
            const chartData = history
                .slice()
                .reverse()
                .map(session => {
                    const sets = Object.values(session.setsData || {});
                    const maxW = sets.reduce((m, s) => {
                        const w = parseFloat(String(s.weight || '0').replace(',', '.')) || 0;
                        return w > m ? w : m;
                    }, 0);
                    return {
                        date: fmtShort(session.date),
                        peso: maxW,
                        fullDate: session.date
                    };
                })
                .filter(p => p.peso > 0);
            setProgressionData(chartData);
        } catch (e) {
            console.error(e);
        } finally {
            setProgressionLoading(false);
        }
    };

    // ─── Formatear volumen ─────────────────────────────────
    const fmtVolume = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));

    // ─── Tabs ──────────────────────────────────────────────
    const tabs = [
        { id: 'resumen',    icon: Trophy,     label: 'Resumen'    },
        { id: 'progresion', icon: TrendingUp,  label: 'Progresión' },
        { id: 'actividad',  icon: Calendar,    label: 'Actividad'  },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <p className="text-text-secondary text-sm">Calculando estadísticas...</p>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────
    return (
        <div className="space-y-5 pb-24">
            {/* Header */}
            <header>
                <h2 className="text-2xl font-bold text-text-primary">Estadísticas</h2>
                <p className="text-text-secondary text-sm">Tu progreso histórico</p>
            </header>

            {/* Tab bar */}
            <div className="flex bg-surface rounded-2xl p-1 gap-1 border border-surface-highlight">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                                isActive
                                    ? 'bg-primary text-black shadow-md shadow-primary/30'
                                    : 'text-text-secondary hover:text-text-primary'
                            }`}
                        >
                            <Icon size={14} />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* ════════════════════════ TAB: RESUMEN ════════════════════════ */}
            {activeTab === 'resumen' && (
                <div className="space-y-5 animate-fadeIn">
                    {/* Big 3 Números */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-surface rounded-2xl p-4 border border-surface-highlight flex flex-col items-center text-center">
                            <Target size={20} className="text-blue-400 mb-2" />
                            <p className="text-2xl font-bold text-text-primary">{stats.total}</p>
                            <p className="text-[11px] text-text-secondary uppercase tracking-wider mt-0.5">Sesiones</p>
                        </div>
                        <div className="bg-surface rounded-2xl p-4 border border-surface-highlight flex flex-col items-center text-center">
                            <Flame size={20} className="text-orange-400 mb-2" />
                            <p className="text-2xl font-bold text-text-primary">{stats.currentStreak}</p>
                            <p className="text-[11px] text-text-secondary uppercase tracking-wider mt-0.5">Racha sem.</p>
                        </div>
                        <div className="bg-surface rounded-2xl p-4 border border-surface-highlight flex flex-col items-center text-center">
                            <Zap size={20} className="text-primary mb-2" />
                            <p className="text-2xl font-bold text-text-primary">{fmtVolume(stats.volume)}</p>
                            <p className="text-[11px] text-text-secondary uppercase tracking-wider mt-0.5">kg totales</p>
                        </div>
                    </div>

                    {/* Racha visual */}
                    <div className="bg-surface rounded-2xl p-4 border border-surface-highlight">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Flame size={18} className="text-orange-400" />
                                <span className="font-semibold text-text-primary">Racha de consistencia</span>
                            </div>
                            <span className="text-xs text-text-secondary">Mejor: {stats.bestStreak} sem.</span>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                            {Array.from({ length: Math.max(stats.bestStreak, stats.currentStreak, 4) }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`h-4 flex-1 min-w-[12px] rounded-full transition-all ${
                                        i < stats.currentStreak
                                            ? 'bg-orange-400 shadow-md shadow-orange-400/30'
                                            : 'bg-surface-highlight'
                                    }`}
                                />
                            ))}
                        </div>
                        {stats.currentStreak === 0 && (
                            <p className="text-xs text-text-secondary mt-2">Entrena esta semana para iniciar tu racha 🔥</p>
                        )}
                        {stats.currentStreak > 0 && (
                            <p className="text-xs text-orange-400 mt-2 font-medium">
                                🔥 {stats.currentStreak} semana{stats.currentStreak !== 1 ? 's' : ''} consecutiva{stats.currentStreak !== 1 ? 's' : ''}
                            </p>
                        )}
                    </div>

                    {/* Esta semana vs. Mejor semana */}
                    <div className="bg-surface rounded-2xl p-4 border border-surface-highlight">
                        <div className="flex items-center gap-2 mb-4">
                            <Star size={18} className="text-yellow-400" />
                            <span className="font-semibold text-text-primary">Esta semana</span>
                        </div>
                        <div className="flex items-end gap-4">
                            <div className="flex-1">
                                <div className="flex items-end gap-2 mb-1">
                                    <span className="text-3xl font-bold text-text-primary">{stats.currentWeek}</span>
                                    <span className="text-text-secondary mb-1">/ {stats.bestWeek} mejor</span>
                                </div>
                                <div className="h-2 bg-surface-highlight rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary rounded-full transition-all duration-700"
                                        style={{ width: stats.bestWeek > 0 ? `${(stats.currentWeek / stats.bestWeek) * 100}%` : '0%' }}
                                    />
                                </div>
                                <p className="text-xs text-text-secondary mt-1">entrenamientos</p>
                            </div>
                            {stats.currentWeek >= stats.bestWeek && stats.currentWeek > 0 && (
                                <div className="text-yellow-400 text-sm font-bold animate-pulse">¡Récord! 🏆</div>
                            )}
                        </div>
                    </div>

                    {/* Records personales */}
                    <div className="bg-surface rounded-2xl p-4 border border-surface-highlight">
                        <div className="flex items-center gap-2 mb-4">
                            <Trophy size={18} className="text-yellow-400" />
                            <span className="font-semibold text-text-primary">Records Personales</span>
                        </div>
                        {personalRecords.length === 0 ? (
                            <p className="text-center text-text-secondary text-sm py-4">
                                Completa ejercicios con pesos para ver tus récords
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {personalRecords.map((pr, i) => (
                                    <div
                                        key={pr.name}
                                        className="flex items-center justify-between gap-3 py-2.5 border-b border-surface-highlight/50 last:border-0"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <span className={`text-xs font-bold w-5 flex-shrink-0 ${
                                                i === 0 ? 'text-yellow-400' :
                                                i === 1 ? 'text-gray-300' :
                                                i === 2 ? 'text-amber-600' : 'text-text-secondary'
                                            }`}>
                                                #{i + 1}
                                            </span>
                                            <span className="text-sm font-medium text-text-primary truncate">{pr.name}</span>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="font-bold text-primary text-base">{pr.maxWeight} kg</p>
                                            <p className="text-[10px] text-text-secondary">{fmtShort(pr.date)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════════════════ TAB: PROGRESIÓN ════════════════════════ */}
            {activeTab === 'progresion' && (
                <div className="space-y-5 animate-fadeIn">
                    {/* Buscador */}
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-3.5 text-text-secondary pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Busca un ejercicio para ver tu progresión..."
                            value={exerciseSearch}
                            onChange={e => {
                                setExerciseSearch(e.target.value);
                                setShowDropdown(true);
                                if (!e.target.value) {
                                    setSelectedExercise(null);
                                    setProgressionData([]);
                                }
                            }}
                            onFocus={() => setShowDropdown(true)}
                            className="w-full bg-surface border border-surface-highlight rounded-2xl pl-9 pr-4 py-3 text-text-primary text-sm focus:outline-none focus:border-primary transition-colors"
                        />
                        {showDropdown && filteredCatalog.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-surface-highlight rounded-2xl shadow-2xl z-20 overflow-hidden">
                                {filteredCatalog.map(name => (
                                    <button
                                        key={name}
                                        className="w-full text-left px-4 py-3 text-sm text-text-primary hover:bg-surface-highlight transition-colors flex items-center justify-between"
                                        onClick={() => selectExercise(name)}
                                    >
                                        <span>{name}</span>
                                        <ChevronRight size={14} className="text-text-secondary" />
                                    </button>
                                ))}
                            </div>
                        )}
                        {showDropdown && exerciseSearch.length >= 2 && filteredCatalog.length === 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-surface-highlight rounded-2xl z-20 p-4 text-center text-text-secondary text-sm">
                                Sin resultados para "{exerciseSearch}"
                            </div>
                        )}
                    </div>

                    {!selectedExercise && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <TrendingUp size={48} className="text-surface-highlight mb-4" />
                            <p className="text-text-primary font-semibold">Selecciona un ejercicio</p>
                            <p className="text-text-secondary text-sm mt-1">Escribe al menos 2 letras para buscar</p>
                        </div>
                    )}

                    {progressionLoading && (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        </div>
                    )}

                    {selectedExercise && !progressionLoading && progressionData.length === 0 && (
                        <div className="bg-surface rounded-2xl p-6 border border-surface-highlight text-center">
                            <p className="text-text-secondary text-sm">Sin datos de peso registrados para <strong className="text-text-primary">{selectedExercise}</strong></p>
                        </div>
                    )}

                    {selectedExercise && !progressionLoading && progressionData.length > 0 && (
                        <>
                            {/* Resumen del PR del ejercicio */}
                            <div className="bg-gradient-to-r from-primary/20 to-primary/5 rounded-2xl p-4 border border-primary/30 flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-primary uppercase tracking-wider font-semibold">Récord Personal</p>
                                    <p className="text-2xl font-bold text-text-primary mt-0.5">
                                        {Math.max(...progressionData.map(p => p.peso))} kg
                                    </p>
                                    <p className="text-xs text-text-secondary mt-0.5">{selectedExercise}</p>
                                </div>
                                <Trophy size={36} className="text-primary/60" />
                            </div>

                            {/* Gráfica de progresión */}
                            <div className="bg-surface rounded-2xl p-4 border border-surface-highlight">
                                <h3 className="font-semibold text-text-primary mb-4">Evolución del peso</h3>
                                <div className="h-52">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={progressionData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                            <defs>
                                                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                                                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                                                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={1} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#6b7280"
                                                tick={{ fontSize: 10 }}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis
                                                stroke="#6b7280"
                                                tick={{ fontSize: 10 }}
                                                unit=" kg"
                                                domain={['auto', 'auto']}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Line
                                                type="monotone"
                                                dataKey="peso"
                                                stroke="var(--primary)"
                                                strokeWidth={2.5}
                                                dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 0 }}
                                                activeDot={{ r: 6, fill: 'var(--primary)' }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Timeline de sesiones */}
                            <div className="bg-surface rounded-2xl p-4 border border-surface-highlight">
                                <h3 className="font-semibold text-text-primary mb-3">Historial de sesiones</h3>
                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {progressionData.slice().reverse().map((p, i) => (
                                        <div key={i} className="flex items-center justify-between bg-background rounded-xl px-3 py-2.5 border border-surface-highlight">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-8 rounded-full bg-primary/40" />
                                                <p className="text-sm text-text-primary">{p.date}</p>
                                            </div>
                                            <p className="font-bold text-primary">{p.peso} kg</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ════════════════════════ TAB: ACTIVIDAD ════════════════════════ */}
            {activeTab === 'actividad' && (
                <div className="space-y-5 animate-fadeIn">
                    {/* Heatmap */}
                    <div className="bg-surface rounded-2xl p-4 border border-surface-highlight">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Calendar size={18} className="text-primary" />
                                <span className="font-semibold text-text-primary">Últimos 90 días</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-text-secondary">
                                <div className="w-3 h-3 rounded-sm bg-surface-highlight/40" /> Sin actividad
                                <div className="w-3 h-3 rounded-sm bg-primary" /> Activo
                            </div>
                        </div>
                        {heatmapData.length === 0 ? (
                            <p className="text-center text-text-secondary text-sm py-4">Sin datos de actividad</p>
                        ) : (
                            <ActivityHeatmap heatmapData={heatmapData} />
                        )}
                    </div>

                    {/* Frecuencia por día de la semana */}
                    <div className="bg-surface rounded-2xl p-4 border border-surface-highlight">
                        <div className="flex items-center gap-2 mb-4">
                            <Flame size={18} className="text-orange-400" />
                            <span className="font-semibold text-text-primary">Días más activos</span>
                        </div>
                        {weekdayData.every(d => d.workouts === 0) ? (
                            <p className="text-center text-text-secondary text-sm py-4">Sin datos suficientes</p>
                        ) : (
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={weekdayData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                                        <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 11 }} />
                                        <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} allowDecimals={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', borderRadius: '12px' }}
                                            cursor={{ fill: '#374151', opacity: 0.4 }}
                                            formatter={(v) => [`${v} entrenamiento${v !== 1 ? 's' : ''}`, '']}
                                        />
                                        <Bar dataKey="workouts" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Resumen actividad */}
                    {heatmapData.length > 0 && (() => {
                        const activeDays = heatmapData.filter(d => d.count > 0).length;
                        const rate = Math.round((activeDays / 90) * 100);
                        const bestDay = weekdayData.reduce((a, b) => b.workouts > a.workouts ? b : a, weekdayData[0]);
                        return (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-surface rounded-2xl p-4 border border-surface-highlight text-center">
                                    <p className="text-2xl font-bold text-primary">{activeDays}</p>
                                    <p className="text-xs text-text-secondary mt-1">días activos (90 días)</p>
                                </div>
                                <div className="bg-surface rounded-2xl p-4 border border-surface-highlight text-center">
                                    <p className="text-2xl font-bold text-orange-400">{bestDay?.workouts > 0 ? bestDay.name : '—'}</p>
                                    <p className="text-xs text-text-secondary mt-1">día favorito</p>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}
