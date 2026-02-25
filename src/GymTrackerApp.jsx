import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { SetupView } from './views/SetupView';
import { DashboardView } from './views/DashboardView';
import { TrainingView, ProgressView } from './views/OtherViews';
import { ChatView } from './views/ChatView';
import { ProfileView } from './views/ProfileView';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Dumbbell } from 'lucide-react';
import { NotificationsListView } from './views/NotificationsListView';
import { loadCompletedRoutines, saveCompletedRoutines } from './lib/utils';
import { supabase } from './lib/supabase';

// Login Component (Internal for now, to keep everything in one file if possible or extract)
const LoginView = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const { signIn, signUp } = useAuth();
    const [error, setError] = useState(null);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (isSignUp) {
                const { error } = await signUp({
                    email,
                    password,
                    options: {
                        data: {
                            username: email.split('@')[0], // Default username
                        }
                    }
                });
                if (error) throw error;
                // alert('Registro exitoso! Por favor inicia sesión.'); // Commented out for automated testing flow
                console.log('Registro exitoso');
                setError('Registro exitoso! Revisa tu email si es necesario o inicia sesión.');
                setIsSignUp(false);
            } else {
                const { error } = await signIn({ email, password });
                if (error) throw error;
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-background px-6 text-center">
            <div className="mb-8 p-4 bg-primary/10 rounded-full">
                <Dumbbell className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2">Gym Tracker</h1>
            <p className="text-gray-400 mb-8">Entrena inteligente, vive mejor.</p>

            <form onSubmit={handleAuth} className="w-full max-w-sm space-y-4">
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-card border border-white/10 rounded-xl px-4 py-3 text-black placeholder:text-gray-500 focus:outline-none focus:border-primary transition-colors"
                />
                <input
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-card border border-white/10 rounded-xl px-4 py-3 text-black placeholder:text-gray-500 focus:outline-none focus:border-primary transition-colors"
                />

                {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-black font-bold py-3 rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50"
                >
                    {loading ? 'Cargando...' : (isSignUp ? 'Registrarse' : 'Iniciar Sesión')}
                </button>
            </form>

            <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="mt-6 text-sm text-gray-400 hover:text-white transition-colors"
            >
                {isSignUp ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate'}
            </button>
        </div>
    );
};

const AuthenticatedApp = () => {
    const [view, setView] = useState('setup'); // setup, dashboard, training, progress, chat, profile
    const { user, loading } = useAuth();
    const [currentWorkout, setCurrentWorkout] = useState(null);
    const [profile, setProfile] = useState(null);
    const [completedRoutines, setCompletedRoutines] = useState(loadCompletedRoutines());

    useEffect(() => {
        // Load user profile
        if (user) {
            supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .single()
                .then(({ data }) => setProfile(data));
        }
    }, [user]);

    const handleStartSetup = () => {
        setView('dashboard');
    };

    const handleNavigate = (newView) => {
        setView(newView);
    };

    const handleStartWorkout = (workout) => {
        setCurrentWorkout(workout);
        setView('training');
    };

    if (loading) return <div className="h-screen w-screen bg-background flex items-center justify-center text-primary">Cargando...</div>;
    if (!user) return <LoginView />;

    // Render Logic
    if (view === 'setup') {
        return <SetupView onStart={handleStartSetup} />;
    }

    return (
        <div className="flex h-screen w-screen flex-col bg-background text-text-primary font-sans antialiased overflow-hidden">




            {/* Header only shows on main dashboard views */}
            {['dashboard', 'progress', 'chat'].includes(view) && (
                <Header
                    userName={profile?.username || user.email.split('@')[0]}
                    userAvatar={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.username || user.email.split('@')[0]}&background=random&color=fff`}
                    onNotificationClick={() => setView('notifications')}
                />
            )}

            <main className="flex-1 overflow-y-auto px-4 pb-32 pt-2 scrollbar-hide">
                {view === 'dashboard' && (
                    <DashboardView
                        onStartDaily={(routine) => handleStartWorkout(routine || { id: 'day1' })}
                        onSeeAll={() => console.log('Ver todos los entrenamientos')}
                        completedRoutines={completedRoutines}
                    />
                )}
                {view === 'training' && (
                    <TrainingView
                        workout={currentWorkout}
                        onFinish={() => {
                            if (currentWorkout) {
                                setCompletedRoutines(prev => {
                                    const newRoutines = [...new Set([...prev, currentWorkout.id])];
                                    saveCompletedRoutines(newRoutines);
                                    return newRoutines;
                                });
                            }
                            setView('dashboard');
                        }}
                    />
                )}
                {view === 'progress' && <ProgressView />}
                {view === 'chat' && <ChatView />}
                {view === 'profile' && <ProfileView />}
                {view === 'notifications' && <NotificationsListView onClose={() => setView('dashboard')} />}
            </main>

            {/* Bottom Navigation */}
            {view !== 'setup' && (
                <BottomNavigation currentView={view} onViewChange={handleNavigate} />
            )}
        </div>
    );
};

import { ThemeProvider } from './context/ThemeContext';
import { NotificationsProvider } from './context/NotificationsContext';

export default function GymTrackerApp() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <NotificationsProvider>
                    <AuthenticatedApp />
                </NotificationsProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
