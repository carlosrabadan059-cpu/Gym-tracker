import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Users, LayoutDashboard, LogOut } from 'lucide-react';

export function TrainerDashboardView({ onNavigate }) {
    const { profile, signOut } = useAuth();

    return (
        <div className="flex flex-col h-full bg-background pb-20">
            <header className="mb-8 p-4">
                <h2 className="text-3xl font-bold text-text-primary">Hola, Entrenador</h2>
                <p className="text-text-secondary">Gestiona a tus clientes desde aquí.</p>
            </header>

            <div className="flex-1 px-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => onNavigate('trainer_clients')}
                        className="bg-surface p-6 rounded-2xl border border-surface-highlight hover:border-primary transition-all flex flex-col items-center justify-center gap-4 text-center group"
                    >
                        <Users size={32} className="text-primary group-hover:scale-110 transition-transform" />
                        <h3 className="font-bold text-lg">Clientes</h3>
                        <p className="text-xs text-text-secondary">Ver lista y rutinas</p>
                    </button>

                    <button
                        onClick={() => onNavigate('trainer_library')}
                        className="bg-surface p-6 rounded-2xl border border-surface-highlight hover:border-primary transition-all flex flex-col items-center justify-center gap-4 text-center group"
                    >
                        <LayoutDashboard size={32} className="text-orange-500 group-hover:scale-110 transition-transform" />
                        <h3 className="font-bold text-lg">Librería</h3>
                        <p className="text-xs text-text-secondary">Ejercicios y bloques</p>
                    </button>
                </div>

                <div className="mt-8 pt-8 border-t border-surface-highlight">
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
