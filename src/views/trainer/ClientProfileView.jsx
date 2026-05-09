import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { enrichExercisesWithCatalog } from '../../lib/utils';
import { isTimeBasedExercise } from '../../lib/exerciseUtils';
import { ArrowLeft, PlusCircle, Activity, Dumbbell, ChevronRight, Trash2, Calendar, Clock, Edit2, Check, X, Minus, Plus, Pencil } from 'lucide-react';
import { WorkoutDetailPanel } from './WorkoutDetailPanel';
import { AddExercisePanel } from './AddExercisePanel';

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

export function ClientProfileView({ client, onBack, onAssignRoutine }) {
    const [assignedRoutines, setAssignedRoutines] = useState([]);
    const [workoutHistory, setWorkoutHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [expandedRoutine, setExpandedRoutine] = useState(null);
    const [historyExpanded, setHistoryExpanded] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const [editingExercise, setEditingExercise] = useState(null);
    const [savingEdit, setSavingEdit] = useState(false);

    const [editingRoutineNameId, setEditingRoutineNameId] = useState(null);
    const [editingRoutineNameValue, setEditingRoutineNameValue] = useState('');

    const [addingToAssignment, setAddingToAssignment] = useState(null);
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

                const [
                    { data: routinesData, error: routinesError },
                    { data: rawExercisesData, error: exercisesError },
                ] = await Promise.all([
                    supabase.from('routines').select('*').in('id', routineIds).order('id'),
                    supabase.from('exercises').select('*, exercise_catalog(name, image_url, instructions)').in('routine_id', routineIds).order('ui_order'),
                ]);

                if (routinesError) throw routinesError;
                if (exercisesError) throw exercisesError;

                const exercisesData = enrichExercisesWithCatalog(rawExercisesData);

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
                    .select('id, routine_id, date, logs, routines(name)')
                    .eq('user_id', client.user_id)
                    .order('date', { ascending: false })
                    .limit(20);

                if (error) throw error;

                setWorkoutHistory((logs || []).map(log => ({
                    ...log,
                    routineName: log.routines?.name || log.routine_id,
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

    const handleRenameRoutine = async (routineId) => {
        const newName = editingRoutineNameValue.trim();
        if (!newName) { setEditingRoutineNameId(null); return; }
        try {
            const { data, error } = await supabase
                .from('routines')
                .update({ name: newName })
                .eq('id', routineId)
                .select();
            if (error) throw error;
            if (!data || data.length === 0) return;
            setAssignedRoutines(prev => prev.map(a =>
                a.routine_id === routineId
                    ? { ...a, routine: { ...a.routine, name: newName } }
                    : a
            ));
        } catch (err) {
            console.error('Error renaming routine:', err);
            alert(`Error al renombrar: ${err.message}`);
        } finally {
            setEditingRoutineNameId(null);
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
            {selectedHistoryEntry && (
                <WorkoutDetailPanel
                    entry={selectedHistoryEntry}
                    onClose={() => setSelectedHistoryEntry(null)}
                />
            )}

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
                                            {editingRoutineNameId === assignment.id ? (
                                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        value={editingRoutineNameValue}
                                                        onChange={e => setEditingRoutineNameValue(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleRenameRoutine(routine.id);
                                                            if (e.key === 'Escape') setEditingRoutineNameId(null);
                                                        }}
                                                        className="flex-1 bg-background border border-primary rounded-lg px-3 py-2 text-sm font-bold text-text-primary focus:outline-none"
                                                    />
                                                    <button
                                                        onClick={() => handleRenameRoutine(routine.id)}
                                                        className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
                                                    >
                                                        <Check size={14} className="text-black" strokeWidth={3} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingRoutineNameId(null)}
                                                        className="w-8 h-8 rounded-full bg-surface-highlight flex items-center justify-center flex-shrink-0"
                                                    >
                                                        <X size={14} className="text-text-secondary" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between items-center">
                                                    <div className="flex-1 min-w-0 mr-2">
                                                        <h4 className={`font-bold ${routine.text_color || 'text-text-primary'}`}>
                                                            {routine.name}
                                                        </h4>
                                                        <p className="text-xs text-text-secondary mt-1">
                                                            Asignado el {new Date(assignment.assigned_at || assignment.created_at || Date.now()).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => { setEditingRoutineNameId(assignment.id); setEditingRoutineNameValue(routine.name); }}
                                                            className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                                                        >
                                                            <Pencil size={15} />
                                                        </button>
                                                        {confirmDeleteId === assignment.id ? (
                                                            <div className="flex items-center gap-1">
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
                                            )}

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
                                                                            <img src={ex.image_url} alt={ex.name} className="h-full w-full object-contain" loading="lazy" />
                                                                        ) : (
                                                                            <Dumbbell size={14} className="text-gray-500" />
                                                                        )}
                                                                    </div>

                                                                    {(ex.catalog_id && ex.catalog_id <= 9999) && (
                                                                        <span className="flex-shrink-0 text-[9px] font-mono font-bold text-text-secondary bg-surface-highlight px-1.5 py-0.5 rounded-md">#{ex.catalog_id}</span>
                                                                    )}
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
                                                                                <span className="text-[9px] text-text-secondary uppercase">{isTimeBasedExercise(ex) ? "Min" : "Reps"}</span>
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
                                                                            <span className="text-xs text-text-secondary font-mono bg-surface px-2 py-1 rounded-md">{ex.series}×{ex.reps}{isTimeBasedExercise(ex) ? 'm' : ''}</span>
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
