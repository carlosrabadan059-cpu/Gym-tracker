import { Home, Users, Dumbbell, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

// Fase 0.4 del plan de entrenador: el entrenador trabaja en iPad/escritorio,
// no en el móvil. A partir de `md:` la navegación pasa de la píldora inferior
// a una barra lateral fija y el contenido se centra con un ancho máximo. Por
// debajo de `md:` no hay barra lateral y las vistas usan su propio header con
// botón atrás, como hasta ahora.

const NAV = [
    { id: 'trainer', label: 'Inicio', icon: Home },
    {
        id: 'trainer_clients',
        label: 'Clientes',
        icon: Users,
        match: ['trainer_clients', 'trainer_client_profile', 'trainer_assign_routine'],
    },
    { id: 'trainer_library', label: 'Librería', icon: Dumbbell },
];

export function TrainerShell({ view, onNavigate, children }) {
    const isActive = (item) => (item.match ? item.match.includes(view) : view === item.id);

    return (
        <div className="flex flex-1 min-h-0">
            <aside className="hidden md:flex md:w-56 lg:w-60 flex-shrink-0 flex-col border-r border-surface-highlight bg-surface">
                <div className="px-5 py-5">
                    <p className="text-lg font-bold text-text-primary">Rutinex</p>
                    <p className="text-xs text-text-secondary">Panel de entrenador</p>
                </div>
                <nav className="flex-1 space-y-1 px-3">
                    {NAV.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item);
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={cn(
                                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                                    active
                                        ? 'bg-primary/15 text-primary'
                                        : 'text-text-secondary hover:bg-surface-highlight hover:text-text-primary'
                                )}
                            >
                                <Icon size={18} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>
                <div className="border-t border-surface-highlight p-3">
                    <button
                        onClick={() => supabase.auth.signOut()}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
                    >
                        <LogOut size={18} />
                        Cerrar sesión
                    </button>
                </div>
            </aside>

            <div className="flex-1 min-w-0 overflow-y-auto scrollbar-hide">
                <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-safe md:px-8 md:py-8">
                    {children}
                </div>
            </div>
        </div>
    );
}
