import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { enrichExercisesWithCatalog } from '../../lib/utils';
import { ArrowLeft, Dumbbell, ChevronRight, Search, Minus, Plus, Check } from 'lucide-react';

export function AddExercisePanel({ assignment, onClose, onAdded }) {
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
        const q = search.toLowerCase().replace(/^#/, '').trim();
        const filtered = catalog.filter(ex =>
            ex.name.toLowerCase().includes(q) || String(ex.id).includes(q)
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

            const { data: existing } = await supabase
                .from('exercises')
                .select('ui_order')
                .eq('routine_id', routineId)
                .order('ui_order', { ascending: false })
                .limit(1);

            const maxOrder = existing?.[0]?.ui_order || 0;

            const newExercises = selected.map((ex, i) => ({
                routine_id: routineId,
                name: ex.name,
                series: String(ex.series),
                reps: String(ex.reps),
                image_url: ex.image_url,
                catalog_id: ex.catalog_id ?? null,
                ui_order: maxOrder + i + 1,
            }));

            const { data: inserted, error } = await supabase
                .from('exercises')
                .insert(newExercises)
                .select('*, exercise_catalog(name, image_url, instructions)');

            if (error) throw error;
            onAdded(assignment.id, enrichExercisesWithCatalog(inserted || []));
            onClose();
        } catch (err) {
            console.error('Error adding exercises:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
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
                                                        <img src={ex.image_url} alt={ex.name} className="w-full h-full object-contain" loading="lazy" referrerPolicy="no-referrer" />
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
