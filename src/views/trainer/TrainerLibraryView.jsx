import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Search, Dumbbell, ChevronDown, ChevronRight, Plus, X, Trash2, Check, ImageIcon, Pencil } from 'lucide-react';

const MUSCLE_GROUPS = [
    'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps',
    'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Pantorrillas',
    'Abdominales', 'Cardio', 'Otros',
];

// Todas las imágenes locales disponibles en /public/exercises/
const LOCAL_IMAGES = [
    'abductor-machine-in.png',
    'abductor-machine-out.png',
    'back-extension.png',
    'barbell-curl.png',
    'bench-press.png',
    'bench-situp.png',
    'calf-raise-machine.png',
    'cardio-andar.png',
    'cardio-bicicleta.png',
    'cardio-correr.png',
    'cardio-eliptica.png',
    'crunch-machine.png',
    'decline-bench-press.png',
    'decline-crunch.png',
    'decline-oblique-crunch.png',
    'dips.png',
    'dumbbell-side-bend.png',
    'ez-bar-skullcrusher.png',
    'front-raise.png',
    'futures-abdomen-cable-crunch.png',
    'futures-abdomen-crunch-pies-alto.png',
    'futures-abdomen-crunch-suelo.png',
    'futures-abdomen-knee-raises.png',
    'futures-abdomen-lumbares.png',
    'futures-abdomen-plank.png',
    'futures-abdomen-russian-twists.png',
    'futures-abdomen-wheel.png',
    'futures-biceps-antebrazo-pronacion.png',
    'futures-biceps-antebrazo-supinacion.png',
    'futures-biceps-curl-alterno-sentado.png',
    'futures-biceps-curl-barra-recta.png',
    'futures-biceps-curl-concentrado.png',
    'futures-biceps-curl-martillo-pie.png',
    'futures-biceps-curl-martillo.png',
    'futures-biceps-curl-polea-alta.png',
    'futures-biceps-curl-polea-baja.png',
    'futures-biceps-curl-predicador.png',
    'futures-biceps-curl-reverse.png',
    'futures-biceps-curl-tumbado.png',
    'futures-biceps-curl-zottman.png',
    'futures-biceps-giros-muneca.png',
    'futures-dorsal-face-pull.png',
    'futures-dorsal-jalon-ancho.png',
    'futures-dorsal-jalon-tras-nuca.png',
    'futures-dorsal-remo-barra.png',
    'futures-dorsal-remo-mancuerna.png',
    'futures-dorsal-remo-polea-baja.png',
    'futures-dorsal-remo-vertical.png',
    'futures-gluteo-abduccion-maquina.png',
    'futures-gluteo-abductor.png',
    'futures-gluteo-hip-thrust.png',
    'futures-gluteo-patada-lateral.png',
    'futures-gluteo-step-ups.png',
    'futures-hombro-front-raise-weight.png',
    'futures-hombro-front-raise.png',
    'futures-hombro-lateral-raise.png',
    'futures-hombro-press-arnold.png',
    'futures-hombro-press-barra-de-pie.png',
    'futures-hombro-press-militar-mancuernas.png',
    'futures-hombro-shrugs-barra.png',
    'futures-hombro-shrugs-mancuernas.png',
    'futures-pecho-aperturas-banco-plano.png',
    'futures-pecho-aperturas-laterales.png',
    'futures-pecho-contractora.png',
    'futures-pecho-cruce-inferior.png',
    'futures-pecho-cruce-superior.png',
    'futures-pecho-flexiones.png',
    'futures-pecho-press-banca-plano-barra.png',
    'futures-pecho-press-inclinado-barra.png',
    'futures-pecho-press-superior-mancuernas.png',
    'futures-pecho-pullover.png',
    'futures-pierna-extension.png',
    'futures-pierna-femoral-tumbado.png',
    'futures-pierna-gemelos-maquina.png',
    'futures-pierna-peso-muerto-rumano.png',
    'futures-pierna-prensa-45.png',
    'futures-pierna-prensa-gemelos.png',
    'futures-pierna-prensa-vertical.png',
    'futures-pierna-sentadilla-hack.png',
    'futures-pierna-sentadilla-smith.png',
    'futures-pierna-zancadas.png',
    'futures-triceps-extension-tras-nuca.png',
    'futures-triceps-extension-una-mano.png',
    'futures-triceps-fondos-bancos.png',
    'futures-triceps-fondos-maquina.png',
    'futures-triceps-jalon-barra.png',
    'futures-triceps-jalon-cuerda.png',
    'futures-triceps-patada.png',
    'futures-triceps-press-cerrado.png',
    'futures-triceps-press-frances.png',
    'futures_abdomen_crunch_declinado_final.png',
    'futures_abdomen_crunch_lateral_final.png',
    'futures_abdomen_crunch_maquina_final.png',
    'futures_abdomen_crunch_suelo_alt_final.png',
    'futures_abdomen_elevacion_suspendido_final.png',
    'futures_abdomen_tijeras_final.png',
    'futures_biceps_curl_barra_recta_alt_final.png',
    'futures_dorsal_jalon_neutral_final.png',
    'futures_dorsal_lumbares_banco_final.png',
    'futures_dorsal_remo_mancuerna_horizontal_final.png',
    'futures_gluteo_aductor_final.png',
    'futures_gluteo_patada_polea_final.png',
    'futures_hombro_elevacion_frontal_mancuernas_final.png',
    'futures_hombro_elevacion_frontal_polea_final.png',
    'futures_hombro_elevacion_lateral_mancuernas_final.png',
    'futures_hombro_encogimiento_maquina_final.png',
    'futures_hombro_press_maquina_final.png',
    'futures_pecho_fondos_paralelas_final.png',
    'futures_pecho_press_declinado_final.png',
    'futures_pecho_press_inclinado_mancuernas_final.png',
    'futures_pecho_press_superior_mancuernas_alt_final.png',
    'futures_pierna_gemelo_sentado_final.png',
    'futures_pierna_prensa_45_alt_final.png',
    'futures_pierna_sentadilla_barra_final.png',
    'futures_triceps_jalon_cuerda_alt_final.png',
    'futures_triceps_press_frances_sentado_final.png',
    'hammer-curl.png',
    'incline-bench-press.png',
    'incline-crunch.png',
    'lat-pulldown.png',
    'lateral-raise.png',
    'leg-extension.png',
    'leg-press.png',
    'leg-raise.png',
    'lying-leg-curl.png',
    'overhead-press.png',
    'seated-bench-crunch.png',
    'seated-cable-row.png',
    'seated-rear-delt-fly.png',
    'skullcrusher.png',
    'triceps-pushdown.png',
    'upright-row.png',
    'v-bar-pulldown.png',
    'vbar-pulldown-front.png',
    'vbar-pulldown.png',
];

