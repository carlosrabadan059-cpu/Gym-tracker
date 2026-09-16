import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { computeStreak, computeDaysSinceLastSession, INACTIVITY_ALERT_DAYS } from '../../lib/adherence';
import { isRoutineScheduledForDay } from '../../lib/routineSchedule';
import { categorizeClient } from '../../lib/trainerPriority';
import { Users, LayoutDashboard, LogOut, ChevronRight, Flame, AlertTriangle } from 'lucide-react';

// Compara dos fechas por día calendario local, ignorando la hora — igual
// criterio que src/lib/adherence.js usa internamente para "hoy"/"ayer",
// reimplementado aquí en vez de exportado desde allí porque es una sola
// comparación de una línea, no justifica una función nueva compartida.
function isSameLocalDay(dateInput, reference) {
    const d = new Date(dateInput);
    return d.getFullYear() === reference.getFullYear()
        && d.getMonth() === reference.getMonth()
        && d.getDate() === reference.getDate();
}

function ClientRow({ client, onClick, subtitle, subtitleIcon: SubtitleIcon, subtitleClassName }) {
    return (
        <button
            onClick={onClick}
            className="w-full bg-surface rounded-2xl border border-surface-highlight hover:border-primary transition-all flex items-center justify-between p-3 text-left group"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-surface-highlight overflow-hidden flex-shrink-0">
                    <img
                        src={client.avatar_url || `https://ui-avatars.com/api/?name=${client.username}&background=random&color=fff`}
                        alt={client.username}
                        loading="lazy"
                        className="w-full h-full object-cover"
                    />
                </div>
                <div className="min-w-0">
                    <h4 className="font-bold text-text-primary text-sm truncate">{client.username}</h4>
                    {subtitle && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-1 ${subtitleClassName}`}>
                            {SubtitleIcon && <SubtitleIcon size={10} />}
                            {subtitle}
                        </span>
                    )}
                </div>
            </div>
            <ChevronRight size={18} className="text-text-secondary group-hover:text-primary transition-colors flex-shrink-0" />
        </button>
    );
}

export function TrainerDashboardView({ onNavigate, onOpenClient }) {
    const { user, signOut } = useAuth();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchClients = useCallback(async () => {
        setError(false);
        try {
            const { data: links, error: linksError } = await supabase
                .from('trainer_clients')
                .select('client_id')
                .eq('trainer_id', user.id);
            if (linksError) throw linksError;

            const clientIds = (links || []).map(l => l.client_id);
            if (clientIds.length === 0) {
                setClients([]);
                return;
            }

            const [
                { data: profiles, error: profilesError },
                { data: logs, error: logsError },
                { data: assigned, error: assignedError },
            ] = await Promise.all([
                supabase.from('profiles').select('*').in('user_id', clientIds),
                supabase.from('workout_logs').select('user_id, date').in('user_id', clientIds),
                supabase.from('assigned_routines').select('client_id, routine_id').in('client_id', clientIds),
            ]);
            if (profilesError) throw profilesError;
            if (logsError) throw logsError;
            if (assignedError) throw assignedError;

            const routineIds = [...new Set((assigned || []).map(a => a.routine_id))];
            let scheduledDaysByRoutineId = {};
            if (routineIds.length > 0) {
                const { data: routinesData, error: routinesError } = await supabase
                    .from('routines')
                    .select('id, scheduled_days')
                    .in('id', routineIds);
                if (routinesError) throw routinesError;
                scheduledDaysByRoutineId = Object.fromEntries((routinesData || []).map(r => [r.id, r.scheduled_days]));
            }

            const logsByClient = {};
            (logs || []).forEach((log) => {
                if (!logsByClient[log.user_id]) logsByClient[log.user_id] = [];
                logsByClient[log.user_id].push(log.date);
            });

            const routineIdsByClient = {};
            (assigned || []).forEach((a) => {
                if (!routineIdsByClient[a.client_id]) routineIdsByClient[a.client_id] = [];
                routineIdsByClient[a.client_id].push(a.routine_id);
            });

            const today = new Date();
            const todayDayOfWeek = today.getDay();

            const categorized = (profiles || []).map((profile) => {
                const dates = logsByClient[profile.user_id] || [];
                const daysSinceLastSession = computeDaysSinceLastSession(dates);
                const streak = computeStreak(dates);
                const trainedToday = dates.some((d) => isSameLocalDay(d, today));
                const hasRoutineScheduledToday = (routineIdsByClient[profile.user_id] || []).some((routineId) =>
                    isRoutineScheduledForDay(scheduledDaysByRoutineId[routineId], todayDayOfWeek)
                );

                return {
                    ...profile,
                    daysSinceLastSession,
                    streak,
                    category: categorizeClient({ daysSinceLastSession, streak, hasRoutineScheduledToday, trainedToday }),
                    missedToday: hasRoutineScheduledToday && !trainedToday,
                };
            });

            setClients(categorized);
        } catch (err) {
            console.error('Error fetching trainer dashboard clients:', err);
            setClients([]);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [user.id]);

    useEffect(() => { fetchClients(); }, [fetchClients]);

    const attentionClients = clients.filter(c => c.category === 'attention');
    const progressingClients = clients.filter(c => c.category === 'progressing');
    const neutralClients = clients.filter(c => c.category === 'neutral');
    const hasHighlightedSections = attentionClients.length > 0 || progressingClients.length > 0;

    const attentionSubtitle = (client) => {
        if (client.daysSinceLastSession === null) return 'Sin sesiones';
        if (client.daysSinceLastSession >= INACTIVITY_ALERT_DAYS) return `Hace ${client.daysSinceLastSession} días`;
        return 'Rutina de hoy sin hacer';
    };

    return (
        <div className="flex flex-col h-full bg-background pb-20">
            <header className="mb-6 p-4">
                <h2 className="text-3xl font-bold text-text-primary">Hola, Entrenador</h2>
                <p className="text-text-secondary">Así están tus clientes hoy.</p>
            </header>

            <div className="flex-1 px-4 space-y-6 overflow-y-auto">
                {loading ? (
                    <p className="text-sm text-text-secondary">Cargando clientes...</p>
                ) : (
                    <>
                        {attentionClients.length > 0 && (
                            <div>
                                <h3 className="font-bold text-sm text-orange-500 mb-2 uppercase tracking-wide">Necesitan atención</h3>
                                <div className="space-y-2">
                                    {attentionClients.map((client) => (
                                        <ClientRow
                                            key={client.user_id}
                                            client={client}
                                            onClick={() => onOpenClient(client)}
                                            subtitle={attentionSubtitle(client)}
                                            subtitleIcon={AlertTriangle}
                                            subtitleClassName="text-orange-500 bg-orange-500/10"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {progressingClients.length > 0 && (
                            <div>
                                <h3 className="font-bold text-sm text-primary mb-2 uppercase tracking-wide">Progresando</h3>
                                <div className="space-y-2">
                                    {progressingClients.map((client) => (
                                        <ClientRow
                                            key={client.user_id}
                                            client={client}
                                            onClick={() => onOpenClient(client)}
                                            subtitle={`Racha de ${client.streak} días`}
                                            subtitleIcon={Flame}
                                            subtitleClassName="text-primary bg-primary/10"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {neutralClients.length > 0 && (
                            <div>
                                {hasHighlightedSections && (
                                    <h3 className="font-bold text-sm text-text-secondary mb-2 uppercase tracking-wide">Resto de tus clientes</h3>
                                )}
                                <div className="space-y-2">
                                    {neutralClients.map((client) => (
                                        <ClientRow key={client.user_id} client={client} onClick={() => onOpenClient(client)} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="text-sm text-red-500 flex items-center justify-between gap-2">
                                <span>No se pudieron cargar tus clientes.</span>
                                <button onClick={fetchClients} className="font-bold underline flex-shrink-0">Reintentar</button>
                            </div>
                        )}

                        {!error && clients.length === 0 && (
                            <p className="text-sm text-text-secondary">Aún no tienes clientes asignados.</p>
                        )}
                    </>
                )}

                <div className="grid grid-cols-2 gap-4 pt-2">
                    <button
                        onClick={() => onNavigate('trainer_clients')}
                        className="bg-surface p-4 rounded-2xl border border-surface-highlight hover:border-primary transition-all flex flex-col items-center justify-center gap-2 text-center group"
                    >
                        <Users size={24} className="text-primary group-hover:scale-110 transition-transform" />
                        <h3 className="font-bold text-sm">Todos los clientes</h3>
                    </button>

                    <button
                        onClick={() => onNavigate('trainer_library')}
                        className="bg-surface p-4 rounded-2xl border border-surface-highlight hover:border-primary transition-all flex flex-col items-center justify-center gap-2 text-center group"
                    >
                        <LayoutDashboard size={24} className="text-orange-500 group-hover:scale-110 transition-transform" />
                        <h3 className="font-bold text-sm">Librería</h3>
                    </button>
                </div>

                <div className="pt-4 border-t border-surface-highlight">
                    <button
                        onClick={signOut}
                        className="w-full bg-red-500/10 text-red-500 rounded-xl py-4 flex items-center justify-center gap-2 font-bold hover:bg-red-500/20 transition-colors"
                    >
                        <LogOut size={20} />
                        Cerrar Sesión
                    </button>
                </div>
            </div>
        </div>
    );
}
