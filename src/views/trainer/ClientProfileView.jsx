import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, PlusCircle, Activity, Dumbbell, ChevronRight, Trash2, Calendar, Clock, Edit2, Check, X, Search, Minus, Plus, Timer } from 'lucide-react';
import { routines as staticRoutines } from '../../data/routines';

// ─── Stepper inline ─────────────────────────────────────────────────────────

function Stepper({ value, onChange, min = 1, max = 99 }) {
    return (
        <div className="flex items-center gap-1">
            <button
                onClick={(e) => { e.stopPropagation(); onChange(Math.max(min, Number(value) - 1)); }}
                className="w-6 h-6 rounded-md bg-surface-highlight flex items-center justify-center hover:bg-gray-600 transition-colors"
            >
                <Minus size={10} className="text-text-primary" />
            </button>
            <span className="w-6 text-center text-sm font-bold text-text-primary">{value}</span>
            <button
                onClick={(e) => { e.stopPropagation(); onChange(Math.min(max, Number(value) + 1)); }}
                className="w-6 h-6 rounded-md bg-surface-highlight flex items-center justify-center hover:bg-gray-600 transition-colors"
            >
                <Plus size={10} className="text-text-primary" />
            </button>
        </div>
    );
}

// ─── Mapa estático id → nombre ───────────────────────────────────────────────
const STATIC_ID_TO_NAME = {};
staticRoutines.forEach(r => r.exercises.forEach(ex => { STATIC_ID_TO_NAME[String(ex.id)] = ex.name; }));

// ─── Panel detalle de sesión ─────────────────────────────────────────────────

