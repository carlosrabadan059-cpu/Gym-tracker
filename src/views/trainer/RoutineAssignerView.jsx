import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, CheckCircle2, Search, Plus, Trash2, Dumbbell } from 'lucide-react';

export function RoutineAssignerView({ client, onBack, onSuccess }) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Step management
    const [step, setStep] = useState(1); // 1: Info & Selection, 2: Customization

    // Form data
    const [routineName, setRoutineName] = useState('');
    const [routineColor, setRoutineColor] = useState('bg-blue-500');

    // Exercise data
    const [allExercises, setAllExercises] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Selected exercises to assign
    const [selectedExercises, setSelectedExercises] = useState([]);

    const colors = [
        { value: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500' },
        { value: 'bg-red-500', border: 'border-red-500', text: 'text-red-500' },
        { value: 'bg-green-500', border: 'border-green-500', text: 'text-green-500' },
        { value: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-500' },
        { value: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-500' },
        { value: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500' },
    ];

    useEffect(() => {
        // Fetch from exercise_catalog instead of exercises for the full 90-exercise list
        const fetchExercises = async () => {
            try {
                const { data, error } = await supabase
                    .from('exercise_catalog')
                    .select('*');

                if (error) throw error;

                // Group by category (or target, depending on what the DB column is named)
                const catalog = data || [];

                // Set default series/reps and group
                const processedEx = catalog.map(ex => ({
                    ...ex,
                    series: ex.series || '4',
                    reps: ex.reps || '10',
                    group: ex.target || ex.category || ex.bodyPart || 'Otros' // fallback property checks
                }));

                setAllExercises(processedEx);
            } catch (error) {
                console.error('Error fetching exercise_catalog:', error);
                alert('No se pudieron cargar los ejercicios del catálogo.');
            } finally {
                setLoading(false);
            }
        };

        fetchExercises();
    }, []);

    const toggleExercise = (exercise) => {
        const isSelected = selectedExercises.some(ex => ex.name === exercise.name);
        if (isSelected) {
            setSelectedExercises(prev => prev.filter(ex => ex.name !== exercise.name));
        } else {
            setSelectedExercises(prev => [...prev, { ...exercise, id: Date.now() + Math.random() }]);
        }
    };

    const updateExerciseLogistics = (idx, field, value) => {
        const updated = [...selectedExercises];
        updated[idx][field] = value;
        setSelectedExercises(updated);
    };

    const moveExercise = (idx, direction) => {
        if (direction === -1 && idx === 0) return;
        if (direction === 1 && idx === selectedExercises.length - 1) return;

        const updated = [...selectedExercises];
        const temp = updated[idx];
        updated[idx] = updated[idx + direction];
        updated[idx + direction] = temp;
        setSelectedExercises(updated);
    };

    const handleAssign = async () => {
        if (!routineName || selectedExercises.length === 0 || !client) return;
        setSaving(true);

        try {
            const customRoutineId = `custom_${Date.now()}_${client.user_id.substring(0, 5)}`;
            const colorConfig = colors.find(c => c.value === routineColor) || colors[0];

            // 1. Insert Routine
            const { error: routineError } = await supabase
                .from('routines')
                .insert([{
                    id: customRoutineId,
                    name: routineName,
                    color: colorConfig.value,
                    border_color: colorConfig.border,
                    text_color: colorConfig.text
                }]);

            if (routineError) throw routineError;

            // 2. Insert Custom Exercises
            const exrToInsert = selectedExercises.map((ex, index) => ({
                routine_id: customRoutineId,
                name: ex.name,
                series: ex.series.toString(),
                reps: ex.reps.toString(),
                image_url: ex.image_url,
                ui_order: index + 1
            }));

            const { error: exError } = await supabase
                .from('exercises')
                .insert(exrToInsert);

            if (exError) throw exError;

            // 3. Assign Routine to Client
            const { error: assignError } = await supabase
                .from('assigned_routines')
                .insert([{
                    client_id: client.user_id,
                    routine_id: customRoutineId,
                    assigned_by: user.id
                }]);

            if (assignError) throw assignError;

            // 4. Send Notification
            const { error: notifyError } = await supabase
                .from('notifications')
                .insert([{
                    user_id: client.user_id,
                    title: '¡Nueva Rutina Personalizada!',
                    message: `Tu entrenador te ha asignado: ${routineName}. ¡A darle duro!`,
                    read: false
                }]);

            if (notifyError) throw notifyError;

            // Done!
            onSuccess();
        } catch (error) {
            console.error('Error al asignar rutina:', error);
            alert('Hubo un error al crear y asignar la rutina. Revisa que tengas los permisos en Supabase (RLS Policies).');
        } finally {
            setSaving(false);
        }
    };

    const filteredCatalog = allExercises.filter(ex => ex.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const categories = {};
    for (const ex of filteredCatalog) {
        if (!categories[ex.group]) categories[ex.group] = [];
        categories[ex.group].push(ex);
    }

    // --- STEP 1: SELECTION ---
    if (step === 1) {
        return (
            <div className="flex flex-col h-full bg-background pb-20">
                <header className="mb-6 flex items-center gap-4 p-4 border-b border-surface-highlight sticky top-0 bg-background z-10">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-surface-highlight transition-colors">
                        <ArrowLeft size={24} className="text-text-primary" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-text-primary">Creador de Rutinas</h2>
                        <p className="text-xs text-text-secondary">Paso 1: Seleccionar Ejercicios</p>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-4 space-y-6">
                    {/* Routine Info inputs */}
                    <div className="bg-surface p-4 rounded-2xl border border-surface-highlight space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Nombre de la Rutina</label>
                            <input
                                type="text"
                                placeholder="Ej: Día 1: Pecho (Adaptado)"
                                value={routineName}
                                onChange={(e) => setRoutineName(e.target.value)}
                                className="w-full bg-background border border-surface-highlight rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Color del Bloque</label>
                            <div className="flex gap-2">
                                {colors.map(c => (
                                    <button
                                        key={c.value}
                                        onClick={() => setRoutineColor(c.value)}
                                        className={`w-8 h-8 rounded-full ${c.value} ${routineColor === c.value ? 'ring-2 ring-white ring-offset-2 ring-offset-background' : 'opacity-50 hover:opacity-100'} transition-all`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Exercise Catalogue */}
                    <div>
                        <h3 className="font-bold text-lg text-text-primary mb-3">Catálogo de Ejercicios</h3>
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-3 text-text-secondary" size={20} />
                            <input
                                type="text"
                                placeholder="Buscar ejercicio..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-surface border border-surface-highlight rounded-xl pl-10 pr-4 py-3 text-text-primary focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>

                        {loading ? (
                            <p className="text-center text-text-secondary py-8">Cargando ejercicios...</p>
                        ) : (
                            <div className="space-y-6">
                                {Object.keys(categories).sort().map(groupName => (
                                    <div key={groupName} className="space-y-2">
                                        <h4 className="font-bold text-primary uppercase text-xs tracking-wider border-b border-surface-highlight pb-1 mb-3">{groupName}</h4>
                                        <div className="space-y-2">
                                            {categories[groupName].map(ex => {
                                                const isSelected = selectedExercises.some(s => s.name === ex.name);
                                                return (
                                                    <div
                                                        key={ex.name}
                                                        onClick={() => toggleExercise(ex)}
                                                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 border-primary' : 'bg-surface border-surface-highlight hover:border-gray-500'}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-lg bg-background overflow-hidden flex items-center justify-center flex-shrink-0">
                                                                {ex.image_url ? (
                                                                    <img src={ex.image_url} alt={ex.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <Dumbbell size={16} className="text-text-secondary" />
                                                                )}
                                                            </div>
                                                            <span className={`font-medium ${isSelected ? 'text-primary' : 'text-text-primary'}`}>{ex.name}</span>
                                                        </div>
                                                        <div className="flex-shrink-0">
                                                            {isSelected ? (
                                                                <CheckCircle2 size={24} className="text-primary" />
                                                            ) : (
                                                                <Plus size={24} className="text-text-secondary" />
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-background border-t border-surface-highlight">
                    <button
                        onClick={() => setStep(2)}
                        disabled={!routineName || selectedExercises.length === 0}
                        className="w-full bg-primary text-black font-bold py-4 rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        Configurar {selectedExercises.length} Ejercicio{selectedExercises.length !== 1 ? 's' : ''} →
                    </button>
                    {(!routineName || selectedExercises.length === 0) && (
                        <p className="text-center text-xs text-text-secondary mt-2">Introduce un nombre y selecciona ejercicios.</p>
                    )}
                </div>
            </div>
        );
    }

    // --- STEP 2: CUSTOMIZATION ---
    return (
        <div className="flex flex-col h-full bg-background pb-20">
            <header className="mb-6 flex items-center justify-between p-4 border-b border-surface-highlight sticky top-0 bg-background z-10">
                <button onClick={() => setStep(1)} className="p-2 rounded-full hover:bg-surface-highlight transition-colors">
                    <ArrowLeft size={24} className="text-text-primary" />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-text-primary text-right">Ajustes</h2>
                    <p className="text-xs text-text-secondary text-right">Paso 2: Series y Reps</p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 space-y-4">
                <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex gap-3">
                    <CheckCircle2 className="text-primary flex-shrink-0 mt-0.5" size={20} />
                    <div>
                        <h4 className="font-bold text-primary">{routineName}</h4>
                        <p className="text-xs text-text-secondary">Ajusta los volúmenes para <strong className="text-text-primary">{client.fullName || client.username}</strong>. Puedes reordenarlos.</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {selectedExercises.map((ex, idx) => (
                        <div key={ex.id} className="bg-surface p-4 rounded-xl border border-surface-highlight flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-text-secondary w-5">{idx + 1}.</span>
                                    <span className="font-bold text-text-primary">{ex.name}</span>
                                </div>
                                <button onClick={() => setSelectedExercises(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="flex gap-4 items-center">
                                <div className="flex-1">
                                    <label className="block text-xs text-text-secondary mb-1">Series</label>
                                    <input
                                        type="text"
                                        value={ex.series}
                                        onChange={(e) => updateExerciseLogistics(idx, 'series', e.target.value)}
                                        className="w-full bg-background border border-surface-highlight rounded-lg px-3 py-2 text-sm text-text-primary focus:border-primary outline-none"
                                    />
                                </div>
                                <span className="text-text-secondary mt-5">x</span>
                                <div className="flex-1">
                                    <label className="block text-xs text-text-secondary mb-1">Reps</label>
                                    <input
                                        type="text"
                                        value={ex.reps}
                                        onChange={(e) => updateExerciseLogistics(idx, 'reps', e.target.value)}
                                        className="w-full bg-background border border-surface-highlight rounded-lg px-3 py-2 text-sm text-text-primary focus:border-primary outline-none"
                                    />
                                </div>

                                {/* Reorder buttons */}
                                <div className="flex flex-col gap-1 ml-2 mt-4">
                                    <button
                                        onClick={() => moveExercise(idx, -1)}
                                        disabled={idx === 0}
                                        className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-30 bg-background rounded"
                                    >
                                        ▲
                                    </button>
                                    <button
                                        onClick={() => moveExercise(idx, 1)}
                                        disabled={idx === selectedExercises.length - 1}
                                        className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-30 bg-background rounded"
                                    >
                                        ▼
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-4 bg-background border-t border-surface-highlight">
                <button
                    onClick={handleAssign}
                    disabled={saving}
                    className="w-full bg-primary text-black font-bold py-4 rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                    {saving ? 'Guardando en Base de Datos...' : 'Guardar y Asignar'}
                </button>
            </div>
        </div>
    );
}
