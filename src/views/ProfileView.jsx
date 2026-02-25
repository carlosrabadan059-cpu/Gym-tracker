import React, { useState, useEffect } from 'react';
import { User, Settings, Bell, Shield, CircleHelp, LogOut, ChevronRight, Scale, Ruler, Calendar, Sparkles } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { EditProfileView } from './profile/EditProfileView';
import { NotificationSettingsView } from './profile/NotificationSettingsView';
import { PrivacyView } from './profile/PrivacyView';
import { SettingsView } from './profile/SettingsView';
import { HelpView } from './profile/HelpView';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export function ProfileView() {
    const [currentView, setCurrentView] = useState('main');
    const { user: authUser, profile, refreshProfile, signOut } = useAuth();
    const [loading, setLoading] = useState(false);

    const user = profile ? {
        id: authUser.id,
        name: profile.username || authUser.email.split('@')[0],
        email: authUser.email,
        avatar: profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username || authUser.email.split('@')[0]}&background=random&color=fff`,
        stats: {
            weight: profile.weight || '',
            height: profile.height || '',
            age: profile.age || ''
        },
        goal: profile.goal || ''
    } : null;

    const handleSaveProfile = async (updatedUser) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    username: updatedUser.name,
                    avatar_url: updatedUser.avatar,
                    weight: updatedUser.stats.weight || null,
                    height: updatedUser.stats.height || null,
                    age: updatedUser.stats.age || null,
                    goal: updatedUser.goal || null,
                    updated_at: new Date()
                })
                .eq('user_id', authUser.id);

            if (error) throw error;
            await refreshProfile();
            setCurrentView('main');
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Error al guardar el perfil');
        }
    };

    if (loading) return <div className="text-white text-center py-10">Cargando perfil...</div>;
    if (!user) return <div className="text-white text-center py-10">No se encontró el usuario</div>;

    const menuItems = [
        { icon: Bell, label: 'Notificaciones', badge: '2', view: 'notifications' },
        { icon: Shield, label: 'Privacidad y Seguridad', view: 'privacy' },
        { icon: Settings, label: 'Configuración General', view: 'settings' },
        { icon: CircleHelp, label: 'Ayuda y Soporte', view: 'help' },
    ];

    // Render Sub-views
    if (currentView === 'edit') return <EditProfileView user={user} onBack={() => setCurrentView('main')} onSave={handleSaveProfile} />;
    if (currentView === 'notifications') return <NotificationSettingsView onBack={() => setCurrentView('main')} />;
    if (currentView === 'privacy') return <PrivacyView onBack={() => setCurrentView('main')} />;
    if (currentView === 'settings') return <SettingsView onBack={() => setCurrentView('main')} />;
    if (currentView === 'help') return <HelpView onBack={() => setCurrentView('main')} />;

    return (
        <div className="pb-24 space-y-6 animate-fadeIn">
            {/* Header Profile */}
            <div className="flex flex-col items-center pt-8 pb-4">
                <div className="relative mb-4">
                    <div className="h-24 w-24 rounded-full p-1 bg-gradient-to-tr from-primary to-blue-500">
                        <img
                            src={user.avatar}
                            alt={user.name}
                            className="h-full w-full rounded-full object-cover border-4 border-background"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = `https://ui-avatars.com/api/?name=${user.name || 'User'}&background=random&color=fff`;
                            }}
                        />
                    </div>
                    <button className="absolute bottom-0 right-0 bg-surface-highlight p-2 rounded-full border border-surface text-primary">
                        <User size={16} />
                    </button>
                </div>
                <h2 className="text-2xl font-bold text-text-primary">{user.name}</h2>
                <p className="text-text-secondary">{user.email}</p>
                <button
                    onClick={() => setCurrentView('edit')}
                    className="mt-4 px-6 py-2 rounded-full bg-surface-highlight border border-transparent text-sm font-bold text-text-primary hover:bg-surface transition-colors"
                >
                    Editar Perfil
                </button>
            </div>

            {/* Goal Card */}
            <div className="px-2">
                <Card className="p-4 bg-surface flex items-center justify-between">
                    <div>
                        <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Objetivo Actual</h3>
                        <p className="text-lg font-bold text-text-primary">{user.goal || 'Sin definir'}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <Sparkles size={20} /> {/* Using Sparkles icon for Goal */}
                    </div>
                </Card>
            </div>

            {/* Physical Stats */}
            <div className="grid grid-cols-3 gap-3 px-2">
                <Card className="flex flex-col items-center justify-center p-4 bg-surface">
                    <Scale size={20} className="text-blue-400 mb-2" />
                    <span className="text-lg font-bold text-text-primary">{user.stats.weight ? `${user.stats.weight} kg` : '--'}</span>
                    <span className="text-xs text-text-secondary">Peso</span>
                </Card>
                <Card className="flex flex-col items-center justify-center p-4 bg-surface">
                    <Ruler size={20} className="text-purple-400 mb-2" />
                    <span className="text-lg font-bold text-text-primary">{user.stats.height ? `${user.stats.height} cm` : '--'}</span>
                    <span className="text-xs text-text-secondary">Altura</span>
                </Card>
                <Card className="flex flex-col items-center justify-center p-4 bg-surface">
                    <Calendar size={20} className="text-green-400 mb-2" />
                    <span className="text-lg font-bold text-text-primary">{user.stats.age ? `${user.stats.age} años` : '--'}</span>
                    <span className="text-xs text-text-secondary">Edad</span>
                </Card>
            </div>

            {/* Menu Options */}
            <div className="space-y-2">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider px-2 mb-2">Cuenta</h3>
                <div className="space-y-1">
                    {menuItems.map((item, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentView(item.view)}
                            className="w-full flex items-center justify-between p-4 bg-surface hover:bg-surface-highlight rounded-xl transition-colors group shadow-sm"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 rounded-lg bg-surface-highlight text-text-secondary group-hover:text-primary transition-colors">
                                    <item.icon size={20} />
                                </div>
                                <span className="text-text-primary font-medium">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {item.badge && (
                                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                        {item.badge}
                                    </span>
                                )}
                                <ChevronRight size={18} className="text-text-secondary group-hover:text-text-primary" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Logout */}
            <button
                onClick={() => signOut()}
                className="w-full flex items-center gap-3 p-4 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors mt-8"
            >
                <LogOut size={20} />
                <span className="font-bold">Cerrar Sesión</span>
            </button>
        </div>
    );
}
