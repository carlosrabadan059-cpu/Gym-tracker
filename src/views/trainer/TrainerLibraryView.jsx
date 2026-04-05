import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Search, Dumbbell, ChevronDown, ChevronRight } from 'lucide-react';

export function TrainerLibraryView({ onBack }) {
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedGroups, setCollapsedGroups] = useState({});

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

    const toggleGroup = (group) => {
        setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    return (
        <div className="flex flex-col h-full bg-background pb-20">
            <header className="flex items-center gap-4 p-4 border-b border-surface-highlight sticky top-0 bg-background z-10">
                <button
                    onClick={onBack}
                    className="p-2 rounded-full hover:bg-surface-highlight transition-colors"
                >
                    <ArrowLeft size={24} className="text-text-primary" />
                </button>
                <h2 className="text-2xl font-bold text-text-primary">Librería</h2>
            </header>

            <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-4 pb-12">
                {/* Search */}
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

                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-surface rounded-xl border border-surface-highlight animate-pulse">
                                <div className="px-4 py-3 flex justify-between items-center">
                                    <div className="h-4 bg-surface-highlight rounded w-1/3" />
                                    <div className="h-3 bg-surface-highlight rounded w-16" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : groups.length === 0 ? (
                    <div className="text-center text-text-secondary mt-16">
                        <Dumbbell size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No se encontraron ejercicios</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {groups.map(([groupName, exercises]) => {
                            const isCollapsed = collapsedGroups[groupName];
                            return (
                                <div key={groupName} className="bg-surface rounded-2xl border border-surface-highlight overflow-hidden">
                                    {/* Group header */}
                                    <button
                                        onClick={() => toggleGroup(groupName)}
                                        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-surface-highlight/40 transition-colors"
                                    >
                                        <span className="font-bold text-text-primary">{groupName}</span>
                                        <div className="flex items-center gap-2 text-text-secondary">
                                            <span className="text-xs">{exercises.length} ejercicios</span>
                                            {isCollapsed
                                                ? <ChevronRight size={16} />
                                                : <ChevronDown size={16} />
                                            }
                                        </div>
                                    </button>

                                    {/* Exercise list */}
                                    {!isCollapsed && (
                                        <div className="divide-y divide-surface-highlight border-t border-surface-highlight">
                                            {exercises.map(ex => (
                                                <div key={ex.id} className="flex items-center gap-3 px-4 py-2.5">
                                                    <div className="w-9 h-9 rounded-lg bg-background overflow-hidden flex-shrink-0 flex items-center justify-center">
                                                        {ex.image_url ? (
                                                            <img
                                                                src={ex.image_url}
                                                                alt={ex.name}
                                                                className="w-full h-full object-cover"
                                                                referrerPolicy="no-referrer"
                                                            />
                                                        ) : (
                                                            <Dumbbell size={14} className="text-text-secondary" />
                                                        )}
                                                    </div>
                                                    <span className="text-sm text-text-primary">{ex.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
