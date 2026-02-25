import React, { createContext, useContext, useState, useEffect } from 'react';

const NotificationsContext = createContext();

export function useNotifications() {
    return useContext(NotificationsContext);
}

export function NotificationsProvider({ children }) {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // Load mock data on mount
    useEffect(() => {
        const mockData = [
            {
                id: 1,
                title: '¡Hora de entrenar!',
                message: 'No has registrado actividad en 2 días. ¿Qué tal un poco de cardio hoy?',
                time: 'Hace 2 horas',
                read: false,
                type: 'reminder'
            },
            {
                id: 2,
                title: 'Nuevo récord personal',
                message: '¡Felicidades! Has superado tu marca en Press de Banca.',
                time: 'Ayer',
                read: false,
                type: 'achievement'
            },
            {
                id: 3,
                title: 'Bienvenido a Gym Tracker',
                message: 'Gracias por unirte. Configura tu perfil para empezar.',
                time: 'Hace 1 semana',
                read: true,
                type: 'info'
            }
        ];
        setNotifications(mockData);
    }, []);

    // Update badge count whenever notifications change
    useEffect(() => {
        if (!notifications) return;
        const count = notifications.filter(n => !n.read).length;
        setUnreadCount(count);
    }, [notifications]);

    const markAsRead = (id) => {
        setNotifications(prev => prev.map(n =>
            n.id === id ? { ...n, read: true } : n
        ));
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const deleteNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
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
