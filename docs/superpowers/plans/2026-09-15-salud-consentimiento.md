# Salud del cliente con consentimiento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gatear detrás de un consentimiento revocable del cliente los dos
datos de salud que el entrenador ya ve hoy sin permiso (peso corporal en
`ClientProfileView.jsx`, kcal reales de sesión en `WorkoutDetailPanel.jsx`).

**Architecture:** Dos columnas nuevas en `trainer_clients`
(`health_consent`, `health_consent_updated_at`) más una función RPC
`security definer` (`set_health_consent`) para que el cliente solo pueda
tocar esas dos columnas de su propia fila — nunca un `update` RLS abierto
que le dejara reasignarse a otro entrenador. El cliente responde desde un
banner en el Dashboard (al vincularse) o un toggle en `PrivacyView.jsx`
(en cualquier momento). El entrenador lee el estado y oculta los datos si
no es `'granted'`.

**Nota de alcance (no cambia el plan, solo lo hace más preciso):** existe
ya una tabla `health_metrics` (steps/weight/active_energy/resting_hr,
migración `20260907_create_health_metrics.sql`, v2 Fase 0) pero **ningún
código en `src/` la usa** — la app lee FC en reposo y pasos en vivo de
HealthKit (`src/lib/appleHealth.js`), nunca los persiste. Sincronizar esos
dos datos para el entrenador seguiría necesitando código nativo nuevo
(escribir a esa tabla desde Capacitor) y una policy de lectura para el
entrenador que hoy no existe — sigue fuera de alcance de este plan, tal
como se decidió en el spec.

**Tech Stack:** React 19, Supabase (Postgres + RLS + RPC), Vitest.

---

## Task 1: Migración — columnas de consentimiento + RPC

**Files:**
- Create: `supabase/migrations/20260915_add_health_consent_to_trainer_clients.sql`

**Context:** `trainer_clients` ya es una fila por cliente
(`unique (trainer_id, client_id)` más `unique (client_id)` de una
migración posterior — ver `20260908_create_trainer_clients_and_fix_profiles_rls.sql`).
Ya existen las policies `"Clients can view their trainer link"` (select,
`client_id = auth.uid()`) y `"Trainers can view own clients"` (select,
`trainer_id = auth.uid()`) — el entrenador y el cliente YA pueden leer
`health_consent` en cuanto exista la columna, no hace falta ninguna
policy de select nueva.

Para escribir, en vez de una policy de `update` abierta sobre
`client_id = auth.uid()` (que dejaría a un cliente reescribir también
`trainer_id`, reasignándose a otro entrenador sin pasar por el flujo
normal), se usa una función `security definer` que solo puede tocar esas
dos columnas — mismo patrón de seguridad que `search_addable_clients` en
`20260908_create_trainer_clients_and_fix_profiles_rls.sql`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Consentimiento del cliente para compartir datos de salud (peso
-- corporal, kcal reales de sesión) con su entrenador. Ver
-- docs/superpowers/specs/2026-09-15-salud-consentimiento-design.md.
alter table public.trainer_clients
    add column health_consent text not null default 'pending'
        check (health_consent in ('pending', 'granted', 'denied')),
    add column health_consent_updated_at timestamptz;

