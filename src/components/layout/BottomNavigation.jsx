import React from 'react';
import { Home, Calendar, MessageCircle, User } from 'lucide-react';
import { cn } from '../../lib/utils';

const BottomNavigation = ({ currentView, onViewChange }) => {
    const navItems = [
        { id: 'dashboard', icon: Home, label: 'Inicio' },
        { id: 'progress', icon: Calendar, label: 'Progreso' }, // Using Calendar for Progress for now based on image
        { id: 'chat', icon: MessageCircle, label: 'Chat' },
        { id: 'profile', icon: User, label: 'Perfil' },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe bg-gradient-to-t from-background to-transparent z-50">
            <nav className="mx-auto flex max-w-md items-center justify-between rounded-full bg-surface/90 px-6 py-4 backdrop-blur-md shadow-lg border border-white/5">
                {navItems.map((item) => {
                    const isActive = currentView === item.id;
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onViewChange(item.id)}
                            className={cn(
                                'flex items-center gap-2 transition-all duration-300',
                                isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                            )}
                        >
                            <div className={cn(
                                "flex items-center justify-center rounded-full p-2 transition-all",
                                isActive ? "bg-primary text-black shadow-primary/20 shadow-md" : "bg-transparent"
                            )}>
                                <Icon className={cn("h-6 w-6", isActive && "fill-current")} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            {isActive && (
                                <span className="text-sm font-bold text-text-primary hidden sm:block">{item.label}</span>
                            )}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

export { BottomNavigation };
