import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components -- hook y provider viven juntos por diseño (patrón estándar de Context)
export function useNotifications() {
    return useContext(NotificationsContext);
}

export function NotificationsProvider({ children }) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const unreadCount = notifications.filter(n => !n.read).length;

    const fetchNotifications = useCallback(async () => {
        if (!user) {
            setNotifications([]);
            return;
        }
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setNotifications(data);
        }
    }, [user]);

    useEffect(() => {
        // Sincroniza con la sesión de auth (carga inicial + reset a [] en
        // logout) y con Supabase Realtime — patrón sancionado por React de
        // "suscribirse a un store externo", no estado derivado.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchNotifications();

        if (!user) return;

        // Subscribe to real-time changes (channel name único por usuario)
        const channel = supabase.channel(`notifications:${user.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
                () => {
                    fetchNotifications();
                }
            )
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') {
                    console.error('Error en suscripción de notificaciones en tiempo real');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, fetchNotifications]);

    const markAsRead = async (id) => {
        await supabase.from('notifications').update({ read: true }).eq('id', id);
        fetchNotifications();
    };

    const markAllAsRead = async () => {
        if (!user) return;
        await supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
        fetchNotifications();
    };

    const deleteNotification = async (id) => {
        await supabase.from('notifications').delete().eq('id', id);
        fetchNotifications();
    };

    const value = {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification
    };

    return (
        <NotificationsContext.Provider value={value}>
            {children}
        </NotificationsContext.Provider>
    );
}
