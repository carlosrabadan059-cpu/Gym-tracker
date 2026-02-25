import React from 'react';
import { useNotifications } from '../context/NotificationsContext';
import { Card } from '../components/ui/Card';
import { Bell, Trophy, Info, X, Check } from 'lucide-react';
import { cn } from '../lib/utils';

export function NotificationsListView({ onClose }) {
    const { notifications, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

    const getIcon = (type) => {
        switch (type) {
            case 'achievement': return <Trophy size={20} className="text-yellow-500" />;
            case 'reminder': return <Bell size={20} className="text-primary" />;
            default: return <Info size={20} className="text-blue-500" />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-background animate-fadeIn">
            <header className="flex items-center justify-between p-4 bg-surface/80 backdrop-blur-md border-b border-surface-highlight sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
                        ← Volver
                    </button>
                    <h2 className="text-xl font-bold text-text-primary">Notificaciones</h2>
                </div>
                {notifications.some(n => !n.read) && (
                    <button
                        onClick={markAllAsRead}
                        className="text-xs text-primary font-medium hover:underline"
                    >
                        Marcar todo leído
                    </button>
                )}
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-text-secondary text-center">
                        <Bell size={48} className="mb-4 opacity-20" />
                        <p>No tienes notificaciones</p>
                    </div>
                ) : (
                    notifications.map((n) => (
                        <div
                            key={n.id}
                            onClick={() => markAsRead(n.id)}
                            className={cn(
                                "relative group flex gap-4 p-4 rounded-2xl transition-all cursor-pointer border border-transparent",
                                n.read ? "bg-surface text-text-secondary" : "bg-surface-highlight border-primary/20"
                            )}
                        >
                            <div className={cn(
                                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                                n.read ? "bg-surface-highlight" : "bg-background"
                            )}>
                                {getIcon(n.type)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className={cn("font-bold text-sm truncate pr-6", n.read ? "text-text-secondary" : "text-text-primary")}>
                                        {n.title}
                                    </h4>
                                    <span className="text-[10px] opacity-60 whitespace-nowrap ml-2">{n.time}</span>
                                </div>
                                <p className="text-xs leading-relaxed opacity-80 line-clamp-2">
                                    {n.message}
                                </p>
                            </div>

                            {!n.read && (
                                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary" />
                            )}

                            {/* Delete Action (visible on hover/long press logic could be added) */}
                            {/* For now, let's keep it simple with just 'mark as read' on click */}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
