import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId, userEmail) => {
        try {
            // Búsqueda primaria por user_id
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (!error && data) {
                setProfile(data);
                return;
            }

            // Fallback: buscar por username (prefijo del email) y reparar el user_id
            if (userEmail) {
                const username = userEmail.split('@')[0];
                const { data: fallback } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('username', username)
                    .single();

                if (fallback) {
                    // Actualizar el user_id para que futuras sesiones funcionen directamente
                    await supabase
                        .from('profiles')
                        .update({ user_id: userId })
                        .eq('id', fallback.id);
                    setProfile({ ...fallback, user_id: userId });
                }
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        }
    };

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            const activeUser = session?.user ?? null;
            setUser(activeUser);
            if (activeUser) {
                fetchProfile(activeUser.id, activeUser.email).finally(() => setLoading(false));
            } else {
                setLoading(false);
            }
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const activeUser = session?.user ?? null;
            setUser(activeUser);
            if (activeUser) {
                fetchProfile(activeUser.id, activeUser.email).finally(() => setLoading(false));
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const value = {
        signUp: (data) => supabase.auth.signUp(data),
        signIn: (data) => supabase.auth.signInWithPassword(data),
        signOut: () => supabase.auth.signOut(),
        user,
        profile,
        // Helper to manually refresh profile if updated in ProfileView
        refreshProfile: () => user && fetchProfile(user.id, user.email),
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
