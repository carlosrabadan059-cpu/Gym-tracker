import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, User, ChevronRight, UserPlus, Search, X } from 'lucide-react';

export function ClientsListView({ onBack, onSelectClient, embedded = false, selectedId = null }) {
    const { user } = useAuth();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    const fetchClients = useCallback(async () => {
        try {
            // Solo los propios: un cliente pertenece a un único entrenador
            // (trainer_clients), no a "cualquiera con role=trainer". Dos
            // pasos porque trainer_clients.client_id referencia a
            // auth.users, no a profiles — no hay FK directa que PostgREST
            // pueda usar para un embed automático.
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

            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('*')
                .in('user_id', clientIds);
            if (profilesError) throw profilesError;

            setClients(profiles || []);
        } catch (error) {
            console.error('Error fetching clients:', error);
        } finally {
            setLoading(false);
        }
    }, [user.id]);

    useEffect(() => { fetchClients(); }, [fetchClients]);

    return (
        <div className={embedded ? '' : 'flex flex-col h-full bg-background pb-20'}>
            <header className={`flex items-center gap-4 border-b border-surface-highlight ${embedded ? 'mb-4 pb-3' : 'mb-6 p-4'}`}>
                {onBack && (
                    <button
                        onClick={onBack}
                        className={`p-2 rounded-full hover:bg-surface-highlight transition-colors ${embedded ? 'md:hidden' : ''}`}
                    >
                        <ArrowLeft size={24} className="text-text-primary" />
                    </button>
                )}
                <h2 className={`font-bold text-text-primary flex-1 ${embedded ? 'text-lg' : 'text-2xl'}`}>Mis Clientes</h2>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    aria-label="Añadir cliente"
                >
                    <UserPlus size={22} />
                </button>
            </header>

            <div className={embedded ? 'space-y-2' : 'flex-1 overflow-y-auto px-4 space-y-3'}>
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-surface p-4 rounded-2xl border border-surface-highlight animate-pulse flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-surface-highlight flex-shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-surface-highlight rounded w-1/2" />
                                    <div className="h-3 bg-surface-highlight rounded w-2/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : clients.length === 0 ? (
                    <div className="text-center text-text-secondary mt-10">
                        <User size={48} className="mx-auto mb-4 opacity-50" />
                        <p className="mb-4">Aún no tienes clientes.</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="inline-flex items-center gap-2 bg-primary text-black font-bold rounded-full px-5 py-2.5"
                        >
                            <UserPlus size={18} /> Añadir cliente
                        </button>
                    </div>
                ) : (
                    clients.map((client) => (
                        <button
                            key={client.user_id}
                            onClick={() => onSelectClient(client)}
                            className={`w-full bg-surface rounded-2xl border transition-all flex items-center justify-between text-left group ${embedded ? 'p-3' : 'p-4'} ${selectedId === client.user_id ? 'border-primary' : 'border-surface-highlight hover:border-primary'}`}
                        >
                            <div className="flex items-center gap-4 min-w-0">
                                <div className={`rounded-full bg-surface-highlight overflow-hidden flex-shrink-0 ${embedded ? 'w-10 h-10' : 'w-12 h-12'}`}>
                                    <img
                                        src={client.avatar_url || `https://ui-avatars.com/api/?name=${client.username}&background=random&color=fff`}
                                        alt={client.username}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <h3 className={`font-bold text-text-primary truncate ${embedded ? 'text-sm' : 'text-lg'}`}>{client.fullName || client.username}</h3>
                                    {!embedded && <p className="text-xs text-text-secondary">Ver progreso y asignar rutinas</p>}
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-text-secondary group-hover:text-primary transition-colors flex-shrink-0" />
                        </button>
                    ))
                )}
            </div>

            {showAddModal && (
                <AddClientModal
                    trainerId={user.id}
                    onClose={() => setShowAddModal(false)}
                    onAdded={() => { setShowAddModal(false); fetchClients(); }}
                />
            )}
        </div>
    );
}

function AddClientModal({ trainerId, onClose, onAdded }) {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addingId, setAddingId] = useState(null);
    const [error, setError] = useState(null);

    const runSearch = useCallback(async (term) => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase.rpc('search_addable_clients', { search_term: term });
            if (error) throw error;
            setResults(data || []);
        } catch (err) {
            console.error('Error searching addable clients:', err);
            setError('No se pudo buscar. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timeout = setTimeout(() => runSearch(search.trim()), 300);
        return () => clearTimeout(timeout);
    }, [search, runSearch]);

    const addClient = async (clientId) => {
        setAddingId(clientId);
        try {
            const { error } = await supabase
                .from('trainer_clients')
                .insert({ trainer_id: trainerId, client_id: clientId });
            if (error) throw error;
            onAdded();
        } catch (err) {
            console.error('Error adding client:', err);
            setError(
                err?.code === '23505'
                    ? 'Ese cliente ya tiene entrenador.'
                    : 'No se pudo añadir. Inténtalo de nuevo.'
            );
            setAddingId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
            <div className="w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-3xl border border-surface-highlight max-h-[85vh] flex flex-col">
                <div className="flex items-center gap-3 p-4 border-b border-surface-highlight">
                    <Search size={18} className="text-text-secondary flex-shrink-0" />
                    <input
                        autoFocus
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por nombre de usuario…"
                        className="flex-1 bg-transparent outline-none text-text-primary placeholder:text-text-secondary"
                    />
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-surface-highlight text-text-secondary" aria-label="Cerrar">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {error && <p className="text-sm text-red-500 mb-2">{error}</p>}

                    {loading ? (
                        <p className="text-center text-text-secondary text-sm py-8">Buscando…</p>
                    ) : results.length === 0 ? (
                        <p className="text-center text-text-secondary text-sm py-8">
                            {search.trim()
                                ? 'Sin resultados. Solo aparecen clientes que aún no tienen entrenador.'
                                : 'No hay clientes disponibles para añadir ahora mismo.'}
                        </p>
                    ) : (
                        results.map((client) => (
                            <div
                                key={client.user_id}
                                className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-surface-highlight/60 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <img
                                        src={client.avatar_url || `https://ui-avatars.com/api/?name=${client.username}&background=random&color=fff`}
                                        alt={client.username}
                                        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                                    />
                                    <span className="font-medium text-text-primary truncate">{client.username}</span>
                                </div>
                                <button
                                    onClick={() => addClient(client.user_id)}
                                    disabled={addingId === client.user_id}
                                    className="flex-shrink-0 bg-primary text-black text-sm font-bold rounded-full px-4 py-1.5 disabled:opacity-50"
                                >
                                    {addingId === client.user_id ? 'Añadiendo…' : 'Añadir'}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
