import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, User, ChevronRight } from 'lucide-react';

export function ClientsListView({ onBack, onSelectClient }) {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('role', 'client');

                if (error) throw error;
                setClients(data || []);
            } catch (error) {
                console.error('Error fetching clients:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchClients();
    }, []);

    return (
        <div className="flex flex-col h-full bg-background pb-20">
            <header className="mb-6 flex items-center gap-4 p-4 border-b border-surface-highlight">
                <button
                    onClick={onBack}
                    className="p-2 rounded-full hover:bg-surface-highlight transition-colors"
                >
                    <ArrowLeft size={24} className="text-text-primary" />
                </button>
                <h2 className="text-2xl font-bold text-text-primary">Mis Clientes</h2>
            </header>

            <div className="flex-1 overflow-y-auto px-4 space-y-3">
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
                        <p>Aún no hay clientes registrados.</p>
                    </div>
                ) : (
                    clients.map((client) => (
                        <button
                            key={client.id}
                            onClick={() => onSelectClient(client)}
                            className="w-full bg-surface p-4 rounded-2xl border border-surface-highlight hover:border-primary transition-all flex items-center justify-between text-left group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-surface-highlight overflow-hidden flex-shrink-0">
                                    <img
                                        src={client.avatar_url || `https://ui-avatars.com/api/?name=${client.username}&background=random&color=fff`}
                                        alt={client.username}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div>
                                    <h3 className="font-bold text-text-primary text-lg">{client.fullName || client.username}</h3>
                                    <p className="text-xs text-text-secondary">Ver progreso y asignar rutinas</p>
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-text-secondary group-hover:text-primary transition-colors" />
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