-- Único camino de escritura: el cliente no tiene un UPDATE de RLS directo
-- sobre trainer_clients (le dejaría tocar también trainer_id/client_id).
-- Esta función solo puede cambiar health_consent de LA PROPIA fila del
-- que llama.
create or replace function public.set_health_consent(new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if new_status not in ('granted', 'denied') then
        raise exception 'invalid health_consent status: %', new_status;
    end if;

    update public.trainer_clients
    set health_consent = new_status,
        health_consent_updated_at = now()
    where client_id = auth.uid();
end;
$$;

grant execute on function public.set_health_consent(text) to authenticated;
```

- [ ] **Step 2: Aplicar la migración**

Usa el MCP de Supabase (`mcp__supabase__apply_migration`, proyecto
`jqpyqqlkgisykgywilrf`) con el nombre `add_health_consent_to_trainer_clients`
y el SQL de arriba. Confirma con `mcp__supabase__list_tables` que
`trainer_clients` tiene las dos columnas nuevas, y con una query de prueba
(`select set_health_consent('granted')` ejecutada como el propio usuario
de prueba, o revisando `get_advisors` después) que la función existe y no
dispara warnings de seguridad nuevos.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260915_add_health_consent_to_trainer_clients.sql
git commit -m "feat(salud-consentimiento): columnas y RPC de consentimiento en trainer_clients"
```

---

## Task 2: `src/lib/healthConsent.js` — funciones puras

**Files:**
- Create: `src/lib/healthConsent.js`
- Create: `src/lib/healthConsent.test.js`

- [ ] **Step 1: Escribir los tests (deben fallar)**

```js
import { describe, it, expect } from 'vitest';
import { canShowHealthData, getHealthConsentBannerCopy, buildHealthConsentRequestPayload } from './healthConsent';

describe('canShowHealthData', () => {
    it('solo es true cuando el consentimiento está concedido', () => {
        expect(canShowHealthData('granted')).toBe(true);
    });

    it('es false para pending, denied, null o undefined', () => {
        expect(canShowHealthData('pending')).toBe(false);
        expect(canShowHealthData('denied')).toBe(false);
        expect(canShowHealthData(null)).toBe(false);
        expect(canShowHealthData(undefined)).toBe(false);
    });
});

describe('getHealthConsentBannerCopy', () => {
    it('devuelve null si ya se respondió (granted o denied)', () => {
        expect(getHealthConsentBannerCopy('granted', 'Ana')).toBeNull();
        expect(getHealthConsentBannerCopy('denied', 'Ana')).toBeNull();
    });

    it('devuelve null sin trainerName aunque esté pending (no hay a quién nombrar)', () => {
        expect(getHealthConsentBannerCopy('pending', null)).toBeNull();
        expect(getHealthConsentBannerCopy('pending', '')).toBeNull();
    });

    it('devuelve title y body con el nombre del entrenador cuando está pending', () => {
        const copy = getHealthConsentBannerCopy('pending', 'Ana');
        expect(copy.title).toBe('Compartir datos de salud');
        expect(copy.body).toContain('Ana');
    });
});

describe('buildHealthConsentRequestPayload', () => {
    it('arma la fila de notifications para el cliente recién vinculado', () => {
        const payload = buildHealthConsentRequestPayload({ recipientId: 'client-1', trainerName: 'Ana' });
        expect(payload).toEqual({
            user_id: 'client-1',
            title: 'Tu entrenador quiere ver tus datos de salud',
            message: 'Ana te ha añadido como cliente y le gustaría ver tu peso corporal y las calorías reales de tus sesiones. Puedes decidirlo desde tu Perfil > Privacidad y Seguridad.',
            type: 'health_consent_request',
        });
    });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `TZ=UTC npx vitest run src/lib/healthConsent.test.js`
Expected: FAIL — el módulo `./healthConsent` no existe.

- [ ] **Step 3: Implementación**

```js
// Consentimiento del cliente para compartir peso corporal y kcal reales de
// sesión con su entrenador (Fase 5 del plan de entrenador). Funciones
// puras — igual que healthConsent no depende de Supabase directamente,
// los componentes que sí tocan la tabla (DashboardView, PrivacyView,
// ClientsListView) las usan para decidir qué mostrar/enviar.

/**
 * @param {'pending'|'granted'|'denied'|null|undefined} healthConsent
 * @returns {boolean}
 */
export function canShowHealthData(healthConsent) {
    return healthConsent === 'granted';
}

/**
 * Copy del banner que ve el CLIENTE mientras no ha respondido. `null` si
 * ya respondió (nada que mostrar) o si no hay nombre de entrenador que
 * mostrar (fila sin cargar todavía).
 *
 * @param {'pending'|'granted'|'denied'|null|undefined} healthConsent
 * @param {string|null|undefined} trainerName
 * @returns {{title: string, body: string} | null}
 */
export function getHealthConsentBannerCopy(healthConsent, trainerName) {
    if (healthConsent !== 'pending' || !trainerName) return null;
    return {
        title: 'Compartir datos de salud',
        body: `${trainerName} quiere ver tu peso corporal y las calorías reales de tus sesiones. Puedes cambiarlo cuando quieras desde Privacidad y Seguridad.`,
    };
}

/**
 * Fila de `notifications` que se inserta cuando un entrenador vincula a un
 * cliente nuevo (mismo patrón que buildCommentNotificationPayload en
 * exerciseComments.js).
 *
 * @param {{recipientId: string, trainerName: string}} params
 */
export function buildHealthConsentRequestPayload({ recipientId, trainerName }) {
    return {
        user_id: recipientId,
        title: 'Tu entrenador quiere ver tus datos de salud',
        message: `${trainerName} te ha añadido como cliente y le gustaría ver tu peso corporal y las calorías reales de tus sesiones. Puedes decidirlo desde tu Perfil > Privacidad y Seguridad.`,
        type: 'health_consent_request',
    };
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `TZ=UTC npx vitest run src/lib/healthConsent.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/healthConsent.js src/lib/healthConsent.test.js
git commit -m "feat(salud-consentimiento): funciones puras de copy y payload"
```

---

## Task 3: Notificación al vincular cliente

**File:** `src/views/trainer/ClientsListView.jsx`

- [ ] **Step 1: Importar `buildHealthConsentRequestPayload` y leer `profile`**

Find:
```js
import { computeDaysSinceLastSession, INACTIVITY_ALERT_DAYS } from '../../lib/adherence';

export function ClientsListView({ onBack, onSelectClient, embedded = false, selectedId = null }) {
    const { user } = useAuth();
```

Replace with:
```js
import { computeDaysSinceLastSession, INACTIVITY_ALERT_DAYS } from '../../lib/adherence';
import { buildHealthConsentRequestPayload } from '../../lib/healthConsent';

export function ClientsListView({ onBack, onSelectClient, embedded = false, selectedId = null }) {
    const { user, profile } = useAuth();
```

- [ ] **Step 2: Pasar el nombre del entrenador al modal**

Find:
```js
            {showAddModal && (
                <AddClientModal
                    trainerId={user.id}
                    onClose={() => setShowAddModal(false)}
                    onAdded={() => { setShowAddModal(false); fetchClients(); }}
                />
            )}
```

Replace with:
```js
            {showAddModal && (
                <AddClientModal
                    trainerId={user.id}
                    trainerName={profile?.fullName || profile?.username || 'Tu entrenador'}
                    onClose={() => setShowAddModal(false)}
                    onAdded={() => { setShowAddModal(false); fetchClients(); }}
                />
            )}
```

- [ ] **Step 3: Insertar la notificación tras vincular**

Find:
```js
function AddClientModal({ trainerId, onClose, onAdded }) {
```

Replace with:
```js
function AddClientModal({ trainerId, trainerName, onClose, onAdded }) {
```

Find:
```js
    const addClient = async (clientId) => {
        setAddingId(clientId);
        try {
            const { error } = await supabase
                .from('trainer_clients')
                .insert({ trainer_id: trainerId, client_id: clientId });
            if (error) throw error;
            onAdded();
        } catch (err) {
```

Replace with:
```js
    const addClient = async (clientId) => {
        setAddingId(clientId);
        try {
            const { error } = await supabase
                .from('trainer_clients')
                .insert({ trainer_id: trainerId, client_id: clientId });
            if (error) throw error;

            // Best-effort: si la notificación falla, el cliente ya quedó
            // vinculado igualmente — podrá conceder el permiso desde
            // Privacidad y Seguridad aunque no le llegue el aviso.
            const { error: notifError } = await supabase
                .from('notifications')
                .insert(buildHealthConsentRequestPayload({ recipientId: clientId, trainerName }));
            if (notifError) console.error('Error creando notificación de consentimiento de salud:', notifError);

            onAdded();
        } catch (err) {
```

- [ ] **Step 4: Tests y lint**

Run: `TZ=UTC npm test` — debe seguir en verde (este archivo no tiene test
dedicado, mismo criterio que el resto de componentes de fetch/UI del
proyecto).
Run: `npx eslint src/views/trainer/ClientsListView.jsx` — sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/views/trainer/ClientsListView.jsx
git commit -m "feat(salud-consentimiento): notificar al cliente al vincularlo"
```

---

## Task 4: Banner del cliente en el Dashboard

**File:** `src/views/DashboardView.jsx`

**Context:** El cliente puede no tener entrenador todavía — la query debe
usar `.maybeSingle()` y no mostrar nada si no hay fila. Solo importa el
`trainer_id` y `health_consent` de `trainer_clients`; el nombre del
entrenador exige una segunda consulta a `profiles` (mismo patrón de "dos
queries sin embed automático" que ya usa `ClientsListView.jsx`, porque
`trainer_clients.trainer_id` referencia `auth.users`, no `profiles`).

- [ ] **Step 1: Import y estado nuevo**

Find:
```js
import { useAuth } from '../context/AuthContext';
import { RetroactiveWorkoutModal } from './RetroactiveWorkoutModal';
import { isHealthAvailableOnThisPlatform, getMostRecentWorkout, mapWorkoutToCardioType, getTodayMetrics } from '../lib/appleHealth';
```

Replace with:
```js
import { useAuth } from '../context/AuthContext';
import { RetroactiveWorkoutModal } from './RetroactiveWorkoutModal';
import { isHealthAvailableOnThisPlatform, getMostRecentWorkout, mapWorkoutToCardioType, getTodayMetrics } from '../lib/appleHealth';
import { getHealthConsentBannerCopy } from '../lib/healthConsent';
```

Find:
```js
    const [showCardioSelector, setShowCardioSelector] = useState(false);
    const [pendingRoutine, setPendingRoutine] = useState(null);
    const [detectedCardio, setDetectedCardio] = useState(null);
```

Replace with:
```js
    const [showCardioSelector, setShowCardioSelector] = useState(false);
    const [pendingRoutine, setPendingRoutine] = useState(null);
    const [detectedCardio, setDetectedCardio] = useState(null);
    const [healthConsentStatus, setHealthConsentStatus] = useState(null);
    const [healthConsentTrainerName, setHealthConsentTrainerName] = useState(null);
    const [respondingConsent, setRespondingConsent] = useState(false);
```

- [ ] **Step 2: Efecto que carga el estado de consentimiento**

Find:
```js
    // v2 Fase 2 — al abrir el selector, mira si hay un workout de cardio
```

Replace with:
```js
    // Fase 5 (parte 1) — banner de consentimiento de salud. Solo aplica si
    // el cliente tiene entrenador (maybeSingle: puede no tener fila
    // todavía) y solo se muestra mientras sigue 'pending' — una vez
    // respondido, desaparece hasta que la app se recargue.
    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;
        (async () => {
            const { data: link, error } = await supabase
                .from('trainer_clients')
                .select('trainer_id, health_consent')
                .eq('client_id', user.id)
                .maybeSingle();
            if (cancelled || error || !link || link.health_consent !== 'pending') return;

            const { data: trainerProfile } = await supabase
                .from('profiles')
                .select('fullName, username')
                .eq('user_id', link.trainer_id)
                .maybeSingle();
            if (cancelled) return;

            setHealthConsentStatus(link.health_consent);
            setHealthConsentTrainerName(trainerProfile?.fullName || trainerProfile?.username || null);
        })();
        return () => { cancelled = true; };
    }, [user?.id]);

    const respondHealthConsent = async (status) => {
        setRespondingConsent(true);
        try {
            const { error } = await supabase.rpc('set_health_consent', { new_status: status });
            if (error) throw error;
            setHealthConsentStatus(status);
        } catch (err) {
            console.error('Error respondiendo al consentimiento de salud:', err);
        } finally {
            setRespondingConsent(false);
        }
    };

    // v2 Fase 2 — al abrir el selector, mira si hay un workout de cardio
