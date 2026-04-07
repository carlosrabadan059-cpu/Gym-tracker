import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, User, PlusCircle, Activity, Dumbbell, ChevronRight, Trash2 } from 'lucide-react';

export function ClientProfileView({ client, onBack, onAssignRoutine }) {
    const [assignedRoutines, setAssignedRoutines] = useState([]);
    const [loading, setLoading] = useState(true);

    const [expandedRoutine, setExpandedRoutine] = useState(null);

    useEffect(() => {
        const fetchRoutines = async () => {
            try {
                // 1. Get assignments
                const { data: assigned, error: assignError } = await supabase
                    .from('assigned_routines')
                    .select('*')
                    .eq('client_id', client.user_id);

                if (assignError) throw assignError;

                // Mirror DashboardView logic: fall back to default day1-4 if no assignments
                let routineIds;
                let isDefaultRoutines = false;
                if (!assigned || assigned.length === 0) {
                    routineIds = ['day1', 'day2', 'day3', 'day4'];
                    isDefaultRoutines = true;
                } else {
                    routineIds = assigned.map(a => a.routine_id);
                }

                // 2. Get routines
                const { data: routinesData, error: routinesError } = await supabase
                    .from('routines')
                    .select('*')
                    .in('id', routineIds)
                    .order('id');

                if (routinesError) throw routinesError;

                // 3. Get exercises
                const { data: exercisesData, error: exercisesError } = await supabase
                    .from('exercises')
                    .select('*')
                    .in('routine_id', routineIds)
                    .order('ui_order');

                if (exercisesError) throw exercisesError;

                // 4. Merge
                const mergedMap = {};
                routinesData.forEach(r => {
                    mergedMap[r.id] = { ...r, exercises: [] };
                });
                exercisesData.forEach(ex => {
                    if (mergedMap[ex.routine_id]) {
                        mergedMap[ex.routine_id].exercises.push(ex);
                    }
                });

                if (isDefaultRoutines) {
                    // Wrap default routines in a shape compatible with the assignment format
                    const finalRoutines = routinesData.map(r => ({
                        id: `default_${r.id}`,
                        routine_id: r.id,
                        created_at: null,
                        isDefault: true,
                        routine: { ...r, exercises: mergedMap[r.id]?.exercises || [] }
                    }));
                    setAssignedRoutines(finalRoutines);
                } else {
                    const finalRoutines = assigned.map(a => ({
                        ...a,
                        routine: mergedMap[a.routine_id] || { id: a.routine_id, name: a.routine_id, exercises: [] }
                    })).filter(a => a.routine);
                    setAssignedRoutines(finalRoutines);
                }
            } catch (error) {
                console.error('Error fetching assigned routines:', error);
            } finally {
                setLoading(false);
            }
        };

        if (client?.user_id) fetchRoutines();
    }, [client]);

    const toggleRoutine = (id) => {
        setExpandedRoutine(expandedRoutine === id ? null : id);
    };

    const handleDeleteRoutine = async (e, assignmentId, routineId) => {
        e.stopPropagation();
        if (!confirm('¿Seguro que quieres eliminar esta asignación?')) return;

        try {
            // Delete from assigned_routines
            await supabase.from('assigned_routines').delete().eq('id', assignmentId);

            // If it's a custom routine (starts with custom_), we delete the routine (cascades to exercises)
            if (routineId.startsWith('custom_')) {
                await supabase.from('routines').delete().eq('id', routineId);
                await supabase.from('exercises').delete().eq('routine_id', routineId);
            }

            setAssignedRoutines(prev => prev.filter(a => a.id !== assignmentId));
        } catch (error) {
            console.error('Error deleting routine:', error);
            alert('Error al eliminar');
        }
    };

    if (!client) return null;

    return (
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

                {/* Stats Summary - Optional for deeper iteration */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-surface p-4 rounded-2xl border border-surface-highlight flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-primary">
                            <Activity size={18} />
                            <span className="font-bold text-xs uppercase tracking-wider">Actividad</span>
                        </div>
                        <p className="text-2xl font-black text-text-primary">Activo</p>
                    </div>
                    <div className="bg-surface p-4 rounded-2xl border border-surface-highlight flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-orange-500">
                            <Dumbbell size={18} />
                            <span className="font-bold text-xs uppercase tracking-wider">Rutinas</span>
                        </div>
                        <p className="text-2xl font-black text-text-primary">{assignedRoutines.length}</p>
                    </div>
                </div>

                {/* Routines List */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg text-text-primary">
                            {assignedRoutines.length > 0 && assignedRoutines[0].isDefault
                                ? 'Rutinas por defecto'
                                : 'Rutinas Asignadas'}
                        </h3>
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
                                                    {assignment.isDefault
                                                        ? 'Rutina por defecto'
                                                        : `Asignado el ${new Date(assignment.created_at).toLocaleDateString()}`}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {!assignment.isDefault && (
                                                    <button
                                                        onClick={(e) => handleDeleteRoutine(e, assignment.id, routine.id)}
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
                                            <div className="mt-4 space-y-3 pt-4 border-t border-surface-highlight animate-fadeIn">
                                                {routine.exercises.length === 0 ? (
                                                    <p className="text-xs text-text-secondary">Sin ejercicios.</p>
                                                ) : (
                                                    routine.exercises.map((ex) => (
                                                        <div key={ex.id} className="flex items-center gap-3">
                                                            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-surface-highlight flex items-center justify-center">
                                                                {ex.image_url ? (
                                                                    <img src={ex.image_url} alt={ex.name} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <Dumbbell size={16} className="text-gray-500" />
                                                                )}
                                                            </div>
                                                            <div className="flex flex-1 items-center justify-between text-sm text-text-secondary">
                                                                <span className="font-medium text-text-primary">{ex.name}</span>
                                                                <span className="text-xs opacity-70 ml-2 whitespace-nowrap bg-background px-2 py-1 rounded-md">{ex.series}x{ex.reps}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
