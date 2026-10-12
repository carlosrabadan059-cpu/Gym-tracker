import { useState } from 'react';
import { Home, Users, Dumbbell, LogOut, LayoutTemplate, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

// Fase 0.4 del plan de entrenador: el entrenador trabaja en iPad/escritorio,
// no en el móvil. A partir de `md:` la navegación pasa de la píldora inferior
// a una barra lateral fija y el contenido se centra con un ancho máximo. Por
// debajo de `md:` no hay barra lateral y las vistas usan su propio header con
// botón atrás, como hasta ahora.
//
// La barra se puede plegar a una columna de iconos para dar más ancho al
// contenido; se recuerda en este navegador. `--trainer-sidebar-w` lo usan
// las barras fijas de las vistas (RoutineAssignerView) para no quedar debajo.

const COLLAPSED_KEY = 'trainerSidebarCollapsed';

function readCollapsed() {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
}

const NAV = [
    { id: 'trainer', label: 'Inicio', icon: Home },
    {
        id: 'trainer_clients',
        label: 'Clientes',
        icon: Users,
        match: ['trainer_clients', 'trainer_client_profile', 'trainer_assign_routine'],
    },
    {
        id: 'trainer_templates',
        label: 'Plantillas',
        icon: LayoutTemplate,
        match: ['trainer_templates', 'trainer_template_edit'],
    },
    { id: 'trainer_library', label: 'Librería', icon: Dumbbell },
];

export function TrainerShell({ view, onNavigate, children }) {
    const isActive = (item) => (item.match ? item.match.includes(view) : view === item.id);
    const [collapsed, setCollapsed] = useState(readCollapsed);
    const toggleCollapsed = () => {
        const next = !collapsed;
        setCollapsed(next);
        try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0'); } catch { /* sin almacenamiento: solo esta sesión */ }
    };
    const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

    return (
        <div className="flex flex-1 min-h-0" style={{ '--trainer-sidebar-w': collapsed ? '4rem' : '14rem' }}>
            <aside className={cn(
                'hidden md:flex flex-shrink-0 flex-col border-r border-surface-highlight bg-surface transition-[width] duration-200',
                collapsed ? 'md:w-16' : 'md:w-56 lg:w-60'
            )}>
                <div className={cn('flex items-center gap-3 py-5', collapsed ? 'flex-col px-2' : 'px-4')}>
                    <img src="/rutinex-logo.svg" alt="Rutinex" className="h-9 w-9 flex-shrink-0 rounded-lg" />
                    {!collapsed && (
                        <div className="min-w-0 flex-1">
                            <p className="text-lg font-bold leading-tight text-text-primary">Rutinex</p>
                            <p className="text-xs text-text-secondary">Panel de entrenador</p>
                        </div>
                    )}
                    <button
                        onClick={toggleCollapsed}
                        className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-highlight hover:text-text-primary"
                        aria-label={collapsed ? 'Desplegar barra lateral' : 'Plegar barra lateral'}
                        title={collapsed ? 'Desplegar barra lateral' : 'Plegar barra lateral'}
                    >
                        <ToggleIcon size={18} />
                    </button>
                </div>
                <nav className={cn('flex-1 space-y-1', collapsed ? 'px-2' : 'px-3')}>
                    {NAV.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item);
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                title={collapsed ? item.label : undefined}
                                aria-label={item.label}
                                className={cn(
                                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                                    collapsed && 'justify-center',
                                    active
                                        ? 'bg-primary/15 text-primary'
                                        : 'text-text-secondary hover:bg-surface-highlight hover:text-text-primary'
                                )}
                            >
                                <Icon size={18} className="flex-shrink-0" />
                                {!collapsed && item.label}
                            </button>
                        );
                    })}
                </nav>
                <div className={cn('border-t border-surface-highlight', collapsed ? 'p-2' : 'p-3')}>
                    <button
                        onClick={() => supabase.auth.signOut()}
                        title={collapsed ? 'Cerrar sesión' : undefined}
                        aria-label="Cerrar sesión"
                        className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10',
                            collapsed && 'justify-center'
                        )}
                    >
                        <LogOut size={18} className="flex-shrink-0" />
                        {!collapsed && 'Cerrar sesión'}
                    </button>
                </div>
            </aside>

            <div className="flex-1 min-w-0 overflow-y-auto scrollbar-hide">
                <div className={cn('mx-auto w-full px-4 pb-24 pt-safe md:px-8 md:py-8', collapsed ? 'max-w-7xl' : 'max-w-5xl')}>
                    {children}
                </div>
            </div>
        </div>
    );
}
