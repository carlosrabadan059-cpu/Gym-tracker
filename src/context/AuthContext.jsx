import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

// eslint-disable-next-line react-refresh/only-export-components -- hook y provider viven juntos por diseño (patrón estándar de Context); separarlo en dos ficheros solo por Fast Refresh no aporta nada aquí
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    // Usuario cuyo perfil ya está cargado (o cargándose). Supabase emite
    // eventos de sesión también para el MISMO usuario (renovación del token
    // cada hora, volver a la pestaña en Safari). Antes cada evento ponía el
    // perfil a null: el panel del entrenador se desmontaba y se volvía a
    // montar, y el editor de plantillas/rutinas perdía sin avisar lo que no
    // estaba guardado.
    const loadedUserIdRef = useRef(null);

    const fetchProfile = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (!error && data) {
                setProfile(data);
                return;
            }

            console.warn('Perfil no encontrado para el usuario, cerrando sesión.');
            await supabase.auth.signOut();
        } catch (err) {
            console.error('Error fetching profile:', err);
            await supabase.auth.signOut();
        }
    };

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            const activeUser = session?.user ?? null;
            setUser(activeUser);
            if (activeUser) {
                loadedUserIdRef.current = activeUser.id;
                fetchProfile(activeUser.id).finally(() => setLoading(false));
            } else {
                setLoading(false);
            }
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const activeUser = session?.user ?? null;
            if (!activeUser) {
                loadedUserIdRef.current = null;
                setUser(null);
                setProfile(null);
                setLoading(false);
                return;
            }
            if (activeUser.id === loadedUserIdRef.current) {
                // Mismo usuario: solo se ha renovado la sesión. Se actualiza
                // el objeto user (puede traer email/metadata nuevos) pero el
                // perfil no se toca, así la interfaz no se desmonta.
                setUser(activeUser);
                return;
            }
            loadedUserIdRef.current = activeUser.id;
            setUser(activeUser);
            setProfile(null); // Otro usuario: resetear antes de cargar el nuevo para no mostrar datos ajenos
            fetchProfile(activeUser.id).finally(() => setLoading(false));
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
        refreshProfile: () => user && fetchProfile(user.id),
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