```

- [ ] **Step 3: Render del banner**

Find:
```js
            {healthSummary && (
                <div className="bg-surface rounded-2xl p-4 border border-surface-highlight">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-text-primary flex items-center gap-2">
                            <Activity size={16} className="text-primary" /> Salud de hoy
                        </h3>
```

Replace with:
```js
            {(() => {
                const bannerCopy = getHealthConsentBannerCopy(healthConsentStatus, healthConsentTrainerName);
                if (!bannerCopy) return null;
                return (
                    <div className="bg-surface rounded-2xl p-4 border border-primary/30 space-y-3">
                        <div>
                            <h3 className="font-semibold text-text-primary">{bannerCopy.title}</h3>
                            <p className="text-xs text-text-secondary mt-1">{bannerCopy.body}</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => respondHealthConsent('granted')}
                                disabled={respondingConsent}
                                className="flex-1 py-2 rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50"
                            >
                                Permitir
                            </button>
                            <button
                                onClick={() => respondHealthConsent('denied')}
                                disabled={respondingConsent}
                                className="flex-1 py-2 rounded-xl bg-surface-highlight text-text-primary font-bold text-sm disabled:opacity-50"
                            >
                                No permitir
                            </button>
                        </div>
                    </div>
                );
            })()}
            {healthSummary && (
                <div className="bg-surface rounded-2xl p-4 border border-surface-highlight">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-text-primary flex items-center gap-2">
                            <Activity size={16} className="text-primary" /> Salud de hoy
                        </h3>
```

- [ ] **Step 4: Tests y lint**

Run: `TZ=UTC npm test` — verde.
Run: `npx eslint src/views/DashboardView.jsx` — sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/views/DashboardView.jsx
git commit -m "feat(salud-consentimiento): banner de consentimiento en el Dashboard"
```

---

## Task 5: Toggle en Privacidad y Seguridad

**File:** `src/views/profile/PrivacyView.jsx`

**Context:** Vista sin estado ni datos reales hoy — los dos toggles
existentes (`Verificación en dos pasos`, `Perfil Público`) son puramente
decorativos (sin `onClick`, sin backend). No se tocan. El nuevo toggle es
el único funcional de la vista, y solo aparece si el cliente tiene
entrenador (si no hay fila en `trainer_clients`, no hay nada que
compartir ni con quién).

- [ ] **Step 1: Reescribir el fichero completo**

`PrivacyView.jsx` es pequeño (45 líneas) y cambia de función sin estado a
componente con datos — más claro reescribirlo entero que ir a parches:

```jsx
import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Eye, CheckCircle, HeartPulse } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export function PrivacyView({ onBack }) {
    const { user } = useAuth();
    const [healthConsent, setHealthConsent] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;
        supabase
            .from('trainer_clients')
            .select('health_consent')
            .eq('client_id', user.id)
            .maybeSingle()
            .then(({ data }) => {
                if (!cancelled) setHealthConsent(data?.health_consent ?? null);
            });
        return () => { cancelled = true; };
    }, [user?.id]);

    const toggleHealthConsent = async () => {
        const nextStatus = healthConsent === 'granted' ? 'denied' : 'granted';
        setSaving(true);
        try {
            const { error } = await supabase.rpc('set_health_consent', { new_status: nextStatus });
            if (error) throw error;
            setHealthConsent(nextStatus);
        } catch (err) {
            console.error('Error actualizando consentimiento de salud:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn pb-24">
            <header className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="text-text-secondary hover:text-black dark:hover:text-white">
                    ← Volver
                </button>
                <h2 className="text-xl font-bold text-black dark:text-white">Privacidad y Seguridad</h2>
            </header>

            <div className="space-y-4">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider px-2">Seguridad</h3>
                <Card className="p-1">
                    <button className="w-full flex items-center justify-between p-4 hover:bg-surface-highlight rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                            <CheckCircle size={20} className="text-green-400" />
                            <span className="text-text-primary font-medium">Verificación en dos pasos</span>
                        </div>
                        <span className="text-xs text-text-secondary">Activado</span>
                    </button>
                </Card>

                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider px-2 pt-4">Privacidad</h3>
                <Card className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Eye size={20} className="text-blue-400" />
                            <div>
                                <h4 className="font-medium text-text-primary">Perfil Público</h4>
                                <p className="text-xs text-text-secondary">Permitir que otros vean tus estadísticas</p>
                            </div>
                        </div>
                        <div className="w-12 h-6 bg-surface-highlight rounded-full p-1 relative">
                            <div className="w-4 h-4 bg-text-secondary rounded-full" />
                        </div>
                    </div>

                    {healthConsent !== null && (
                        <div className="flex items-center justify-between pt-4 border-t border-surface-highlight">
                            <div className="flex items-center gap-3">
                                <HeartPulse size={20} className="text-primary" />
                                <div>
                                    <h4 className="font-medium text-text-primary">Datos de salud con mi entrenador</h4>
                                    <p className="text-xs text-text-secondary">
                                        {healthConsent === 'pending'
                                            ? 'Aún no has respondido — actívalo aquí o desde el aviso del Dashboard.'
                                            : 'Comparte tu peso corporal y las calorías reales de tus sesiones.'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={toggleHealthConsent}
                                disabled={saving}
                                className={`w-12 h-6 rounded-full p-1 relative transition-colors disabled:opacity-50 ${healthConsent === 'granted' ? 'bg-primary' : 'bg-surface-highlight'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${healthConsent === 'granted' ? 'translate-x-6' : ''}`} />
                            </button>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Tests y lint**

Run: `TZ=UTC npm test` — verde.
Run: `npx eslint src/views/profile/PrivacyView.jsx` — sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/views/profile/PrivacyView.jsx
git commit -m "feat(salud-consentimiento): toggle revocable en Privacidad y Seguridad"
```

---

## Task 6: Ocultar peso corporal en `ClientProfileView.jsx`

**File:** `src/views/trainer/ClientProfileView.jsx`

- [ ] **Step 1: Imports**

Find:
```js
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { enrichExercisesWithCatalog, loadExerciseHistory } from '../../lib/utils';
import { deleteClientRoutineCopy, summarizeExerciseHistoryForAI, buildProgressionSuggestionPayload } from '../../lib/trainerUtils';
```

Replace with:
```js
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { enrichExercisesWithCatalog, loadExerciseHistory } from '../../lib/utils';
import { deleteClientRoutineCopy, summarizeExerciseHistoryForAI, buildProgressionSuggestionPayload } from '../../lib/trainerUtils';
import { canShowHealthData } from '../../lib/healthConsent';
```

- [ ] **Step 2: Estado y fetch del consentimiento**

Find:
```js
export function ClientProfileView({ client, onBack, onAssignRoutine, embedded = false }) {
    const [assignedRoutines, setAssignedRoutines] = useState([]);
```

Replace with:
```js
export function ClientProfileView({ client, onBack, onAssignRoutine, embedded = false }) {
    const { user } = useAuth();
    const [healthConsent, setHealthConsent] = useState(null);
    const [assignedRoutines, setAssignedRoutines] = useState([]);
```

Find:
```js
    useEffect(() => {
        isMountedForSuggestionRef.current = true;
        return () => { isMountedForSuggestionRef.current = false; };
    }, []);
```

Replace with:
```js
    useEffect(() => {
        isMountedForSuggestionRef.current = true;
        return () => { isMountedForSuggestionRef.current = false; };
    }, []);

    // Fase 5 (parte 1): peso corporal y kcal reales (WorkoutDetailPanel)
    // solo se muestran si el cliente dio su consentimiento explícito.
    useEffect(() => {
        if (!client?.user_id || !user?.id) return;
        let cancelled = false;
        supabase
            .from('trainer_clients')
            .select('health_consent')
            .eq('trainer_id', user.id)
            .eq('client_id', client.user_id)
            .maybeSingle()
            .then(({ data }) => {
                if (!cancelled) setHealthConsent(data?.health_consent ?? null);
            });
        return () => { cancelled = true; };
    }, [client?.user_id, user?.id]);

    const showHealthData = canShowHealthData(healthConsent);
```

- [ ] **Step 3: Gatear el peso mostrado**

Find:
```js
                            <h2 className="text-xl font-bold text-text-primary">{client.fullName || client.username}</h2>
                            <p className="text-xs text-text-secondary">{client.weight ? `${client.weight} kg` : 'Sin peso registrado'}</p>
```

Replace with:
```js
                            <h2 className="text-xl font-bold text-text-primary">{client.fullName || client.username}</h2>
                            <p className="text-xs text-text-secondary">
                                {showHealthData
                                    ? (client.weight ? `${client.weight} kg` : 'Sin peso registrado')
                                    : 'Sin compartir'}
                            </p>
```

- [ ] **Step 4: Pasar el permiso a `WorkoutDetailPanel`**

Find:
```js
            {selectedHistoryEntry && (
                <WorkoutDetailPanel
                    entry={selectedHistoryEntry}
                    onClose={() => setSelectedHistoryEntry(null)}
                />
            )}
```

Replace with:
```js
            {selectedHistoryEntry && (
                <WorkoutDetailPanel
                    entry={selectedHistoryEntry}
                    onClose={() => setSelectedHistoryEntry(null)}
                    showHealthData={showHealthData}
                />
            )}
```

- [ ] **Step 5: Tests y lint**

Run: `TZ=UTC npm test` — verde.
Run: `npx eslint src/views/trainer/ClientProfileView.jsx` — sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/views/trainer/ClientProfileView.jsx
git commit -m "feat(salud-consentimiento): ocultar peso corporal sin consentimiento"
```

---

## Task 7: Ocultar kcal reales en `WorkoutDetailPanel.jsx`

**File:** `src/views/trainer/WorkoutDetailPanel.jsx`

- [ ] **Step 1: Aceptar el nuevo prop**

Find:
```js
export function WorkoutDetailPanel({ entry, onClose }) {
```

Replace with:
```js
export function WorkoutDetailPanel({ entry, onClose, showHealthData = false }) {
```

- [ ] **Step 2: Gatear el bloque de calorías**

Find:
```js
                {duration?.realCalories > 0 && (
                    <div className="bg-primary/10 rounded-2xl p-4 border border-primary/20 flex items-center justify-between">
                        <span className="text-sm font-semibold text-text-primary">Calorías estimadas</span>
                        <span className="text-lg font-black text-primary">{Math.round(duration.realCalories)} kcal</span>
                    </div>
                )}
```

Replace with:
```js
                {showHealthData && duration?.realCalories > 0 && (
                    <div className="bg-primary/10 rounded-2xl p-4 border border-primary/20 flex items-center justify-between">
                        <span className="text-sm font-semibold text-text-primary">Calorías estimadas</span>
                        <span className="text-lg font-black text-primary">{Math.round(duration.realCalories)} kcal</span>
                    </div>
                )}
```

- [ ] **Step 3: Tests y lint**

Run: `TZ=UTC npm test` — verde.
Run: `npx eslint src/views/trainer/WorkoutDetailPanel.jsx` — sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/views/trainer/WorkoutDetailPanel.jsx
git commit -m "feat(salud-consentimiento): ocultar kcal reales sin consentimiento"
```

---

## Task 8: Verificación completa

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Suite completa**

Run: `TZ=UTC npm test`
Expected: todos los test files en verde, incluidos los 7 nuevos de
`healthConsent.test.js`.

- [ ] **Step 2: Lint completo**

Run: `npx eslint .`
Expected: sin salida (repo limpio, ver commit `chore(lint)` previo — no
introducir regresiones).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build OK. Luego `git checkout -- public/version.json` (el build
le escribe un timestamp, no debe quedar en el diff).

- [ ] **Step 4: Verificación en navegador (skill `run-rutinex`)**

Usa la cuenta de prueba del entrenador (`admin@gymtracker.com`) y, si hace
falta un cliente de prueba con `health_consent = 'pending'` para ver el
banner y el toggle en los tres estados, créalo o reutiliza uno de los dos
clientes sin entrenador que ya existían antes de la Fase 0 (ver
`docs/plan-trainer-improvements.md`, backfill de `trainer_clients`) —
**nunca cambiar `health_consent` de la fila de Carlos** salvo que él mismo
lo pida, es su cuenta real.

Confirmar con capturas:
1. Al vincular un cliente de prueba nuevo, le llega la notificación
   (`type: 'health_consent_request'`).
2. Ese cliente ve el banner en el Dashboard con el nombre real del
   entrenador; "Permitir" lo hace desaparecer y el entrenador pasa a ver
   el peso.
3. "No permitir" también hace desaparecer el banner; el entrenador sigue
   viendo "Sin compartir".
4. El toggle de `PrivacyView.jsx` refleja el estado y permite cambiarlo
   después en cualquier dirección.
5. Sin errores de consola nuevos en ninguno de los tres.

- [ ] **Step 5: Limpieza**

```bash
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill
git status
```

Expected: working tree limpio (todo ya commiteado en las tareas
anteriores).

---

## Notes for the reviewer

- Carlos ya está vinculado con su entrenador de prueba desde antes de esta
  feature — tras la migración, su fila queda en `health_consent =
  'pending'` (default), así que verá el banner la próxima vez que abra la
  app real. Es la decisión tomada en el spec (tratarlo igual que una
  vinculación nueva), no un efecto secundario a corregir.
- El RPC `set_health_consent` es intencionadamente la única vía de
  escritura — no añadir una policy de `UPDATE` directa sobre
  `trainer_clients` para "simplificar", dejaría a un cliente reasignar su
  propio `trainer_id`.
- FC en reposo y pasos quedan fuera, tal como decidió el usuario en el
  brainstorming — no confundir con la tabla `health_metrics` ya existente
  (no usada por ningún código de `src/`), que serviría de destino si algún
  día se construye esa sincronización, pero no la construye este plan.
