import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Search, Dumbbell, Check, Minus, Plus, X, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

const COLORS = [
    { value: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500' },
    { value: 'bg-red-500', border: 'border-red-500', text: 'text-red-500' },
    { value: 'bg-green-500', border: 'border-green-500', text: 'text-green-500' },
    { value: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-500' },
    { value: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-500' },
    { value: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500' },
];

function Stepper({ label, value, onChange, min = 1, max = 99 }) {
    return (
        <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-text-secondary uppercase tracking-wide">{label}</span>
            <div className="flex items-center gap-1.5">
                <button
                    onClick={(e) => { e.stopPropagation(); onChange(Math.max(min, Number(value) - 1)); }}
                    className="w-6 h-6 rounded-md bg-black/20 flex items-center justify-center text-white hover:bg-black/40 transition-colors"
                >
                    <Minus size={10} />
                </button>
                <span className="w-5 text-center text-sm font-bold text-white">{value}</span>
                <button
                    onClick={(e) => { e.stopPropagation(); onChange(Math.min(max, Number(value) + 1)); }}
                    className="w-6 h-6 rounded-md bg-black/20 flex items-center justify-center text-white hover:bg-black/40 transition-colors"
                >
                    <Plus size={10} />
                </button>
            </div>
        </div>
    );
}

function ExerciseCard({ ex, selected, onToggle, onUpdate }) {
    return (
        <div
            onClick={() => onToggle(ex)}
            className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all aspect-square ${
                selected ? 'border-primary shadow-lg shadow-primary/30 scale-[1.02]' : 'border-transparent hover:border-surface-highlight'
            }`}
        >
            {/* Image or placeholder */}
            {ex.image_url ? (
                <img
                    src={ex.image_url}
                    alt={ex.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                />
            ) : (
                <div className="w-full h-full bg-surface-highlight flex items-center justify-center">
                    <Dumbbell size={24} className="text-text-secondary opacity-50" />
                </div>
            )}

            {/* Gradient overlay always */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Exercise name */}
            <div className="absolute bottom-0 inset-x-0 p-1.5">
                <p className="text-white text-[10px] font-semibold leading-tight line-clamp-2">{ex.name}</p>
            </div>

            {/* Selected overlay with steppers */}
            {selected && onUpdate && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 p-1">
                    <Check size={16} className="text-primary" strokeWidth={3} />
                    <div className="flex gap-2">
                        <Stepper
                            label="Series"
                            value={selected.series}
                            onChange={(v) => onUpdate(ex.id, 'series', v)}
                        />
                        <Stepper
                            label="Reps"
                            value={selected.reps}
                            onChange={(v) => onUpdate(ex.id, 'reps', v)}
                        />
                    </div>
                    <p className="text-[9px] text-white/60 mt-0.5 text-center leading-tight line-clamp-1">{ex.name}</p>
                </div>
            )}

            {/* Check badge (unselected hover) */}
            {!selected && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/40 flex items-center justify-center">
                    <Plus size={10} className="text-white/70" />
                </div>
            )}
        </div>
    );
}

// ─── Assign Existing Routine Tab ────────────────────────────────────────────

function AssignExistingTab({ client, user, onSuccess, onBack }) {
    const [routines, setRoutines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedRoutineId, setSelectedRoutineId] = useState(null);
    const [expandedRoutineId, setExpandedRoutineId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    useEffect(() => {
        const fetchRoutines = async () => {
            try {
                const { data: routinesData, error } = await supabase
                    .from('routines')
                    .select('*')
                    .order('id');
                if (error) throw error;

                const ids = (routinesData || []).map(r => r.id);
                const { data: exercisesData } = await supabase
                    .from('exercises')
                    .select('*')
                    .in('routine_id', ids)
                    .order('ui_order');

                const map = {};
                (routinesData || []).forEach(r => { map[r.id] = { ...r, exercises: [] }; });
                (exercisesData || []).forEach(ex => {
                    if (map[ex.routine_id]) map[ex.routine_id].exercises.push(ex);
                });

                setRoutines(Object.values(map));
            } catch (err) {
                console.error('Error fetching routines:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchRoutines();
    }, []);

    const handleDeleteRoutine = async (routineId) => {
        try {
            await supabase.from('exercises').delete().eq('routine_id', routineId);
            await supabase.from('assigned_routines').delete().eq('routine_id', routineId);
            await supabase.from('routines').delete().eq('id', routineId);
            setRoutines(prev => prev.filter(r => r.id !== routineId));
            if (selectedRoutineId === routineId) setSelectedRoutineId(null);
        } catch (err) {
            console.error('Error deleting routine:', err);
        } finally {
            setConfirmDeleteId(null);
        }
    };

    const handleAssign = async () => {
        if (!selectedRoutineId || !client) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('assigned_routines').insert([{
                client_id: client.user_id,
                routine_id: selectedRoutineId,
                assigned_by: user.id,
            }]);
            if (error) throw error;

            const routine = routines.find(r => r.id === selectedRoutineId);
            if (client.user_id && routine) {
                try {
                    await supabase.from('notifications').insert([{
                        user_id: client.user_id,
                        title: '¡Nueva Rutina Asignada!',
                        message: `Tu entrenador te ha asignado: ${routine.name}. ¡A darle duro!`,
                        read: false,
                    }]);
                } catch (notifErr) {
                    console.warn('Could not insert notification, table likely missing', notifErr);
                }
            }

            onSuccess();
        } catch (err) {
            console.error('Error assigning routine:', err);
            alert('Error al asignar. Verifica permisos RLS en Supabase.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-surface rounded-2xl p-4 border border-surface-highlight animate-pulse h-16" />
                ))}
            </div>
        );
    }

    if (routines.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-text-secondary px-4">
                <Dumbbell size={36} className="mb-3 opacity-30" />
                <p className="text-sm text-center">No hay rutinas disponibles en la biblioteca.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto px-4 pb-32 pt-4 space-y-3">
                {routines.map(routine => {
                    const isSelected = selectedRoutineId === routine.id;
                    const isExpanded = expandedRoutineId === routine.id;
                    return (
                        <div
                            key={routine.id}
                            className={`bg-surface rounded-2xl border-2 transition-all cursor-pointer border-l-4 ${routine.border_color || 'border-surface-highlight'} ${isSelected ? 'border-primary shadow-lg shadow-primary/20' : 'hover:border-gray-500'}`}
                            onClick={() => setSelectedRoutineId(isSelected ? null : routine.id)}
                        >
                            <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-text-secondary'}`}>
                                        {isSelected && <Check size={12} className="text-black" strokeWidth={3} />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`font-bold text-sm ${routine.text_color || 'text-text-primary'}`}>{routine.name}</p>
                                        <p className="text-xs text-text-secondary">{routine.exercises.length} ejercicios</p>
                                    </div>
                                </div>
                                    {confirmDeleteId === routine.id ? (
                                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => handleDeleteRoutine(routine.id)}
                                            className="text-xs font-bold px-2 py-1 rounded-lg bg-red-500 text-white"
                                        >
                                            Eliminar
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
                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(routine.id); }}
                                        className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors flex-shrink-0"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); setExpandedRoutineId(isExpanded ? null : routine.id); }}
                                    className="p-1 text-text-secondary hover:text-text-primary transition-colors flex-shrink-0"
                                >
                                    <ChevronRight size={16} className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                </button>
                            </div>
                            {isExpanded && routine.exercises.length > 0 && (
                                <div className="px-4 pb-4 space-y-2 border-t border-surface-highlight pt-3">
                                    {routine.exercises.map(ex => (
                                        <div key={ex.id} className="flex items-center gap-3 text-sm">
                                            <div className="w-8 h-8 rounded-lg bg-surface-highlight overflow-hidden flex-shrink-0 flex items-center justify-center">
                                                {ex.image_url ? (
                                                    <img src={ex.image_url} alt={ex.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Dumbbell size={12} className="text-text-secondary" />
                                                )}
                                            </div>
                                            <span className="flex-1 text-text-primary text-xs">{ex.name}</span>
                                            <span className="text-xs text-text-secondary font-mono">{ex.series}×{ex.reps}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Fixed bottom bar */}
            {selectedRoutineId && (
                <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-surface-highlight p-4 z-20">
                    <button
                        onClick={handleAssign}
                        disabled={saving}
                        className="w-full bg-primary text-black font-bold py-3 rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Asignando...' : `Asignar "${routines.find(r => r.id === selectedRoutineId)?.name}"`}
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function RoutineAssignerView({ client, onBack, onSuccess }) {
    const { user } = useAuth();
    const [mode, setMode] = useState('existing'); // 'existing' | 'new'
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [routineName, setRoutineName] = useState('');
    const [routineColor, setRoutineColor] = useState(COLORS[0]);

    const [catalog, setCatalog] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedExercises, setSelectedExercises] = useState([]);
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const [showSelected, setShowSelected] = useState(false);
    const [saveError, setSaveError] = useState(null);

    useEffect(() => {
        const fetchCatalog = async () => {
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
        fetchCatalog();
    }, []);

    const groups = useMemo(() => {
        const filtered = catalog.filter(ex =>
            ex.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        const map = {};
        for (const ex of filtered) {
            if (!map[ex.group]) map[ex.group] = [];
            map[ex.group].push(ex);
        }
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
    }, [catalog, searchQuery]);

    const getSelected = (exId) => selectedExercises.find(s => s.catalog_id === exId);

    const toggleExercise = (ex) => {
        if (getSelected(ex.id)) {
            setSelectedExercises(prev => prev.filter(s => s.catalog_id !== ex.id));
        } else {
            setSelectedExercises(prev => [...prev, {
                catalog_id: ex.id,
                name: ex.name,
                image_url: ex.image_url || null,
                series: 3,
                reps: 10,
            }]);
        }
    };

    const updateSelected = (catalogId, field, value) => {
        setSelectedExercises(prev =>
            prev.map(s => s.catalog_id === catalogId ? { ...s, [field]: value } : s)
        );
    };

    const toggleGroup = (group) => {
        setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    const canSave = routineName.trim() && selectedExercises.length > 0;

    const handleSave = async () => {
        if (!canSave || !client) return;
        setSaving(true);
        try {
            const routineId = `custom_${crypto.randomUUID()}`;

            const { error: routineError } = await supabase
                .from('routines')
                .insert([{
                    id: routineId,
                    name: routineName.trim(),
                    color: routineColor.value,
                    border_color: routineColor.border,
                    text_color: routineColor.text,
                }]);
            if (routineError) throw routineError;

            const baseId = Math.floor(Math.random() * 800_000) + 100_000;
            const { error: exError } = await supabase.from('exercises').insert(
                selectedExercises.map((ex, i) => ({
                    id: baseId + i,
                    routine_id: routineId,
                    name: ex.name,
                    series: String(ex.series),
                    reps: String(ex.reps),
                    image_url: ex.image_url,
                    ui_order: i + 1,
                }))
            );
            if (exError) throw exError;

            const { error: assignError } = await supabase.from('assigned_routines').insert([{
                client_id: client.user_id,
                routine_id: routineId,
                assigned_by: user.id,
            }]);
            if (assignError) throw assignError;

            if (client.user_id) {
                try {
                    await supabase.from('notifications').insert([{
                        user_id: client.user_id,
                        title: '¡Nueva Rutina Personalizada!',
                        message: `Tu entrenador te ha asignado: ${routineName.trim()}. ¡A darle duro!`,
                        read: false,
                    }]);
                } catch (notifErr) {
                    console.warn('Could not insert notification, table likely missing', notifErr);
                }
            }

            onSuccess();
        } catch (err) {
            console.error('Error saving routine:', err);
            setSaveError(err.message || 'Error al guardar. Inténtalo de nuevo.');
            setTimeout(() => setSaveError(null), 4000);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <header className="flex items-center gap-3 p-4 border-b border-surface-highlight sticky top-0 bg-background z-10">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-surface-highlight transition-colors">
                    <ArrowLeft size={22} className="text-text-primary" />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-text-primary">Asignar Rutina</h2>
                    <p className="text-xs text-text-secondary truncate">{client?.fullName || client?.username}</p>
                </div>
                {mode === 'new' && (
                    <button
                        onClick={handleSave}
                        disabled={!canSave || saving}
                        className="bg-primary text-black font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors flex-shrink-0"
                    >
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                )}
            </header>

            {saveError && (
                <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-2 text-red-400 text-xs font-medium">
                    {saveError}
                </div>
            )}

            {/* Mode tabs */}
            <div className="flex gap-1 p-3 border-b border-surface-highlight bg-background">
                <button
                    onClick={() => setMode('existing')}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${mode === 'existing' ? 'bg-primary text-black' : 'bg-surface text-text-secondary hover:text-text-primary'}`}
                >
                    Rutinas existentes
                </button>
                <button
                    onClick={() => setMode('new')}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${mode === 'new' ? 'bg-primary text-black' : 'bg-surface text-text-secondary hover:text-text-primary'}`}
                >
                    Crear nueva
                </button>
            </div>

            {mode === 'existing' ? (
                <AssignExistingTab client={client} user={user} onSuccess={onSuccess} onBack={onBack} />
            ) : (
                <div className="flex-1 overflow-y-auto">
                    {/* Routine config */}
                    <div className="p-4 space-y-3 border-b border-surface-highlight">
                        <input
                            type="text"
                            placeholder="Nombre de la rutina (ej: Día 1 - Pecho)"
                            value={routineName}
                            onChange={(e) => setRoutineName(e.target.value)}
                            className="w-full bg-surface border border-surface-highlight rounded-xl px-4 py-2.5 text-text-primary text-sm focus:outline-none focus:border-primary transition-colors"
                        />
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-text-secondary">Color:</span>
                            <div className="flex gap-2">
                                {COLORS.map(c => (
                                    <button
                                        key={c.value}
                                        onClick={() => setRoutineColor(c)}
                                        className={`w-6 h-6 rounded-full ${c.value} transition-all ${routineColor.value === c.value ? 'ring-2 ring-white ring-offset-2 ring-offset-background scale-110' : 'opacity-40 hover:opacity-70'}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="px-4 pt-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-text-secondary" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar ejercicio..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-surface border border-surface-highlight rounded-xl pl-9 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>
                    </div>

                    {/* Exercise grid by group */}
                    <div className="px-4 pb-32 pt-4 space-y-6">
                        {loading ? (
                            <div className="grid grid-cols-4 gap-2">
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
                                                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                            </div>
                                        </button>

                                        {!isCollapsed && (
                                            <div className="grid grid-cols-4 gap-2">
                                                {exercises.map(ex => {
                                                    const sel = getSelected(ex.id);
                                                    return (
                                                        <ExerciseCard
                                                            key={ex.id}
                                                            ex={ex}
                                                            selected={sel || null}
                                                            onToggle={toggleExercise}
                                                            onUpdate={updateSelected}
                                                        />
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
            )}

            {/* Bottom selected bar — only for new routine mode */}
            {mode === 'new' && selectedExercises.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-surface-highlight p-4 z-20">
                    <button
                        onClick={() => setShowSelected(!showSelected)}
                        className="w-full flex items-center justify-between"
                    >
                        <span className="text-sm font-bold text-text-primary">
                            {selectedExercises.length} ejercicio{selectedExercises.length !== 1 ? 's' : ''} seleccionado{selectedExercises.length !== 1 ? 's' : ''}
                        </span>
                        <ChevronDown size={16} className={`text-text-secondary transition-transform ${showSelected ? 'rotate-180' : ''}`} />
                    </button>

                    {showSelected && (
                        <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                            {selectedExercises.map((ex) => (
                                <div key={ex.catalog_id} className="flex items-center gap-3 bg-background rounded-xl px-3 py-2">
                                    {ex.image_url ? (
                                        <img src={ex.image_url} alt={ex.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-lg bg-surface-highlight flex items-center justify-center flex-shrink-0">
                                            <Dumbbell size={12} className="text-text-secondary" />
                                        </div>
                                    )}
                                    <span className="flex-1 text-xs text-text-primary truncate">{ex.name}</span>
                                    <span className="text-xs text-text-secondary font-bold">{ex.series}×{ex.reps}</span>
                                    <button
                                        onClick={() => setSelectedExercises(prev => prev.filter(s => s.catalog_id !== ex.catalog_id))}
                                        className="w-6 h-6 flex items-center justify-center text-text-secondary hover:text-red-500 transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
