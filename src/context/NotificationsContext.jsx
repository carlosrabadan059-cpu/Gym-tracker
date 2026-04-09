import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext();

export function useNotifications() {
    return useContext(NotificationsContext);
}

export function NotificationsProvider({ children }) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = async () => {
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
    };

    useEffect(() => {
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
    }, [user]);

    // Update badge count whenever notifications change
    useEffect(() => {
        if (!notifications) return;
        const count = notifications.filter(n => !n.read).length;
        setUnreadCount(count);
    }, [notifications]);

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
