// Plantillas: rutinas del entrenador sin cliente, que se asignan a uno o
// varios clientes (cada uno recibe su copia). Ver
// docs/superpowers/specs/2026-10-08-borradores-plantillas-design.md.
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { enrichExercisesWithCatalog } from '../../lib/utils';
import { cloneRoutineToClient } from '../../lib/trainerUtils';
import { WEEKDAY_LABELS } from '../../lib/routineSchedule';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, PlusCircle, Pencil, Send, Star, X, CalendarDays } from 'lucide-react';

const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function AssignTemplateModal({ template, onClose, onDone }) {
    const { user } = useAuth();
    const [clients, setClients] = useState(null);
    const [picked, setPicked] = useState([]);
    const [days, setDays] = useState([]);
    const [startDate, setStartDate] = useState(todayISO());
    const [draft, setDraft] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        (async () => {
                const { data: links } = await supabase.from('trainer_clients').select('client_id').eq('trainer_id', user.id);
                const ids = (links || []).map(l => l.client_id);
                if (!ids.length) { setClients([]); return; }
                const { data } = await supabase.from('profiles').select('user_id, username').in('user_id', ids).order('username');
                setClients(data || []);
        })();
    }, [user.id]);

    const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

    const handleAssign = async () => {
        setSaving(true);
        setError(null);
        try {
            const scheduledDays = [...days].sort((a, b) => a - b);
            for (const client of clients.filter(c => picked.includes(c.user_id))) {
                await cloneRoutineToClient(template.id, client, user.id, { draft, scheduledDays, startDate });
            }
            onDone(picked.length, draft);
        } catch (err) {
            console.error('Error assigning template:', err);
            setError('No se pudo asignar a todos los clientes. Revisa sus fichas e inténtalo de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-surface rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-text-primary">Asignar “{template.name}”</p>
                    <button onClick={onClose}><X size={18} className="text-text-secondary" /></button>
                </div>
                <p className="text-xs text-text-secondary">Cada cliente recibe su propia copia. Editar la plantilla después no cambia lo ya asignado.</p>

                <div className="space-y-2">
                    {clients === null ? (
                        <div className="h-11 rounded-xl bg-background animate-pulse" />
                    ) : clients.length === 0 ? (
                        <p className="text-sm text-text-secondary">Aún no tienes clientes.</p>
                    ) : clients.map(c => (
                        <label key={c.user_id} className="flex items-center gap-3 rounded-xl bg-background px-3 py-2.5 cursor-pointer">
                            <input type="checkbox" checked={picked.includes(c.user_id)} onChange={() => toggle(picked, setPicked, c.user_id)} className="accent-primary w-4 h-4" />
                            <span className="text-sm text-text-primary">{c.username || 'Sin nombre'}</span>
                        </label>
                    ))}
                </div>

                <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Días de la semana</p>
                    <div className="flex gap-1.5">
                        {WEEKDAY_LABELS.map(({ value, label }) => (
                            <button key={value} onClick={() => toggle(days, setDays, value)}
                                className={`w-8 h-8 rounded-full text-xs font-bold ${days.includes(value) ? 'bg-primary text-black' : 'bg-background text-text-secondary'}`}>{label}</button>
                        ))}
                    </div>
                </div>

                <label className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2.5">
                    <span className="text-sm text-text-primary flex items-center gap-2"><CalendarDays size={15} className="text-primary" /> Fecha de inicio</span>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-sm text-text-primary" />
                </label>
                <p className="text-[11px] text-text-secondary">El peso queda en blanco: lo pones en la ficha de cada cliente.</p>

                <div className="grid grid-cols-2 gap-2">
                    {[[false, 'Enviar ahora', 'Lo ven y reciben aviso'], [true, 'Como borrador', 'Lo revisas antes de enviar']].map(([v, l, d]) => (
                        <button key={l} onClick={() => setDraft(v)} className={`rounded-xl border p-3 text-left ${draft === v ? 'border-primary bg-primary/10' : 'border-surface-highlight'}`}>
                            <p className="text-sm font-bold text-text-primary">{l}</p>
                            <p className="text-[11px] text-text-secondary">{d}</p>
                        </button>
                    ))}
                </div>

                {error && <p className="text-xs text-red-500">{error}</p>}

                <button disabled={!picked.length || saving} onClick={handleAssign}
                    className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-black disabled:opacity-40">
                    {saving ? 'Asignando...' : `Asignar a ${picked.length} ${picked.length === 1 ? 'cliente' : 'clientes'}`}
                </button>
            </div>
        </div>
    );
}

export function TemplatesView({ onBack, onEdit }) {
    const { user } = useAuth();
    const [templates, setTemplates] = useState(null);
    const [assigning, setAssigning] = useState(null);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        (async () => {
            const { data: routines, error } = await supabase
                .from('routines')
                .select('*')
                .eq('is_template', true)
                .eq('trainer_id', user.id)
                .is('owner_client_id', null)
                .order('name');
            if (error) { console.error('Error fetching templates:', error); setTemplates([]); return; }
            const ids = (routines || []).map(r => r.id);
            const { data: rawExercises } = ids.length
                ? await supabase.from('exercises').select('*, exercise_catalog(name, image_url)').in('routine_id', ids).order('ui_order')
                : { data: [] };
            const exercises = enrichExercisesWithCatalog(rawExercises);
            setTemplates((routines || []).map(r => ({ ...r, exercises: (exercises || []).filter(e => e.routine_id === r.id) })));
        })();
    }, [user.id]);

    const showToast = (text) => {
        setToast(text);
        setTimeout(() => setToast(null), 3000);
    };

    return (
        <div className="flex flex-col h-full bg-background">
            <header className="flex items-center gap-3 p-4 border-b border-surface-highlight sticky top-0 bg-background z-10">
                <button onClick={onBack} className="md:hidden p-2 rounded-full hover:bg-surface-highlight transition-colors">
                    <ArrowLeft size={22} className="text-text-primary" />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold text-text-primary">Plantillas</h2>
                    <p className="text-xs text-text-secondary">Rutinas sin cliente, listas para asignar.</p>
                </div>
                <button onClick={() => onEdit({})} className="bg-primary text-black px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 flex-shrink-0">
                    <PlusCircle size={16} /> Nueva
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
                {templates === null ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-surface rounded-2xl border border-surface-highlight animate-pulse" />)}
                    </div>
                ) : templates.length === 0 ? (
                    <div className="text-center py-16 text-text-secondary space-y-2">
                        <Star size={36} className="mx-auto opacity-30" />
                        <p className="text-sm">Aún no tienes plantillas.</p>
                        <p className="text-xs">Crea una con “Nueva”, o marca con la estrella una rutina en “Rutinas existentes”.</p>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {templates.map(t => (
                            <div key={t.id} className="bg-surface rounded-2xl border border-surface-highlight p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="font-bold text-text-primary">{t.name}</p>
                                    <Star size={16} className="text-primary shrink-0" fill="currentColor" />
                                </div>
                                <p className="text-xs text-text-secondary">
                                    {t.exercises.length} ejercicio{t.exercises.length !== 1 ? 's' : ''}
                                </p>
                                <div className="flex gap-2">
                                    <button onClick={() => onEdit(t)} className="flex-1 rounded-xl border border-surface-highlight py-2 text-xs font-bold text-text-primary flex items-center justify-center gap-1.5">
                                        <Pencil size={13} /> Editar
                                    </button>
                                    <button onClick={() => setAssigning(t)} disabled={!t.exercises.length}
                                        className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-black flex items-center justify-center gap-1.5 disabled:opacity-40">
                                        <Send size={13} /> Asignar a…
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {assigning && (
                <AssignTemplateModal
                    template={assigning}
                    onClose={() => setAssigning(null)}
                    onDone={(n, draft) => {
                        setAssigning(null);
                        showToast(draft
                            ? `Borrador creado para ${n} ${n === 1 ? 'cliente' : 'clientes'}.`
                            : `Enviada a ${n} ${n === 1 ? 'cliente' : 'clientes'}.`);
                    }}
                />
            )}

            {toast && (
                <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-text-primary text-background px-4 py-3 text-sm font-semibold shadow-lg">
                    {toast}
                </div>
            )}
        </div>
    );
}
