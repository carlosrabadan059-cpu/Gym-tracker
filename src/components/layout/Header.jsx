import React from 'react';
import { Bell } from 'lucide-react';
import { cn } from '../../lib/utils';

import { useNotifications } from '../../context/NotificationsContext';

const Header = ({ className, userName, userAvatar, onNotificationClick }) => {
    const { unreadCount } = useNotifications();

    return (
        <header className={cn('flex items-center justify-between px-6 py-4 pt-safe', className)}>
            <div className="flex items-center space-x-3">
                <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-surface-highlight">
                    <img
                        src={userAvatar}
                        alt="Profile"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = `https://ui-avatars.com/api/?name=${userName || 'User'}&background=random&color=fff`;
                        }}
                    />
                </div>
                <div>
                    <p className="text-xs text-text-secondary">Bienvenido de nuevo</p>
                    <h2 className="text-lg font-bold text-text-primary capitalize">{userName || 'Usuario'}</h2>
                </div>
            </div>
            <button
                onClick={onNotificationClick}
                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface-highlight transition-colors hover:bg-surface"
            >
                <Bell className="h-5 w-5 text-text-primary" />
                {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-surface-highlight" />
                )}
            </button>
        </header>
    );
};

export { Header };