function WorkoutDetailPanel({ entry, onClose }) {
    const [nameMap, setNameMap] = useState({ ...STATIC_ID_TO_NAME });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ids = Object.keys(entry.logs || {}).filter(k => k !== 'workoutDuration' && k !== 'cardio');
        if (ids.length === 0) { setLoading(false); return; }

        supabase
            .from('exercises')
            .select('id, name')
            .in('id', ids.map(Number))
            .then(({ data }) => {
                if (data) {
                    setNameMap(prev => {
                        const next = { ...prev };
                        data.forEach(ex => { next[String(ex.id)] = ex.name; });
                        return next;
                    });
                }
            })
            .finally(() => setLoading(false));
    }, [entry]);

    const exercises = useMemo(() => {
        if (!entry.logs) return [];
        return Object.entries(entry.logs)
            .filter(([k]) => k !== 'workoutDuration' && k !== 'cardio')
            .map(([id, log]) => ({
                id,
                name: nameMap[id] || `Ejercicio #${id}`,
                sets: Object.values(log.setsData || {}),
            }));
    }, [entry.logs, nameMap]);

    const duration = entry.logs?.workoutDuration;

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
            <header className="flex items-center gap-3 p-4 border-b border-surface-highlight sticky top-0 bg-background z-10">
                <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-highlight transition-colors">
                    <ArrowLeft size={22} className="text-text-primary" />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-text-primary truncate">{entry.routineName}</h2>
                    <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-text-secondary">
                            <Calendar size={11} />
                            {new Date(entry.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        {duration?.durationMinutes > 0 && (
                            <span className="flex items-center gap-1 text-xs text-text-secondary">
                                <Timer size={11} />
                                {duration.durationMinutes} min
                            </span>
                        )}
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-surface rounded-2xl p-4 border border-surface-highlight animate-pulse">
                            <div className="h-4 bg-surface-highlight rounded w-1/3 mb-3" />
                            <div className="space-y-2">
                                {[1, 2, 3].map(j => <div key={j} className="h-3 bg-surface-highlight rounded w-1/2" />)}
                            </div>
                        </div>
                    ))
                ) : exercises.length === 0 ? (
                    <div className="text-center py-12 text-text-secondary">
                        <Dumbbell size={36} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Sin datos de ejercicios.</p>
                    </div>
                ) : (
                    exercises.map(ex => {
                        const doneSets = ex.sets.filter(s => s.done !== false);
                        return (
                            <div key={ex.id} className="bg-surface rounded-2xl p-4 border border-surface-highlight">
                                <p className="font-semibold text-text-primary text-sm mb-3">{ex.name}</p>
                                <div className="space-y-1.5">
                                    {doneSets.length === 0 ? (
                                        <p className="text-xs text-text-secondary">Sin series completadas.</p>
                                    ) : (
                                        doneSets.map((set, i) => {
                                            const w = parseFloat(String(set.weight || '0').replace(',', '.')) || 0;
                                            const r = parseInt(set.reps) || 0;
                                            return (
                                                <div key={i} className="flex items-center gap-2">
                                                    <span className="text-xs text-text-secondary w-12">Serie {i + 1}</span>
                                                    <span className="text-xs font-mono font-bold text-text-primary">
                                                        {w > 0 ? `${w} kg` : '—'}
                                                        {w > 0 && r > 0 ? ' × ' : ''}
                                                        {r > 0 ? `${r} reps` : ''}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}

                {duration?.realCalories > 0 && (
                    <div className="bg-primary/10 rounded-2xl p-4 border border-primary/20 flex items-center justify-between">
                        <span className="text-sm font-semibold text-text-primary">Calorías estimadas</span>
                        <span className="text-lg font-black text-primary">{Math.round(duration.realCalories)} kcal</span>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Panel añadir ejercicios ─────────────────────────────────────────────────

function AddExercisePanel({ assignment, onClose, onAdded }) {
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState([]);
    const [saving, setSaving] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState({});

    useEffect(() => {
        const fetch = async () => {
            try {
                const { data, error } = await supabase
                    .from('exercise_catalog')
                    .select('*')
                    .order('name');
                if (error) throw error;
                setCatalog((data || []).map(ex => ({
                    ...ex,
                    group: ex.target || ex.category || ex.bodyPart || 'Otros'
                })));
            } catch (err) {
                console.error('Error fetching catalog:', err);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    const groups = useMemo(() => {
        const filtered = catalog.filter(ex =>
            ex.name.toLowerCase().includes(search.toLowerCase())
        );
        const map = {};
        for (const ex of filtered) {
            if (!map[ex.group]) map[ex.group] = [];
            map[ex.group].push(ex);
        }
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
    }, [catalog, search]);

    const getSelected = (exId) => selected.find(s => s.catalog_id === exId);

    const toggleExercise = (ex) => {
        if (getSelected(ex.id)) {
            setSelected(prev => prev.filter(s => s.catalog_id !== ex.id));
        } else {
            setSelected(prev => [...prev, {
                catalog_id: ex.id,
                name: ex.name,
                image_url: ex.image_url || null,
                series: 3,
                reps: 10,
            }]);
        }
    };

    const updateSelected = (catalogId, field, value) => {
        setSelected(prev =>
            prev.map(s => s.catalog_id === catalogId ? { ...s, [field]: value } : s)
        );
    };

    const toggleGroup = (group) => {
        setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    const handleSave = async () => {
        if (selected.length === 0) return;
        setSaving(true);
        try {
            const routineId = assignment.routine_id;

            // Get current max ui_order for this routine
            const { data: existing } = await supabase
                .from('exercises')
                .select('ui_order')
                .eq('routine_id', routineId)
                .order('ui_order', { ascending: false })
                .limit(1);

            const maxOrder = existing?.[0]?.ui_order || 0;
            const baseId = Math.floor(Math.random() * 800_000) + 100_000;

            const newExercises = selected.map((ex, i) => ({
                id: baseId + i,
                routine_id: routineId,
                name: ex.name,
                series: String(ex.series),
                reps: String(ex.reps),
                image_url: ex.image_url,
                ui_order: maxOrder + i + 1,
            }));

            const { data: inserted, error } = await supabase
                .from('exercises')
                .insert(newExercises)
                .select();

            if (error) throw error;
            onAdded(assignment.id, inserted || newExercises);
            onClose();
        } catch (err) {
            console.error('Error adding exercises:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
            {/* Header */}
            <header className="flex items-center gap-3 p-4 border-b border-surface-highlight sticky top-0 bg-background z-10">
                <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-highlight transition-colors">
                    <ArrowLeft size={22} className="text-text-primary" />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-text-primary">Añadir ejercicios</h2>
                    <p className="text-xs text-text-secondary truncate">{assignment.routine?.name}</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={selected.length === 0 || saving}
                    className="bg-primary text-black font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors flex-shrink-0"
                >
                    {saving ? 'Guardando...' : `Añadir (${selected.length})`}
                </button>
            </header>

            {/* Search */}
            <div className="px-4 pt-4 pb-2">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-text-secondary" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar ejercicio..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-surface border border-surface-highlight rounded-xl pl-9 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                    />
                </div>
            </div>

            {/* Exercise grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-8 pt-2 space-y-6">
                {loading ? (
                    <div className="grid grid-cols-4 gap-2 pt-4">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="aspect-square bg-surface rounded-xl animate-pulse border border-surface-highlight" />
                        ))}
                    </div>
                ) : groups.length === 0 ? (
                    <div className="text-center py-12 text-text-secondary">
                        <Dumbbell size={36} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No se encontraron ejercicios</p>
                    </div>
                ) : (
                    groups.map(([groupName, exercises]) => {
                        const isCollapsed = collapsedGroups[groupName];
                        const selectedCount = exercises.filter(ex => getSelected(ex.id)).length;
                        return (
                            <div key={groupName}>
                                <button
                                    onClick={() => toggleGroup(groupName)}
                                    className="w-full flex items-center justify-between mb-3"
                                >
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">{groupName}</h3>
                                        {selectedCount > 0 && (
                                            <span className="bg-primary text-black text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">{selectedCount}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 text-text-secondary">
                                        <span className="text-xs">{exercises.length}</span>
                                        <ChevronRight size={14} className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                                    </div>
                                </button>

                                {!isCollapsed && (
                                    <div className="grid grid-cols-4 gap-2">
                                        {exercises.map(ex => {
                                            const sel = getSelected(ex.id);
                                            return (
                                                <div
                                                    key={ex.id}
                                                    onClick={() => toggleExercise(ex)}
                                                    className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all aspect-square ${
                                                        sel ? 'border-primary shadow-lg shadow-primary/30 scale-[1.02]' : 'border-transparent hover:border-surface-highlight'
                                                    }`}
                                                >
                                                    {ex.image_url ? (
                                                        <img src={ex.image_url} alt={ex.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                    ) : (
                                                        <div className="w-full h-full bg-surface-highlight flex items-center justify-center">
                                                            <Dumbbell size={24} className="text-text-secondary opacity-50" />
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                                    <div className="absolute bottom-0 inset-x-0 p-1.5">
                                                        <p className="text-white text-[10px] font-semibold leading-tight line-clamp-2">{ex.name}</p>
                                                    </div>

                                                    {sel ? (
                                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1.5 p-1">
                                                            <Check size={14} className="text-primary" strokeWidth={3} />
                                                            <div className="flex gap-1.5">
                                                                <div className="flex flex-col items-center gap-0.5">
                                                                    <span className="text-[8px] text-white/60 uppercase">Series</span>
                                                                    <div className="flex items-center gap-0.5">
                                                                        <button onClick={(e) => { e.stopPropagation(); updateSelected(ex.id, 'series', Math.max(1, sel.series - 1)); }} className="w-5 h-5 rounded bg-black/30 flex items-center justify-center"><Minus size={8} className="text-white" /></button>
                                                                        <span className="w-4 text-center text-xs font-bold text-white">{sel.series}</span>
                                                                        <button onClick={(e) => { e.stopPropagation(); updateSelected(ex.id, 'series', Math.min(99, sel.series + 1)); }} className="w-5 h-5 rounded bg-black/30 flex items-center justify-center"><Plus size={8} className="text-white" /></button>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-center gap-0.5">
                                                                    <span className="text-[8px] text-white/60 uppercase">Reps</span>
                                                                    <div className="flex items-center gap-0.5">
                                                                        <button onClick={(e) => { e.stopPropagation(); updateSelected(ex.id, 'reps', Math.max(1, sel.reps - 1)); }} className="w-5 h-5 rounded bg-black/30 flex items-center justify-center"><Minus size={8} className="text-white" /></button>
                                                                        <span className="w-4 text-center text-xs font-bold text-white">{sel.reps}</span>
                                                                        <button onClick={(e) => { e.stopPropagation(); updateSelected(ex.id, 'reps', Math.min(99, sel.reps + 1)); }} className="w-5 h-5 rounded bg-black/30 flex items-center justify-center"><Plus size={8} className="text-white" /></button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/40 flex items-center justify-center">
                                                            <Plus size={10} className="text-white/70" />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ClientProfileView({ client, onBack, onAssignRoutine }) {
    const [assignedRoutines, setAssignedRoutines] = useState([]);
    const [workoutHistory, setWorkoutHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [expandedRoutine, setExpandedRoutine] = useState(null);
    const [historyExpanded, setHistoryExpanded] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    // Edit exercise inline
    const [editingExercise, setEditingExercise] = useState(null); // { id, assignmentId, series, reps }
    const [savingEdit, setSavingEdit] = useState(false);

    // Add exercise panel
    const [addingToAssignment, setAddingToAssignment] = useState(null);

    // Workout detail panel
    const [selectedHistoryEntry, setSelectedHistoryEntry] = useState(null);

    useEffect(() => {
        const fetchRoutines = async () => {
            try {
                if (!client?.user_id) { setLoading(false); return; }
                const { data: assigned, error: assignError } = await supabase
                    .from('assigned_routines')
                    .select('*')
                    .eq('client_id', client.user_id);

                if (assignError) throw assignError;

                if (!assigned || assigned.length === 0) {
                    setAssignedRoutines([]);
                    return;
                }

                const routineIds = assigned.map(a => a.routine_id);

                const { data: routinesData, error: routinesError } = await supabase
                    .from('routines')
                    .select('*')
                    .in('id', routineIds)
                    .order('id');

                if (routinesError) throw routinesError;

                const { data: exercisesData, error: exercisesError } = await supabase
                    .from('exercises')
                    .select('*')
                    .in('routine_id', routineIds)
                    .order('ui_order');

                if (exercisesError) throw exercisesError;

                const mergedMap = {};
                (routinesData || []).forEach(r => { mergedMap[r.id] = { ...r, exercises: [] }; });
                (exercisesData || []).forEach(ex => {
                    if (mergedMap[ex.routine_id]) mergedMap[ex.routine_id].exercises.push(ex);
                });

                const finalRoutines = assigned.map(a => ({
                    ...a,
                    routine: mergedMap[a.routine_id] || { id: a.routine_id, name: a.routine_id, exercises: [] }
                })).filter(a => a.routine);

                setAssignedRoutines(finalRoutines);
            } catch (error) {
                console.error('Error fetching assigned routines:', error);
                setAssignedRoutines([]);
            } finally {
                setLoading(false);
            }
        };

        const fetchHistory = async () => {
            if (!client?.user_id) { setHistoryLoading(false); return; }
            try {
                const { data: logs, error } = await supabase
                    .from('workout_logs')
                    .select('id, routine_id, date, logs')
                    .eq('user_id', client.user_id)
                    .order('date', { ascending: false })
                    .limit(20);

                if (error) throw error;
                if (!logs || logs.length === 0) { setWorkoutHistory([]); return; }

                const routineIds = [...new Set(logs.map(l => l.routine_id))];
                const { data: routines } = await supabase
                    .from('routines').select('id, name').in('id', routineIds);

                const routineNameMap = {};
                (routines || []).forEach(r => { routineNameMap[r.id] = r.name; });

                setWorkoutHistory(logs.map(log => ({
                    ...log,
                    routineName: routineNameMap[log.routine_id] || log.routine_id,
                    exerciseCount: log.logs ? Object.keys(log.logs).length : 0,
                })));
            } catch (e) {
                console.error('Error fetching workout history:', e);
            } finally {
                setHistoryLoading(false);
            }
        };

        fetchRoutines();
        fetchHistory();
    }, [client]);

    const toggleRoutine = (id) => {
        setExpandedRoutine(expandedRoutine === id ? null : id);
        setEditingExercise(null);
    };

    const handleDeleteExercise = async (e, exerciseId, assignmentId) => {
        e.stopPropagation();
        try {
            await supabase.from('exercises').delete().eq('id', exerciseId);
            setAssignedRoutines(prev => prev.map(a => {
                if (a.id !== assignmentId) return a;
                return { ...a, routine: { ...a.routine, exercises: a.routine.exercises.filter(ex => ex.id !== exerciseId) } };
            }));
            if (editingExercise?.id === exerciseId) setEditingExercise(null);
        } catch (error) {
            console.error('Error deleting exercise:', error);
        }
    };

    const handleDeleteRoutine = async (assignmentId) => {
        try {
            await supabase.from('assigned_routines').delete().eq('id', assignmentId);
            setAssignedRoutines(prev => prev.filter(a => a.id !== assignmentId));
        } catch (error) {
            console.error('Error unassigning routine:', error);
        } finally {
            setConfirmDeleteId(null);
        }
    };

    const startEditExercise = (e, ex, assignmentId) => {
        e.stopPropagation();
        setEditingExercise({
            id: ex.id,
            assignmentId,
            series: Number(ex.series) || 3,
            reps: Number(ex.reps) || 10,
        });
    };

    const handleSaveEdit = async (e) => {
        e.stopPropagation();
        if (!editingExercise) return;
        setSavingEdit(true);
        try {
            const { error } = await supabase
                .from('exercises')
                .update({ series: String(editingExercise.series), reps: String(editingExercise.reps) })
                .eq('id', editingExercise.id);
            if (error) throw error;

            setAssignedRoutines(prev => prev.map(a => {
                if (a.id !== editingExercise.assignmentId) return a;
                return {
                    ...a,
                    routine: {
                        ...a.routine,
                        exercises: a.routine.exercises.map(ex =>
                            ex.id === editingExercise.id
                                ? { ...ex, series: String(editingExercise.series), reps: String(editingExercise.reps) }
                                : ex
                        )
                    }
                };
            }));
            setEditingExercise(null);
        } catch (err) {
            console.error('Error updating exercise:', err);
        } finally {
            setSavingEdit(false);
        }
    };

    const handleExercisesAdded = (assignmentId, newExercises) => {
        setAssignedRoutines(prev => prev.map(a => {
            if (a.id !== assignmentId) return a;
            return {
                ...a,
                routine: {
                    ...a.routine,
                    exercises: [...a.routine.exercises, ...newExercises]
                }
            };
        }));
    };

    if (!client) return null;

    return (
        <>
            {/* Workout detail panel overlay */}
            {selectedHistoryEntry && (
                <WorkoutDetailPanel
                    entry={selectedHistoryEntry}
                    onClose={() => setSelectedHistoryEntry(null)}
                />
            )}

            {/* Add exercise panel overlay */}
            {addingToAssignment && (
                <AddExercisePanel
                    assignment={addingToAssignment}
                    onClose={() => setAddingToAssignment(null)}
                    onAdded={handleExercisesAdded}
                />
            )}

            <div className="flex flex-col h-full bg-background pb-20">
                <header className="mb-6 flex items-center gap-4 p-4 border-b border-surface-highlight">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-full hover:bg-surface-highlight transition-colors"
                    >
                        <ArrowLeft size={24} className="text-text-primary" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-surface-highlight overflow-hidden flex-shrink-0">
                            <img
                                src={client.avatar_url || `https://ui-avatars.com/api/?name=${client.username}&background=random&color=fff`}
                                alt={client.username}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-text-primary">{client.fullName || client.username}</h2>
                            <p className="text-xs text-text-secondary">{client.weight ? `${client.weight} kg` : 'Sin peso registrado'}</p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-4 space-y-6">

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-surface p-4 rounded-2xl border border-surface-highlight flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-primary">
                                <Activity size={18} />
                                <span className="font-bold text-xs uppercase tracking-wider">Sesiones</span>
                            </div>
                            <p className="text-2xl font-black text-text-primary">
                                {historyLoading ? '—' : workoutHistory.length}
                            </p>
                            <p className="text-xs text-text-secondary">últimas 20</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-surface-highlight flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-orange-500">
                                <Dumbbell size={18} />
                                <span className="font-bold text-xs uppercase tracking-wider">Rutinas</span>
                            </div>
                            <p className="text-2xl font-black text-text-primary">
                                {loading ? '—' : assignedRoutines.length}
                            </p>
                            <p className="text-xs text-text-secondary">asignadas</p>
                        </div>
                    </div>

                    {/* Routines */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg text-text-primary">Rutinas Asignadas</h3>
                            <button
                                onClick={() => onAssignRoutine(client)}
                                className="bg-primary text-black px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-primary-hover transition-colors"
                            >
                                <PlusCircle size={16} />
                                Asignar
                            </button>
                        </div>

                        <div className="space-y-3">
                            {loading ? (
                                <p className="text-sm text-text-secondary">Cargando rutinas...</p>
                            ) : assignedRoutines.length === 0 ? (
                                <div className="bg-surface border border-surface-highlight border-dashed rounded-2xl p-6 text-center text-text-secondary">
                                    <p className="text-sm">No tiene rutinas asignadas actualmente.</p>
                                </div>
                            ) : (
                                assignedRoutines.map((assignment) => {
                                    const { routine } = assignment;
                                    const isExpanded = expandedRoutine === assignment.id;
                                    return (
                                        <div
                                            key={assignment.id}
                                            className={`bg-surface p-4 rounded-2xl border transition-all cursor-pointer border-l-4 ${routine.border_color || 'border-surface-highlight'} ${isExpanded ? 'border-primary shadow-lg' : 'hover:border-gray-500'}`}
                                            onClick={() => toggleRoutine(assignment.id)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className={`font-bold ${routine.text_color || 'text-text-primary'}`}>
                                                        {routine.name}
                                                    </h4>
                                                    <p className="text-xs text-text-secondary mt-1">
                                                        Asignado el {new Date(assignment.assigned_at || assignment.created_at || Date.now()).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {confirmDeleteId === assignment.id ? (
                                                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => handleDeleteRoutine(assignment.id)}
                                                                className="text-xs font-bold px-2 py-1 rounded-lg bg-orange-500 text-white"
                                                            >
                                                                Desasignar
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmDeleteId(null)}
                                                                className="text-xs px-2 py-1 rounded-lg bg-surface-highlight text-text-secondary"
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(assignment.id); }}
                                                            className="p-2 text-text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                    <ChevronRight
                                                        size={20}
                                                        className={`text-text-secondary transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}
                                                    />
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="mt-4 space-y-2 pt-4 border-t border-surface-highlight">
                                                    {routine.exercises.length === 0 ? (
                                                        <p className="text-xs text-text-secondary">Sin ejercicios.</p>
                                                    ) : (
                                                        routine.exercises.map((ex) => {
                                                            const isEditing = editingExercise?.id === ex.id;
                                                            return (
                                                                <div
                                                                    key={ex.id}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="flex items-center gap-3 bg-background/40 rounded-xl px-2 py-2"
                                                                >
                                                                    <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg bg-surface-highlight flex items-center justify-center">
                                                                        {ex.image_url ? (
                                                                            <img src={ex.image_url} alt={ex.name} className="h-full w-full object-cover" />
                                                                        ) : (
                                                                            <Dumbbell size={14} className="text-gray-500" />
                                                                        )}
                                                                    </div>

                                                                    <span className="flex-1 font-medium text-text-primary text-xs truncate">{ex.name}</span>

                                                                    {isEditing ? (
                                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                                            <div className="flex flex-col items-center gap-0.5">
                                                                                <span className="text-[9px] text-text-secondary uppercase">Series</span>
                                                                                <Stepper
                                                                                    value={editingExercise.series}
                                                                                    onChange={(v) => setEditingExercise(prev => ({ ...prev, series: v }))}
                                                                                />
                                                                            </div>
                                                                            <div className="flex flex-col items-center gap-0.5">
                                                                                <span className="text-[9px] text-text-secondary uppercase">Reps</span>
                                                                                <Stepper
                                                                                    value={editingExercise.reps}
                                                                                    onChange={(v) => setEditingExercise(prev => ({ ...prev, reps: v }))}
                                                                                />
                                                                            </div>
                                                                            <button
                                                                                onClick={handleSaveEdit}
                                                                                disabled={savingEdit}
                                                                                className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                                                                            >
                                                                                <Check size={13} className="text-black" strokeWidth={3} />
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setEditingExercise(null); }}
                                                                                className="w-7 h-7 rounded-full bg-surface-highlight flex items-center justify-center flex-shrink-0"
                                                                            >
                                                                                <X size={13} className="text-text-secondary" />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                                            <span className="text-xs text-text-secondary font-mono bg-surface px-2 py-1 rounded-md">{ex.series}×{ex.reps}</span>
                                                                            <button
                                                                                onClick={(e) => startEditExercise(e, ex, assignment.id)}
                                                                                className="w-7 h-7 rounded-full hover:bg-surface-highlight flex items-center justify-center transition-colors"
                                                                            >
                                                                                <Edit2 size={12} className="text-text-secondary" />
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => handleDeleteExercise(e, ex.id, assignment.id)}
                                                                                className="w-7 h-7 rounded-full hover:bg-red-500/10 flex items-center justify-center transition-colors"
                                                                            >
                                                                                <Trash2 size={12} className="text-text-secondary hover:text-red-500" />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    )}

                                                    {/* Add exercise button */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setAddingToAssignment(assignment); }}
                                                        className="w-full flex items-center justify-center gap-2 py-2.5 mt-2 rounded-xl border border-dashed border-surface-highlight text-text-secondary hover:border-primary hover:text-primary transition-colors text-sm font-medium"
                                                    >
                                                        <Plus size={15} />
                                                        Añadir ejercicio
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Workout History */}
                    <div className="pb-6">
                        <button
                            onClick={() => setHistoryExpanded(prev => !prev)}
                            className="w-full flex items-center justify-between mb-4"
                        >
                            <h3 className="font-bold text-lg text-text-primary">Historial de Entrenamientos</h3>
                            <div className="flex items-center gap-2">
                                {!historyLoading && workoutHistory.length > 0 && (
                                    <span className="bg-surface-highlight text-text-secondary text-xs font-bold rounded-full px-2 py-0.5">
                                        {workoutHistory.length}
                                    </span>
                                )}
                                <ChevronRight
                                    size={20}
                                    className={`text-text-secondary transition-transform duration-300 ${historyExpanded ? 'rotate-90' : ''}`}
                                />
                            </div>
                        </button>

                        {historyExpanded && (
                            historyLoading ? (
                                <div className="space-y-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="bg-surface rounded-2xl p-4 border border-surface-highlight animate-pulse">
                                            <div className="h-4 bg-surface-highlight rounded w-1/2 mb-2" />
                                            <div className="h-3 bg-surface-highlight rounded w-1/3" />
                                        </div>
                                    ))}
                                </div>
                            ) : workoutHistory.length === 0 ? (
                                <div className="bg-surface border border-surface-highlight border-dashed rounded-2xl p-6 text-center text-text-secondary">
                                    <p className="text-sm">Aún no ha completado ningún entrenamiento.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {workoutHistory.map((entry) => (
                                        <button
                                            key={entry.id}
                                            onClick={() => setSelectedHistoryEntry(entry)}
                                            className="w-full bg-surface p-4 rounded-2xl border border-surface-highlight flex items-center gap-4 hover:border-primary transition-colors text-left"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <Dumbbell size={18} className="text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-text-primary text-sm truncate">{entry.routineName}</p>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <span className="flex items-center gap-1 text-xs text-text-secondary">
                                                        <Calendar size={11} />
                                                        {new Date(entry.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                    {entry.exerciseCount > 0 && (
                                                        <span className="flex items-center gap-1 text-xs text-text-secondary">
                                                            <Clock size={11} />
                                                            {entry.exerciseCount} ejercicio{entry.exerciseCount !== 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
