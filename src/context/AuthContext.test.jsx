// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

// Supabase falso: guarda el callback de onAuthStateChange para disparar
// eventos de sesión a mano y cuenta las cargas del perfil.
let authCallback;
const profileLoads = [];
vi.mock('../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }),
            onAuthStateChange: (cb) => { authCallback = cb; return { data: { subscription: { unsubscribe() {} } } }; },
            signOut: () => Promise.resolve(),
        },
        from: () => ({
            select: () => ({
                eq: (_col, userId) => ({
                    single: () => { profileLoads.push(userId); return Promise.resolve({ data: { user_id: userId, role: 'trainer' }, error: null }); },
                }),
            }),
        }),
    },
}));

const { AuthProvider, useAuth } = await import('./AuthContext');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Cuenta cuántas veces se monta el contenido: si el perfil pasa por null,
// la app desmonta las vistas (lo que hacía perder el editor de plantillas).
let mounts = 0;
let seen = [];
function Probe() {
    const { profile } = useAuth();
    React.useEffect(() => { mounts += 1; }, []);
    seen.push(profile?.user_id ?? null);
    return profile ? <span>{profile.user_id}</span> : null;
}
let lastProfile;
function App() {
    const { profile } = useAuth();
    lastProfile = profile;
    return profile ? <Probe /> : null;
}

async function render() {
    const root = createRoot(document.createElement('div'));
    await act(async () => { root.render(<AuthProvider><App /></AuthProvider>); });
    return root;
}

describe('AuthProvider y eventos de sesión', () => {
    beforeEach(() => { mounts = 0; seen = []; profileLoads.length = 0; });

    it('renovar la sesión del mismo usuario no borra el perfil ni desmonta la interfaz', async () => {
        await render();
        expect(mounts).toBe(1);
        expect(profileLoads).toEqual(['u1']);

        seen = [];
        await act(async () => { authCallback('TOKEN_REFRESHED', { user: { id: 'u1' } }); });
        await act(async () => { authCallback('SIGNED_IN', { user: { id: 'u1' } }); });

        expect(seen).not.toContain(null);
        expect(mounts).toBe(1);
        expect(profileLoads).toEqual(['u1']);
    });

    it('otro usuario sí recarga el perfil', async () => {
        await render();
        await act(async () => { authCallback('SIGNED_IN', { user: { id: 'u2' } }); });
        expect(profileLoads).toEqual(['u1', 'u2']);
        expect(seen.at(-1)).toBe('u2');
    });

    it('cerrar sesión borra el perfil', async () => {
        await render();
        expect(lastProfile?.user_id).toBe('u1');
        await act(async () => { authCallback('SIGNED_OUT', null); });
        expect(lastProfile).toBeNull();
    });
});
