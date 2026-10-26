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

    // Sin conexión con Supabase al arrancar: la app ofrece reintentar en vez
    // de quedarse en "Cargando..." para siempre.
    const [offline, setOffline] = useState(false);
    // Cada intento de carga tiene su número; un intento que ya caducó por
    // tiempo no pisa el estado del siguiente.
    const attemptRef = useRef(0);

    const fetchProfile = async (userId) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (!error && data) {
            setProfile(data);
            return;
        }

        // PGRST116 = no existe la fila. Cualquier otro error (sin red,
        // Supabase inalcanzable) no es motivo para cerrar la sesión: antes se
        // cerraba y había que volver a entrar al recuperar la conexión.
        if (error?.code === 'PGRST116') {
            console.warn('Perfil no encontrado para el usuario, cerrando sesión.');
            await supabase.auth.signOut();
            return;
        }
        throw error ?? new Error('Perfil vacío');
    };

    const loadSession = () => {
        const attempt = ++attemptRef.current;
        setOffline(false);
        setLoading(true);

        const load = (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (attempt !== attemptRef.current) return;
            const activeUser = session?.user ?? null;
            setUser(activeUser);
            if (activeUser) {
                loadedUserIdRef.current = activeUser.id;
                await fetchProfile(activeUser.id);
            }
            if (attempt === attemptRef.current) setOffline(false);
        })();
        // Sin red, las llamadas a Supabase pueden no responder nunca (pasó el
        // 26-10 en el gimnasio con datos móviles): a los 10 s se deja de esperar.
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado')), 10_000));

        Promise.race([load, timeout])
            .catch(err => {
                if (attempt !== attemptRef.current) return;
                console.error('[Auth] Sin conexión con Supabase:', err);
                setOffline(true);
            })
            .finally(() => {
                if (attempt === attemptRef.current) setLoading(false);
            });
    };

    useEffect(() => {
        loadSession();

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
            fetchProfile(activeUser.id)
                .catch(err => {
                    console.error('[Auth] Sin conexión con Supabase:', err);
                    setOffline(true);
                })
                .finally(() => setLoading(false));
        });

        return () => subscription.unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
    }, []);

    const value = {
        signUp: (data) => supabase.auth.signUp(data),
        signIn: (data) => supabase.auth.signInWithPassword(data),
        signOut: () => supabase.auth.signOut(),
        user,
        profile,
        // Helper to manually refresh profile if updated in ProfileView
        refreshProfile: () => user && fetchProfile(user.id).catch(err => console.error('[Auth] No se pudo refrescar el perfil:', err)),
        loading,
        offline,
        // Recarga entera: el cliente de Supabase se queda esperando la
        // petición colgada del primer intento y un loadSession() nuevo también
        // se colgaría detrás de ella.
        retry: () => window.location.reload()
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