// ─── Selector de imagen ──────────────────────────────────────────────────────

function ImagePickerPanel({ selected, onSelect, onClose }) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const q = search.toLowerCase().replace(/[-_]/g, ' ');
        return LOCAL_IMAGES.filter(f =>
            f.replace(/[-_.]/g, ' ').toLowerCase().includes(q)
        );
    }, [search]);

    return (
        <div className="fixed inset-0 z-[60] bg-background flex flex-col">
            <header className="flex items-center gap-3 p-4 border-b border-surface-highlight sticky top-0 bg-background z-10">
                <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-highlight transition-colors">
                    <ArrowLeft size={22} className="text-text-primary" />
                </button>
                <h3 className="text-lg font-bold text-text-primary flex-1">Seleccionar imagen</h3>
                {selected && (
                    <button
                        onClick={onClose}
                        className="bg-primary text-black font-bold px-4 py-1.5 rounded-xl text-sm hover:bg-primary-hover transition-colors"
                    >
                        Confirmar
                    </button>
                )}
            </header>

            <div className="px-4 pt-4 pb-2">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-text-secondary" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar imagen..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-surface border border-surface-highlight rounded-xl pl-9 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-8">
                <div className="grid grid-cols-4 gap-2 pt-3">
                    {filtered.map(filename => {
                        const path = `/exercises/${filename}`;
                        const isSelected = selected === path;
                        return (
                            <button
                                key={filename}
                                onClick={() => { onSelect(path); }}
                                className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                                    isSelected
                                        ? 'border-primary shadow-lg shadow-primary/30 scale-[1.03]'
                                        : 'border-transparent hover:border-surface-highlight'
                                }`}
                            >
                                <img
                                    src={path}
                                    alt={filename}
                                    className="w-full h-full object-contain bg-surface-highlight"
                                />
                                {isSelected && (
                                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                            <Check size={14} className="text-black" strokeWidth={3} />
                                        </div>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
                {filtered.length === 0 && (
                    <div className="text-center py-16 text-text-secondary">
                        <ImageIcon size={36} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No se encontraron imágenes</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Modal añadir ejercicio ──────────────────────────────────────────────────

function AddExerciseModal({ onClose, onAdded }) {
    const [name, setName] = useState('');
    const [group, setGroup] = useState('');
    const [customGroup, setCustomGroup] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [showImagePicker, setShowImagePicker] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const isCustomGroup = group === '__custom__';
    const finalGroup = isCustomGroup ? customGroup.trim() : group;
    const canSave = name.trim() && finalGroup;

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        setError(null);
        try {
            const { data, error: insertError } = await supabase
                .from('exercise_catalog')
                .insert([{
                    name: name.trim(),
                    target: finalGroup,
                    image_url: imageUrl || null,
                }])
                .select()
                .single();

            if (insertError) throw insertError;
            onAdded({ ...data, group: finalGroup });
            onClose();
        } catch (err) {
            console.error('Error adding exercise:', err);
            setError(err.message || 'Error al guardar. Verifica permisos en Supabase.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {showImagePicker && (
                <ImagePickerPanel
                    selected={imageUrl}
                    onSelect={(path) => { setImageUrl(path); }}
                    onClose={() => setShowImagePicker(false)}
                />
            )}

            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
                <div
                    className="w-full max-w-lg bg-surface rounded-t-3xl p-6 pb-10 space-y-5"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Handle */}
                    <div className="w-10 h-1 rounded-full bg-surface-highlight mx-auto -mt-1 mb-2" />

                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-text-primary">Nuevo ejercicio</h3>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-highlight transition-colors">
                            <X size={18} className="text-text-secondary" />
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-400 text-xs">
                            {error}
                        </div>
                    )}

                    {/* Name */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Nombre *</label>
                        <input
                            type="text"
                            placeholder="Ej: Press de banca inclinado"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                            className="w-full bg-background border border-surface-highlight rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>

                    {/* Muscle group */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Grupo muscular *</label>
                        <div className="flex flex-wrap gap-2">
                            {MUSCLE_GROUPS.map(g => (
                                <button
                                    key={g}
                                    onClick={() => setGroup(g)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                        group === g
                                            ? 'bg-primary text-black border-primary'
                                            : 'bg-background border-surface-highlight text-text-secondary hover:border-gray-500'
                                    }`}
                                >
                                    {g}
                                </button>
                            ))}
                            <button
                                onClick={() => setGroup('__custom__')}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                    isCustomGroup
                                        ? 'bg-primary text-black border-primary'
                                        : 'bg-background border-surface-highlight text-text-secondary hover:border-gray-500'
                                }`}
                            >
                                + Personalizado
                            </button>
                        </div>
                        {isCustomGroup && (
                            <input
                                type="text"
                                placeholder="Nombre del grupo..."
                                value={customGroup}
                                onChange={(e) => setCustomGroup(e.target.value)}
                                className="w-full bg-background border border-surface-highlight rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                            />
                        )}
                    </div>

                    {/* Image picker */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Imagen</label>
                        <button
                            onClick={() => setShowImagePicker(true)}
                            className={`w-full flex items-center gap-3 border rounded-xl px-4 py-3 transition-colors ${
                                imageUrl
                                    ? 'border-primary bg-primary/5'
                                    : 'border-surface-highlight bg-background hover:border-gray-500'
                            }`}
                        >
                            {imageUrl ? (
                                <>
                                    <img
                                        src={imageUrl}
                                        alt="seleccionada"
                                        className="w-10 h-10 rounded-lg object-contain flex-shrink-0"
                                    />
                                    <span className="text-sm text-text-primary flex-1 text-left truncate">
                                        {imageUrl.replace('/exercises/', '')}
                                    </span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setImageUrl(''); }}
                                        className="p-1 rounded-full hover:bg-surface-highlight transition-colors flex-shrink-0"
                                    >
                                        <X size={14} className="text-text-secondary" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="w-10 h-10 rounded-lg bg-surface-highlight flex items-center justify-center flex-shrink-0">
                                        <ImageIcon size={18} className="text-text-secondary opacity-50" />
                                    </div>
                                    <span className="text-sm text-text-secondary">Seleccionar imagen del catálogo...</span>
                                </>
                            )}
                        </button>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={!canSave || saving}
                        className="w-full bg-primary text-black font-bold py-3 rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Guardando...' : 'Añadir al catálogo'}
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function TrainerLibraryView({ onBack }) {
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const [showAddModal, setShowAddModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    // Inline edit state
    const [editingExId, setEditingExId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [editingImageUrl, setEditingImageUrl] = useState('');
    const [showEditImagePicker, setShowEditImagePicker] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);

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

    const handleExerciseAdded = (newEx) => {
        setCatalog(prev => [...prev, newEx].sort((a, b) => a.name.localeCompare(b.name)));
    };

    const handleDeleteExercise = async (exId) => {
        setDeletingId(exId);
        try {
            const { error } = await supabase
                .from('exercise_catalog')
                .delete()
                .eq('id', exId);
            if (error) throw error;
            setCatalog(prev => prev.filter(ex => ex.id !== exId));
        } catch (err) {
            console.error('Error deleting exercise:', err);
        } finally {
            setDeletingId(null);
            setConfirmDeleteId(null);
        }
    };

    const startEdit = (ex) => {
        setEditingExId(ex.id);
        setEditingName(ex.name);
        setEditingImageUrl(ex.image_url || '');
        setConfirmDeleteId(null);
    };

    const cancelEdit = () => setEditingExId(null);

    const handleSaveEdit = async () => {
        if (!editingName.trim()) return;
        setSavingEdit(true);
        try {
            const { error } = await supabase
                .from('exercise_catalog')
                .update({ name: editingName.trim(), image_url: editingImageUrl || null })
                .eq('id', editingExId);
            if (error) throw error;

            // Update all assigned exercises that use this catalog_id
            await supabase
                .from('exercises')
                .update({ name: editingName.trim(), image_url: editingImageUrl || null })
                .eq('catalog_id', editingExId);
            setCatalog(prev => prev.map(ex =>
                ex.id === editingExId
                    ? { ...ex, name: editingName.trim(), image_url: editingImageUrl || null }
                    : ex
            ));
            setEditingExId(null);
        } catch (err) {
            console.error('Error updating exercise:', err);
        } finally {
            setSavingEdit(false);
        }
    };

    return (
        <>
            {showAddModal && (
                <AddExerciseModal
                    onClose={() => setShowAddModal(false)}
                    onAdded={handleExerciseAdded}
                />
            )}

            {/* Image picker for editing existing exercise */}
            {showEditImagePicker && (
                <ImagePickerPanel
                    selected={editingImageUrl}
                    onSelect={(path) => { setEditingImageUrl(path); }}
                    onClose={() => setShowEditImagePicker(false)}
                />
            )}

            <div className="flex flex-col h-full bg-background pb-20">
                <header className="flex items-center gap-4 p-4 border-b border-surface-highlight sticky top-0 bg-background z-10">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-full hover:bg-surface-highlight transition-colors"
                    >
                        <ArrowLeft size={24} className="text-text-primary" />
                    </button>
                    <h2 className="text-2xl font-bold text-text-primary flex-1">Librería</h2>
                    <button
                        onClick={() => { setEditMode(prev => !prev); setConfirmDeleteId(null); }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                            editMode
                                ? 'bg-primary text-black border-primary'
                                : 'border-surface-highlight text-text-secondary hover:border-gray-500'
                        }`}
                    >
                        {editMode ? (
                            <span className="flex items-center gap-1"><Check size={12} /> Listo</span>
                        ) : 'Editar'}
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 bg-primary text-black font-bold px-3 py-1.5 rounded-full text-sm hover:bg-primary-hover transition-colors"
                    >
                        <Plus size={16} />
                        Añadir
                    </button>
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
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="mt-4 flex items-center gap-2 mx-auto bg-primary text-black font-bold px-4 py-2 rounded-xl text-sm hover:bg-primary-hover transition-colors"
                            >
                                <Plus size={16} />
                                Añadir ejercicio
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {groups.map(([groupName, exercises]) => {
                                const isCollapsed = collapsedGroups[groupName];
                                return (
                                    <div key={groupName} className="bg-surface rounded-2xl border border-surface-highlight overflow-hidden">
                                        <button
                                            onClick={() => toggleGroup(groupName)}
                                            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-surface-highlight/40 transition-colors"
                                        >
                                            <span className="font-bold text-text-primary">{groupName}</span>
                                            <div className="flex items-center gap-2 text-text-secondary">
                                                <span className="text-xs">{exercises.length} ejercicio{exercises.length !== 1 ? 's' : ''}</span>
                                                {isCollapsed
                                                    ? <ChevronRight size={16} />
                                                    : <ChevronDown size={16} />
                                                }
                                            </div>
                                        </button>

                                        {!isCollapsed && (
                                            <div className="divide-y divide-surface-highlight border-t border-surface-highlight">
                                                {exercises.map(ex => (
                                                    editingExId === ex.id ? (
                                                        // ── Inline edit row ──
                                                        <div key={ex.id} className="flex items-center gap-2 px-4 py-2.5 bg-surface-highlight/10">
                                                            <button
                                                                onClick={() => setShowEditImagePicker(true)}
                                                                className="w-9 h-9 rounded-lg bg-background overflow-hidden flex-shrink-0 flex items-center justify-center border-2 border-primary/50 hover:border-primary transition-colors"
                                                                title="Cambiar imagen"
                                                            >
                                                                {editingImageUrl ? (
                                                                    <img src={editingImageUrl} alt="preview" className="w-full h-full object-contain" />
                                                                ) : (
                                                                    <ImageIcon size={14} className="text-text-secondary" />
                                                                )}
                                                            </button>
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                value={editingName}
                                                                onChange={e => setEditingName(e.target.value)}
                                                                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                                                className="flex-1 bg-background border border-primary rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none min-w-0"
                                                            />
                                                            <button
                                                                onClick={handleSaveEdit}
                                                                disabled={savingEdit || !editingName.trim()}
                                                                className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                                                            >
                                                                {savingEdit ? <span className="text-[8px] text-black font-bold">...</span> : <Check size={13} className="text-black" strokeWidth={3} />}
                                                            </button>
                                                            <button
                                                                onClick={cancelEdit}
                                                                className="w-7 h-7 rounded-full bg-surface-highlight flex items-center justify-center flex-shrink-0"
                                                            >
                                                                <X size={13} className="text-text-secondary" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        // ── Normal row ──
                                                        <div key={ex.id} className="flex items-center gap-3 px-4 py-2.5">
                                                            <div className="w-9 h-9 rounded-lg bg-background overflow-hidden flex-shrink-0 flex items-center justify-center">
                                                                {ex.image_url ? (
                                                                    <img
                                                                        src={ex.image_url}
                                                                        alt={ex.name}
                                                                        className="w-full h-full object-contain"
                                                                        referrerPolicy="no-referrer"
                                                                    />
                                                                ) : (
                                                                    <Dumbbell size={14} className="text-text-secondary" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 flex items-center gap-2">
                                                                <span className="text-sm text-text-primary">{ex.name}</span>
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-highlight text-text-secondary font-mono border border-surface-highlight/50">
                                                                    ID: {ex.id}
                                                                </span>
                                                            </div>

                                                            {editMode && (
                                                                confirmDeleteId === ex.id ? (
                                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                                        <button
                                                                            onClick={() => handleDeleteExercise(ex.id)}
                                                                            disabled={deletingId === ex.id}
                                                                            className="text-xs font-bold px-2 py-1 rounded-lg bg-red-500 text-white disabled:opacity-50"
                                                                        >
                                                                            {deletingId === ex.id ? '...' : 'Eliminar'}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setConfirmDeleteId(null)}
                                                                            className="text-xs px-2 py-1 rounded-lg bg-surface-highlight text-text-secondary"
                                                                        >
                                                                            Cancelar
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                                                        <button
                                                                            onClick={() => startEdit(ex)}
                                                                            className="w-7 h-7 rounded-full hover:bg-primary/10 flex items-center justify-center transition-colors"
                                                                        >
                                                                            <Pencil size={13} className="text-text-secondary" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setConfirmDeleteId(ex.id)}
                                                                            className="w-7 h-7 rounded-full hover:bg-red-500/10 flex items-center justify-center transition-colors"
                                                                        >
                                                                            <Trash2 size={14} className="text-text-secondary" />
                                                                        </button>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    )
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
        </>
    );
}
